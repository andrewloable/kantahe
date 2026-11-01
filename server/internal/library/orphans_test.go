package library

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

var errInUse = errors.New("test: the file is in use")

// busyFiles makes the removal of the named files fail with a busy error while pred(now) says so. now is a fake clock that Sleep
// moves, so a retry loop of seconds runs at once; the real remove is used once the file is free.
type busyFiles struct {
	now   time.Time
	start time.Time
	slept time.Duration
}

func newBusyFiles() *busyFiles {
	t := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	return &busyFiles{now: t, start: t}
}

func (b *busyFiles) install(t *testing.T, busyFor time.Duration, paths ...string) {
	t.Helper()
	busy := func(p string) bool {
		for _, q := range paths {
			if p == q {
				return b.now.Sub(b.start) < busyFor
			}
		}
		return false
	}
	t.Cleanup(fsutil.SetHooksForTest(fsutil.Hooks{
		IsBusy: func(err error) bool { return errors.Is(err, errInUse) },
		Remove: func(p string) error {
			if busy(p) {
				return &fs.PathError{Op: "remove", Path: p, Err: errInUse}
			}
			return os.Remove(p)
		},
		Now: func() time.Time { return b.now },
		Sleep: func(_ context.Context, d time.Duration) {
			b.slept += d
			b.now = b.now.Add(d)
		},
	}))
}

// logTo makes the importer log into a buffer.
func logTo(im *Importer) *bytes.Buffer {
	var buf bytes.Buffer
	im.logger = slog.New(slog.NewTextHandler(&buf, nil))
	return &buf
}

func TestDeleteSongBusyLongerThanTheBudgetFailsWithTheInUseMessageAndChangesNothing(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Alpha", "B"))
	e.scan(t)
	e.process(t)
	number := e.numberOfPath(t, p)
	b := newBusyFiles()
	b.install(t, 3*time.Second, p)

	err := e.im.DeleteSong(context.Background(), number)
	var rm *RemoveError
	if !errors.As(err, &rm) || !strings.Contains(err.Error(), "the song's file is in use") || !strings.Contains(err.Error(), "try again in a moment") {
		t.Fatalf("err = %v, want a RemoveError that says the file is in use", err)
	}
	if b.slept != fsutil.DeleteBudget {
		t.Fatalf("waited %v, want exactly the delete budget %v", b.slept, fsutil.DeleteBudget)
	}
	if r := e.row(t, number); r.Deleted {
		t.Fatal("the row must be unchanged")
	}
	if _, err := os.Stat(p); err != nil {
		t.Fatalf("the file must stay: %v", err)
	}
	if got := e.ftsNumbers(t, "Alpha"); len(got) != 1 {
		t.Fatalf("the song must still be searchable: %v", got)
	}
}

func TestDeleteSongBusyBrieflySucceeds(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Alpha", "B"))
	e.scan(t)
	e.process(t)
	number := e.numberOfPath(t, p)
	b := newBusyFiles()
	b.install(t, 200*time.Millisecond, p)

	if err := e.im.DeleteSong(context.Background(), number); err != nil {
		t.Fatal(err)
	}
	if !e.row(t, number).Deleted {
		t.Fatal("the song must be deleted")
	}
	if _, err := os.Stat(p); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("the file must be gone")
	}
}

func TestDeleteSongAFileThatIsNotBusyButDeniedKeepsItsOwnMessage(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Alpha", "B"))
	e.scan(t)
	e.process(t)
	number := e.numberOfPath(t, p)
	denied := errors.New("test: permission denied")
	t.Cleanup(fsutil.SetHooksForTest(fsutil.Hooks{
		IsBusy: func(err error) bool { return errors.Is(err, errInUse) },
		Remove: func(string) error { return denied },
	}))
	err := e.im.DeleteSong(context.Background(), number)
	var rm *RemoveError
	if !errors.As(err, &rm) || !errors.Is(err, denied) || strings.Contains(err.Error(), "in use") {
		t.Fatalf("err = %v, want the permission error unchanged", err)
	}
}

