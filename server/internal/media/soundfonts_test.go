package media

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/song/sf2"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// fullBank has the presets a song may ask for.
func fullBank(t *testing.T, extra ...testfix.Preset) string {
	t.Helper()
	ps := []testfix.Preset{
		{Name: "Piano", Bank: 0, Program: 0, Samples: [][]int16{make([]int16, 400)}},
		{Name: "Guitar", Bank: 0, Program: 24, Samples: [][]int16{make([]int16, 300)}},
		{Name: "Organ", Bank: 0, Program: 19, Samples: [][]int16{make([]int16, 300)}},
		{Name: "Drums", Bank: 128, Program: 0, Samples: [][]int16{make([]int16, 200)}},
	}
	ps = append(ps, extra...)
	p := filepath.Join(t.TempDir(), "bank.sf2")
	if err := os.WriteFile(p, testfix.SF2(ps), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

// songWithPrograms: channel 0 plays program 0 (piano, no program change needed), channel 1 program 24, channel 9 drums.
func songWithPrograms() []byte {
	return testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Text("@TSong")},
		{Delta: 0, Data: testfix.Program(1, 24)},
		{Delta: 0, Data: testfix.NoteOn(0, 60, 90)},
		{Delta: 0, Data: testfix.NoteOn(1, 64, 90)},
		{Delta: 0, Data: testfix.NoteOn(9, 36, 100)},
		{Delta: 480, Data: testfix.NoteOff(0, 60)},
	}}}}.Bytes()
}

func startRunner(t *testing.T, e *testEnv) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.svc.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
}

func (e *testEnv) addMIDISong(t *testing.T, number string, body []byte) string {
	t.Helper()
	p := filepath.Join(e.data, "song-"+number+".kar")
	if err := os.WriteFile(p, body, 0o640); err != nil {
		t.Fatal(err)
	}
	e.addSong(t, number, 2, p, "", false, false)
	return p
}

func waitReady(t *testing.T, e *testEnv, number string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if e.svc.Fonts().Ready(context.Background(), number) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("the SoundFont of %s never became ready", number)
}

func TestPrepareDoesNotQueueABuildThatFinishedMeanwhile(t *testing.T) {
	e, _ := newEnv(t, fullBank(t)) // no runner: the test plays the part of the other request
	e.addMIDISong(t, "00001", songWithPrograms())
	f := e.svc.Fonts()
	j, err := f.lookup(context.Background(), "00001")
	if err != nil {
		t.Fatal(err)
	}
	f.afterStat = func() { // another request builds the file after this one found it missing and before it takes the lock
		if err := f.build(j); err != nil {
			t.Error(err)
		}
	}
	f.Prepare("00001")
	f.afterStat = nil
	if n := len(f.queue); n != 0 {
		t.Fatalf("%d build(s) of a finished SoundFont were queued", n)
	}
	if n := f.builds.Load(); n != 1 {
		t.Fatalf("builds = %d, want 1", n)
	}
}

func TestPrepareBuildsOnce(t *testing.T) {
	e, _ := newEnv(t, fullBank(t))
	startRunner(t, e)
	e.addMIDISong(t, "00001", songWithPrograms())
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); e.svc.Fonts().Prepare("00001") }()
	}
	wg.Wait()
	waitReady(t, e, "00001")
	e.svc.Fonts().Prepare("1") // already built: nothing to do
	time.Sleep(50 * time.Millisecond)
	if n := e.svc.Fonts().builds.Load(); n != 1 {
		t.Fatalf("builds = %d, want 1", n)
	}
	p, err := e.svc.Fonts().Path(context.Background(), "1")
	if err != nil || !strings.HasSuffix(p, ".sf2") {
		t.Fatalf("%q %v", p, err)
	}
	// no temporary files are left behind
	entries, _ := os.ReadDir(filepath.Dir(p))
	for _, en := range entries {
		if strings.HasPrefix(en.Name(), ".build-") {
			t.Errorf("temporary file %s left behind", en.Name())
		}
	}
}

