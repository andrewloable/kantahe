package transfer

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/andrewloable/kantahe/server/internal/store"
)

const (
	pendingName = "import-pending"
	partialName = "import-pending.partial"
)

// Stage checks an export folder and copies it into <data>/import-pending, where ApplyPending finds it at the next start. It writes
// nothing else in the data folder: not the running database, and not the song, media or video folders. Every file is copied
// through a hash and compared with the manifest; the database is checked (integrity, a schema no newer than this program's, the same
// schema as a fresh database, an enabled administrator), migrated, and its paths are made to point where the files will be. Any
// failure removes what was written. The files of the export are only read.
func Stage(ctx context.Context, folder string, o ImportOptions, report func(Progress)) (err error) {
	clean, err := CheckImportFolder(folder, o)
	if err != nil {
		return err
	}
	m, err := ReadManifest(clean)
	if err != nil {
		return err
	}
	if err := CheckFilesPresent(clean, m); err != nil {
		return err
	}
	partial := filepath.Join(o.DataDir, partialName)
	if err := os.RemoveAll(partial); err != nil {
		return err
	}
	if err := os.Mkdir(partial, 0o700); err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = os.RemoveAll(partial)
		}
	}()

	prog := Progress{FilesTotal: len(m.Files), BytesTotal: m.TotalBytes()}
	for _, f := range m.Files {
		if err := copyVerified(ctx, clean, partial, f, &prog, report); err != nil {
			return err
		}
		prog.FilesDone++
		report(prog)
	}
	if err := adoptDatabase(ctx, partial, o); err != nil {
		return err
	}
	pending := filepath.Join(o.DataDir, pendingName)
	if err := os.RemoveAll(pending); err != nil {
		return err
	}
	return os.Rename(partial, pending)
}

