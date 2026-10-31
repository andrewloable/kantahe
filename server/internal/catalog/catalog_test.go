package catalog

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

type env struct {
	db   *store.DB
	im   *library.Importer
	c    *Catalog
	data string
}

func newEnv(t *testing.T) *env {
	t.Helper()
	data := t.TempDir()
	db, err := store.Open(context.Background(), data)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	im := library.NewImporter(db, data, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	return &env{db, im, New(db), data}
}

type opt func(*song)

type song struct {
	number, title, artist, original string
	format                          int
	failed, deleted, pending        bool
	path                            string
}

func failed() opt  { return func(s *song) { s.failed = true } }
func deleted() opt { return func(s *song) { s.deleted = true } }
func pending() opt { return func(s *song) { s.pending = true } }
func midi() opt    { return func(s *song) { s.format = 2 } }
func named(n string) opt {
	return func(s *song) { s.original = n }
}

// add inserts a finished song row and indexes it as the importer would.
func (e *env) add(t *testing.T, number, title, artist string, opts ...opt) {
	t.Helper()
	s := song{number: number, title: title, artist: artist, original: number + ".kar", format: 1}
	for _, o := range opts {
		o(&s)
	}
	b := func(v bool) int {
		if v {
			return 1
		}
		return 0
	}
	if s.path == "" {
		s.path = "/nowhere/" + number
	}
	_, err := e.db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, file_title, file_artist, duration_ms, failed, deleted, metadata_done, created_at)
		VALUES (?, ?, 2, ?, ?, 1, 1, ?, ?, ?, 1000, ?, ?, ?, 1)`,
		s.number, s.format, s.path, "sha-"+number, s.original, s.title, s.artist, b(s.failed), b(s.deleted), b(!s.pending))
	if err != nil {
		t.Fatal(err)
	}
	if err := e.im.Reindex(context.Background(), number); err != nil {
		t.Fatal(err)
	}
}

func (e *env) search(t *testing.T, p SearchParams) ([]string, bool) {
	t.Helper()
	songs, more, err := e.c.Search(context.Background(), p)
	if err != nil {
		t.Fatalf("Search(%+v): %v", p, err)
	}
	var nums []string
	for _, s := range songs {
		nums = append(nums, s.Number)
	}
	return nums, more
}

func TestSearchDigitsPrefix(t *testing.T) {
	e := newEnv(t)
	e.add(t, "01052", "A", "X")
	e.add(t, "01053", "B", "X")
	e.add(t, "21052", "C", "X")
	if got, _ := e.search(t, SearchParams{Query: "105"}); !reflect.DeepEqual(got, []string{"01052", "01053"}) {
		t.Fatalf("105 -> %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "1052"}); !reflect.DeepEqual(got, []string{"01052"}) {
		t.Fatalf("1052 -> %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "01052"}); !reflect.DeepEqual(got, []string{"01052"}) {
		t.Fatalf("01052 -> %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "2"}); !reflect.DeepEqual(got, []string{"21052"}) {
		t.Fatalf("2 -> %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: " 105 "}); len(got) != 2 {
		t.Fatalf("a trimmed query: %v", got)
	}
}

func TestSearchDigitsOrderedNumerically(t *testing.T) {
	e := newEnv(t)
	e.add(t, "100000", "Six digits", "X")
	e.add(t, "99999", "Five digits", "X")
	e.add(t, "00002", "Two", "X")
	got, _ := e.search(t, SearchParams{Sort: SortNumber})
	if !reflect.DeepEqual(got, []string{"00002", "99999", "100000"}) {
		t.Fatalf("got %v, want numeric order", got)
	}
}

func TestSearchText(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Heto Naman Ako", "Daryl")
	e.add(t, "00002", "Hey It's Me", "Someone")
	if got, _ := e.search(t, SearchParams{Query: "he"}); !reflect.DeepEqual(got, []string{"00001", "00002"}) && !reflect.DeepEqual(got, []string{"00002", "00001"}) {
		t.Fatalf("he -> %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "heto nam"}); !reflect.DeepEqual(got, []string{"00001"}) {
		t.Fatalf("heto nam -> %v (prefix match on the last word)", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "it's me"}); !reflect.DeepEqual(got, []string{"00002"}) {
		t.Fatalf("it's me -> %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "daryl"}); !reflect.DeepEqual(got, []string{"00001"}) {
		t.Fatalf("artist search -> %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "naman heto"}); !reflect.DeepEqual(got, []string{"00001"}) {
		t.Fatalf("word order does not matter: %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "nam heto"}); len(got) != 0 {
		t.Fatalf("only the last word is a prefix: %v", got)
	}
}

func TestSearchDiacritics(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Élan", "Café")
	for _, q := range []string{"elan", "ÉLAN", "cafe", "éla"} {
		if got, _ := e.search(t, SearchParams{Query: q}); !reflect.DeepEqual(got, []string{"00001"}) {
			t.Errorf("%q -> %v", q, got)
		}
	}
}

func TestSearchSpecialChars(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "a b", "X")
	e.add(t, "00002", "OR something", "X")
	for _, q := range []string{`a* OR (b`, `"`, `""`, `a AND`, `NEAR(a b)`, `title:a`, `-a`, `a^`, "a\x00b", `(((`, `*`, `'`, `\`, `%`, `_`} {
		if _, _, err := e.c.Search(context.Background(), SearchParams{Query: q}); err != nil {
			t.Errorf("%q: %v", q, err)
		}
	}
	// punctuation only: no tokens, no results, no error
	if got, more := e.search(t, SearchParams{Query: `"()*:`}); len(got) != 0 || more {
		t.Fatalf("%v", got)
	}
	// operators are plain words
	if got, _ := e.search(t, SearchParams{Query: "a OR b"}); len(got) != 0 {
		t.Fatalf("OR must be a word here, not an operator: %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "or"}); !reflect.DeepEqual(got, []string{"00002"}) {
		t.Fatalf("%v", got)
	}
}

func TestSearchTokenLimits(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "alpha", "X")
	long := ""
	for i := 0; i < 500; i++ {
		long += "alpha "
	}
	if _, _, err := e.c.Search(context.Background(), SearchParams{Query: long}); err != nil {
		t.Fatal(err)
	}
	if got, _ := e.search(t, SearchParams{Query: string(make([]byte, 0)) + "alpha" + fmt.Sprintf("%0200d", 0)}); len(got) != 0 {
		t.Fatalf("%v", got)
	}
}

