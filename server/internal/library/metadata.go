package library

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/song/kar"
	"github.com/andrewloable/kantahe/server/internal/song/karmp3"
)

const maxReasonLen = 200

// maxMIDIBytes is the largest .kar file that is read.
const maxMIDIBytes = 10 << 20

// noMusicReason is the failed reason of a MIDI file without audible notes.
const noMusicReason = "the file contains no music"

// metadata is what the metadata step learned about one file.
type metadata struct {
	title, artist string
	durationMs    int64
	mediaPath     string
	hasVocals     bool   // the .karmp3 has a vocals track and it was extracted next to mediaPath
	vocalsSkipped string // why a vocals track the file names was left out; the song is not failed for it
	failedReason  string // non-empty marks the song failed
}

// vocalsPathOf is the extracted vocals track that goes with an extracted instrumental (<sha>.mp3 and <sha>.vocals.mp3 in the
// media folder); "" for no instrumental. The server's media route derives the same name.
func vocalsPathOf(mediaPath string) string {
	if mediaPath == "" {
		return ""
	}
	return strings.TrimSuffix(mediaPath, ".mp3") + ".vocals.mp3"
}

func shortReason(err error) string {
	r := err.Error()
	if len(r) > maxReasonLen {
		r = r[:maxReasonLen]
	}
	return r
}

// parseFile reads the title, artist and duration and judges the file; problems
// with the file itself become a failed reason, not an error. It extracts nothing.
func parseFile(path string, format Format) metadata {
	switch format {
	case FormatMIDI:
		st, err := os.Stat(path)
		if err != nil {
			return metadata{failedReason: "file cannot be read"}
		}
		if st.Size() > maxMIDIBytes {
			return metadata{failedReason: "file is too large"}
		}
		body, err := os.ReadFile(path)
		if err != nil {
			return metadata{failedReason: "file cannot be read"}
		}
		return parseMIDI(body)
	default:
		f, err := os.Open(path)
		if err != nil {
			return metadata{failedReason: "file cannot be read"}
		}
		defer f.Close()
		st, err := f.Stat()
		if err != nil {
			return metadata{failedReason: "file cannot be read"}
		}
		return parseKARMP3(f, st.Size())
	}
}

func parseMIDI(body []byte) metadata {
	song, err := kar.Parse(body)
	if err != nil {
		return metadata{failedReason: shortReason(err)}
	}
	md := metadata{title: song.Title, artist: song.Artist, durationMs: song.DurationMs}
	if !song.HasMusic {
		md.failedReason = noMusicReason
	}
	return md
}

func parseKARMP3(r io.ReaderAt, size int64) metadata {
	song, err := karmp3.Parse(r, size)
	if err != nil {
		return metadata{failedReason: shortReason(err)}
	}
	return metadata{title: song.Title, artist: song.Artist, durationMs: song.DurationMs}
}

// CheckContent judges uploaded bytes before anything is stored: it returns the
// reason the file cannot be a song, or "" when it can.
func CheckContent(format Format, body []byte) string {
	if format == FormatMIDI {
		return parseMIDI(body).failedReason
	}
	return parseKARMP3(bytes.NewReader(body), int64(len(body))).failedReason
}

// readMetadata is parseFile plus, for a .karmp3, the extraction of its MP3.
func (im *Importer) readMetadata(path, sha string, format Format) metadata {
	md := parseFile(path, format)
	if md.failedReason != "" || format != FormatMP3 {
		return md
	}
	f, err := os.Open(path)
	if err != nil {
		return metadata{failedReason: "file cannot be read"}
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return metadata{failedReason: "file cannot be read"}
	}
	media, err := im.extractMP3(f, st.Size(), sha)
	if err != nil {
		md.failedReason = shortReason(err)
		return md
	}
	md.mediaPath = media
	md.hasVocals, md.vocalsSkipped = im.extractVocals(f, st.Size(), sha)
	return md
}

// extractVocals writes the vocals track of a .karmp3, when it has one, to <data>/media/<sha256>.vocals.mp3. A track that is named
// but cannot be used is not an error: the song simply has no vocals, and skipped says why.
func (im *Importer) extractVocals(f *os.File, size int64, sha string) (has bool, skipped string) {
	a, err := karmp3.Open(f, size)
	if err != nil {
		return false, shortReason(err)
	}
	if err := a.VocalsProblem(); err != nil {
		return false, shortReason(err)
	}
	if !a.HasVocals() {
		return false, ""
	}
	if _, err := im.place(a, sha+".vocals.mp3", a.ExtractVocals); err != nil {
		return false, shortReason(err)
	}
	return true, ""
}

// extractMP3 writes the MP3 of a .karmp3 to <data>/media/<sha256>.mp3 through a
// temporary file, so that readers never see a partial file.
func (im *Importer) extractMP3(f *os.File, size int64, sha string) (string, error) {
	a, err := karmp3.Open(f, size)
	if err != nil {
		return "", err
	}
	return im.place(a, sha+".mp3", a.ExtractMP3)
}

// place writes what extract produces to <data>/media/<name> through a temporary file and returns the final path.
func (im *Importer) place(a *karmp3.Archive, name string, extract func(io.Writer) (int64, error)) (string, error) {
	if err := os.MkdirAll(im.mediaDir(), 0o750); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(im.mediaDir(), ".extract-*")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name()) // no-op after the rename
	if _, err := extract(tmp); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Chmod(tmp.Name(), 0o640); err != nil {
		return "", err
	}
	final := filepath.Join(im.mediaDir(), name)
	// the name is the SHA-256 of the song: a file that is there already is the same MP3 and stays (it may be playing)
	if err := fsutil.Place(tmp.Name(), final, fsutil.PlaceBudget); err != nil {
		return "", err
	}
	// a file that was there is reused before the row names it: renew its age, so that SweepOrphans does not take it meanwhile
	now := time.Now()
	_ = os.Chtimes(final, now, now)
	return final, nil
}

// processMetadata reads one entry's file, stores title, artist, duration and
// the extracted MP3, marks the song failed when the file is unusable, and
// refreshes the search index. A file that changed meanwhile is left for the next pass.
func (im *Importer) processMetadata(ctx context.Context, number string) error {
	var path, sha string
	var format int
	err := im.db.QueryRowContext(ctx, `SELECT path, sha256, format FROM songs WHERE number = ? AND deleted = 0`, number).Scan(&path, &sha, &format)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	md := im.readMetadata(path, sha, Format(format))
	if im.hookMetadata != nil {
		im.hookMetadata()
	}
	failed := md.failedReason != ""
	if failed {
		md.mediaPath, md.hasVocals = "", false
	}
	if md.vocalsSkipped != "" && !failed {
		im.logger.Warn("vocals track left out", "song", number, "reason", md.vocalsSkipped)
	}
	return im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `UPDATE songs SET file_title = ?, file_artist = ?, duration_ms = ?, media_path = ?, has_vocals = ?, failed = ?, failed_reason = ?, metadata_done = 1
			WHERE number = ? AND sha256 = ? AND deleted = 0`,
			strings.TrimSpace(md.title), strings.TrimSpace(md.artist), md.durationMs, md.mediaPath, b2i(md.hasVocals), b2i(failed), md.failedReason, number, sha)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return nil // changed or removed meanwhile
		}
		if err := syncSong(ctx, tx, number); err != nil {
			return fmt.Errorf("update search index: %w", err)
		}
		return nil
	})
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}
