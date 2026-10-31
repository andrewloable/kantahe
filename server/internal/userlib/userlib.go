// Package userlib holds a user's own lists: favourites, history and playlists.
// Every query is filtered by the user id; nothing here reads another user's rows.
package userlib

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/users"
)

// Errors returned by the library.
var (
	// ErrNotFound covers an unknown song or an unknown (or foreign) playlist.
	ErrNotFound = library.ErrNotFound
	// ErrInvalid wraps every rejected input; InvalidError carries the message.
	ErrInvalid = errors.New("userlib: invalid request")
)

// InvalidError is a rejected input with a message fit for the client.
type InvalidError struct{ Msg string }

func (e *InvalidError) Error() string        { return e.Msg }
func (e *InvalidError) Is(target error) bool { return target == ErrInvalid }

func invalid(format string, args ...any) error { return &InvalidError{fmt.Sprintf(format, args...)} }

const (
	maxPlaylistSongs = 1000
	maxNameRunes     = 100
	chunk            = 400 // numbers per IN (...) query
	visible          = `s.deleted = 0 AND s.failed = 0 AND s.metadata_done = 1`
	songCols         = `s.number, s.format, s.songbook_number, s.duration_ms, s.display_title, s.display_artist`
)

// Library is the per-user data access.
type Library struct {
	db  *store.DB
	now func() int64 // Unix seconds
}

// New builds a Library; now supplies the creation times.
func New(db *store.DB, now func() int64) *Library { return &Library{db: db, now: now} }

func scanSong(row interface{ Scan(...any) error }) (library.SongInfo, error) {
	var s library.SongInfo
	var format int
	err := row.Scan(&s.Number, &format, &s.Songbook, &s.DurationMs, &s.Title, &s.Artist)
	s.Format = library.Format(format)
	return s, err
}

func placeholders(n int) string { return strings.TrimSuffix(strings.Repeat("?,", n), ",") }

func canonicalAll(numbers []string) ([]string, error) {
	out := make([]string, len(numbers))
	for i, n := range numbers {
		c, ok := library.CanonicalNumber(strings.TrimSpace(n))
		if !ok {
			return nil, invalid("%q is not a song number", n)
		}
		out[i] = c
	}
	return out, nil
}