func TestFormatFilter(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Same", "X")
	e.add(t, "00002", "Same", "X", midi())
	if got, _ := e.search(t, SearchParams{Query: "same", Format: library.FormatMIDI}); !reflect.DeepEqual(got, []string{"00002"}) {
		t.Fatalf("%v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "same", Format: library.FormatMP3}); !reflect.DeepEqual(got, []string{"00001"}) {
		t.Fatalf("%v", got)
	}
	if got, _ := e.search(t, SearchParams{Format: library.FormatMIDI}); !reflect.DeepEqual(got, []string{"00002"}) {
		t.Fatalf("browse with format: %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "same"}); len(got) != 2 {
		t.Fatalf("both formats are separate entries: %v", got)
	}
}

func TestLetterBrowse(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Heto", "Zed")
	e.add(t, "00002", "Hello", "Abe")
	e.add(t, "00003", "Apple", "Hal")
	e.add(t, "00004", "123 Go", "Hal")
	got, _ := e.search(t, SearchParams{Letter: "H", Sort: SortTitle})
	if !reflect.DeepEqual(got, []string{"00002", "00001"}) {
		t.Fatalf("title letter H sorted by title: %v", got)
	}
	got, _ = e.search(t, SearchParams{Letter: "h", Sort: SortNumber})
	if !reflect.DeepEqual(got, []string{"00001", "00002"}) {
		t.Fatalf("lower-case letter is accepted: %v", got)
	}
	got, _ = e.search(t, SearchParams{Letter: "H", Sort: SortArtist})
	if !reflect.DeepEqual(got, []string{"00004", "00003"}) {
		t.Fatalf("with sort ARTIST the letter applies to the artist (then by title): %v", got)
	}
	got, _ = e.search(t, SearchParams{Letter: "#", Sort: SortTitle})
	if !reflect.DeepEqual(got, []string{"00004"}) {
		t.Fatalf("#: %v", got)
	}
	if _, _, err := e.c.Search(context.Background(), SearchParams{Letter: "AB"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad letter: %v", err)
	}
	if _, _, err := e.c.Search(context.Background(), SearchParams{Letter: "1"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad letter: %v", err)
	}
}

func TestSortArtist(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Zulu", "Bob")
	e.add(t, "00002", "Alpha", "bob")
	e.add(t, "00003", "Mid", "Äbe")
	e.add(t, "00004", "Zed", "Cy")
	got, _ := e.search(t, SearchParams{Sort: SortArtist})
	// accents and case are folded: Äbe, bob (Alpha before Zulu), Bob... then Cy
	if !reflect.DeepEqual(got, []string{"00003", "00002", "00001", "00004"}) {
		t.Fatalf("got %v", got)
	}
	got, _ = e.search(t, SearchParams{Sort: SortTitle})
	if !reflect.DeepEqual(got, []string{"00002", "00003", "00004", "00001"}) {
		t.Fatalf("by title: %v", got)
	}
}

func TestPaging(t *testing.T) {
	e := newEnv(t)
	tx, _ := e.db.Begin()
	for i := 1; i <= 120; i++ {
		n := fmt.Sprintf("%05d", i)
		if _, err := tx.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, file_title, display_title, title_key, metadata_done, created_at)
			VALUES (?,1,2,?,?,1,1,'x','T','T','t',1,1)`, n, "/p/"+n, "sha"+n); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	var seen []string
	token := ""
	var sizes []int
	for {
		songs, next, err := e.c.SearchPage(context.Background(), SearchParams{Sort: SortNumber}, token, 50)
		if err != nil {
			t.Fatal(err)
		}
		sizes = append(sizes, len(songs))
		for _, s := range songs {
			seen = append(seen, s.Number)
		}
		if next == "" {
			break
		}
		token = next
	}
	if !reflect.DeepEqual(sizes, []int{50, 50, 20}) || len(seen) != 120 || seen[0] != "00001" || seen[119] != "00120" {
		t.Fatalf("pages %v, %d songs", sizes, len(seen))
	}
	for _, bad := range []string{"!!!", "bm90LW51bWJlcg", "LTU", "ZXhwbG9kZQ=="} {
		if _, _, err := e.c.SearchPage(context.Background(), SearchParams{}, bad, 50); !errors.Is(err, ErrInvalid) {
			t.Errorf("token %q: %v", bad, err)
		}
	}
	if songs, _, _ := e.c.SearchPage(context.Background(), SearchParams{Sort: SortNumber}, "", 0); len(songs) != 50 {
		t.Fatalf("default page size: %d", len(songs))
	}
	if songs, _, _ := e.c.SearchPage(context.Background(), SearchParams{Sort: SortNumber}, "", 100000); len(songs) != 120 {
		t.Fatalf("page size is capped at 200, 120 rows fit: %d", len(songs))
	}
}

func TestExcludesFailedDeletedAndPending(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Visible", "X")
	e.add(t, "00002", "Visible failed", "X", failed())
	e.add(t, "00003", "Visible deleted", "X", deleted())
	e.add(t, "00004", "Visible pending", "X", pending())
	for _, p := range []SearchParams{{Query: "visible"}, {Sort: SortTitle}, {Query: "0000"}, {Sort: SortArtist}, {Letter: "V"}} {
		if got, _ := e.search(t, p); !reflect.DeepEqual(got, []string{"00001"}) {
			t.Errorf("%+v -> %v", p, got)
		}
	}
	for _, n := range []string{"00002", "00003", "00004"} {
		if _, err := e.c.Get(context.Background(), n); !errors.Is(err, library.ErrNotFound) {
			t.Errorf("Get(%s): %v", n, err)
		}
	}
	if arts, _, _ := e.c.Artists(context.Background(), "", 0, 50); len(arts) != 1 || arts[0].SongCount != 1 {
		t.Fatalf("artists count only visible songs: %+v", arts)
	}
}

func TestGetSongNonCanonical(t *testing.T) {
	e := newEnv(t)
	e.add(t, "01052", "Song", "Artist")
	for _, n := range []string{"1052", "01052", " 1052 ", "001052"} {
		s, err := e.c.Get(context.Background(), n)
		if err != nil || s.Number != "01052" || s.Title != "Song" || s.Artist != "Artist" {
			t.Errorf("Get(%q) = %+v, %v", n, s, err)
		}
	}
	if _, err := e.c.Get(context.Background(), "9999"); !errors.Is(err, library.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
	if _, err := e.c.Get(context.Background(), "abc"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("not a number: %v", err)
	}
	if _, err := e.c.Get(context.Background(), ""); !errors.Is(err, ErrInvalid) {
		t.Fatalf("empty: %v", err)
	}
}

func TestEditWins(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Original", "Band")
	if _, err := e.db.Exec(`INSERT INTO song_edits(number, title, artist) VALUES ('00001', 'Edited title', NULL)`); err != nil {
		t.Fatal(err)
	}
	if err := e.im.Reindex(context.Background(), "00001"); err != nil {
		t.Fatal(err)
	}
	if got, _ := e.search(t, SearchParams{Query: "edited"}); !reflect.DeepEqual(got, []string{"00001"}) {
		t.Fatalf("edited title is searchable: %v", got)
	}
	if got, _ := e.search(t, SearchParams{Query: "original"}); len(got) != 0 {
		t.Fatalf("old title still searchable: %v", got)
	}
	s, _ := e.c.Get(context.Background(), "1")
	if s.Title != "Edited title" || s.Artist != "Band" {
		t.Fatalf("%+v", s)
	}
}

func TestListArtists(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "a", "A")
	e.add(t, "00002", "b", "A")
	e.add(t, "00003", "c", "a") // same artist, other case
	e.add(t, "00004", "d", "B")
	e.add(t, "00005", "e", "")
	e.add(t, "00006", "f", "Ångström")
	arts, next, err := e.c.Artists(context.Background(), "", 0, 50)
	if err != nil || next {
		t.Fatalf("%v %v", err, next)
	}
	var got []string
	for _, a := range arts {
		got = append(got, fmt.Sprintf("%s(%d)", a.Name, a.SongCount))
	}
	if !reflect.DeepEqual(got, []string{"Ångström(1)", "A(3)", "B(1)"}) && !reflect.DeepEqual(got, []string{"A(3)", "Ångström(1)", "B(1)"}) {
		t.Fatalf("got %v; songs without an artist are not listed and artists are grouped ignoring case", got)
	}
	arts, _, _ = e.c.Artists(context.Background(), "B", 0, 50)
	if len(arts) != 1 || arts[0].Name != "B" {
		t.Fatalf("letter filter: %+v", arts)
	}
	arts, more, _ := e.c.Artists(context.Background(), "", 0, 2)
	if len(arts) != 2 || !more {
		t.Fatalf("paging: %+v %v", arts, more)
	}
	if _, _, err := e.c.Artists(context.Background(), "??", 0, 50); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad letter: %v", err)
	}
}

func writeFile(t *testing.T, e *env, name string, body []byte) string {
	t.Helper()
	p := filepath.Join(e.data, name)
	if err := os.WriteFile(p, body, 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestGetLyrics(t *testing.T) {
	e := newEnv(t)
	karBody := testfix.KAR("S", "A", []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}, {Tick: 960, Text: "/Next"}})
	e.add(t, "00001", "S", "A", midi(), func(s *song) { s.path = writeFile(t, e, "a.kar", karBody) })
	mp3Body := testfix.KARMP3("x", testfix.MP3Frames(100), "[00:01.00]<00:01.00>He<00:01.50>llo\n[00:05.00]Next", "")
	e.add(t, "00002", "S2", "A", func(s *song) { s.path = writeFile(t, e, "b.karmp3", mp3Body) })
	l, err := e.c.Lyrics(context.Background(), "1")
	if err != nil || l.Number != "00001" || l.Source != "kar" || len(l.Lines) != 2 || l.Lines[0].Words[0].Text != "Hel" || l.DurationMs <= 0 {
		t.Fatalf("%+v %v", l, err)
	}
	l, err = e.c.Lyrics(context.Background(), "00002")
	if err != nil || l.Source != "lrc" || len(l.Lines) != 2 || l.Lines[0].Words[1].StartMs != 1500 || l.Lines[1].Words[0].Text != "Next" {
		t.Fatalf("%+v %v", l, err)
	}
	// a song without lyrics
	e.add(t, "00003", "S3", "A", midi(), func(s *song) {
		s.path = writeFile(t, e, "c.kar", testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.NoteOn(0, 60, 90)}}}}}.Bytes())
	})
	if _, err := e.c.Lyrics(context.Background(), "3"); !errors.Is(err, ErrNoLyrics) {
		t.Fatalf("err = %v", err)
	}
	if _, err := e.c.Lyrics(context.Background(), "99"); !errors.Is(err, library.ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
	// the file vanished
	e.add(t, "00004", "S4", "A", midi(), func(s *song) { s.path = "/definitely/not/here.kar" })
	if _, err := e.c.Lyrics(context.Background(), "4"); err == nil || errors.Is(err, library.ErrNotFound) {
		t.Fatalf("a missing file is an internal problem, not 'no such song': %v", err)
	}
}

func TestLyricsAreCachedBySHA(t *testing.T) {
	e := newEnv(t)
	p := writeFile(t, e, "a.kar", testfix.KAR("S", "A", []testfix.Syllable{{Tick: 0, Text: "/Hel"}}))
	e.add(t, "00001", "S", "A", midi(), func(s *song) { s.path = p })
	if _, err := e.c.Lyrics(context.Background(), "1"); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	l, err := e.c.Lyrics(context.Background(), "1")
	if err != nil || len(l.Lines) != 1 {
		t.Fatalf("the second request is served from the cache: %+v %v", l, err)
	}
}

func TestLRUEvicts(t *testing.T) {
	c := newLRU(3)
	for i := 0; i < 5; i++ {
		c.put(fmt.Sprint(i), cachedLyrics{source: "kar"})
	}
	if _, ok := c.get("0"); ok {
		t.Fatal("0 should have been evicted")
	}
	if _, ok := c.get("1"); ok {
		t.Fatal("1 should have been evicted")
	}
	if _, ok := c.get("4"); !ok {
		t.Fatal("4 should be present")
	}
	c.get("2") // refresh 2
	c.put("5", cachedLyrics{})
	if _, ok := c.get("2"); !ok {
		t.Fatal("recently used 2 must survive")
	}
	if _, ok := c.get("3"); ok {
		t.Fatal("3 was least recently used")
	}
}

func BenchmarkSearch(b *testing.B) {
	data := b.TempDir()
	db, err := store.Open(context.Background(), data)
	if err != nil {
		b.Fatal(err)
	}
	defer db.Close()
	words := []string{"love", "heart", "night", "dream", "angel", "forever", "tonight", "paradise", "memories", "rainbow", "summer", "baby", "fire", "river", "moon", "sunshine"}
	tx, _ := db.Begin()
	for i := 1; i <= 24000; i++ {
		n := fmt.Sprintf("%05d", i)
		title := words[i%16] + " " + words[(i/16)%16] + " " + words[(i/256)%16]
		artist := words[(i/7)%16] + " band"
		res, err := tx.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, file_title, file_artist, display_title, display_artist, title_key, artist_key, title_letter, artist_letter, metadata_done, created_at)
			VALUES (?,1,2,?,?,1,1,'x',?,?,?,?,?,?,'L','L',1,1)`, n, "/p/"+n, "sha"+n, title, artist, title, artist, title, artist)
		if err != nil {
			b.Fatal(err)
		}
		id, _ := res.LastInsertId()
		if _, err := tx.Exec(`INSERT INTO songs_fts(rowid, number, title, artist) VALUES (?,?,?,?)`, id, n, title, artist); err != nil {
			b.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		b.Fatal(err)
	}
	c := New(db)
	ctx := context.Background()
	for _, q := range []string{"love", "love heart", "lo", "1052", "heart night dr"} {
		b.Run(q, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				if _, _, err := c.Search(ctx, SearchParams{Query: q, Limit: 51}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
	b.Run("browse title H", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			if _, _, err := c.Search(ctx, SearchParams{Letter: "L", Sort: SortTitle, Limit: 51}); err != nil {
				b.Fatal(err)
			}
		}
	})
}

func TestRegression_DecomposedAccentsInTheQuery(t *testing.T) {
	e := newEnv(t)
	e.add(t, "00001", "Élan Vital", "Café")
	// "É" typed as E + combining acute (what macOS file names and pasted text often contain)
	for _, q := range []string{"Élan", "café", "Éla", "ELAN"} {
		if got, _ := e.search(t, SearchParams{Query: q}); !reflect.DeepEqual(got, []string{"00001"}) {
			t.Errorf("%q -> %v", q, got)
		}
	}
}

func TestSearchOrderIsStableAcrossPages(t *testing.T) {
	e := newEnv(t)
	for i := 1; i <= 30; i++ {
		e.add(t, fmt.Sprintf("%05d", i), "Same title", "Same artist") // identical relevance
	}
	var seen = map[string]int{}
	token := ""
	for {
		songs, next, err := e.c.SearchPage(context.Background(), SearchParams{Query: "same"}, token, 7)
		if err != nil {
			t.Fatal(err)
		}
		for _, s := range songs {
			seen[s.Number]++
		}
		if next == "" {
			break
		}
		token = next
	}
	if len(seen) != 30 {
		t.Fatalf("saw %d distinct songs, want 30", len(seen))
	}
	for n, c := range seen {
		if c != 1 {
			t.Errorf("%s returned %d times: ties must be broken deterministically", n, c)
		}
	}
}
