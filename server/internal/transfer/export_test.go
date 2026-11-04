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
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

type env struct {
	t    *testing.T
	data string
	lib  string
	db   *store.DB
	im   *library.Importer
}

func newEnv(t *testing.T) *env {
	t.Helper()
	data, lib := t.TempDir(), t.TempDir()
	lib, _ = fsutil.Canonical(lib) // the importer stores canonical paths (macOS temp folders are links)
	db, err := store.Open(context.Background(), data)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	im := library.NewImporter(db, data, []string{lib}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	return &env{t, data, lib, db, im}
}

func (e *env) opts() ExportOptions {
	return ExportOptions{DB: e.db, DataDir: e.data, Libraries: []string{e.lib}, Version: "test-1", ServerName: "Test box",
		Now: func() time.Time { return time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC) }, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
}

func sum(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func (e *env) write(p string, body []byte) {
	e.t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		e.t.Fatal(err)
	}
	if err := os.WriteFile(p, body, 0o644); err != nil {
		e.t.Fatal(err)
	}
}

func (e *env) numberOf(p string) string {
	e.t.Helper()
	var n string
	if err := e.db.QueryRow(`SELECT number FROM songs WHERE path = ?`, p).Scan(&n); err != nil {
		e.t.Fatal(err)
	}
	return n
}

// upload stores a song as the upload service does (<data>/songs/<sha>.<ext>) and imports it; it returns its number and file.
func (e *env) upload(name string, body []byte) (number, path string) {
	e.t.Helper()
	ext := filepath.Ext(name)
	path = filepath.Join(e.data, "songs", sum(body)+ext)
	e.write(path, body)
	if _, err := e.im.ImportFile(context.Background(), path, library.SourceUpload, name); err != nil {
		e.t.Fatal(err)
	}
	return e.numberOf(path), path
}

// watched puts a song into the watched folder and lets the importer find it and read its metadata.
func (e *env) watched(name string, body []byte) (number, path string) {
	e.t.Helper()
	path = filepath.Join(e.lib, name)
	e.write(path, body)
	e.rescan()
	return e.numberOf(path), path
}

func (e *env) rescan() {
	e.t.Helper()
	if _, err := e.im.Scan(context.Background()); err != nil {
		e.t.Fatal(err)
	}
	if err := e.im.ProcessPending(context.Background()); err != nil {
		e.t.Fatal(err)
	}
}

func (e *env) video() (sha, path string) {
	e.t.Helper()
	body := testfix.MP4(testfix.MP4Options{})
	sha = sum(body)
	path = filepath.Join(e.data, "videos", sha+".mp4")
	e.write(path, body)
	if _, err := e.db.Exec(`INSERT INTO videos(id, sha256, name, original_name, size, duration_ms, width, height, codec, has_audio, faststart, enabled, position, created_at)
		VALUES ('v1', ?, 'Clip', 'clip.mp4', ?, 1000, 1920, 1080, 'avc1', 0, 0, 1, 1, 1)`, sha, len(body)); err != nil {
		e.t.Fatal(err)
	}
	return sha, path
}

func (e *env) user(email string, admin bool) {
	e.t.Helper()
	if _, err := e.db.Exec(`INSERT INTO users(id, email, display_name, password_hash, admin, created_at) VALUES (?, ?, 'N', 'hash-of-'||?, ?, 1)`, email, email, email, admin); err != nil {
		e.t.Fatal(err)
	}
}

func vocalsKarmp3(base string, inst, voc []byte) []byte {
	nfo := "Title : Tune\nArtist : Band\nInstrumental : " + base + ".mp3\nVocals : " + base + ".vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\n"
	return testfix.KARMP3WithVocals(base, inst, voc, "[00:01.00]hi", nfo)
}

func kar(title string) []byte {
	return testfix.KAR(title, "Band", []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}})
}

func newFolder(t *testing.T) string { return filepath.Join(t.TempDir(), "export") }

func readManifest(t *testing.T, folder string) Manifest {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(folder, ManifestName))
	if err != nil {
		t.Fatal(err)
	}
	var m Manifest
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func manifestPaths(m Manifest) []string {
	var out []string
	for _, f := range m.Files {
		out = append(out, f.Path)
	}
	sort.Strings(out)
	return out
}