// playable returns which of the numbers are visible songs.
func (l *Library) playable(ctx context.Context, q interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}, numbers []string) (map[string]bool, error) {
	ok := map[string]bool{}
	for start := 0; start < len(numbers); start += chunk {
		part := numbers[start:min(start+chunk, len(numbers))]
		args := make([]any, len(part))
		for i, n := range part {
			args[i] = n
		}
		rows, err := q.QueryContext(ctx, `SELECT s.number FROM songs s WHERE `+visible+` AND s.number IN (`+placeholders(len(part))+`)`, args...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var n string
			if err := rows.Scan(&n); err != nil {
				rows.Close()
				return nil, err
			}
			ok[n] = true
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	return ok, nil
}

// SetFavourite adds or removes a favourite. Adding needs a playable song;
// both directions are idempotent.
func (l *Library) SetFavourite(ctx context.Context, userID, number string, favourite bool) error {
	n, ok := library.CanonicalNumber(strings.TrimSpace(number))
	if !ok {
		return invalid("a song number is made of digits")
	}
	return l.db.WriteTx(ctx, func(tx *sql.Tx) error {
		if !favourite {
			_, err := tx.ExecContext(ctx, `DELETE FROM favourites WHERE user_id = ? AND number = ?`, userID, n)
			return err
		}
		set, err := l.playable(ctx, tx, []string{n})
		if err != nil {
			return err
		}
		if !set[n] {
			return ErrNotFound
		}
		_, err = tx.ExecContext(ctx, `INSERT OR IGNORE INTO favourites(user_id, number, created_at) VALUES (?,?,?)`, userID, n, l.now())
		return err
	})
}

// FavouriteSet returns which of the numbers the user has favourited.
func (l *Library) FavouriteSet(ctx context.Context, userID string, numbers []string) (map[string]bool, error) {
	out := map[string]bool{}
	for start := 0; start < len(numbers); start += chunk {
		part := numbers[start:min(start+chunk, len(numbers))]
		args := []any{userID}
		for _, n := range part {
			args = append(args, n)
		}
		rows, err := l.db.QueryContext(ctx, `SELECT number FROM favourites WHERE user_id = ? AND number IN (`+placeholders(len(part))+`)`, args...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var n string
			if err := rows.Scan(&n); err != nil {
				rows.Close()
				return nil, err
			}
			out[n] = true
		}
		rows.Close()
	}
	return out, nil
}

// ListFavourites returns the user's favourites that are still playable, newest first.
func (l *Library) ListFavourites(ctx context.Context, userID string, offset, limit int) ([]library.SongInfo, bool, error) {
	rows, err := l.db.QueryContext(ctx, `SELECT `+songCols+` FROM favourites f JOIN songs s ON s.number = f.number
		WHERE f.user_id = ? AND `+visible+` ORDER BY f.created_at DESC, f.rowid DESC LIMIT ? OFFSET ?`, userID, limit+1, offset)
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

// HistoryItem is one sung or skipped song.
type HistoryItem struct {
	Song     library.SongInfo
	SungAt   int64
	Skipped  bool
	HasScore bool
	Score    int
}

// ListHistory returns the user's history, newest first. A song deleted since keeps
// its last known title; a song whose row is gone is shown by number only.
func (l *Library) ListHistory(ctx context.Context, userID string, offset, limit int) ([]HistoryItem, bool, error) {
	rows, err := l.db.QueryContext(ctx, `SELECT h.number, h.sung_at, h.skipped <> 0, h.has_score <> 0, h.score,
		s.format, s.songbook_number, s.duration_ms, s.display_title, s.display_artist
		FROM history h LEFT JOIN songs s ON s.number = h.number WHERE h.user_id = ? ORDER BY h.id DESC LIMIT ? OFFSET ?`, userID, limit+1, offset)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	var out []HistoryItem
	for rows.Next() {
		var it HistoryItem
		var format, duration sql.NullInt64
		var songbook, title, artist sql.NullString
		if err := rows.Scan(&it.Song.Number, &it.SungAt, &it.Skipped, &it.HasScore, &it.Score, &format, &songbook, &duration, &title, &artist); err != nil {
			return nil, false, err
		}
		it.Song.Format, it.Song.Songbook, it.Song.DurationMs = library.Format(format.Int64), songbook.String, duration.Int64
		it.Song.Title, it.Song.Artist = title.String, artist.String
		out = append(out, it)
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

// Playlist is a named list of songs; Songs holds the playable ones in order.
type Playlist struct {
	ID, Name string
	Songs    []library.SongInfo
}

// PlaylistSummary is a playlist without its songs; Count covers the playable ones.
type PlaylistSummary struct {
	ID, Name string
	Count    int
}

func validName(name string) (string, error) {
	n := strings.TrimSpace(name)
	if c := utf8.RuneCountInString(n); c < 1 || c > maxNameRunes {
		return "", invalid("a playlist name is 1 to %d characters", maxNameRunes)
	}
	return n, nil
}

// checkNumbers canonicalises the numbers and names every one that is not a playable song.
func (l *Library) checkNumbers(ctx context.Context, q interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}, numbers []string) ([]string, error) {
	canon, err := canonicalAll(numbers)
	if err != nil {
		return nil, err
	}
	ok, err := l.playable(ctx, q, canon)
	if err != nil {
		return nil, err
	}
	var bad []string
	seen := map[string]bool{}
	for _, n := range canon {
		if !ok[n] && !seen[n] {
			seen[n] = true
			bad = append(bad, n)
		}
	}
	if len(bad) > 0 {
		return nil, invalid("these songs do not exist or cannot be played: %s", strings.Join(bad, ", "))
	}
	return canon, nil
}

// CreatePlaylist makes a playlist. Every number must be a playable song.
func (l *Library) CreatePlaylist(ctx context.Context, userID, name string, numbers []string) (Playlist, error) {
	n, err := validName(name)
	if err != nil {
		return Playlist{}, err
	}
	if len(numbers) > maxPlaylistSongs {
		return Playlist{}, invalid("a playlist holds at most %d songs", maxPlaylistSongs)
	}
	var id string
	err = l.db.WriteTx(ctx, func(tx *sql.Tx) error {
		canon, err := l.checkNumbers(ctx, tx, numbers)
		if err != nil {
			return err
		}
		id = users.NewID()
		if _, err := tx.ExecContext(ctx, `INSERT INTO playlists(id, user_id, name, created_at) VALUES (?,?,?,?)`, id, userID, n, l.now()); err != nil {
			return err
		}
		return insertSongs(ctx, tx, id, 0, canon)
	})
	if err != nil {
		return Playlist{}, err
	}
	return l.GetPlaylist(ctx, userID, id)
}

func insertSongs(ctx context.Context, tx *sql.Tx, playlistID string, from int, numbers []string) error {
	for i, n := range numbers {
		if _, err := tx.ExecContext(ctx, `INSERT INTO playlist_songs(playlist_id, pos, number) VALUES (?,?,?)`, playlistID, from+i, n); err != nil {
			return err
		}
	}
	return nil
}

// UpdatePlaylist renames (when name is set) and either replaces the songs or appends to them.
func (l *Library) UpdatePlaylist(ctx context.Context, userID, id string, name *string, replace bool, numbers []string) (Playlist, error) {
	var newName string
	if name != nil {
		var err error
		if newName, err = validName(*name); err != nil {
			return Playlist{}, err
		}
	}
	err := l.db.WriteTx(ctx, func(tx *sql.Tx) error {
		var owner string
		err := tx.QueryRowContext(ctx, `SELECT user_id FROM playlists WHERE id = ?`, id).Scan(&owner)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && owner != userID) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		canon, err := l.checkNumbers(ctx, tx, numbers)
		if err != nil {
			return err
		}
		var existing int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?`, id).Scan(&existing); err != nil {
			return err
		}
		if replace {
			existing = 0
		}
		if existing+len(canon) > maxPlaylistSongs {
			return invalid("a playlist holds at most %d songs", maxPlaylistSongs)
		}
		if name != nil {
			if _, err := tx.ExecContext(ctx, `UPDATE playlists SET name = ? WHERE id = ?`, newName, id); err != nil {
				return err
			}
		}
		if replace {
			if _, err := tx.ExecContext(ctx, `DELETE FROM playlist_songs WHERE playlist_id = ?`, id); err != nil {
				return err
			}
		}
		return insertSongs(ctx, tx, id, existing, canon)
	})
	if err != nil {
		return Playlist{}, err
	}
	return l.GetPlaylist(ctx, userID, id)
}

// GetPlaylist returns the playlist with its playable songs in order.
func (l *Library) GetPlaylist(ctx context.Context, userID, id string) (Playlist, error) {
	p := Playlist{ID: id}
	err := l.db.QueryRowContext(ctx, `SELECT name FROM playlists WHERE id = ? AND user_id = ?`, id, userID).Scan(&p.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return Playlist{}, ErrNotFound
	}
	if err != nil {
		return Playlist{}, err
	}
	p.Songs, err = l.songsOf(ctx, id)
	return p, err
}

func (l *Library) songsOf(ctx context.Context, playlistID string) ([]library.SongInfo, error) {
	rows, err := l.db.QueryContext(ctx, `SELECT `+songCols+` FROM playlist_songs ps JOIN songs s ON s.number = ps.number
		WHERE ps.playlist_id = ? AND `+visible+` ORDER BY ps.pos`, playlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []library.SongInfo
	for rows.Next() {
		s, err := scanSong(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// PlayableSongs returns the playlist's playable songs in order (for queueing it).
func (l *Library) PlayableSongs(ctx context.Context, userID, id string) ([]library.SongInfo, error) {
	p, err := l.GetPlaylist(ctx, userID, id)
	return p.Songs, err
}

// ListPlaylists returns the user's playlists, oldest first, with playable-song counts.
func (l *Library) ListPlaylists(ctx context.Context, userID string) ([]PlaylistSummary, error) {
	rows, err := l.db.QueryContext(ctx, `SELECT p.id, p.name, COUNT(s.number) FROM playlists p
		LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
		LEFT JOIN songs s ON s.number = ps.number AND `+visible+`
		WHERE p.user_id = ? GROUP BY p.id ORDER BY p.created_at, p.rowid`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PlaylistSummary
	for rows.Next() {
		var p PlaylistSummary
		if err := rows.Scan(&p.ID, &p.Name, &p.Count); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// DeletePlaylist removes one of the user's playlists.
func (l *Library) DeletePlaylist(ctx context.Context, userID, id string) error {
	return l.db.WriteTx(ctx, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `DELETE FROM playlists WHERE id = ? AND user_id = ?`, id, userID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return ErrNotFound
		}
		return nil
	})
}