func TestPresetsFromSong(t *testing.T) {
	e, _ := newEnv(t, fullBank(t))
	startRunner(t, e)
	e.addMIDISong(t, "00001", songWithPrograms())
	e.svc.Fonts().Prepare("00001")
	waitReady(t, e, "00001")
	p, _ := e.svc.Fonts().Path(context.Background(), "00001")
	b, _ := os.ReadFile(p)
	bank, err := sf2.Parse(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		t.Fatal(err)
	}
	var got [][2]uint16
	for _, pr := range bank.Presets[:len(bank.Presets)-1] {
		got = append(got, [2]uint16{pr.Bank, pr.Program})
	}
	want := [][2]uint16{{0, 0}, {0, 24}, {128, 0}}
	if len(got) != 3 || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Fatalf("presets %v, want %v (Organ must not be included)", got, want)
	}
	full, _ := os.ReadFile(e.svc.soundFont)
	if len(b) >= len(full) {
		t.Fatalf("trimmed %d bytes, full %d", len(b), len(full))
	}
}

func TestEndpointNotReady(t *testing.T) {
	e, clock := newEnv(t, fullBank(t))
	e.addUser(t, "u1", false)
	e.addMIDISong(t, "00001", songWithPrograms())
	signed := e.svc.Sign("/media/soundfont/00001.sf2", "u1", clock.t.Add(time.Hour))
	// the worker is not running yet: the request queues the build and answers 503
	res := e.get(t, signed)
	res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable || res.Header.Get("Retry-After") != "1" {
		t.Fatalf("status %d Retry-After %q", res.StatusCode, res.Header.Get("Retry-After"))
	}
	startRunner(t, e)
	waitReady(t, e, "00001")
	res = e.get(t, signed)
	b := body(t, res)
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "application/octet-stream" || res.Header.Get("Cache-Control") != "private, max-age=86400" {
		t.Fatalf("status %d type %q cc %q", res.StatusCode, res.Header.Get("Content-Type"), res.Header.Get("Cache-Control"))
	}
	bank, err := sf2.Parse(bytes.NewReader(b), int64(len(b)))
	if err != nil || len(bank.Presets) != 4 {
		t.Fatalf("the served file must parse with the song's presets: %v", err)
	}
	// ranges work and the signature is required
	if res := e.get(t, signed, "Range", "bytes=0-3"); res.StatusCode != 206 {
		t.Fatalf("range: %d", res.StatusCode)
	}
	for _, raw := range []string{"/media/soundfont/00001.sf2", strings.Replace(signed, "00001", "00002", 1)} {
		res := e.get(t, raw)
		res.Body.Close()
		if res.StatusCode != 403 {
			t.Errorf("%s: %d", raw, res.StatusCode)
		}
	}
}

func TestMP3HasNoSoundFont(t *testing.T) {
	e, clock := newEnv(t, fullBank(t))
	e.addUser(t, "u1", false)
	p := filepath.Join(e.data, "m.mp3")
	_ = os.WriteFile(p, testfix.MP3Frames(5), 0o640)
	e.addSong(t, "00001", 1, "/z", p, false, false)
	for _, raw := range []string{"/media/soundfont/00001.sf2", "/media/soundfont/99999.sf2", "/media/soundfont/00001", "/media/soundfont/abc.sf2"} {
		signed := e.svc.Sign(strings.SplitN(raw, "?", 2)[0], "u1", clock.t.Add(time.Hour))
		res := e.get(t, signed)
		res.Body.Close()
		if res.StatusCode != 404 {
			t.Errorf("%s: %d, want 404", raw, res.StatusCode)
		}
	}
	e.svc.Fonts().Prepare("00001")
	if e.svc.Fonts().builds.Load() != 0 {
		t.Fatal("an MP3 song must never be queued")
	}
}

