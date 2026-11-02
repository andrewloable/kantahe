package library

import (
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"os"

	"github.com/andrewloable/kantahe/server/internal/song/kar"
	"github.com/andrewloable/kantahe/server/internal/song/karmp3"
	"github.com/andrewloable/kantahe/server/internal/store"
)

const (
	// checkProgressEvery is how many songs pass between two calls of the progress function.
	checkProgressEvery = 250
	// checkBatchRows is how many changed songs one transaction writes.
	checkBatchRows = 500

	missingReason    = "the file is missing"
	unreadableReason = "file cannot be read"
	tooLargeReason   = "file is too large"
)

// checkRow is a live song as stored: where its file is and what the library believes of it.
type checkRow struct {
	number, path, sha, media string
	format                   Format
	failed                   bool
	reason                   string
	hasVocals                bool
}

// verdict is what the check finds out about one song.
type verdict struct {
	failed bool
	reason string // why, when failed
	media  string // the extracted MP3 of a .karmp3 (kept or re-extracted)
	vocals bool   // the .karmp3 has a vocals track and it is extracted next to media
}

// judge re-evaluates one song from its file: the rules of the import (the file is there and can be read, a MIDI file has audible notes,
// a .karmp3 can be opened and its MP3 is on disk), without the full parse of a .kar (that costs minutes on a big library).
func (im *Importer) judge(r checkRow) verdict {
	st, err := os.Stat(r.path)
	if errors.Is(err, fs.ErrNotExist) {
		return verdict{failed: true, reason: missingReason, media: r.media}
	}
	if err != nil {
		return verdict{failed: true, reason: unreadableReason, media: r.media}
	}
	if r.format == FormatMIDI {
		if st.Size() > maxMIDIBytes {
			return verdict{failed: true, reason: tooLargeReason}
		}
		body, err := os.ReadFile(r.path)
		if err != nil {
			return verdict{failed: true, reason: unreadableReason}
		}
		music, err := kar.HasAudibleNotes(body)
		switch {
		case err != nil:
			return verdict{failed: true, reason: shortReason(err)}
		case !music:
			return verdict{failed: true, reason: noMusicReason}
		}
		return verdict{}
	}
	f, err := os.Open(r.path)
	if err != nil {
		return verdict{failed: true, reason: unreadableReason, media: r.media}
	}
	defer f.Close()
	if md := parseKARMP3(f, st.Size()); md.failedReason != "" {
		return verdict{failed: true, reason: md.failedReason, media: r.media}
	}
	media := r.media
	if mst, err := os.Stat(media); media == "" || err != nil || mst.Size() == 0 {
		// the extracted MP3 is gone (or never was): extract it again; one that is fine is left alone
		if media, err = im.extractMP3(f, st.Size(), r.sha); err != nil {
			return verdict{failed: true, reason: shortReason(err), media: r.media}
		}
	}
	return verdict{media: media, vocals: im.vocalsReady(f, st.Size(), r.sha, media)}
}

// vocalsReady says whether the .karmp3 has a vocals track and it is extracted next to media; a missing extracted file is made again.
// A vocals track that cannot be used is no reason to call the song broken.
func (im *Importer) vocalsReady(f *os.File, size int64, sha, media string) bool {
	a, err := karmp3.Open(f, size)
	if err != nil || !a.HasVocals() {
		return false
	}
	if st, err := os.Stat(vocalsPathOf(media)); err == nil && st.Size() > 0 {
		return true
	}
	has, _ := im.extractVocals(f, size, sha)
	return has
}

