package library

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
)

// DuplicateError means the bytes of a replacement already are another live song.
type DuplicateError struct{ Number string }

func (e *DuplicateError) Error() string { return "library: the file is already the song " + e.Number }

// ErrNotWritable means the file of a song in a watched folder could not be overwritten.
var ErrNotWritable = errors.New("the file of this song cannot be written")

// ReplaceResult says what Replace did.
type ReplaceResult struct {
	Number    string
	Unchanged bool // the bytes are the ones the song has already
}

// songState is what a replace must be able to put back.
type songState struct {
	path, sha, media string
	size, mtime      int64
	source           int
	format           int
}

// Replace gives the song number the content of a new file and keeps everything that hangs on the number: its admin title and artist,
// favourites, playlists, queue and history. A song stored by an upload gets the new file at <data>/songs/<sha>.<ext> and, once the
// new file has been read, loses the old one; a song of a watched folder has its file overwritten in place (a temporary file in the
// folder, then a rename), so that the next scan sees nothing new and the old content does not come back as another song. The caller
// has checked that the content is a valid song of the song's format. Errors: ErrNotFound, *DuplicateError (the bytes belong to another
// live song), ErrOutsideManaged and ErrNotWritable (a watched file), or a plain error. When the new file turns out unusable after
// it was read, an upload is put back as it was; a watched file stays overwritten and the song stays marked failed.
func (im *Importer) Replace(ctx context.Context, number string, content []byte) (ReplaceResult, error) {
	var old songState
	err := im.db.QueryRowContext(ctx, `SELECT path, sha256, media_path, size, mtime, source, format FROM songs WHERE number = ? AND deleted = 0`, number).
		Scan(&old.path, &old.sha, &old.media, &old.size, &old.mtime, &old.source, &old.format)
	if errors.Is(err, sql.ErrNoRows) {
		return ReplaceResult{}, ErrNotFound
	}
	if err != nil {
		return ReplaceResult{}, err
	}
	sum := sha256.Sum256(content)
	sha := hex.EncodeToString(sum[:])
	if sha == old.sha {
		return ReplaceResult{Number: number, Unchanged: true}, nil
	}
	var other string
	err = im.db.QueryRowContext(ctx, `SELECT number FROM songs WHERE sha256 = ? AND deleted = 0 AND number <> ? LIMIT 1`, sha, number).Scan(&other)
	if err == nil {
		return ReplaceResult{}, &DuplicateError{Number: other}
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return ReplaceResult{}, err
	}

	ext := ".kar"
	if Format(old.format) == FormatMP3 {
		ext = ".karmp3"
	}
	var newPath string
	created := false
	if Source(old.source) == SourceUpload {
		newPath = filepath.Join(im.dataDir, "songs", sha+ext)
		_, statErr := os.Stat(newPath)
		created = errors.Is(statErr, os.ErrNotExist)
		if err := im.writeTemp(filepath.Dir(newPath), ".upload-*", content, 0o640, func(tmp string) error {
			return fsutil.Place(tmp, newPath, fsutil.PlaceBudget)
		}); err != nil {
			return ReplaceResult{}, err
		}
	} else {
		if !im.managed(old.path) {
			return ReplaceResult{}, ErrOutsideManaged
		}
		newPath = old.path
		mode := os.FileMode(0o644)
		if st, err := os.Stat(old.path); err == nil {
			mode = st.Mode().Perm()
		}
		if err := im.writeTemp(filepath.Dir(newPath), ".replace-*", content, mode, func(tmp string) error {
			return fsutil.Replace(ctx, tmp, newPath, fsutil.PlaceBudget)
		}); err != nil {
			return ReplaceResult{}, fmt.Errorf("%w: %v", ErrNotWritable, err)
		}
	}
	st, err := os.Stat(newPath)
	if err != nil {
		return ReplaceResult{}, err
	}
	if err := im.pointAt(ctx, number, newPath, sha, st.Size(), st.ModTime().Unix()); err != nil {
		if created {
			fsutil.RemoveQuietly(newPath)
		}
		return ReplaceResult{}, err
	}
	if err := im.processMetadata(ctx, number); err != nil {
		return ReplaceResult{}, err
	}
	if im.hookAfterReplace != nil {
		im.hookAfterReplace()
	}
	var failed bool
	if err := im.db.QueryRowContext(ctx, `SELECT failed <> 0 FROM songs WHERE number = ?`, number).Scan(&failed); err != nil {
		return ReplaceResult{}, err
	}
	if failed {
		if Source(old.source) == SourceUpload {
			if err := im.pointAt(ctx, number, old.path, old.sha, old.size, old.mtime); err == nil {
				_ = im.processMetadata(ctx, number)
			}
			if created {
				fsutil.RemoveQuietly(newPath)
			}
		}
		return ReplaceResult{}, errors.New("the new file could not be processed")
	}

	// the new file is in place and read: what belonged to the old content goes
	im.removeMediaIfUnused(ctx, old.media)
	im.removeCacheFiles(filepath.Join(im.dataDir, "cache", "sf2"), old.sha+"-")
	im.removeCacheFiles(filepath.Join(im.dataDir, "cache", "render"), old.sha)
	if Source(old.source) == SourceUpload && old.path != newPath && fsutil.SamePath(filepath.Dir(old.path), filepath.Join(im.dataDir, "songs")) {
		fsutil.RemoveQuietly(old.path)
	}
	return ReplaceResult{Number: number}, nil
}

// writeTemp writes content to a new temporary file in dir with the given mode and hands it to finish, which moves it into place. The
// temporary file is removed when anything fails.
func (im *Importer) writeTemp(dir, pattern string, content []byte, mode os.FileMode, finish func(tmp string) error) error {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, pattern)
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name) // nothing is left after the rename
	if _, err := tmp.Write(content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(name, mode); err != nil {
		return err
	}
	return finish(name)
}

// pointAt makes the entry describe the file at path, with its metadata cleared to be read again, like a changed file (resetSong), but
// also moving the path.
func (im *Importer) pointAt(ctx context.Context, number, path, sha string, size, mtime int64) error {
	return im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE songs SET path = ?, sha256 = ?, size = ?, mtime = ?, metadata_done = 0, failed = 0, failed_reason = '',
			file_title = '', file_artist = '', duration_ms = 0, media_path = '', has_vocals = 0, lyric_timing = 0, gain_db = NULL, loudness_done = 0 WHERE number = ?`,
			path, sha, size, mtime, number); err != nil {
			return err
		}
		return deleteFTS(ctx, tx, number)
	})
}
