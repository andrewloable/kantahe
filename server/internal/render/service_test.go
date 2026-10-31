package render

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/media"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// fakeFonts stands in for the per-song SoundFonts: notReady answers ErrNotReady that many times.
type fakeFonts struct {
	path     string
	err      error
	notReady atomic.Int32
	prepares atomic.Int32
}

func (f *fakeFonts) Path(_ context.Context, _ string) (string, error) {
	if f.notReady.Add(-1) >= 0 {
		return "", media.ErrNotReady
	}
	if f.err != nil {
		return "", f.err
	}
	return f.path, nil
}

func (f *fakeFonts) Prepare(string) { f.prepares.Add(1) }

type env struct {
	db    *store.DB
	svc   *Service
	data  string
	bank  string
	fonts *fakeFonts
	clock *fakeClock
}

func newEnv(t *testing.T, limit int64) *env {
	t.Helper()
	data := t.TempDir()
	db, err := store.Open(context.Background(), data)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	bank := filepath.Join(data, "bank.sf2")
	if err := os.WriteFile(bank, sineBank(), 0o644); err != nil {
		t.Fatal(err)
	}
	fonts := &fakeFonts{path: bank}
	clock := &fakeClock{time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)}
	svc, err := New(Config{DB: db, DataDir: data, Fonts: fonts, FullBank: bank, Tag: "abcd", LimitBytes: limit,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Now: clock.now})
	if err != nil {
		t.Fatal(err)
	}
	return &env{db, svc, data, bank, fonts, clock}
}

func (e *env) run(t *testing.T) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.svc.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
}

