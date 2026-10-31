package library

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/andrewloable/kantahe/server/internal/song/kar"
)

// RemoveError means a song's file could not be deleted, so the song was kept.
type RemoveError struct{ Err error }

func (e *RemoveError) Error() string { return e.Err.Error() }
func (e *RemoveError) Unwrap() error { return e.Err }

// ErrOutsideManaged means a song's file is not inside the data directory or a
// watched folder, so it will not be deleted.
var ErrOutsideManaged = errors.New("the song's file is outside the managed folders")

// SetEdit stores the admin's title and artist for a song. A nil argument leaves
// that field alone; an empty string clears the edit so that the file's value
// shows again. The search entry and browse letters are refreshed.
func (im *Importer) SetEdit(ctx context.Context, number string, title, artist *string) error {
	return im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		var live int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE number = ? AND deleted = 0`, number).Scan(&live); err != nil {
			return err
		}
		if live == 0 {
			return ErrNotFound
		}
		var t, a sql.NullString
		err := tx.QueryRowContext(ctx, `SELECT title, artist FROM song_edits WHERE number = ?`, number).Scan(&t, &a)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		apply := func(cur sql.NullString, in *string) sql.NullString {
			if in == nil {
				return cur
			}
			v := strings.TrimSpace(*in)
			return sql.NullString{String: v, Valid: v != ""}
		}
		t, a = apply(t, title), apply(a, artist)
		if !t.Valid && !a.Valid {
			_, err = tx.ExecContext(ctx, `DELETE FROM song_edits WHERE number = ?`, number)
		} else {
			_, err = tx.ExecContext(ctx, `INSERT INTO song_edits(number, title, artist) VALUES (?, ?, ?)
				ON CONFLICT(number) DO UPDATE SET title = excluded.title, artist = excluded.artist`, number, t, a)
		}
		if err != nil {
			return err
		}
		return syncSong(ctx, tx, number)
	})
}

// managed reports whether path lies inside the data directory or a watched
// folder, with symlinks in the directory part resolved.
func (im *Importer) managed(path string) bool {
	dir, err := filepath.EvalSymlinks(filepath.Dir(path))
	if err != nil {
		return false
	}
	full := filepath.Join(dir, filepath.Base(path))
	roots := append([]string{im.dataDir}, im.libraries...)
	for _, r := range roots {
		resolved, err := filepath.EvalSymlinks(r)
		if err != nil {
			continue
		}
		if abs, err := filepath.Abs(resolved); err == nil && under(full, abs) {
			return true
		}
	}
	return false
}

// DeleteSong removes a song together with its file (uploads and watched-folder
// files alike). The row is kept, marked deleted, so that its number is never
// reused. If the file cannot be removed, nothing changes and a *RemoveError is returned.
func (im *Importer) DeleteSong(ctx context.Context, number string) error {
	return im.remove(ctx, number, true)
}

// RemoveFromList takes a song off the list and leaves its file where it is. The
// derived files (the extracted MP3, the cached SoundFont and audio) are removed. A
// song in a watched folder is listed again by the next scan, under a new number.
func (im *Importer) RemoveFromList(ctx context.Context, number string) error {
	return im.remove(ctx, number, false)
}

func (im *Importer) remove(ctx context.Context, number string, deleteFile bool) error {
	var sha, media string
	err := im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		var path string
		var source int
		err := tx.QueryRowContext(ctx, `SELECT path, sha256, media_path, source FROM songs WHERE number = ? AND deleted = 0`, number).Scan(&path, &sha, &media, &source)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if deleteFile && !im.managed(path) {
			return ErrOutsideManaged
		}
		if _, err := tx.ExecContext(ctx, `UPDATE songs SET deleted = 1, path = path || '#deleted-' || number, media_path = '' WHERE number = ?`, number); err != nil {
			return err
		}
		if err := deleteFTS(ctx, tx, number); err != nil {
			return err
		}
		// the file goes before the commit: if it cannot be removed the whole change is rolled back
		if deleteFile {
			if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
				return &RemoveError{Err: err}
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	im.removeMediaIfUnused(ctx, media)
	im.removeCacheFiles(filepath.Join(im.dataDir, "cache", "sf2"), sha+"-")
	im.removeCacheFiles(filepath.Join(im.dataDir, "cache", "render"), sha)
	return nil
}

// RemoveScope picks the songs RemoveSongs takes off the list.
type RemoveScope int

// Scopes of RemoveSongs.
const (
	ScopeAll     RemoveScope = iota + 1 // every song
	ScopeNoMusic                        // MIDI songs whose file has no audible notes
)

type goneSong struct{ number, sha, media string }

// RemoveSongs takes many songs off the list in one go and returns how many it
// removed. It never deletes a song file; the derived files go as with RemoveFromList.
func (im *Importer) RemoveSongs(ctx context.Context, scope RemoveScope) (int, error) {
	if scope != ScopeAll && scope != ScopeNoMusic {
		return 0, fmt.Errorf("library: unknown remove scope %d", scope)
	}
	candidates, err := im.removeCandidates(ctx, scope)
	if err != nil {
		return 0, err
	}
	var gone []goneSong
	err = im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		gone = gone[:0]
		for _, c := range candidates {
			res, err := tx.ExecContext(ctx, `UPDATE songs SET deleted = 1, path = path || '#deleted-' || number, media_path = ''
				WHERE number = ? AND sha256 = ? AND deleted = 0`, c.number, c.sha)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 0 {
				continue // changed or removed meanwhile
			}
			if err := deleteFTS(ctx, tx, c.number); err != nil {
				return err
			}
			gone = append(gone, c)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	shas := make(map[string]bool, len(gone))
	for _, g := range gone {
		shas[g.sha] = true
		im.removeMediaIfUnused(ctx, g.media)
	}
	im.removeCachedFilesOf(filepath.Join(im.dataDir, "cache", "sf2"), shas)
	im.removeCachedFilesOf(filepath.Join(im.dataDir, "cache", "render"), shas)
	return len(gone), nil
}

// removeCandidates lists the live songs a scope covers. For no-music it reads
// each MIDI file; one that cannot be read is left alone.
func (im *Importer) removeCandidates(ctx context.Context, scope RemoveScope) ([]goneSong, error) {
	query := `SELECT number, sha256, media_path, path FROM songs WHERE deleted = 0`
	if scope == ScopeNoMusic {
		query += ` AND format = ` + fmt.Sprint(int(FormatMIDI))
	}
	rows, err := im.db.QueryContext(ctx, query+` ORDER BY number`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []goneSong
	for rows.Next() {
		var g goneSong
		var path string
		if err := rows.Scan(&g.number, &g.sha, &g.media, &path); err != nil {
			return nil, err
		}
		if scope == ScopeNoMusic {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			if !silentMIDI(path) {
				continue
			}
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

// silentMIDI reports whether the MIDI file at path can be read and has no audible note.
func silentMIDI(path string) bool {
	st, err := os.Stat(path)
	if err != nil || st.Size() > maxMIDIBytes {
		return false
	}
	body, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	music, err := kar.HasAudibleNotes(body)
	return err == nil && !music
}

// removeCachedFilesOf deletes the files of dir named after one of the songs (their
// names start with the SHA-256): one pass over the directory, whatever the number of songs.
func (im *Importer) removeCachedFilesOf(dir string, shas map[string]bool) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return // no cache yet
	}
	for _, e := range entries {
		if e.IsDir() || len(e.Name()) < sha256HexLen || !shas[e.Name()[:sha256HexLen]] {
			continue
		}
		if err := os.Remove(filepath.Join(dir, e.Name())); err != nil && !errors.Is(err, os.ErrNotExist) {
			im.logger.Warn("cannot remove a cache file of a removed song", "err", err)
		}
	}
}

const sha256HexLen = 64

// FailedCount is the number of live songs marked failed.
func (im *Importer) FailedCount(ctx context.Context) (int, error) {
	var n int
	err := im.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE failed <> 0 AND deleted = 0`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count failed songs: %w", err)
	}
	return n, nil
}

// removeCacheFiles deletes the files of dir whose names start with prefix. It
// lists the directory instead of using a glob pattern, because the data
// directory's own name may contain pattern characters.
func (im *Importer) removeCacheFiles(dir, prefix string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return // no cache yet
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), prefix) {
			continue
		}
		if err := os.Remove(filepath.Join(dir, e.Name())); err != nil && !errors.Is(err, os.ErrNotExist) {
			im.logger.Warn("cannot remove a cache file of a deleted song", "err", err)
		}
	}
}