func filesOnDisk(t *testing.T, folder string) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir(folder, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			rel, _ := filepath.Rel(folder, p)
			out = append(out, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(out)
	return out
}

func snapshot(t *testing.T, folder string) *sqlHandle {
	t.Helper()
	db, err := store.OpenFile(filepath.Join(folder, "kantahe.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return &sqlHandle{db, t}
}

type sqlHandle struct {
	*sql.DB
	t *testing.T
}

func (h *sqlHandle) str(q string, args ...any) string {
	h.t.Helper()
	var s string
	if err := h.QueryRow(q, args...).Scan(&s); err != nil {
		h.t.Fatal(err)
	}
	return s
}

func (h *sqlHandle) num(q string, args ...any) int {
	h.t.Helper()
	var n int
	if err := h.QueryRow(q, args...).Scan(&n); err != nil {
		h.t.Fatal(err)
	}
	return n
}

func export(t *testing.T, e *env, folder string) []string {
	t.Helper()
	skipped, err := Export(context.Background(), folder, e.opts(), func(Progress) {})
	if err != nil {
		t.Fatal(err)
	}
	return skipped
}

func TestExportWritesTheLayout(t *testing.T) {
	e := newEnv(t)
	e.user("admin@example.com", true)
	e.user("sam@example.com", false)
	karmp3 := vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40))
	_, _ = e.upload("Tune.karmp3", karmp3)
	_, _ = e.watched("Other.kar", kar("Other"))
	vsha, _ := e.video()
	folder := newFolder(t)
	if skipped := export(t, e, folder); len(skipped) != 0 {
		t.Fatalf("skipped %v", skipped)
	}

	ksha, osha := sum(karmp3), sum(kar("Other"))
	want := []string{"kantahe.db", "media/" + ksha + ".mp3", "media/" + ksha + ".vocals.mp3", "songs/" + ksha + ".karmp3", "songs/" + osha + ".kar", "videos/" + vsha + ".mp4"}
	m := readManifest(t, folder)
	if got := manifestPaths(m); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("manifest files\n got %v\nwant %v", got, want)
	}
	disk := filesOnDisk(t, folder)
	wantDisk := append(append([]string{}, want...), ManifestName)
	sort.Strings(wantDisk)
	if strings.Join(disk, ",") != strings.Join(wantDisk, ",") {
		t.Fatalf("files on disk\n got %v\nwant %v", disk, wantDisk)
	}
	for _, f := range m.Files {
		b, err := os.ReadFile(filepath.Join(folder, filepath.FromSlash(f.Path)))
		if err != nil {
			t.Fatal(err)
		}
		if int64(len(b)) != f.Size || sum(b) != f.SHA256 {
			t.Errorf("%s: manifest says %d bytes %s, the file is %d bytes %s", f.Path, f.Size, f.SHA256, len(b), sum(b))
		}
	}
	var version int
	if err := e.db.QueryRow(`SELECT MAX(version) FROM schema_migrations`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if m.Format != FormatVersion || m.SchemaVersion != version || m.KantaheVersion != "test-1" || m.ServerName != "Test box" ||
		m.CreatedUnix != time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC).Unix() || m.Counts.Songs != 2 || m.Counts.Users != 2 || m.Counts.Videos != 1 {
		t.Fatalf("manifest %+v", m)
	}
	if runtime.GOOS != "windows" {
		for _, p := range append([]string{folder}, filepath.Join(folder, "songs"), filepath.Join(folder, "media"), filepath.Join(folder, "videos")) {
			if st, err := os.Stat(p); err != nil || st.Mode().Perm() != 0o700 {
				t.Errorf("%s: %v %v, want 0700", p, st, err)
			}
		}
		for _, f := range disk {
			if st, err := os.Stat(filepath.Join(folder, filepath.FromSlash(f))); err != nil || st.Mode().Perm() != 0o600 {
				t.Errorf("%s: %v %v, want 0600", f, st, err)
			}
		}
	}
	if left, _ := filepath.Glob(filepath.Join(folder, "kantahe.db-*")); len(left) != 0 {
		t.Errorf("left behind: %v", left)
	}
}

