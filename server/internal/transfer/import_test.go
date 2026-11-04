package transfer

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func (e *env) importOpts() ImportOptions {
	return ImportOptions{DataDir: e.data, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
}

// populated is a server with an administrator, a user, an upload with vocals, a song of the watched folder and a video, and its export.
func populated(t *testing.T) (*env, string) {
	t.Helper()
	e := newEnv(t)
	e.user("admin@example.com", true)
	e.user("sam@example.com", false)
	e.upload("Tune.karmp3", vocalsKarmp3("Tune", testfix.MP3Frames(50), testfix.MP3Frames(40)))
	e.watched("Other.kar", kar("Other"))
	e.video()
	folder := newFolder(t)
	export(t, e, folder)
	return e, folder
}

// refresh writes the manifest again after a test changed a file of the export: size and hash of every file that is still there.
func refresh(t *testing.T, folder string, mutate func(*Manifest)) {
	t.Helper()
	m := readManifest(t, folder)
	var kept []File
	for _, f := range m.Files {
		if d, err := describe(filepath.Join(folder, filepath.FromSlash(f.Path)), f.Path); err == nil {
			kept = append(kept, d)
		}
	}
	m.Files = kept
	if mutate != nil {
		mutate(&m)
	}
	writeJSON(t, folder, m)
}

func writeJSON(t *testing.T, folder string, v any) {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	p := filepath.Join(folder, ManifestName)
	_ = os.Remove(p)
	if err := os.WriteFile(p, b, 0o600); err != nil {
		t.Fatal(err)
	}
}

func isFolderErr(t *testing.T, err error, contains string) {
	t.Helper()
	var fe *FolderError
	if !errors.As(err, &fe) {
		t.Fatalf("want a *FolderError, got %v", err)
	}
	if contains != "" && !strings.Contains(fe.Msg, contains) {
		t.Fatalf("message %q lacks %q", fe.Msg, contains)
	}
}

func noPending(t *testing.T, data string) {
	t.Helper()
	for _, n := range []string{"import-pending", "import-pending.partial"} {
		if _, err := os.Stat(filepath.Join(data, n)); !errors.Is(err, os.ErrNotExist) {
			t.Errorf("%s is left behind: %v", n, err)
		}
	}
}

func stage(t *testing.T, e *env, folder string) {
	t.Helper()
	if err := Stage(context.Background(), folder, e.importOpts(), func(Progress) {}); err != nil {
		t.Fatal(err)
	}
}

func staged(t *testing.T, e *env) *sqlHandle {
	t.Helper()
	return snapshot(t, filepath.Join(e.data, "import-pending"))
}

func TestReadManifestAcceptsAnExport(t *testing.T) {
	_, folder := populated(t)
	m, err := ReadManifest(folder)
	if err != nil {
		t.Fatal(err)
	}
	if m.Format != FormatVersion || m.Counts.Songs != 2 || m.Counts.Users != 2 || m.Counts.Videos != 1 || len(m.Files) != 6 {
		t.Fatalf("%+v", m)
	}
}

func TestReadManifestRefuses(t *testing.T) {
	hex64 := strings.Repeat("a", 64)
	cases := []struct {
		name   string
		change func(t *testing.T, folder string)
		msg    string
	}{
		{"no manifest", func(t *testing.T, f string) { _ = os.Remove(filepath.Join(f, ManifestName)) }, "kantahe-export.json"},
		{"a huge manifest", func(t *testing.T, f string) {
			if err := os.Truncate(filepath.Join(f, ManifestName), 65<<20); err != nil {
				t.Fatal(err)
			}
		}, "too big"},
		{"an unknown field", func(t *testing.T, f string) {
			b, _ := os.ReadFile(filepath.Join(f, ManifestName))
			b = []byte(strings.Replace(string(b), `{`, `{"surprise": 1,`, 1))
			if err := os.WriteFile(filepath.Join(f, ManifestName), b, 0o600); err != nil {
				t.Fatal(err)
			}
		}, ""},
		{"not json", func(t *testing.T, f string) {
			if err := os.WriteFile(filepath.Join(f, ManifestName), []byte("nope"), 0o600); err != nil {
				t.Fatal(err)
			}
		}, ""},
		{"a newer format", func(t *testing.T, f string) { refresh(t, f, func(m *Manifest) { m.Format = 2 }) }, "newer"},
		{"a newer schema", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) { m.SchemaVersion = store.LatestVersion() + 1 })
		}, "newer"},
		{"a path that leaves the folder", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) { m.Files = append(m.Files, File{Path: "../x", Size: 1, SHA256: hex64}) })
		}, "../x"},
		{"a song with a short name", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) { m.Files = append(m.Files, File{Path: "songs/abc.kar", Size: 1, SHA256: hex64}) })
		}, "songs/abc.kar"},
		{"a song with another extension", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) {
				m.Files = append(m.Files, File{Path: "songs/" + hex64 + ".exe", Size: 1, SHA256: hex64})
			})
		}, ".exe"},
		{"an absolute path", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) { m.Files = append(m.Files, File{Path: "/etc/passwd", Size: 1, SHA256: hex64}) })
		}, "/etc/passwd"},
		{"a path twice", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) { m.Files = append(m.Files, m.Files[0]) })
		}, "twice"},
		{"a negative size", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) { m.Files[0].Size = -1 })
		}, ""},
		{"a bad hash", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) { m.Files[0].SHA256 = "XYZ" })
		}, ""},
		{"no database", func(t *testing.T, f string) {
			refresh(t, f, func(m *Manifest) {
				var keep []File
				for _, x := range m.Files {
					if x.Path != "kantahe.db" {
						keep = append(keep, x)
					}
				}
				m.Files = keep
			})
		}, "kantahe.db"},
	}
	if runtime.GOOS != "windows" {
		cases = append(cases, struct {
			name   string
			change func(t *testing.T, folder string)
			msg    string
		}{"a manifest that is a link", func(t *testing.T, f string) {
			real := filepath.Join(t.TempDir(), "real.json")
			b, _ := os.ReadFile(filepath.Join(f, ManifestName))
			if err := os.WriteFile(real, b, 0o600); err != nil {
				t.Fatal(err)
			}
			_ = os.Remove(filepath.Join(f, ManifestName))
			if err := os.Symlink(real, filepath.Join(f, ManifestName)); err != nil {
				t.Fatal(err)
			}
		}, "link"})
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, folder := populated(t)
			c.change(t, folder)
			_, err := ReadManifest(folder)
			isFolderErr(t, err, c.msg)
		})
	}
}

