package transfer

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/video"
)

// reportEvery is how much of one file is copied between two progress reports.
const reportEvery = 8 << 20

type ctxReader struct {
	ctx context.Context
	r   io.Reader
}

func (c ctxReader) Read(p []byte) (int, error) {
	if err := c.ctx.Err(); err != nil {
		return 0, err
	}
	return c.r.Read(p)
}

type songRow struct {
	number, path, sha, media string
	format                   int
	vocals                   bool
}

type kind int

const (
	kindSong kind = iota
	kindMedia
	kindVocals
	kindVideo
)

// item is one file to copy. A media item depends on its song: when the song's file turns out to be another one than the database
// says, or cannot be read, the extracted MP3s that go with it are left out (the target extracts them again).
type item struct {
	kind  kind
	src   string
	size  int64
	song  *songRow // the song of a song, media or vocals item
	video string   // the id of a video
	vsha  string
	dep   *item // the song item of a media item
	// results
	changed bool // song: the file is not the one the database knew
	failed  bool
	sha     string
	written int64
}

func (it *item) dir() string {
	switch it.kind {
	case kindSong:
		return "songs"
	case kindVideo:
		return "videos"
	}
	return "media"
}

func ext(format int) string {
	if format == 1 {
		return ".karmp3"
	}
	return ".kar"
}

// regular tells whether p is a regular file and how big.
func regular(p string) (int64, bool) {
	st, err := os.Stat(p)
	if err != nil || !st.Mode().IsRegular() {
		return 0, false
	}
	return st.Size(), true
}