// copyVerified copies one listed file into the staging folder and checks it against the manifest.
func copyVerified(ctx context.Context, from, to string, f File, prog *Progress, report func(Progress)) error {
	src := filepath.Join(from, filepath.FromSlash(f.Path))
	st, err := os.Lstat(src)
	if err != nil || !st.Mode().IsRegular() || st.Size() != f.Size {
		return folderErr("%s is missing or is not the file the export lists", f.Path)
	}
	in, err := os.Open(src)
	if err != nil {
		return folderErr("%s cannot be read: %v", f.Path, err)
	}
	defer in.Close()
	dst := filepath.Join(to, filepath.FromSlash(f.Path))
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	h := sha256.New()
	w := io.MultiWriter(out, h)
	buf := make([]byte, 256<<10)
	since := int64(0)
	for {
		k, rerr := (ctxReader{ctx, in}).Read(buf)
		if k > 0 {
			if _, werr := w.Write(buf[:k]); werr != nil {
				out.Close()
				return werr
			}
			prog.BytesDone += int64(k)
			since += int64(k)
			if since >= reportEvery {
				since = 0
				report(*prog)
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			out.Close()
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return folderErr("%s cannot be read: %v", f.Path, rerr)
		}
	}
	if err := out.Close(); err != nil {
		return err
	}
	got := hex.EncodeToString(h.Sum(nil))
	if got != f.SHA256 {
		return folderErr("%s is damaged: its content does not match the export", f.Path)
	}
	if strings.HasPrefix(f.Path, "songs/") && !strings.HasPrefix(filepath.Base(f.Path), got) {
		return folderErr("%s is not named after its content", f.Path)
	}
	return nil
}

var errNotKantahe = errors.New("the database in this export is not a Kantahe database")

func notKantahe(err error) error {
	if err == nil {
		return nil
	}
	return &FolderError{Msg: errNotKantahe.Error() + " (" + err.Error() + ")"}
}

// adoptDatabase checks the staged database, brings it to this program's schema and points it at the staged files.
func adoptDatabase(ctx context.Context, partial string, o ImportOptions) error {
	dbPath := filepath.Join(partial, "kantahe.db")
	if err := preCheck(ctx, dbPath); err != nil {
		return err
	}
	db, err := store.Open(ctx, partial)
	if err != nil {
		return notKantahe(err)
	}
	closed := false
	defer func() {
		if !closed {
			_ = db.Close()
		}
	}()
	got, err := store.SchemaOf(ctx, db.DB)
	if err != nil {
		return notKantahe(err)
	}
	want, err := freshSchema(ctx, o.DataDir)
	if err != nil {
		return err
	}
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		return &FolderError{Msg: errNotKantahe.Error() + " (its tables, triggers or views differ from this program's)"}
	}
	var admins int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE admin <> 0 AND disabled = 0`).Scan(&admins); err != nil {
		return notKantahe(err)
	}
	if admins == 0 {
		return folderErr("the export has no enabled administrator; nobody could sign in after the import")
	}
	if err := adoptFiles(ctx, db, partial, o); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `PRAGMA wal_checkpoint(TRUNCATE)`); err != nil {
		return err
	}
	closed = true
	if err := db.Close(); err != nil {
		return err
	}
	for _, side := range []string{"-wal", "-shm"} {
		if st, err := os.Stat(dbPath + side); err == nil && st.Size() > 0 {
			return fmt.Errorf("the staged database was not closed cleanly (%s is left)", side)
		}
	}
	return nil
}

// preCheck reads the database without changing it: it is a SQLite file that passes its integrity check and was made by a Kantahe
// whose schema this program knows.
func preCheck(ctx context.Context, dbPath string) error {
	db, err := store.OpenFile(dbPath)
	if err != nil {
		return notKantahe(err)
	}
	defer db.Close()
	rows, err := db.QueryContext(ctx, `PRAGMA integrity_check`)
	if err != nil {
		return notKantahe(err)
	}
	defer rows.Close()
	var lines []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return notKantahe(err)
		}
		lines = append(lines, s)
	}
	if err := rows.Err(); err != nil {
		return notKantahe(err)
	}
	if len(lines) != 1 || lines[0] != "ok" {
		return &FolderError{Msg: errNotKantahe.Error() + " (it is damaged)"}
	}
	var version int
	if err := db.QueryRowContext(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&version); err != nil {
		return notKantahe(err)
	}
	if version < 1 {
		return &FolderError{Msg: errNotKantahe.Error() + " (it has no history of migrations)"}
	}
	if version > store.LatestVersion() {
		return folderErr("this export was made by a newer Kantahe; upgrade this server first")
	}
	return nil
}

// freshSchema is the schema of a database that this program has just made.
func freshSchema(ctx context.Context, dataDir string) ([]string, error) {
	dir, err := os.MkdirTemp(dataDir, ".schema-check-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	db, err := store.Open(ctx, dir)
	if err != nil {
		return nil, err
	}
	defer db.Close()
	return store.SchemaOf(ctx, db.DB)
}

func isFile(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.Mode().IsRegular()
}

// adoptFiles makes every row say where its file will be once ApplyPending has moved the staged files: a song is an upload stored at
// <data>/songs/<sha>.<ext>, its extracted MP3s are in <data>/media, a video in <data>/videos. A row whose file is not in the
// export (or whose content is a copy of an earlier row's) is marked removed, as the library marks a vanished file, so that its number
// is never used again; a song whose extracted MP3s are missing is read again at the next start; a video without its file is dropped.
func adoptFiles(ctx context.Context, db *store.DB, partial string, o ImportOptions) error {
	type row struct {
		number, sha, media string
		format             int
		vocals             bool
	}
	rows, err := db.QueryContext(ctx, `SELECT number, format, sha256, media_path, has_vocals <> 0 FROM songs WHERE deleted = 0 ORDER BY number`)
	if err != nil {
		return err
	}
	var songs []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.number, &r.format, &r.sha, &r.media, &r.vocals); err != nil {
			rows.Close()
			return err
		}
		songs = append(songs, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	vrows, err := db.QueryContext(ctx, `SELECT id, sha256 FROM videos ORDER BY position`)
	if err != nil {
		return err
	}
	var videos []videoRow
	for vrows.Next() {
		var v videoRow
		if err := vrows.Scan(&v.id, &v.sha); err != nil {
			vrows.Close()
			return err
		}
		videos = append(videos, v)
	}
	if err := vrows.Err(); err != nil {
		vrows.Close()
		return err
	}
	vrows.Close()

	return db.WriteTx(ctx, func(tx *sql.Tx) error {
		taken := map[string]bool{}
		for _, r := range songs {
			ext := ext(r.format)
			final := filepath.Join(o.DataDir, "songs", r.sha+ext)
			if taken[final] || !isFile(filepath.Join(partial, "songs", r.sha+ext)) {
				o.logger().Warn("a song of the export has no file of its own and is left out", "number", r.number)
				if _, err := tx.ExecContext(ctx, `DELETE FROM songs_fts WHERE rowid = (SELECT rowid FROM songs WHERE number = ?)`, r.number); err != nil {
					return err
				}
				if _, err := tx.ExecContext(ctx, `UPDATE songs SET deleted = 1, path = path || '#deleted-' || number, media_path = '' WHERE number = ?`, r.number); err != nil {
					return err
				}
				continue
			}
			taken[final] = true
			if _, err := tx.ExecContext(ctx, `UPDATE songs SET path = ?, source = 1 WHERE number = ?`, final, r.number); err != nil {
				return err
			}
			if r.media == "" {
				continue
			}
			haveMedia := isFile(filepath.Join(partial, "media", r.sha+".mp3"))
			haveVocals := !r.vocals || isFile(filepath.Join(partial, "media", r.sha+".vocals.mp3"))
			if haveMedia && haveVocals {
				if _, err := tx.ExecContext(ctx, `UPDATE songs SET media_path = ? WHERE number = ?`, filepath.Join(o.DataDir, "media", r.sha+".mp3"), r.number); err != nil {
					return err
				}
			} else if _, err := tx.ExecContext(ctx, `UPDATE songs SET media_path = '', has_vocals = 0, lyric_timing = 0, metadata_done = 0 WHERE number = ?`, r.number); err != nil {
				return err
			}
		}
		pos := 0
		for _, v := range videos {
			if !hexSHA.MatchString(v.sha) || !isFile(filepath.Join(partial, "videos", v.sha+".mp4")) {
				if _, err := tx.ExecContext(ctx, `DELETE FROM videos WHERE id = ?`, v.id); err != nil {
					return err
				}
				continue
			}
			pos++
			if _, err := tx.ExecContext(ctx, `UPDATE videos SET position = ? WHERE id = ?`, pos, v.id); err != nil {
				return err
			}
		}
		return nil
	})
}