func TestBankChangeInvalidates(t *testing.T) {
	e1, _ := newEnv(t, fullBank(t))
	e1.addMIDISong(t, "00001", songWithPrograms())
	other := fullBank(t, testfix.Preset{Name: "Extra", Bank: 0, Program: 40, Samples: [][]int16{make([]int16, 10)}})
	e2, _ := newEnv(t, other)
	e2.addMIDISong(t, "00001", songWithPrograms())
	p1 := e1.svc.Fonts().cachePath("samesha")
	p2 := e2.svc.Fonts().cachePath("samesha")
	if filepath.Base(p1) == filepath.Base(p2) {
		t.Fatalf("a different full bank must give a different cache file: %s", filepath.Base(p1))
	}
	if !strings.HasPrefix(filepath.Base(p1), "samesha-") || len(filepath.Base(p1)) != len("samesha-")+16+len(".sf2") {
		t.Fatalf("name %s: want <song sha>-<16 hex of the bank>.sf2", filepath.Base(p1))
	}
	// the same bank gives the same name across restarts
	e3, _ := newEnv(t, e1.svc.soundFont)
	if filepath.Base(e3.svc.Fonts().cachePath("samesha")) != filepath.Base(p1) {
		t.Fatal("the cache name must be stable for one bank")
	}
}

func TestOldCacheCleanup(t *testing.T) {
	e, clock := newEnv(t, fullBank(t))
	dir := filepath.Join(e.data, "cache", "sf2")
	old := filepath.Join(dir, "old-aaaaaaaaaaaaaaaa.sf2")
	fresh := filepath.Join(dir, "fresh-aaaaaaaaaaaaaaaa.sf2")
	staleTmp := filepath.Join(dir, ".build-123")
	freshTmp := filepath.Join(dir, ".build-456")
	for _, f := range []string{old, fresh, staleTmp, freshTmp} {
		_ = os.WriteFile(f, []byte("x"), 0o640)
	}
	age := func(f string, d time.Duration) { _ = os.Chtimes(f, clock.t.Add(-d), clock.t.Add(-d)) }
	age(old, 31*24*time.Hour)
	age(fresh, 29*24*time.Hour)
	age(staleTmp, 2*time.Hour)
	age(freshTmp, time.Minute)
	e.svc.Fonts().Cleanup()
	for f, want := range map[string]bool{old: false, fresh: true, staleTmp: false, freshTmp: true} {
		_, err := os.Stat(f)
		if (err == nil) != want {
			t.Errorf("%s: exists=%v, want %v", filepath.Base(f), err == nil, want)
		}
	}
	// serving a file counts as using it
	age(fresh, 29*24*time.Hour)
	e.svc.Fonts().Touch(fresh)
	st, _ := os.Stat(fresh)
	if clock.t.Sub(st.ModTime()) > time.Second {
		t.Fatalf("Touch did not refresh the modification time: %v", st.ModTime())
	}
}

func TestBuildFailureFallsBackWithoutLooping(t *testing.T) {
	// a bank that has no piano and no drums: a song cannot be served from it
	odd := filepath.Join(t.TempDir(), "odd.sf2")
	_ = os.WriteFile(odd, testfix.SF2([]testfix.Preset{{Name: "Strange", Bank: 5, Program: 99, Samples: [][]int16{make([]int16, 10)}}}), 0o644)
	e, _ := newEnv(t, odd)
	startRunner(t, e)
	e.addMIDISong(t, "00001", songWithPrograms())
	e.svc.Fonts().Prepare("00001")
	deadline := time.Now().Add(5 * time.Second)
	for !e.svc.Fonts().Failed(context.Background(), "00001") && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if !e.svc.Fonts().Failed(context.Background(), "00001") || e.svc.Fonts().Ready(context.Background(), "00001") {
		t.Fatal("the build should have failed")
	}
	if _, err := e.svc.Fonts().Path(context.Background(), "00001"); err != ErrBuildFailed {
		t.Fatalf("err = %v", err)
	}
	before := e.svc.Fonts().builds.Load()
	e.svc.Fonts().Prepare("00001")
	time.Sleep(50 * time.Millisecond)
	if e.svc.Fonts().builds.Load() != before {
		t.Fatal("a failed song must not be rebuilt on every request")
	}
}