// The delete retries inside the write transaction, which holds the database's write lock; another writer waits for it at most
// store.BusyTimeout. With the real clock: a delete that waits its whole budget must leave the other writer room to succeed.
func TestDeleteSongWaitingForABusyFileDoesNotStarveAnotherWriter(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Alpha", "B"))
	e.scan(t)
	e.process(t)
	number := e.numberOfPath(t, p)
	start := time.Now()
	t.Cleanup(fsutil.SetHooksForTest(fsutil.Hooks{
		IsBusy: func(err error) bool { return errors.Is(err, errInUse) },
		Remove: func(path string) error {
			if path == p && time.Since(start) < 3*time.Second {
				return &fs.PathError{Op: "remove", Path: path, Err: errInUse}
			}
			return os.Remove(path)
		},
	}))
	deleted := make(chan error, 1)
	go func() { deleted <- e.im.DeleteSong(context.Background(), number) }()
	time.Sleep(300 * time.Millisecond) // the delete is inside its transaction now
	wrote := time.Now()
	err := e.db.WriteTx(context.Background(), func(tx *sql.Tx) error {
		_, err := tx.Exec(`INSERT INTO settings(key, value) VALUES ('probe', '1')`)
		return err
	})
	if err != nil {
		t.Fatalf("another write during the delete: %v (database is locked?)", err)
	}
	if waited := time.Since(wrote); waited > store.BusyTimeout-time.Second {
		t.Fatalf("the other writer waited %v of its %v", waited, store.BusyTimeout)
	}
	if derr := <-deleted; derr == nil || !strings.Contains(derr.Error(), "in use") {
		t.Fatalf("the delete should have given up with the in-use message, got %v", derr)
	}
}

func TestTheDeleteBudgetStaysWellUnderTheDatabaseBusyTimeout(t *testing.T) {
	if fsutil.DeleteBudget*2 > store.BusyTimeout {
		t.Fatalf("delete budget %v is not well under the busy timeout %v: other writers would fail with 'database is locked'", fsutil.DeleteBudget, store.BusyTimeout)
	}
}

func karmp3Song(t *testing.T, e *testEnv, name string) (path, media string) {
	t.Helper()
	path = e.put(t, name, testfix.KARMP3(name, testfix.MP3Frames(300), "[00:01.00]hi", "Title : Tune\nArtist : Band"))
	e.scan(t)
	e.process(t)
	media = e.row(t, e.numberOfPath(t, path)).Media
	if media == "" {
		t.Fatal("the .karmp3 should have an extracted MP3 by now")
	}
	return path, media
}

func TestRemovingASongWhoseDerivedFileIsBusySucceedsAndTheSweeperRemovesTheFileLater(t *testing.T) {
	e := newEnv(t)
	logs := logTo(e.im)
	path, media := karmp3Song(t, e, "m.karmp3")
	number := e.numberOfPath(t, path)
	b := newBusyFiles()
	b.install(t, time.Hour, media) // busy for the rest of this test, until it is released below

	if err := e.im.RemoveFromList(context.Background(), number); err != nil {
		t.Fatalf("a derived file that is busy must not fail the user's action: %v", err)
	}
	if _, err := os.Stat(media); err != nil {
		t.Fatalf("the busy media file stays for now: %v", err)
	}
	// asking again (a second song with the same media, a rescan) must not log the same warning again
	e.im.removeMediaIfUnused(context.Background(), media)
	e.im.removeMediaIfUnused(context.Background(), media)
	if n := strings.Count(logs.String(), "cannot remove a file now"); n != 1 {
		t.Fatalf("the warning was logged %d times, want once:\n%s", n, logs)
	}

	// the sweeper tries again while it is still busy: nothing is removed, nothing is logged again
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 0 {
		t.Fatalf("sweep while busy: removed %d, %v", n, err)
	}
	if n := strings.Count(logs.String(), "cannot remove a file now"); n != 1 {
		t.Fatalf("the sweeper logged again: %d\n%s", n, logs)
	}

	b.now = b.now.Add(2 * time.Hour) // released
	aged := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(media, aged, aged); err != nil { // a file is not swept within an hour of its last change
		t.Fatal(err)
	}
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 1 {
		t.Fatalf("sweep after release: removed %d, %v; want 1", n, err)
	}
	if _, err := os.Stat(media); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("the media file must be gone")
	}
	if len(e.im.stuck) != 0 {
		t.Fatalf("nothing may be remembered any more: %v", e.im.stuck)
	}
}