func TestStageVerifiesEveryFile(t *testing.T) {
	_, probe := populated(t)
	for _, f := range readManifest(t, probe).Files {
		t.Run(f.Path, func(t *testing.T) {
			_, folder := populated(t)
			target := newEnv(t)
			var file File
			for _, x := range readManifest(t, folder).Files {
				if x.Path == f.Path {
					file = x
				}
			}
			if file.Path == "" { // the names are hashes of the content, which differs between two populated servers only by the video's id
				t.Skip("not in this export")
			}
			p := filepath.Join(folder, filepath.FromSlash(file.Path))
			b, _ := os.ReadFile(p)
			b[len(b)/2] ^= 0xff // the same size, another content
			if err := os.WriteFile(p, b, 0o600); err != nil {
				t.Fatal(err)
			}
			err := Stage(context.Background(), folder, target.importOpts(), func(Progress) {})
			isFolderErr(t, err, file.Path)
			noPending(t, target.data)
		})
	}
}

func TestStageRefusesAWrongSize(t *testing.T) {
	_, folder := populated(t)
	target := newEnv(t)
	var song string
	for _, f := range readManifest(t, folder).Files {
		if strings.HasPrefix(f.Path, "songs/") && strings.HasSuffix(f.Path, ".kar") {
			song = f.Path
		}
	}
	if err := os.WriteFile(filepath.Join(folder, filepath.FromSlash(song)), []byte("short"), 0o600); err != nil {
		t.Fatal(err)
	}
	isFolderErr(t, Stage(context.Background(), folder, target.importOpts(), func(Progress) {}), song)
	noPending(t, target.data)
}

