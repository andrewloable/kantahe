// Package catalog answers the read-only questions about the library: search,
// browse, artists, single songs and lyrics.
package catalog

import (
	"container/list"
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"unicode"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/song/kar"
	"github.com/andrewloable/kantahe/server/internal/song/karmp3"
	"github.com/andrewloable/kantahe/server/internal/song/lyrics"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// Errors returned for bad requests.
var (
	ErrInvalid  = errors.New("catalog: invalid request")
	ErrNoLyrics = errors.New("catalog: the song has no lyrics")
)

const (
	defaultPage   = 50
	maxPage       = 200
	maxTokens     = 8
	maxTokenRunes = 64
	maxOffset     = 10_000_000
	lyricsCache   = 256
)

// Sort is the order of search and browse results.
type Sort int

// Result orders. SortRelevance is the best match for a text query and the
// number order otherwise.
const (
	SortRelevance Sort = iota
	SortNumber
	SortTitle
	SortArtist
)

// SearchParams describe one search or browse request.
type SearchParams struct {
	Query  string
	Format library.Format // 0 for any
	Sort   Sort
	Letter string // "A".."Z" or "#", "" for any
	Offset int
	Limit  int // page size; 0 means 50, at most 200
}

// Artist is a displayed artist with the number of visible songs.
type Artist struct {
	Name      string
	SongCount int
}

// Catalog reads the library.
type Catalog struct {
	db    *store.DB
	cache *lru
}

// New builds a Catalog on the application database.
func New(db *store.DB) *Catalog { return &Catalog{db: db, cache: newLRU(lyricsCache)} }

// visible limits every query to songs users may see: finished, not failed, not deleted.
const visible = `s.deleted = 0 AND s.failed = 0 AND s.metadata_done = 1`

const songColumns = `s.number, s.format, s.songbook_number, s.duration_ms, s.failed <> 0, s.display_title, s.display_artist`

func scanSong(row interface{ Scan(...any) error }) (library.SongInfo, error) {
	var s library.SongInfo
	var format int
	err := row.Scan(&s.Number, &format, &s.Songbook, &s.DurationMs, &s.Failed, &s.Title, &s.Artist)
	s.Format = library.Format(format)
	return s, err
}

func normLetter(l string) (string, error) {
	l = strings.ToUpper(strings.TrimSpace(l))
	if l == "" {
		return "", nil
	}
	if l == "#" || (len(l) == 1 && l[0] >= 'A' && l[0] <= 'Z') {
		return l, nil
	}
	return "", fmt.Errorf("%w: letter must be A-Z or #", ErrInvalid)
}

func clampLimit(n int) int {
	switch {
	case n <= 0:
		return defaultPage
	case n > maxPage:
		return maxPage
	}
	return n
}

// ftsQuery turns free text into a safe FTS5 expression: every run of letters or
// digits becomes a quoted token, the last one a prefix. Everything else
// (operators, quotes, parentheses, colons) is dropped. ok is false when no token is left.
func ftsQuery(q string) (expr string, ok bool) {
	var tokens []string
	var cur []rune
	flush := func() {
		if len(cur) > 0 && len(tokens) < maxTokens {
			if len(cur) > maxTokenRunes {
				cur = cur[:maxTokenRunes]
			}
			tokens = append(tokens, string(cur))
		}
		cur = cur[:0]
	}
	for _, r := range q {
		// combining marks belong to the letter before them (decomposed accents)
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsMark(r) {
			cur = append(cur, r)
		} else {
			flush()
		}
	}
	flush()
	if len(tokens) == 0 {
		return "", false
	}
	parts := make([]string, len(tokens))
	for i, t := range tokens {
		parts[i] = `"` + t + `"`
	}
	return strings.Join(parts, " ") + "*", true
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

// Search finds songs by number prefix (digits only) or full text, or browses
// them when the query is empty. It returns at most p.Limit songs and whether more follow.
func (c *Catalog) Search(ctx context.Context, p SearchParams) ([]library.SongInfo, bool, error) {
	letter, err := normLetter(p.Letter)
	if err != nil {
		return nil, false, err
	}
	if p.Offset < 0 || p.Offset > maxOffset {
		return nil, false, fmt.Errorf("%w: bad offset", ErrInvalid)
	}
	limit := clampLimit(p.Limit)
	q := strings.TrimSpace(p.Query)

	var (
		from, where string
		args        []any
		order       string
	)
	where = visible
	numberOrder := `length(s.number), s.number`
	switch {
	case allDigits(q):
		from = `songs s`
		where += ` AND ltrim(s.number, '0') LIKE ?`
		args = append(args, strings.TrimLeft(q, "0")+"%")
		order = numberOrder
	case q != "":
		expr, ok := ftsQuery(q)
		if !ok {
			return nil, false, nil
		}
		from = `songs_fts JOIN songs s ON s.rowid = songs_fts.rowid`
		where += ` AND songs_fts MATCH ?`
		args = append(args, expr)
		order = `bm25(songs_fts), ` + numberOrder
	default:
		from = `songs s`
		order = numberOrder
	}
	if p.Format != 0 {
		where += ` AND s.format = ?`
		args = append(args, int(p.Format))
	}
	letterColumn := `s.title_letter`
	switch p.Sort {
	case SortNumber:
		order = numberOrder
	case SortTitle:
		order = `s.title_key, ` + numberOrder
	case SortArtist:
		order = `s.artist_key, s.title_key, ` + numberOrder
		letterColumn = `s.artist_letter`
	}
	if letter != "" {
		where += ` AND ` + letterColumn + ` = ?`
		args = append(args, letter)
	}
	args = append(args, limit+1, p.Offset)
	rows, err := c.db.QueryContext(ctx, `SELECT `+songColumns+` FROM `+from+` WHERE `+where+` ORDER BY `+order+` LIMIT ? OFFSET ?`, args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	var out []library.SongInfo
	for rows.Next() {
		s, err := scanSong(rows)
		if err != nil {
			return nil, false, err
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	more := len(out) > limit
	if more {
		out = out[:limit]
	}
	return out, more, nil
}

func decodeToken(token string) (int, error) {
	if token == "" {
		return 0, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return 0, fmt.Errorf("%w: bad page token", ErrInvalid)
	}
	n, err := strconv.Atoi(string(raw))
	if err != nil || n < 0 || n > maxOffset {
		return 0, fmt.Errorf("%w: bad page token", ErrInvalid)
	}
	return n, nil
}

func encodeToken(offset int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}

// SearchPage is Search with an opaque page token; next is "" on the last page.
func (c *Catalog) SearchPage(ctx context.Context, p SearchParams, token string, pageSize int) (songs []library.SongInfo, next string, err error) {
	if p.Offset, err = decodeToken(token); err != nil {
		return nil, "", err
	}
	p.Limit = clampLimit(pageSize)
	songs, more, err := c.Search(ctx, p)
	if err != nil {
		return nil, "", err
	}
	if more {
		next = encodeToken(p.Offset + len(songs))
	}
	return songs, next, nil
}

// Artists lists the displayed artists of visible songs, grouped ignoring case
// and accents, optionally restricted to a first letter. Songs without an artist are not listed.
func (c *Catalog) Artists(ctx context.Context, letter string, offset, limit int) ([]Artist, bool, error) {
	l, err := normLetter(letter)
	if err != nil {
		return nil, false, err
	}
	if offset < 0 || offset > maxOffset {
		return nil, false, fmt.Errorf("%w: bad offset", ErrInvalid)
	}
	limit = clampLimit(limit)
	where := visible + ` AND s.artist_key <> ''`
	var args []any
	if l != "" {
		where += ` AND s.artist_letter = ?`
		args = append(args, l)
	}
	args = append(args, limit+1, offset)
	rows, err := c.db.QueryContext(ctx, `SELECT MIN(s.display_artist), COUNT(*) FROM songs s WHERE `+where+` GROUP BY s.artist_key ORDER BY s.artist_key LIMIT ? OFFSET ?`, args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	var out []Artist
	for rows.Next() {
		var a Artist
		if err := rows.Scan(&a.Name, &a.SongCount); err != nil {
			return nil, false, err
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	more := len(out) > limit
	if more {
		out = out[:limit]
	}
	return out, more, nil
}

func canonicalOrInvalid(number string) (string, error) {
	n, ok := library.CanonicalNumber(strings.TrimSpace(number))
	if !ok {
		return "", fmt.Errorf("%w: a song number is made of digits", ErrInvalid)
	}
	return n, nil
}

// Get finds a visible song by number; non-canonical digits (1052) work.
func (c *Catalog) Get(ctx context.Context, number string) (library.SongInfo, error) {
	n, err := canonicalOrInvalid(number)
	if err != nil {
		return library.SongInfo{}, err
	}
	s, err := scanSong(c.db.QueryRowContext(ctx, `SELECT `+songColumns+` FROM songs s WHERE s.number = ? AND `+visible, n))
	if errors.Is(err, sql.ErrNoRows) {
		return library.SongInfo{}, library.ErrNotFound
	}
	return s, err
}

type cachedLyrics struct {
	source     string
	durationMs int64
	lines      []lyrics.Line
}

// Lyrics parses the song's file (or serves the parse from the cache, keyed by
// the file's SHA-256) and returns its lyrics with millisecond times.
func (c *Catalog) Lyrics(ctx context.Context, number string) (*kantahev1.Lyrics, error) {
	n, err := canonicalOrInvalid(number)
	if err != nil {
		return nil, err
	}
	var path, sha string
	var format int
	err = c.db.QueryRowContext(ctx, `SELECT s.path, s.sha256, s.format FROM songs s WHERE s.number = ? AND `+visible, n).Scan(&path, &sha, &format)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, library.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	cl, ok := c.cache.get(sha)
	if !ok {
		if cl, err = parseLyrics(path, library.Format(format)); err != nil {
			return nil, err
		}
		c.cache.put(sha, cl)
	}
	if len(cl.lines) == 0 {
		return nil, ErrNoLyrics
	}
	return lyrics.ToProto(n, cl.source, cl.durationMs, cl.lines), nil
}

func parseLyrics(path string, format library.Format) (cachedLyrics, error) {
	if format == library.FormatMIDI {
		body, err := os.ReadFile(path)
		if err != nil {
			return cachedLyrics{}, fmt.Errorf("read song file: %w", err)
		}
		song, err := kar.Parse(body)
		if err != nil {
			return cachedLyrics{}, err
		}
		return cachedLyrics{source: "kar", durationMs: song.DurationMs, lines: song.Lines}, nil
	}
	f, err := os.Open(path)
	if err != nil {
		return cachedLyrics{}, fmt.Errorf("read song file: %w", err)
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return cachedLyrics{}, err
	}
	song, err := karmp3.Parse(f, st.Size())
	if err != nil {
		return cachedLyrics{}, err
	}
	return cachedLyrics{source: "lrc", durationMs: song.DurationMs, lines: song.Lines}, nil
}

// lru is a small least-recently-used cache.
type lru struct {
	mu    sync.Mutex
	cap   int
	order *list.List // front = most recent
	items map[string]*list.Element
}

type lruEntry struct {
	key string
	val cachedLyrics
}

func newLRU(capacity int) *lru {
	return &lru{cap: capacity, order: list.New(), items: map[string]*list.Element{}}
}

func (l *lru) get(key string) (cachedLyrics, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	el, ok := l.items[key]
	if !ok {
		return cachedLyrics{}, false
	}
	l.order.MoveToFront(el)
	return el.Value.(*lruEntry).val, true
}

func (l *lru) put(key string, val cachedLyrics) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if el, ok := l.items[key]; ok {
		el.Value.(*lruEntry).val = val
		l.order.MoveToFront(el)
		return
	}
	l.items[key] = l.order.PushFront(&lruEntry{key, val})
	for l.order.Len() > l.cap {
		last := l.order.Back()
		l.order.Remove(last)
		delete(l.items, last.Value.(*lruEntry).key)
	}
}

// ArtistsPage is Artists with an opaque page token; next is "" on the last page.
func (c *Catalog) ArtistsPage(ctx context.Context, letter, token string, pageSize int) (artists []Artist, next string, err error) {
	offset, err := decodeToken(token)
	if err != nil {
		return nil, "", err
	}
	artists, more, err := c.Artists(ctx, letter, offset, pageSize)
	if err != nil {
		return nil, "", err
	}
	if more {
		next = encodeToken(offset + len(artists))
	}
	return artists, next, nil
}

// DecodePageToken reads an opaque page token into an offset ("" is the first page).
func DecodePageToken(token string) (int, error) { return decodeToken(token) }

// EncodePageToken makes the opaque token of the page starting at offset.
func EncodePageToken(offset int) string { return encodeToken(offset) }

// ClampPageSize applies the default (50) and maximum (200) page size.
func ClampPageSize(n int) int { return clampLimit(n) }
