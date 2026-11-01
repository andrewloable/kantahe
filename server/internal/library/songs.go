package library

import (
	"context"
	"database/sql"
	"errors"
)

// ErrNotFound means there is no live song with that number.
var ErrNotFound = errors.New("library: song not found")

// SongInfo is a library entry as shown to users.
type SongInfo struct {
	Number, Title, Artist, Songbook string
	Format                          Format
	DurationMs                      int64
	Failed                          bool
}

// Querier is satisfied by *sql.DB, *sql.Tx and *store.DB.
type Querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// GetSong returns a live (not deleted) entry with the title and artist shown to
// users, admin edits applied.
func GetSong(ctx context.Context, q Querier, number string) (SongInfo, error) {
	var s SongInfo
	var format int
	var fileTitle, fileArtist, original string
	var editTitle, editArtist sql.NullString
	err := q.QueryRowContext(ctx, `SELECT s.number, s.format, s.songbook_number, s.duration_ms, s.failed <> 0, s.file_title, s.file_artist, s.original_name, e.title, e.artist
		FROM songs s LEFT JOIN song_edits e ON e.number = s.number WHERE s.number = ? AND s.deleted = 0`, number).
		Scan(&s.Number, &format, &s.Songbook, &s.DurationMs, &s.Failed, &fileTitle, &fileArtist, &original, &editTitle, &editArtist)
	if errors.Is(err, sql.ErrNoRows) {
		return SongInfo{}, ErrNotFound
	}
	if err != nil {
		return SongInfo{}, err
	}
	s.Format = Format(format)
	s.Title, s.Artist = display(fileTitle, fileArtist, original, editTitle, editArtist)
	return s, nil
}

// PathOf returns the stored path of a live entry.
func (im *Importer) PathOf(ctx context.Context, number string) (string, error) {
	var p string
	err := im.db.QueryRowContext(ctx, `SELECT path FROM songs WHERE number = ? AND deleted = 0`, number).Scan(&p)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return p, err
}

// Discard removes an upload that turned out to be unusable after it was
// imported: its row, search entry, stored file and extracted MP3. Entries from
// watched folders are never touched.
func (im *Importer) Discard(ctx context.Context, number string) error {
	var path, media string
	var source int
	err := im.db.QueryRowContext(ctx, `SELECT path, media_path, source FROM songs WHERE number = ?`, number).Scan(&path, &media, &source)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if Source(source) != SourceUpload {
		return errors.New("library: only uploads can be discarded")
	}
	err = im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		if err := deleteFTS(ctx, tx, number); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, `DELETE FROM songs WHERE number = ? AND source = ?`, number, int(SourceUpload))
		return err
	})
	if err != nil {
		return err
	}
	im.removeDerived(path, removeUpload)
	im.removeMediaIfUnused(ctx, media)
	return nil
}

// IsReferenced reports whether a live entry is stored at path.
func (im *Importer) IsReferenced(ctx context.Context, path string) (bool, error) {
	var n int
	err := im.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE path = ? AND deleted = 0`, path).Scan(&n)
	return n > 0, err
}