func TestQueueFullDropsInsteadOfBlocking(t *testing.T) {
	e, _ := newEnv(t, fullBank(t))
	done := make(chan struct{})
	go func() { // no worker is running, so the queue fills up
		for i := 1; i <= queueSize+20; i++ {
			num := fmt.Sprintf("%05d", i)
			e.addMIDISong(t, num, songWithPrograms())
			e.svc.Fonts().Prepare(num)
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Prepare blocked on a full queue")
	}
	f := e.svc.Fonts()
	f.mu.Lock()
	queued := len(f.inflight)
	f.mu.Unlock()
	if queued != queueSize {
		t.Fatalf("%d songs are marked in flight, want exactly the queue size %d (dropped ones must be asked for again later)", queued, queueSize)
	}
}

func TestFontsHandleUnknownAndInvalidNumbers(t *testing.T) {
	e, _ := newEnv(t, fullBank(t))
	f := e.svc.Fonts()
	ctx := context.Background()
	for _, n := range []string{"99999", "abc", "", "  "} {
		if f.Ready(ctx, n) || f.Failed(ctx, n) {
			t.Errorf("%q must be neither ready nor failed", n)
		}
		if _, err := f.Path(ctx, n); err == nil {
			t.Errorf("%q: Path must fail", n)
		}
		f.Prepare(n) // no panic, no work
	}
	if f.builds.Load() != 0 {
		t.Fatal("unknown songs must not be built")
	}
}

func TestServiceWithoutSoundFont(t *testing.T) {
	e, clock := newEnv(t, "")
	if e.svc.Fonts() != nil || e.svc.HasSoundFont() {
		t.Fatal("no fonts without a bank")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	e.svc.Run(ctx) // returns at once
	if err := e.svc.Close(); err != nil {
		t.Fatal(err)
	}
	e.addUser(t, "u1", false)
	res := e.get(t, e.svc.Sign("/media/soundfont/00001.sf2", "u1", clock.t.Add(time.Hour)))
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatalf("per-song route without a bank: %d", res.StatusCode)
	}
}

func TestCorruptBankIsAStartupError(t *testing.T) {
	bad := filepath.Join(t.TempDir(), "bad.sf2")
	_ = os.WriteFile(bad, []byte("this is not a soundfont at all, just text"), 0o644)
	_, err := New(context.Background(), Config{DB: nil, SoundFont: bad, DataDir: t.TempDir(), Now: time.Now, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if err == nil {
		t.Fatal("a SoundFont that cannot be parsed must stop the start")
	}
}

func TestCleanupToleratesAMissingDirectory(t *testing.T) {
	e, _ := newEnv(t, fullBank(t))
	_ = os.RemoveAll(filepath.Join(e.data, "cache"))
	e.svc.Fonts().Cleanup() // no panic
}

func TestRegression_FailedBuildsAreRetriedAfterAWhile(t *testing.T) {
	e, clock := newEnv(t, fullBank(t))
	startRunner(t, e)
	p := filepath.Join(e.data, "song.kar")
	// the song file is unreadable at first (for example a network folder that is briefly offline)
	e.addSong(t, "00001", 2, p, "", false, false)
	f := e.svc.Fonts()
	f.Prepare("00001")
	deadline := time.Now().Add(5 * time.Second)
	for !f.Failed(context.Background(), "00001") && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if !f.Failed(context.Background(), "00001") {
		t.Fatal("the first build should fail")
	}
	_ = os.WriteFile(p, songWithPrograms(), 0o640) // the folder is back
	f.Prepare("00001")
	time.Sleep(50 * time.Millisecond)
	if f.Ready(context.Background(), "00001") {
		t.Fatal("a failure is remembered for a while so that it is not retried on every request")
	}
	clock.t = clock.t.Add(failureMemory + time.Minute)
	if f.Failed(context.Background(), "00001") {
		t.Fatal("after the memory time the song is no longer considered failed")
	}
	f.Prepare("00001")
	waitReady(t, e, "00001")
}