func TestTheSweeperNeverRemovesAFileThatALiveSongNeeds(t *testing.T) {
	e := newEnv(t)
	_, media := karmp3Song(t, e, "m.karmp3")
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(media, old, old); err != nil {
		t.Fatal(err)
	}
	// a cache file of the same song, old as well
	number := e.numberOfPath(t, filepath.Join(e.lib, "m.karmp3"))
	var sha string
	if err := e.db.QueryRow(`SELECT sha256 FROM songs WHERE number = ?`, number).Scan(&sha); err != nil {
		t.Fatal(err)
	}
	cacheFile := e.cacheFile(t, "sf2", sha+"-x.sf2", old)

	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 0 {
		t.Fatalf("removed %d, %v; a live song needs both files", n, err)
	}
	for _, p := range []string{media, cacheFile} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s must stay: %v", p, err)
		}
	}
}

// A remembered file is a known leftover, but it may be needed again: the same content imported again reuses the file (Place keeps
// it) before the new row names it. So a remembered file is swept only once it has not been touched for the grace period, and
// reusing a file touches it.
func TestAStuckFileChangedWithinTheGraceIsKeptUntilItIsOld(t *testing.T) {
	e := newEnv(t)
	p := e.leftover(t, "media/"+strings.Repeat("ab", 32)+".mp3", time.Now().Add(-10*time.Minute))
	e.im.pmu.Lock()
	e.im.stuck[p] = removeMedia
	e.im.pmu.Unlock()
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 0 {
		t.Fatalf("removed %d, %v; the file changed 10 minutes ago", n, err)
	}
	if _, err := os.Stat(p); err != nil {
		t.Fatal("a file changed within the grace period must stay")
	}
	if len(e.im.stuck) != 1 {
		t.Fatal("it stays remembered")
	}
	old := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(p, old, old); err != nil {
		t.Fatal(err)
	}
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 1 {
		t.Fatalf("removed %d, %v; once old it goes", n, err)
	}
}

func TestAStuckFileThatIsGoneIsForgotten(t *testing.T) {
	e := newEnv(t)
	e.im.pmu.Lock()
	e.im.stuck[filepath.Join(e.data, "media", strings.Repeat("ab", 32)+".mp3")] = removeMedia
	e.im.pmu.Unlock()
	if _, err := e.im.SweepOrphans(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(e.im.stuck) != 0 {
		t.Fatal("a file that no longer exists must not be remembered")
	}
}

func TestExtractingAnMP3AgainReusesTheFileAndRenewsItsAge(t *testing.T) {
	e := newEnv(t)
	path, media := karmp3Song(t, e, "m.karmp3")
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(media, old, old); err != nil {
		t.Fatal(err)
	}
	var sha string
	if err := e.db.QueryRow(`SELECT sha256 FROM songs WHERE path = ?`, path).Scan(&sha); err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	st, _ := f.Stat()
	got, err := e.im.extractMP3(f, st.Size(), sha)
	if err != nil || got != media {
		t.Fatalf("extractMP3 = %q, %v; want the same file %q", got, err, media)
	}
	info, err := os.Stat(media)
	if err != nil {
		t.Fatal(err)
	}
	if age := time.Since(info.ModTime()); age > time.Minute {
		t.Fatalf("the reused file is %v old: its age must be renewed, or the sweeper may take it before the new row names it", age)
	}
}

// a file that was remembered as stuck is not removed if a song needs it again meanwhile
func TestAStuckFileThatASongNeedsAgainIsKept(t *testing.T) {
	e := newEnv(t)
	_, media := karmp3Song(t, e, "m.karmp3")
	e.im.pmu.Lock()
	e.im.stuck[media] = removeMedia
	e.im.pmu.Unlock()
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 0 {
		t.Fatalf("removed %d, %v", n, err)
	}
	if _, err := os.Stat(media); err != nil {
		t.Fatal("a referenced file must stay")
	}
	if len(e.im.stuck) != 0 {
		t.Fatal("the entry must be forgotten")
	}
}

func (e *testEnv) cacheFile(t *testing.T, kind, name string, mtime time.Time) string {
	t.Helper()
	dir := filepath.Join(e.data, "cache", kind)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatal(err)
	}
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte("x"), 0o640); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(p, mtime, mtime); err != nil {
		t.Fatal(err)
	}
	return p
}