// Export writes a copy of the whole server into folder (see CheckExportFolder for what is allowed) and returns the numbers of the live
// songs whose file could not be read. The database is copied with VACUUM INTO, which gives a consistent snapshot of a running
// database without stopping it; the snapshot is then adjusted to what was really copied (a song without its file is marked
// removed, a song whose file changed since the last scan is marked for a new read, a video without its file is dropped), so that
// the target never refers to a file the export does not hold. The manifest is written last. Nothing is deleted, and an export that
// stops leaves what it wrote, without a manifest.
func Export(ctx context.Context, folder string, o ExportOptions, report func(Progress)) (skipped []string, err error) {
	clean, err := CheckExportFolder(folder, o)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			err = fmt.Errorf("the export stopped; delete the incomplete folder %s: %w", clean, err)
		}
	}()
	if err := os.Mkdir(clean, 0o700); err != nil {
		if !errors.Is(err, fs.ErrExist) {
			return nil, err
		}
		if err := os.Chmod(clean, 0o700); err != nil {
			return nil, err
		}
	}
	for _, d := range []string{"songs", "media", "videos"} {
		if err := os.Mkdir(filepath.Join(clean, d), 0o700); err != nil {
			return nil, err
		}
	}

	dbPath := filepath.Join(clean, "kantahe.db")
	if _, err := o.DB.ExecContext(ctx, "VACUUM INTO ?", dbPath); err != nil {
		return nil, fmt.Errorf("copy the database: %w", err)
	}
	if err := os.Chmod(dbPath, 0o600); err != nil {
		return nil, err
	}
	snap, err := store.OpenFile(dbPath)
	if err != nil {
		return nil, err
	}
	closed := false
	defer func() {
		if !closed {
			_ = snap.Close()
		}
	}()

	songs, err := liveSongs(ctx, snap)
	if err != nil {
		return nil, err
	}
	videos, err := videoRows(ctx, snap)
	if err != nil {
		return nil, err
	}

	var items []*item
	var removed []*songRow
	for i := range songs {
		r := &songs[i]
		size, ok := regular(r.path)
		if !ok {
			skipped = append(skipped, r.number)
			removed = append(removed, r)
			continue
		}
		si := &item{kind: kindSong, src: r.path, size: size, song: r}
		items = append(items, si)
		if r.media != "" {
			if msize, ok := regular(r.media); ok {
				items = append(items, &item{kind: kindMedia, src: r.media, size: msize, song: r, dep: si})
			}
			if r.vocals {
				vp := strings.TrimSuffix(r.media, ".mp3") + ".vocals.mp3"
				if vsize, ok := regular(vp); ok {
					items = append(items, &item{kind: kindVocals, src: vp, size: vsize, song: r, dep: si})
				}
			}
		}
	}
	var droppedVideos []string
	for _, v := range videos {
		p := video.Path(o.DataDir, v.sha)
		size, ok := regular(p)
		if p == "" || !ok {
			droppedVideos = append(droppedVideos, v.id)
			continue
		}
		items = append(items, &item{kind: kindVideo, src: p, size: size, video: v.id, vsha: v.sha})
	}

	var prog Progress
	for _, it := range items {
		prog.FilesTotal++
		prog.BytesTotal += it.size
	}
	files := map[string]File{}
	for _, it := range items {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if it.dep != nil && (it.dep.changed || it.dep.failed) {
			prog.FilesTotal--
			prog.BytesTotal -= it.size
			continue
		}
		f, err := copyItem(ctx, clean, it, &prog, report)
		switch {
		case err == nil:
			files[f.Path] = f
			prog.FilesDone++
			report(prog)
		case ctx.Err() != nil:
			return nil, ctx.Err()
		default:
			o.logger().Warn("a file could not be copied and is left out of the export", "kind", it.kind, "err", err)
			it.failed = true
			prog.FilesTotal--
			prog.BytesTotal -= it.size
			switch it.kind {
			case kindSong:
				skipped = append(skipped, it.song.number)
				removed = append(removed, it.song)
			case kindVideo:
				droppedVideos = append(droppedVideos, it.video)
			}
		}
	}
	prog.BytesTotal = prog.BytesDone
	report(prog)

	if err := adjust(ctx, snap, items, removed, droppedVideos); err != nil {
		return nil, err
	}
	var m Manifest
	m.Format, m.KantaheVersion, m.ServerName, m.CreatedUnix = FormatVersion, o.Version, o.ServerName, o.now().Unix()
	m.Counts.Songs = len(songs) - len(removed)
	if err := snap.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&m.Counts.Users); err != nil {
		return nil, err
	}
	if err := snap.QueryRowContext(ctx, `SELECT COUNT(*) FROM videos`).Scan(&m.Counts.Videos); err != nil {
		return nil, err
	}
	if err := snap.QueryRowContext(ctx, `SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&m.SchemaVersion); err != nil {
		return nil, err
	}
	closed = true
	if err := snap.Close(); err != nil {
		return nil, err
	}
	dbFile, err := describe(dbPath, "kantahe.db")
	if err != nil {
		return nil, err
	}
	files[dbFile.Path] = dbFile
	for _, f := range files {
		m.Files = append(m.Files, f)
	}
	sort.Slice(m.Files, func(i, j int) bool { return m.Files[i].Path < m.Files[j].Path })
	if err := writeManifest(clean, m); err != nil {
		return nil, err
	}
	sort.Strings(skipped)
	return skipped, nil
}

type videoRow struct{ id, sha string }

func liveSongs(ctx context.Context, db *sql.DB) ([]songRow, error) {
	rows, err := db.QueryContext(ctx, `SELECT number, format, path, sha256, media_path, has_vocals <> 0 FROM songs WHERE deleted = 0 ORDER BY number`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []songRow
	for rows.Next() {
		var r songRow
		if err := rows.Scan(&r.number, &r.format, &r.path, &r.sha, &r.media, &r.vocals); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func videoRows(ctx context.Context, db *sql.DB) ([]videoRow, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, sha256 FROM videos ORDER BY position`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []videoRow
	for rows.Next() {
		var v videoRow
		if err := rows.Scan(&v.id, &v.sha); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// copyItem copies one file into its folder of the export, under its final name, and returns its manifest entry.
func copyItem(ctx context.Context, root string, it *item, prog *Progress, report func(Progress)) (File, error) {
	src, err := os.Open(it.src)
	if err != nil {
		return File{}, err
	}
	defer src.Close()
	dir := filepath.Join(root, it.dir())
	tmp, err := os.CreateTemp(dir, ".copy-*")
	if err != nil {
		return File{}, err
	}
	defer os.Remove(tmp.Name()) // nothing is left after the rename
	h := sha256.New()
	sinceReport := int64(0)
	w := io.MultiWriter(tmp, h)
	buf := make([]byte, 256<<10)
	var n int64
	for {
		k, rerr := (ctxReader{ctx, src}).Read(buf)
		if k > 0 {
			if _, werr := w.Write(buf[:k]); werr != nil {
				tmp.Close()
				return File{}, werr
			}
			n += int64(k)
			prog.BytesDone += int64(k)
			sinceReport += int64(k)
			if sinceReport >= reportEvery {
				sinceReport = 0
				report(*prog)
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			tmp.Close()
			return File{}, rerr
		}
	}
	if err := tmp.Close(); err != nil {
		return File{}, err
	}
	if err := os.Chmod(tmp.Name(), 0o600); err != nil {
		return File{}, err
	}
	hash := hex.EncodeToString(h.Sum(nil))
	var name string
	switch it.kind {
	case kindSong:
		name = hash + ext(it.song.format)
		it.changed = hash != it.song.sha
	case kindMedia:
		name = it.song.sha + ".mp3"
	case kindVocals:
		name = it.song.sha + ".vocals.mp3"
	case kindVideo:
		if hash != it.vsha {
			return File{}, errors.New("the video file is not the one the database knows")
		}
		name = it.vsha + ".mp4"
	}
	it.sha, it.written = hash, n
	if err := fsutil.Place(tmp.Name(), filepath.Join(dir, name), fsutil.PlaceBudget); err != nil {
		return File{}, err
	}
	return File{Path: it.dir() + "/" + name, Size: n, SHA256: hash}, nil
}

// adjust makes the snapshot say what was really copied.
func adjust(ctx context.Context, snap *sql.DB, items []*item, removed []*songRow, droppedVideos []string) error {
	tx, err := snap.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit
	for _, r := range removed {
		// the same rule as the library's removal of a vanished file: the row stays, so that its number is never used again
		if _, err := tx.ExecContext(ctx, `DELETE FROM songs_fts WHERE rowid = (SELECT rowid FROM songs WHERE number = ?)`, r.number); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE songs SET deleted = 1, path = path || '#deleted-' || number, media_path = '' WHERE number = ?`, r.number); err != nil {
			return err
		}
	}
	for _, it := range items {
		if it.kind != kindSong || !it.changed || it.failed {
			continue
		}
		if _, err := tx.ExecContext(ctx, `UPDATE songs SET sha256 = ?, size = ?, media_path = '', has_vocals = 0, lyric_timing = 0, metadata_done = 0 WHERE number = ?`, it.sha, it.written, it.song.number); err != nil {
			return err
		}
	}
	for _, id := range droppedVideos {
		if _, err := tx.ExecContext(ctx, `DELETE FROM videos WHERE id = ?`, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func describe(path, rel string) (File, error) {
	f, err := os.Open(path)
	if err != nil {
		return File{}, err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return File{}, err
	}
	return File{Path: rel, Size: n, SHA256: hex.EncodeToString(h.Sum(nil))}, nil
}

// writeManifest writes the manifest through a temporary file, so that a folder has a manifest only when it is complete.
func writeManifest(folder string, m Manifest) error {
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(folder, ".manifest-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) // nothing is left after the rename
	if _, err := tmp.Write(b); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp.Name(), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), filepath.Join(folder, ManifestName))
}