// changeDatabase opens the exported database, runs sql on it, and writes the manifest again.
func changeDatabase(t *testing.T, folder string, sql ...string) {
	t.Helper()
	db, err := store.OpenFile(filepath.Join(folder, "kantahe.db"))
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range sql {
		if _, err := db.Exec(q); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	refresh(t, folder, nil)
}

func TestStageRefusesAForeignDatabase(t *testing.T) {
	for name, change := range map[string]func(t *testing.T, folder string){
		"a trigger": func(t *testing.T, f string) {
			changeDatabase(t, f, `CREATE TRIGGER t AFTER INSERT ON songs BEGIN DELETE FROM users; END`)
		},
		"another table": func(t *testing.T, f string) { changeDatabase(t, f, `CREATE TABLE loot(x)`) },
		"not a database": func(t *testing.T, f string) {
			if err := os.WriteFile(filepath.Join(f, "kantahe.db"), []byte("this is not sqlite"), 0o600); err != nil {
				t.Fatal(err)
			}
			refresh(t, f, nil)
		},
	} {
		t.Run(name, func(t *testing.T) {
			_, folder := populated(t)
			change(t, folder)
			target := newEnv(t)
			err := Stage(context.Background(), folder, target.importOpts(), func(Progress) {})
			isFolderErr(t, err, "not a Kantahe database")
			noPending(t, target.data)
		})
	}
}

func TestStageRefusesAnExportWithoutAnAdministrator(t *testing.T) {
	_, folder := populated(t)
	changeDatabase(t, folder, `UPDATE users SET disabled = 1 WHERE admin = 1`)
	target := newEnv(t)
	isFolderErr(t, Stage(context.Background(), folder, target.importOpts(), func(Progress) {}), "administrator")
	noPending(t, target.data)
}

func TestStageMigratesAnOlderExport(t *testing.T) {
	for _, c := range []struct {
		name    string
		version int
		sql     []string
	}{
		{"made by the version before this one", 13, []string{`ALTER TABLE songs DROP COLUMN lyric_timing`, `DELETE FROM schema_migrations WHERE version = 14`}},
		{"made two versions before", 12, []string{`ALTER TABLE songs DROP COLUMN lyric_timing`, `ALTER TABLE songs DROP COLUMN has_vocals`, `DELETE FROM schema_migrations WHERE version >= 13`}},
	} {
		t.Run(c.name, func(t *testing.T) {
			_, folder := populated(t)
			changeDatabase(t, folder, c.sql...)
			refresh(t, folder, func(m *Manifest) { m.SchemaVersion = c.version })
			target := newEnv(t)
			stage(t, target, folder)
			s := staged(t, target)
			if s.num(`SELECT COUNT(*) FROM pragma_table_info('songs') WHERE name IN ('has_vocals', 'lyric_timing')`) != 2 || s.num(`SELECT MAX(version) FROM schema_migrations`) != store.LatestVersion() {
				t.Fatal("the staged database must be migrated")
			}
		})
	}
}

func TestStageRewritesPaths(t *testing.T) {
	src, folder := populated(t)
	if _, err := src.db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, created_at, deleted) VALUES ('77777', 1, 2, '/gone/old.karmp3#deleted-77777', ?, 1, 1, 'old', 1, 1)`, strings.Repeat("c", 64)); err != nil {
		t.Fatal(err)
	}
	export(t, src, folder+"-2")
	target := newEnv(t)
	stage(t, target, folder+"-2")
	s := staged(t, target)
	rows, err := s.Query(`SELECT number, format, source, path, sha256, media_path, has_vocals FROM songs WHERE deleted = 0 ORDER BY number`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		var number, path, sha, media string
		var format, source, vocals int
		if err := rows.Scan(&number, &format, &source, &path, &sha, &media, &vocals); err != nil {
			t.Fatal(err)
		}
		ext := ".kar"
		if format == 1 {
			ext = ".karmp3"
		}
		if want := filepath.Join(target.data, "songs", sha+ext); path != want || source != 1 {
			t.Errorf("song %s: path %q source %d, want %q 1", number, path, source, want)
		}
		if format == 1 {
			if want := filepath.Join(target.data, "media", sha+".mp3"); media != want || vocals != 1 {
				t.Errorf("song %s: media %q vocals %d, want %q 1", number, media, vocals, want)
			}
		} else if media != "" {
			t.Errorf("song %s: media %q", number, media)
		}
		n++
	}
	if n != 2 {
		t.Fatalf("%d live songs", n)
	}
	if s.str(`SELECT path FROM songs WHERE number = '77777'`) != "/gone/old.karmp3#deleted-77777" || s.num(`SELECT deleted FROM songs WHERE number = '77777'`) != 1 {
		t.Error("a removed song stays as it was")
	}
}

func TestStageIntoTheSameServer(t *testing.T) {
	src, folder := populated(t) // the paths of the uploads are the paths they will have again
	stage(t, src, folder)
	s := staged(t, src)
	if s.num(`SELECT COUNT(*) FROM songs WHERE deleted = 0 AND path LIKE ?`, filepath.Join(src.data, "songs")+"%") != 2 {
		t.Fatal("both songs must end up in the data folder")
	}
}

func TestStageMissingMediaIsReExtracted(t *testing.T) {
	src, folder := populated(t)
	var media string
	if err := src.db.QueryRow(`SELECT media_path FROM songs WHERE media_path <> ''`).Scan(&media); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(media); err != nil {
		t.Fatal(err)
	}
	folder2 := folder + "-2"
	export(t, src, folder2)
	target := newEnv(t)
	stage(t, target, folder2)
	s := staged(t, target)
	if s.num(`SELECT COUNT(*) FROM songs WHERE format = 1 AND deleted = 0 AND media_path = '' AND has_vocals = 0 AND metadata_done = 0`) != 1 {
		t.Fatal("a song without its extracted MP3 must be read again")
	}
}

func TestStageDropsASongWhoseFileIsNotInTheExport(t *testing.T) {
	_, folder := populated(t)
	var gone string
	for _, f := range readManifest(t, folder).Files {
		if strings.HasSuffix(f.Path, ".kar") {
			gone = f.Path
		}
	}
	if err := os.Remove(filepath.Join(folder, filepath.FromSlash(gone))); err != nil {
		t.Fatal(err)
	}
	refresh(t, folder, nil)
	target := newEnv(t)
	stage(t, target, folder)
	s := staged(t, target)
	if s.num(`SELECT COUNT(*) FROM songs WHERE deleted = 0`) != 1 || s.num(`SELECT COUNT(*) FROM songs WHERE deleted = 1`) != 1 {
		t.Fatal("one live song and one removed")
	}
	if s.num(`SELECT COUNT(*) FROM songs_fts`) != 1 {
		t.Error("the search entry of the removed song must go")
	}
}

func TestStageRefusesFolders(t *testing.T) {
	_, folder := populated(t)
	target := newEnv(t)
	root := t.TempDir()
	cases := []struct {
		name, folder, root string
	}{
		{"relative", "relative/dir", ""},
		{"empty", "", ""},
		{"missing", filepath.Join(t.TempDir(), "no"), ""},
		{"the data folder", target.data, ""},
		{"inside the data folder", filepath.Join(target.data, "sub"), ""},
		{"a folder with no manifest", t.TempDir(), ""},
		{"outside the transfer root", folder, root},
	}
	if runtime.GOOS != "windows" {
		link := filepath.Join(t.TempDir(), "link")
		if err := os.Symlink(folder, link); err != nil {
			t.Fatal(err)
		}
		cases = append(cases, struct{ name, folder, root string }{"a link", link, ""})
	}
	if err := os.MkdirAll(filepath.Join(target.data, "sub"), 0o700); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			o := target.importOpts()
			o.Root = c.root
			isFolderErr(t, Stage(context.Background(), c.folder, o, func(Progress) {}), "")
			noPending(t, target.data)
		})
	}
	if err := os.RemoveAll(filepath.Join(target.data, "sub")); err != nil {
		t.Fatal(err)
	}
	o := target.importOpts()
	o.Root = filepath.Dir(folder)
	if err := Stage(context.Background(), folder, o, func(Progress) {}); err != nil {
		t.Fatalf("inside the transfer root: %v", err)
	}
}

func TestStageReplacesAnOlderStagedImport(t *testing.T) {
	_, folder := populated(t)
	target := newEnv(t)
	for _, leftover := range []string{"import-pending", "import-pending.partial"} {
		if err := os.MkdirAll(filepath.Join(target.data, leftover), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(target.data, leftover, "old"), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	stage(t, target, folder)
	if _, err := os.Stat(filepath.Join(target.data, "import-pending", "old")); err == nil {
		t.Error("the older staged import must be gone")
	}
	if _, err := os.Stat(filepath.Join(target.data, "import-pending.partial")); err == nil {
		t.Error("the partial folder must be gone")
	}
	if _, err := os.Stat(filepath.Join(target.data, "import-pending", "kantahe.db")); err != nil {
		t.Error(err)
	}
	if left, _ := filepath.Glob(filepath.Join(target.data, "import-pending", "kantahe.db-*")); len(left) != 0 {
		t.Errorf("left beside the database: %v", left)
	}
}

func TestStageCancelledLeavesNothing(t *testing.T) {
	_, folder := populated(t)
	target := newEnv(t)
	ctx, cancel := context.WithCancel(context.Background())
	err := Stage(ctx, folder, target.importOpts(), func(Progress) { cancel() })
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err %v", err)
	}
	noPending(t, target.data)
}

func TestStageReportsProgress(t *testing.T) {
	_, folder := populated(t)
	target := newEnv(t)
	var last Progress
	calls := 0
	if err := Stage(context.Background(), folder, target.importOpts(), func(p Progress) { last = p; calls++ }); err != nil {
		t.Fatal(err)
	}
	if calls == 0 || last.FilesTotal != 6 || last.FilesDone != 6 || last.BytesTotal == 0 || last.BytesDone != last.BytesTotal {
		t.Fatalf("%d calls, last %+v", calls, last)
	}
}

var fixedNow = func() time.Time { return time.Date(2026, 11, 4, 13, 14, 15, 0, time.UTC) }

// applied stages an export of src on a target that has a user and a song of its own, closes the target's database, and applies it.
func applied(t *testing.T) (target *env, srcNumbers []string) {
	t.Helper()
	src, folder := populated(t)
	rows, err := src.db.Query(`SELECT number FROM songs WHERE deleted = 0 ORDER BY number`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var n string
		_ = rows.Scan(&n)
		srcNumbers = append(srcNumbers, n)
	}
	rows.Close()
	target = newEnv(t)
	target.user("target-admin@example.com", true)
	target.upload("Mine.karmp3", testfix.KARMP3("Mine", testfix.MP3Frames(30), "[00:01.00]hi", "Title : Mine\nArtist : Me\n"))
	stage(t, target, folder)
	if err := target.db.Close(); err != nil {
		t.Fatal(err)
	}
	return target, srcNumbers
}

func TestApplyPendingSwapsAndBacksUp(t *testing.T) {
	target, numbers := applied(t)
	if err := ApplyPending(target.data, fixedNow, target.importOpts().Logger); err != nil {
		t.Fatal(err)
	}
	noPending(t, target.data)
	db, err := store.Open(context.Background(), target.data)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var users string
	if err := db.QueryRow(`SELECT group_concat(email) FROM (SELECT email FROM users ORDER BY email)`).Scan(&users); err != nil || users != "admin@example.com,sam@example.com" {
		t.Fatalf("users %q %v", users, err)
	}
	for _, n := range numbers {
		var path string
		if err := db.QueryRow(`SELECT path FROM songs WHERE number = ?`, n).Scan(&path); err != nil {
			t.Fatal(err)
		}
		if st, err := os.Stat(path); err != nil || st.Size() == 0 {
			t.Errorf("song %s: %v", n, err)
		}
	}
	var media string
	if err := db.QueryRow(`SELECT media_path FROM songs WHERE media_path <> ''`).Scan(&media); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{media, strings.TrimSuffix(media, ".mp3") + ".vocals.mp3"} {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("%v", err)
		}
	}
	var vpath string
	if err := db.QueryRow(`SELECT sha256 FROM videos`).Scan(&vpath); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(target.data, "videos", vpath+".mp4")); err != nil {
		t.Error(err)
	}
	backups, _ := filepath.Glob(filepath.Join(target.data, "backups", "before-import-20261104-131415*"))
	if len(backups) != 1 {
		t.Fatalf("backups %v", backups)
	}
	old, err := store.OpenFile(filepath.Join(backups[0], "kantahe.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer old.Close()
	var email string
	if err := old.QueryRow(`SELECT email FROM users`).Scan(&email); err != nil || email != "target-admin@example.com" {
		t.Fatalf("the backup holds %q %v", email, err)
	}
	// the target's own song file is not deleted
	if m, _ := filepath.Glob(filepath.Join(target.data, "songs", "*")); len(m) != 3 {
		t.Errorf("song files %v: the three of the export and the one the target had... want 3 in all (two of the export, one of its own)", m)
	}
}

func TestApplyPendingIsSafeToRepeat(t *testing.T) {
	for _, failAfter := range []string{"files", "backup", "swap"} {
		t.Run(failAfter, func(t *testing.T) {
			target, numbers := applied(t)
			// a file of the export that is there already is kept
			keep := filepath.Join(target.data, "songs", strings.Repeat("e", 64)+".kar")
			if err := os.WriteFile(keep, []byte("old"), 0o640); err != nil {
				t.Fatal(err)
			}
			inject := errors.New("injected")
			applyStepHook = func(step string) error {
				if step == failAfter {
					return inject
				}
				return nil
			}
			err := ApplyPending(target.data, fixedNow, target.importOpts().Logger)
			applyStepHook = nil
			if !errors.Is(err, inject) {
				t.Fatalf("err %v", err)
			}
			if err := ApplyPending(target.data, fixedNow, target.importOpts().Logger); err != nil {
				t.Fatal(err)
			}
			noPending(t, target.data)
			db, err := store.Open(context.Background(), target.data)
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			var n int
			if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE email = 'sam@example.com'`).Scan(&n); err != nil || n != 1 {
				t.Fatalf("the import is not there: %d %v", n, err)
			}
			for _, num := range numbers {
				var path string
				if err := db.QueryRow(`SELECT path FROM songs WHERE number = ?`, num).Scan(&path); err != nil {
					t.Fatal(err)
				}
				if _, err := os.Stat(path); err != nil {
					t.Errorf("song %s: %v", num, err)
				}
			}
			if b, _ := os.ReadFile(keep); string(b) != "old" {
				t.Error("a file that is there is never touched")
			}
			if m, _ := filepath.Glob(filepath.Join(target.data, "backups", "*")); len(m) != 1 {
				t.Errorf("backups %v", m)
			}
		})
	}
}

func TestApplyPendingNothingToDo(t *testing.T) {
	e := newEnv(t)
	e.user("a@example.com", true)
	if err := e.db.Close(); err != nil {
		t.Fatal(err)
	}
	if err := ApplyPending(e.data, fixedNow, e.importOpts().Logger); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(e.data, "backups")); err == nil {
		t.Error("no import, no backup")
	}
	db, err := store.Open(context.Background(), e.data)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("%d %v", n, err)
	}
}