func (e *testEnv) leftover(t *testing.T, rel string, mtime time.Time) string {
	t.Helper()
	p := filepath.Join(e.data, rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte("x"), 0o640); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(p, mtime, mtime); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestTheSweeperRemovesOldLeftoversAndKeepsYoungOnes(t *testing.T) {
	e := newEnv(t)
	old := time.Now().Add(-2 * time.Hour)
	young := time.Now().Add(-10 * time.Minute)
	sha := strings.Repeat("ab", 32) // no song has this content
	oldGone := []string{
		e.leftover(t, "songs/.upload-123", old),
		e.leftover(t, "media/.extract-456", old),
		e.leftover(t, "media/"+sha+".mp3", old),
		e.leftover(t, "cache/sf2/.build-789", old),
		e.leftover(t, "cache/render/.render-1", old),
		e.leftover(t, "soundfont/default.sf2.tmp42", old),
		e.cacheFile(t, "sf2", sha+"-x.sf2", old),
		e.cacheFile(t, "render", sha+"-v1.ogg", old),
	}
	stays := []string{
		e.leftover(t, "songs/.upload-young", young),                    // an upload being written right now
		e.leftover(t, "media/.extract-young", young),                   // the same for an extracted MP3
		e.leftover(t, "media/"+strings.Repeat("cd", 32)+".mp3", young), // extracted, its row not stored yet
		e.cacheFile(t, "sf2", strings.Repeat("ef", 32)+"-x.sf2", young),
		e.leftover(t, "songs/"+sha+".kar", old),     // a song file is never swept, whatever it looks like
		e.leftover(t, "soundfont/default.sf2", old), // the SoundFont in use
		e.leftover(t, "media/notes.txt", old),       // not ours
		e.cacheFile(t, "sf2", "readme", old),        // not named after a SHA-256
	}
	n, err := e.im.SweepOrphans(context.Background())
	if err != nil || n != len(oldGone) {
		t.Fatalf("removed %d, %v; want %d", n, err, len(oldGone))
	}
	for _, p := range oldGone {
		if _, err := os.Stat(p); !errors.Is(err, fs.ErrNotExist) {
			t.Errorf("%s should have been removed", p)
		}
	}
	for _, p := range stays {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("%s must stay: %v", p, err)
		}
	}
}

func TestTheSweeperWithoutAnyFolderIsNotAnError(t *testing.T) {
	e := newEnv(t)
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 0 {
		t.Fatalf("removed %d, %v", n, err)
	}
}

func TestAnUploadThatCannotBeDeletedNowIsSweptLater(t *testing.T) {
	e := newEnv(t)
	logs := logTo(e.im)
	p := filepath.Join(e.data, "songs", strings.Repeat("12", 32)+".kar")
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte("x"), 0o640); err != nil {
		t.Fatal(err)
	}
	b := newBusyFiles()
	b.install(t, time.Hour, p)
	e.im.RemoveIfUnreferenced(context.Background(), p) // must not panic or fail
	if _, err := os.Stat(p); err != nil {
		t.Fatal("busy: the file stays for now")
	}
	if !strings.Contains(logs.String(), "stored upload") {
		t.Fatalf("expected one warning:\n%s", logs)
	}
	b.now = b.now.Add(2 * time.Hour)
	aged := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(p, aged, aged); err != nil {
		t.Fatal(err)
	}
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 1 {
		t.Fatalf("removed %d, %v", n, err)
	}
	if _, err := os.Stat(p); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("the upload must be gone")
	}
}

// Run sweeps once at start (and after every scan), also when no folder is watched: uploads need the sweep as much as scans do.
func TestRunSweepsLeftoversAtStartEvenWithoutWatchedFolders(t *testing.T) {
	e := newEnv(t)
	e.im.libraries = nil
	leftover := e.leftover(t, "media/.extract-crashed", time.Now().Add(-3*time.Hour))
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.im.Run(ctx); close(done) }()
	defer func() { cancel(); <-done }()
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(leftover); errors.Is(err, fs.ErrNotExist) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("Run did not sweep the leftover file at start")
		}
		time.Sleep(20 * time.Millisecond)
	}
}