func TestExportSnapshotIsTheDatabase(t *testing.T) {
	e := newEnv(t)
	e.user("admin@example.com", true)
	e.user("sam@example.com", false)
	n1, _ := e.upload("Tune.karmp3", vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	n2, _ := e.watched("Other.kar", kar("Other"))
	if _, err := e.db.Exec(`INSERT INTO settings(key, value) VALUES ('score_seconds', '9')`); err != nil {
		t.Fatal(err)
	}
	secret, err := e.db.Secret(context.Background(), "media-signing", 32)
	if err != nil {
		t.Fatal(err)
	}
	folder := newFolder(t)
	export(t, e, folder)
	s := snapshot(t, folder)
	if got := s.str(`SELECT password_hash FROM users WHERE email = 'sam@example.com'`); got != "hash-of-sam@example.com" {
		t.Errorf("password hash %q", got)
	}
	if got := s.str(`SELECT value FROM settings WHERE key = 'score_seconds'`); got != "9" {
		t.Errorf("setting %q", got)
	}
	if got := s.str(`SELECT hex(value) FROM server_secrets WHERE name = 'media-signing'`); got != strings.ToUpper(hex.EncodeToString(secret)) {
		t.Errorf("secret %q", got)
	}
	if got := s.str(`SELECT group_concat(number) FROM (SELECT number FROM songs WHERE deleted = 0 ORDER BY number)`); got != strings.Join(sorted(n1, n2), ",") {
		t.Errorf("songs %q", got)
	}
}

func sorted(s ...string) []string { sort.Strings(s); return s }

func TestExportRefusesFolders(t *testing.T) {
	e := newEnv(t)
	other := t.TempDir()
	full := t.TempDir()
	e.write(filepath.Join(full, "keep.txt"), []byte("x"))
	aFile := filepath.Join(t.TempDir(), "file")
	e.write(aFile, []byte("x"))
	empty := t.TempDir()
	root := t.TempDir()
	inRoot := filepath.Join(root, "ok")
	cases := []struct {
		name, folder, root string
	}{
		{"relative", "relative/dir", ""},
		{"empty", "", ""},
		{"not empty", full, ""},
		{"a file", aFile, ""},
		{"inside the data folder", filepath.Join(e.data, "export"), ""},
		{"the data folder", e.data, ""},
		{"a parent of the data folder", filepath.Dir(e.data), ""},
		{"inside a watched folder", filepath.Join(e.lib, "export"), ""},
		{"the watched folder", e.lib, ""},
		{"missing parent", filepath.Join(t.TempDir(), "no", "such", "export"), ""},
		{"outside the transfer root", filepath.Join(other, "export"), root},
		{"the transfer root itself", root, root},
	}
	if runtime.GOOS != "windows" {
		link := filepath.Join(t.TempDir(), "link")
		if err := os.Symlink(empty, link); err != nil {
			t.Fatal(err)
		}
		cases = append(cases, struct{ name, folder, root string }{"a link", link, ""})
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			o := e.opts()
			o.Root = c.root
			var before []string
			if st, err := os.Lstat(c.folder); err == nil && st.IsDir() {
				before = filesOnDisk(t, c.folder)
			}
			_, err := Export(context.Background(), c.folder, o, func(Progress) {})
			var fe *FolderError
			if !errors.As(err, &fe) || fe.Msg == "" {
				t.Fatalf("want a *FolderError, got %v", err)
			}
			if c.folder != "" && filepath.IsAbs(c.folder) {
				if st, err := os.Lstat(c.folder); err == nil && st.IsDir() && c.folder != e.data && c.folder != filepath.Dir(e.data) {
					if after := filesOnDisk(t, c.folder); strings.Join(after, ",") != strings.Join(before, ",") {
						t.Errorf("the folder changed: %v -> %v", before, after)
					}
				}
			}
		})
	}
	o := e.opts()
	o.Root = root
	if got, err := Export(context.Background(), inRoot, o, func(Progress) {}); err != nil || len(got) != 0 {
		t.Fatalf("a folder inside the transfer root: %v %v", got, err)
	}
	if _, err := Export(context.Background(), empty, e.opts(), func(Progress) {}); err != nil {
		t.Fatalf("an existing empty folder: %v", err)
	}
}

