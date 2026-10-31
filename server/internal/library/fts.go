package library

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"runtime"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

func runtimeYield() { runtime.Gosched() }

func deleteFTS(ctx context.Context, tx *sql.Tx, number string) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM songs_fts WHERE rowid = (SELECT rowid FROM songs WHERE number = ?)`, number)
	return err
}

// letterOf is the A-Z browse letter of a title or artist: its first letter with
// accents removed and upper-cased, or "#".
func letterOf(s string) string {
	s = strings.TrimSpace(s)
	for _, r := range norm.NFD.String(s) {
		if r >= 'a' && r <= 'z' {
			r = unicode.ToUpper(r)
		}
		if r >= 'A' && r <= 'Z' {
			return string(r)
		}
		return "#"
	}
	return "#"
}

// titleFromFileName is the title shown for a song without one: the file name
// without its extension and number prefix.
func titleFromFileName(name string) string {
	base := name
	if i := strings.LastIndexAny(base, `/\`); i >= 0 {
		base = base[i+1:]
	}
	if dot := strings.LastIndexByte(base, '.'); dot >= 0 {
		base = base[:dot]
	}
	rest := strings.TrimLeft(base, "0123456789")
	rest = strings.Trim(rest, " -_.")
	if rest == "" {
		return strings.TrimSpace(base)
	}
	return rest
}

// syncSong refreshes the browse letters and the search entry of one song from
// its file metadata and the admin's edits (a NULL edit keeps the file's value).
func syncSong(ctx context.Context, tx *sql.Tx, number string) error {
	var rowid int64
	var original, fileTitle, fileArtist string
	var failed, deleted, done bool
	var editTitle, editArtist sql.NullString
	err := tx.QueryRowContext(ctx, `SELECT s.rowid, s.original_name, s.file_title, s.file_artist, s.failed <> 0, s.deleted <> 0, s.metadata_done <> 0, e.title, e.artist
		FROM songs s LEFT JOIN song_edits e ON e.number = s.number WHERE s.number = ?`, number).
		Scan(&rowid, &original, &fileTitle, &fileArtist, &failed, &deleted, &done, &editTitle, &editArtist)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("song %s: %w", number, sql.ErrNoRows)
	}
	if err != nil {
		return err
	}
	title, artist := display(fileTitle, fileArtist, original, editTitle, editArtist)
	if _, err := tx.ExecContext(ctx, `UPDATE songs SET title_letter = ?, artist_letter = ?, display_title = ?, display_artist = ?, title_key = ?, artist_key = ? WHERE number = ?`,
		letterOf(title), letterOf(artist), title, artist, sortKey(title), sortKey(artist), number); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM songs_fts WHERE rowid = ?`, rowid); err != nil {
		return err
	}
	if deleted || failed || !done {
		return nil
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO songs_fts(rowid, number, title, artist) VALUES (?, ?, ?, ?)`, rowid, number, title, artist)
	return err
}

// Reindex refreshes the letters and search entry of a song after an admin edit.
func (im *Importer) Reindex(ctx context.Context, number string) error {
	return im.db.WriteTx(ctx, func(tx *sql.Tx) error { return syncSong(ctx, tx, number) })
}

// namePair splits a file name like "01052 - Artist - Title.kar" into artist and title.
func namePair(name string) (artist, title string, ok bool) {
	base := name
	if i := strings.LastIndexAny(base, `/\`); i >= 0 {
		base = base[i+1:]
	}
	if dot := strings.LastIndexByte(base, '.'); dot >= 0 {
		base = base[:dot]
	}
	rest := strings.TrimLeft(base, "0123456789")
	if rest == base { // no number prefix: the pattern needs one to avoid guessing
		return "", "", false
	}
	rest = strings.TrimLeft(rest, " -_.")
	artist, title, found := strings.Cut(rest, " - ")
	artist, title = strings.TrimSpace(artist), strings.TrimSpace(title)
	if !found || artist == "" || title == "" {
		return "", "", false
	}
	return artist, title, true
}

// display is the title and artist shown for a song: the admin's edit when there is
// one (a NULL edit keeps the file's value), else the file's, else what the file
// name says ("NNNNN - Artist - Title", else the name without number and extension).
func display(fileTitle, fileArtist, original string, editTitle, editArtist sql.NullString) (title, artist string) {
	nameArtist, nameTitle, patterned := namePair(original)
	title = fileTitle
	if editTitle.Valid && strings.TrimSpace(editTitle.String) != "" {
		title = editTitle.String
	}
	if strings.TrimSpace(title) == "" {
		title = titleFromFileName(original)
		if patterned {
			title = nameTitle
		}
	}
	artist = fileArtist
	if editArtist.Valid {
		artist = editArtist.String
	} else if strings.TrimSpace(artist) == "" && patterned {
		artist = nameArtist
	}
	return strings.ToValidUTF8(title, "\uFFFD"), strings.ToValidUTF8(artist, "\uFFFD")
}

// sortKey folds a title or artist for ordering: accents removed, lower case.
func sortKey(s string) string {
	var b strings.Builder
	for _, r := range norm.NFD.String(strings.TrimSpace(s)) {
		if unicode.Is(unicode.Mn, r) {
			continue
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return b.String()
}

// CanonicalNumber returns the 5+ digit form of a typed song number (1052 -> 01052).
func CanonicalNumber(s string) (string, bool) { return canonical(s) }