// CheckLibrary re-judges every finished live song, marks the broken ones failed (they leave searches and lists at once, as import
// failures do) and clears the mark of songs that are fine now. It returns how many songs are broken after the check. progress is
// called every checkProgressEvery songs and at the end with checked == total. When ctx ends the check stops and writes nothing more.
func (im *Importer) CheckLibrary(ctx context.Context, progress func(checked, total, broken int)) (int, error) {
	rows, err := im.checkRows(ctx)
	if err != nil {
		return 0, err
	}
	type change struct {
		row checkRow
		v   verdict
	}
	var pending []change
	flush := func() error {
		if len(pending) == 0 {
			return nil
		}
		err := im.db.WriteTx(ctx, func(tx *sql.Tx) error {
			for _, c := range pending {
				res, err := tx.ExecContext(ctx, `UPDATE songs SET failed = ?, failed_reason = ?, media_path = ?, has_vocals = ? WHERE number = ? AND sha256 = ? AND deleted = 0`,
					b2i(c.v.failed), c.v.reason, c.v.media, b2i(c.v.vocals), c.row.number, c.row.sha)
				if err != nil {
					return err
				}
				if n, _ := res.RowsAffected(); n == 0 {
					continue // changed or removed meanwhile
				}
				if err := syncSong(ctx, tx, c.row.number); err != nil {
					return err
				}
			}
			return nil
		})
		pending = pending[:0]
		return err
	}
	broken := 0
	for i, r := range rows {
		if err := ctx.Err(); err != nil {
			return broken, err
		}
		if im.hookCheck != nil {
			im.hookCheck()
		}
		v := im.judge(r)
		if v.failed {
			broken++
		}
		if v.failed != r.failed || v.reason != r.reason || v.media != r.media || v.vocals != r.hasVocals {
			pending = append(pending, change{r, v})
			if len(pending) >= checkBatchRows {
				if err := flush(); err != nil {
					return broken, err
				}
			}
		}
		if progress != nil && (i+1)%checkProgressEvery == 0 && i+1 < len(rows) {
			progress(i+1, len(rows), broken)
		}
	}
	if err := ctx.Err(); err != nil {
		return broken, err
	}
	if err := flush(); err != nil {
		return broken, err
	}
	if progress != nil {
		progress(len(rows), len(rows), broken)
	}
	return broken, nil
}

func (im *Importer) checkRows(ctx context.Context) ([]checkRow, error) {
	rows, err := im.db.QueryContext(ctx, `SELECT number, path, sha256, media_path, format, failed <> 0, failed_reason, has_vocals <> 0 FROM songs WHERE deleted = 0 AND metadata_done = 1 ORDER BY number`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []checkRow
	for rows.Next() {
		var r checkRow
		var format int
		if err := rows.Scan(&r.number, &r.path, &r.sha, &r.media, &format, &r.failed, &r.reason, &r.hasVocals); err != nil {
			return nil, err
		}
		r.format = Format(format)
		out = append(out, r)
	}
	return out, rows.Err()
}

// BrokenSong is a song marked failed and the reason.
type BrokenSong struct {
	SongInfo
	Reason string
}

// ListBroken returns one page of the live songs marked failed, ordered by number, and how many there are in all.
func ListBroken(ctx context.Context, db *store.DB, offset, limit int) ([]BrokenSong, int, error) {
	var total int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE failed <> 0 AND deleted = 0`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := db.QueryContext(ctx, `SELECT s.number, s.format, s.songbook_number, s.duration_ms, s.file_title, s.file_artist, s.original_name, e.title, e.artist, s.failed_reason
		FROM songs s LEFT JOIN song_edits e ON e.number = s.number WHERE s.failed <> 0 AND s.deleted = 0 ORDER BY s.number LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []BrokenSong
	for rows.Next() {
		var b BrokenSong
		var format int
		var fileTitle, fileArtist, original string
		var editTitle, editArtist sql.NullString
		if err := rows.Scan(&b.Number, &format, &b.Songbook, &b.DurationMs, &fileTitle, &fileArtist, &original, &editTitle, &editArtist, &b.Reason); err != nil {
			return nil, 0, err
		}
		b.Format = Format(format)
		b.Failed = true
		b.Title, b.Artist = display(fileTitle, fileArtist, original, editTitle, editArtist)
		out = append(out, b)
	}
	return out, total, rows.Err()
}

// SetCheckHookForTest makes CheckLibrary call f before it judges each song (a test holds a check open with it).
func (im *Importer) SetCheckHookForTest(f func()) { im.hookCheck = f }