func TestExportMissingSongFileIsSkipped(t *testing.T) {
	e := newEnv(t)
	n1, p1 := e.upload("Tune.karmp3", vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	n2, _ := e.upload("Song.karmp3", testfix.KARMP3("Song", testfix.MP3Frames(60), "[00:01.00]hi", "Title : Song\nArtist : Band\n"))
	sha1 := sum(vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	if err := os.Remove(p1); err != nil {
		t.Fatal(err)
	}
	folder := newFolder(t)
	skipped := export(t, e, folder)
	if len(skipped) != 1 || skipped[0] != n1 {
		t.Fatalf("skipped %v, want [%s]", skipped, n1)
	}
	s := snapshot(t, folder)
	if s.num(`SELECT deleted FROM songs WHERE number = ?`, n1) != 1 || s.str(`SELECT media_path FROM songs WHERE number = ?`, n1) != "" {
		t.Error("the song must be marked removed in the snapshot")
	}
	if !strings.Contains(s.str(`SELECT path FROM songs WHERE number = ?`, n1), "#deleted-"+n1) {
		t.Error("the path of a removed song carries #deleted-NUMBER")
	}
	if s.num(`SELECT COUNT(*) FROM songs_fts WHERE number = ?`, n1) != 0 || s.num(`SELECT COUNT(*) FROM songs_fts WHERE number = ?`, n2) != 1 {
		t.Error("the search entry of the removed song goes, the other stays")
	}
	for _, p := range manifestPaths(readManifest(t, folder)) {
		if strings.Contains(p, sha1) {
			t.Errorf("%s must not be exported", p)
		}
	}
	if s.num(`SELECT deleted FROM songs WHERE number = ?`, n2) != 0 {
		t.Error("the other song stays")
	}
}

func TestExportChangedFileIsReRead(t *testing.T) {
	e := newEnv(t)
	n, p := e.watched("Tune.karmp3", vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	oldSha := sum(vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	changed := vocalsKarmp3("Tune", testfix.MP3Frames(70), testfix.MP3Frames(60))
	e.write(p, changed) // changed since the last scan
	folder := newFolder(t)
	export(t, e, folder)
	newSha := sum(changed)
	paths := manifestPaths(readManifest(t, folder))
	if strings.Join(paths, ",") != "kantahe.db,songs/"+newSha+".karmp3" {
		t.Fatalf("exported %v", paths)
	}
	s := snapshot(t, folder)
	if s.str(`SELECT sha256 FROM songs WHERE number = ?`, n) != newSha || s.num(`SELECT size FROM songs WHERE number = ?`, n) != len(changed) ||
		s.num(`SELECT metadata_done FROM songs WHERE number = ?`, n) != 0 || s.str(`SELECT media_path FROM songs WHERE number = ?`, n) != "" ||
		s.num(`SELECT has_vocals FROM songs WHERE number = ?`, n) != 0 {
		t.Error("the snapshot row must carry the new hash and ask for a new read")
	}
	if strings.Contains(strings.Join(filesOnDisk(t, folder), ","), oldSha) {
		t.Error("the old content must not be exported")
	}
}

func TestExportSharesOneFileForEqualContent(t *testing.T) {
	e := newEnv(t)
	body := testfix.KARMP3("Song", testfix.MP3Frames(60), "[00:01.00]hi", "Title : Song\nArtist : Band\n")
	n1, _ := e.upload("Song.karmp3", body)
	twin := filepath.Join(e.lib, "twin.karmp3")
	e.write(twin, body)
	if _, err := e.db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, created_at) VALUES ('99999', 1, 2, ?, ?, ?, 1, 'twin.karmp3', 1)`, twin, sum(body), len(body)); err != nil {
		t.Fatal(err)
	}
	folder := newFolder(t)
	if skipped := export(t, e, folder); len(skipped) != 0 {
		t.Fatalf("skipped %v", skipped)
	}
	var songs []string
	for _, p := range manifestPaths(readManifest(t, folder)) {
		if strings.HasPrefix(p, "songs/") {
			songs = append(songs, p)
		}
	}
	if len(songs) != 1 || songs[0] != "songs/"+sum(body)+".karmp3" {
		t.Fatalf("songs %v", songs)
	}
	s := snapshot(t, folder)
	if s.num(`SELECT COUNT(*) FROM songs WHERE deleted = 0 AND sha256 = ?`, sum(body)) != 2 || s.num(`SELECT deleted FROM songs WHERE number = ?`, n1) != 0 {
		t.Error("both rows stay as they were")
	}
}

func TestExportMissingDerivedFilesAreLeftOut(t *testing.T) {
	e := newEnv(t)
	body := vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40))
	n, _ := e.upload("Tune.karmp3", body)
	vsha, vpath := e.video()
	var media string
	if err := e.db.QueryRow(`SELECT media_path FROM songs WHERE number = ?`, n).Scan(&media); err != nil || media == "" {
		t.Fatalf("media path %q %v", media, err)
	}
	if err := os.Remove(media); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(vpath); err != nil {
		t.Fatal(err)
	}
	folder := newFolder(t)
	if skipped := export(t, e, folder); len(skipped) != 0 {
		t.Fatalf("skipped %v", skipped)
	}
	got := strings.Join(manifestPaths(readManifest(t, folder)), ",")
	if strings.Contains(got, vsha) || strings.Contains(got, "media/"+sum(body)+".mp3,") || !strings.Contains(got, "media/"+sum(body)+".vocals.mp3") || !strings.Contains(got, "songs/"+sum(body)+".karmp3") {
		t.Fatalf("exported %s", got)
	}
	s := snapshot(t, folder)
	if s.num(`SELECT COUNT(*) FROM videos`) != 0 || readManifest(t, folder).Counts.Videos != 0 {
		t.Error("a video without a file is dropped from the snapshot")
	}
}

func TestExportReportsProgress(t *testing.T) {
	e := newEnv(t)
	e.upload("Tune.karmp3", vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	e.watched("Other.kar", kar("Other"))
	e.video()
	var seen []Progress
	if _, err := Export(context.Background(), newFolder(t), e.opts(), func(p Progress) { seen = append(seen, p) }); err != nil {
		t.Fatal(err)
	}
	if len(seen) == 0 {
		t.Fatal("no progress")
	}
	last := seen[len(seen)-1]
	if last.FilesTotal == 0 || last.FilesDone != last.FilesTotal || last.BytesDone != last.BytesTotal || last.BytesTotal == 0 {
		t.Fatalf("last %+v", last)
	}
	for i := 1; i < len(seen); i++ {
		if seen[i].FilesDone < seen[i-1].FilesDone || seen[i].BytesDone < seen[i-1].BytesDone {
			t.Fatalf("progress went back: %+v then %+v", seen[i-1], seen[i])
		}
	}
}

func TestExportCancelledLeavesNoManifest(t *testing.T) {
	e := newEnv(t)
	e.upload("Tune.karmp3", vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	e.watched("Other.kar", kar("Other"))
	ctx, cancel := context.WithCancel(context.Background())
	folder := newFolder(t)
	_, err := Export(ctx, folder, e.opts(), func(Progress) { cancel() })
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err %v", err)
	}
	if !strings.Contains(err.Error(), folder) {
		t.Errorf("the error must name the folder to delete: %v", err)
	}
	if _, err := os.Stat(filepath.Join(folder, ManifestName)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("a cancelled export has no manifest: %v", err)
	}
}

func TestExportManifestIsWrittenLast(t *testing.T) {
	e := newEnv(t)
	e.upload("Tune.karmp3", vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	e.watched("Other.kar", kar("Other"))
	e.video()
	folder := newFolder(t)
	calls := 0
	_, err := Export(context.Background(), folder, e.opts(), func(Progress) {
		calls++
		if _, err := os.Stat(filepath.Join(folder, ManifestName)); err == nil {
			t.Error("the manifest exists before the last file is written")
		}
	})
	if err != nil || calls == 0 {
		t.Fatalf("%v %d", err, calls)
	}
	readManifest(t, folder)
}

func TestExportUnreadableSongIsSkipped(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs a file that its owner cannot read")
	}
	e := newEnv(t)
	body := vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40))
	n, p := e.upload("Tune.karmp3", body)
	other, _ := e.watched("Other.kar", kar("Other"))
	if err := os.Chmod(p, 0); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(p, 0o600) })
	folder := newFolder(t)
	skipped := export(t, e, folder)
	if len(skipped) != 1 || skipped[0] != n {
		t.Fatalf("skipped %v, want [%s]", skipped, n)
	}
	for _, f := range manifestPaths(readManifest(t, folder)) {
		if strings.Contains(f, sum(body)) {
			t.Errorf("%s is exported although its song could not be read", f)
		}
	}
	s := snapshot(t, folder)
	if s.num(`SELECT deleted FROM songs WHERE number = ?`, n) != 1 || s.num(`SELECT deleted FROM songs WHERE number = ?`, other) != 0 {
		t.Error("the unreadable song is marked removed, the other stays")
	}
	if got := readManifest(t, folder).Counts.Songs; got != 1 {
		t.Errorf("counts %d songs, want 1", got)
	}
}

func TestIsDiskFull(t *testing.T) {
	for name, c := range map[string]struct {
		err  error
		want bool
	}{
		"full":    {fmt.Errorf("copy: %w", syscall.ENOSPC), true},
		"other":   {errors.New("other"), false},
		"nil":     {nil, false},
		"denied":  {syscall.EACCES, false},
		"windows": {fmt.Errorf("write: %w", syscall.Errno(112)), runtime.GOOS == "windows"},
	} {
		if got := IsDiskFull(c.err); got != c.want {
			t.Errorf("%s: IsDiskFull(%v) = %v, want %v", name, c.err, got, c.want)
		}
	}
}