func (e *env) addSong(t *testing.T, number string, format library.Format, body []byte) {
	t.Helper()
	p := filepath.Join(e.data, "song-"+number+".kar")
	if err := os.WriteFile(p, body, 0o640); err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, media_path, failed, deleted, metadata_done, created_at)
		VALUES (?, ?, 1, ?, ?, 1, 1, 'x', '', 0, 0, 1, 1)`, number, int(format), p, "sha"+number); err != nil {
		t.Fatal(err)
	}
}

func (e *env) waitReady(t *testing.T, number string) string {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if p, err := e.svc.Path(context.Background(), number); err == nil {
			return p
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("song %s was never rendered", number)
	return ""
}

func TestPrepareRendersAndServesFromCache(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, noteSong(1))
	if e.svc.Ready(context.Background(), "1") {
		t.Fatal("ready before it was rendered")
	}
	if _, err := e.svc.Path(context.Background(), "1"); err != media.ErrNotReady {
		t.Fatalf("before: %v, want ErrNotReady", err)
	}
	e.svc.Prepare("1") // a non-canonical number finds the same song
	p := e.waitReady(t, "00001")
	if filepath.Base(p) != "sha00001-abcd.flac" {
		t.Errorf("cache file %s, want <song sha>-<bank tag>.flac", filepath.Base(p))
	}
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	if d := decode(t, b); d.samples < SampleRate+SampleRate*3/2-SampleRate/10 {
		t.Errorf("rendered %d samples: the one-second song plus the tail is at least 2.4 s", d.samples)
	}
	if !e.svc.Ready(context.Background(), "00001") {
		t.Error("not ready after it was rendered")
	}
}

func TestOnlyOneRenderRunsAtATimeAndEachSongOnce(t *testing.T) {
	e := newEnv(t, 1<<30)
	for _, n := range []string{"00001", "00002", "00003"} {
		e.addSong(t, n, library.FormatMIDI, noteSong(1))
	}
	// queue before the worker starts, and ask repeatedly
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		for _, n := range []string{"00001", "00002", "00003"} {
			wg.Add(1)
			go func() { defer wg.Done(); e.svc.Prepare(n) }()
		}
	}
	wg.Wait()
	e.run(t)
	for _, n := range []string{"00001", "00002", "00003"} {
		e.waitReady(t, n)
	}
	time.Sleep(50 * time.Millisecond)
	if got := e.svc.renders.Load(); got != 3 {
		t.Errorf("renders = %d, want 3 (once per song)", got)
	}
	if got := e.svc.maxActive.Load(); got != 1 {
		t.Errorf("at most %d renders ran at the same time, want 1", got)
	}
}

func TestWaitsForTheSongSoundFont(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.fonts.notReady.Store(3)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, noteSong(1))
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	if e.fonts.prepares.Load() == 0 {
		t.Error("the render did not ask for the song's SoundFont to be built")
	}
}

func TestFallsBackToTheFullBank(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.fonts.err = media.ErrBuildFailed
	e.fonts.path = "/does/not/exist.sf2"
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, noteSong(1))
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
}

func TestFailureIsRememberedAndRetriedLater(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, []byte("not a midi file"))
	e.svc.Prepare("00001")
	deadline := time.Now().Add(5 * time.Second)
	for !e.svc.Failed(context.Background(), "00001") {
		if time.Now().After(deadline) {
			t.Fatal("the failure was never recorded")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if _, err := e.svc.Path(context.Background(), "00001"); err != media.ErrBuildFailed {
		t.Fatalf("Path = %v, want ErrBuildFailed", err)
	}
	if left, _ := filepath.Glob(filepath.Join(e.svc.cache.Dir(), "*")); len(left) != 0 {
		t.Fatalf("files left after a failed render: %v", left)
	}
	before := e.svc.renders.Load()
	e.svc.Prepare("00001")
	time.Sleep(100 * time.Millisecond)
	if e.svc.renders.Load() != before {
		t.Fatal("a song that just failed was rendered again at once")
	}
	e.clock.advance(11 * time.Minute)
	if e.svc.Failed(context.Background(), "00001") {
		t.Fatal("the failure was not forgotten after ten minutes")
	}
	e.svc.Prepare("00001")
	deadline = time.Now().Add(5 * time.Second)
	for e.svc.renders.Load() == before {
		if time.Now().After(deadline) {
			t.Fatal("the song did not get another chance")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestCacheZeroDisables(t *testing.T) {
	e := newEnv(t, 0)
	e.run(t)
	if e.svc.Available() {
		t.Fatal("a zero limit must switch rendering off")
	}
	e.addSong(t, "00001", library.FormatMIDI, noteSong(1))
	e.svc.Prepare("00001")
	time.Sleep(100 * time.Millisecond)
	if n := e.svc.renders.Load(); n != 0 {
		t.Fatalf("%d renders although the cache is disabled", n)
	}
}

func TestAvailableNeedsABank(t *testing.T) {
	e := newEnv(t, 1<<30)
	if !e.svc.Available() {
		t.Fatal("not available with a bank and a limit")
	}
	svc, err := New(Config{DB: e.db, DataDir: t.TempDir(), LimitBytes: 1 << 30, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if err != nil {
		t.Fatal(err)
	}
	if svc.Available() {
		t.Fatal("available without any SoundFont")
	}
}

func TestOnlyVisibleMIDISongs(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMP3, []byte("mp3"))
	e.addSong(t, "00002", library.FormatMIDI, noteSong(1))
	if _, err := e.db.Exec(`UPDATE songs SET deleted = 1 WHERE number = '00002'`); err != nil {
		t.Fatal(err)
	}
	for _, n := range []string{"00001", "00002", "99999", "abc", ""} {
		if _, err := e.svc.Path(context.Background(), n); err != library.ErrNotFound {
			t.Errorf("Path(%q) = %v, want ErrNotFound", n, err)
		}
		e.svc.Prepare(n)
		if e.svc.Ready(context.Background(), n) || e.svc.Failed(context.Background(), n) {
			t.Errorf("%q is neither ready nor failed", n)
		}
	}
	time.Sleep(50 * time.Millisecond)
	if n := e.svc.renders.Load(); n != 0 {
		t.Fatalf("%d renders of songs that cannot be played", n)
	}
}

func TestRunCancelStopsARenderAndLeavesNoFile(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.addSong(t, "00001", library.FormatMIDI, noteSong(1100)) // 18 minutes: long enough to be cancelled
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.svc.Run(ctx); close(done) }()
	e.svc.Prepare("00001")
	deadline := time.Now().Add(5 * time.Second)
	for e.svc.renders.Load() == 0 {
		if time.Now().After(deadline) {
			t.Fatal("the render never started")
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop while rendering")
	}
	if left, _ := filepath.Glob(filepath.Join(e.svc.cache.Dir(), "*")); len(left) != 0 {
		t.Fatalf("files left after a cancelled render: %v", left)
	}
	if e.svc.Failed(context.Background(), "00001") {
		t.Error("a cancelled render was recorded as a failure")
	}
}

func TestRunCleansStaleTemporaryFiles(t *testing.T) {
	e := newEnv(t, 1<<30)
	stale := filepath.Join(e.svc.cache.Dir(), ".render-stale")
	if err := os.WriteFile(stale, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	old := e.clock.t.Add(-3 * time.Hour)
	if err := os.Chtimes(stale, old, old); err != nil {
		t.Fatal(err)
	}
	e.run(t)
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(stale); os.IsNotExist(err) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("the stale temporary file was not removed at start")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestTouchRefreshesTheCacheFile(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, noteSong(1))
	e.svc.Prepare("00001")
	p := e.waitReady(t, "00001")
	old := e.clock.t.Add(-48 * time.Hour)
	if err := os.Chtimes(p, old, old); err != nil {
		t.Fatal(err)
	}
	e.svc.Touch(p)
	st, _ := os.Stat(p)
	if !st.ModTime().Equal(e.clock.t) {
		t.Fatalf("mtime %v after Touch, want the clock's %v", st.ModTime(), e.clock.t)
	}
}

func TestRenderedFileIsPlayable(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, noteSong(2))
	e.svc.Prepare("00001")
	b, err := os.ReadFile(e.waitReady(t, "00001"))
	if err != nil {
		t.Fatal(err)
	}
	if d := decode(t, b); d.rms <= 0.01 {
		t.Fatalf("silent: rms %v", d.rms)
	}
	var direct bytes.Buffer
	if err := RenderWithTail(context.Background(), noteSong(2), bytes.NewReader(sineBank()), &direct, Tail); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(b, direct.Bytes()) {
		t.Error("the cached file differs from rendering the song directly (with the tail)")
	}
}
