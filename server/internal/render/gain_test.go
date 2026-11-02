package render

import (
	"context"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/loudness"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// heldNote is middle C held for 3 seconds at the given velocity (a quiet or a loud song).
func heldNote(velocity byte) []byte {
	return testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.NoteOn(0, 60, velocity)},
		{Delta: 960 * 3, Data: testfix.NoteOff(0, 60)},
	}}}}.Bytes()
}

func (e *env) gain(t *testing.T, number string) (float64, bool) {
	t.Helper()
	return e.svc.Gain(context.Background(), number)
}

func TestRenderedSongGetsAGainOnceItsRenderIsReady(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(100))
	if _, ok := e.gain(t, "00001"); ok {
		t.Fatal("a gain before the render exists")
	}
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	g, ok := e.gain(t, "00001")
	if !ok {
		t.Fatal("a ready render has no gain")
	}
	if g < -loudness.MaxCutDB || g > loudness.MaxBoostDB {
		t.Fatalf("gain %v outside the limits", g)
	}
}

func TestAQuietRenderGetsMoreGainThanALoudOne(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(20))
	e.addSong(t, "00002", library.FormatMIDI, heldNote(127))
	for _, n := range []string{"00001", "00002"} {
		e.svc.Prepare(n)
		e.waitReady(t, n)
	}
	quiet, ok1 := e.gain(t, "00001")
	loud, ok2 := e.gain(t, "00002")
	if !ok1 || !ok2 {
		t.Fatalf("gains missing: %v %v", ok1, ok2)
	}
	if quiet <= loud+3 {
		t.Fatalf("the quiet render's gain %.1f dB must be well above the loud one's %.1f dB", quiet, loud)
	}
}

func TestARenderThatIsGoneLosesItsGainAndTheNewRenderMeasuresAgain(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(100))
	e.svc.Prepare("00001")
	p := e.waitReady(t, "00001")
	first, ok := e.gain(t, "00001")
	if !ok {
		t.Fatal("no gain")
	}
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	if _, ok := e.gain(t, "00001"); ok {
		t.Fatal("the gain of a render that is gone is still given")
	}
	// the stored gain is stale information, so a new render must write its own
	if _, err := e.db.Exec(`UPDATE render_gain SET gain_db = 99`); err != nil {
		t.Fatal(err)
	}
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	again, ok := e.gain(t, "00001")
	if !ok || again != first {
		t.Fatalf("the new render measured %v (%v), want %v again", again, ok, first)
	}
}

func TestAnotherBankMeasuresItsOwnRender(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(100))
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	other, err := New(Config{DB: e.db, DataDir: e.data, Fonts: e.fonts, FullBank: e.bank, Tag: "efgh", LimitBytes: 1 << 30,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Now: e.clock.now})
	if err != nil {
		t.Fatal(err)
	}
	// the other bank's render exists (a copy of the file), but it was never measured: the gain of the first bank is not its gain
	data, err := os.ReadFile(e.svc.cache.Path(e.svc.cacheName("sha00001")))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(other.cache.Path(other.cacheName("sha00001")), data, 0o640); err != nil {
		t.Fatal(err)
	}
	if !other.Ready(context.Background(), "00001") {
		t.Fatal("the test needs the other bank's render to exist")
	}
	if g, ok := other.Gain(context.Background(), "00001"); ok {
		t.Fatalf("a render with another SoundFont tag was never measured, but has a gain of %v", g)
	}
}

func TestASilentRenderHasNoGainAndStillPlays(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(0)) // velocity 0 is a note off: nothing sounds
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	if !e.svc.Ready(context.Background(), "00001") {
		t.Fatal("the silent render is not ready")
	}
	if g, ok := e.gain(t, "00001"); ok {
		t.Fatalf("a silent render has a gain of %v", g)
	}
}

// Renders made before the gain existed sit in the cache without a measure: the backfill reads them again (a FLAC is lossless, so the
// measure is the one the render would have made).
func TestBackfillMeasuresRendersThatHaveNoMeasure(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(100))
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	want, ok := e.gain(t, "00001")
	if !ok {
		t.Fatal("no gain")
	}
	if _, err := e.db.Exec(`DELETE FROM render_gain`); err != nil { // as a cache from before the gain existed
		t.Fatal(err)
	}
	if _, ok := e.gain(t, "00001"); ok {
		t.Fatal("the gain is still there")
	}
	e.svc.backfillGains(context.Background())
	got, ok := e.gain(t, "00001")
	if !ok || got != want {
		t.Fatalf("after the backfill %v (%v), want %v", got, ok, want)
	}
	// a render that has its measure is not read again
	if _, err := e.db.Exec(`UPDATE render_gain SET gain_db = 5.5`); err != nil {
		t.Fatal(err)
	}
	e.svc.backfillGains(context.Background())
	if g, _ := e.gain(t, "00001"); g != 5.5 {
		t.Fatalf("the backfill measured a render that already had its measure: %v", g)
	}
}

func TestRunBackfillsTheCacheAtStart(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(100))
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	want, _ := e.gain(t, "00001")
	if _, err := e.db.Exec(`DELETE FROM render_gain`); err != nil {
		t.Fatal(err)
	}
	// the server starts again: a new service over the same cache
	again, err := New(Config{DB: e.db, DataDir: e.data, Fonts: e.fonts, FullBank: e.bank, Tag: "abcd", LimitBytes: 1 << 30,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Now: e.clock.now})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { again.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if g, ok := again.Gain(context.Background(), "00001"); ok {
			if g != want {
				t.Fatalf("measured %v, want %v", g, want)
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("Run did not backfill the cached render")
}

func TestBackfillDoesNotMeasureAgainAndLeavesSilentRendersAlone(t *testing.T) {
	e := newEnv(t, 1<<30)
	e.run(t)
	e.addSong(t, "00001", library.FormatMIDI, heldNote(0)) // silent
	e.svc.Prepare("00001")
	e.waitReady(t, "00001")
	var rows int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM render_gain`).Scan(&rows)
	if rows != 1 {
		t.Fatalf("a silent render is recorded as measured: %d rows, want 1", rows)
	}
	e.svc.backfillGains(context.Background())
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM render_gain`).Scan(&rows)
	if rows != 1 {
		t.Fatalf("%d rows after the backfill, want 1", rows)
	}
	if _, ok := e.gain(t, "00001"); ok {
		t.Fatal("a silent render got a gain")
	}
}

func TestBackfillSkipsADamagedFileAndOtherBanks(t *testing.T) {
	e := newEnv(t, 1<<30)
	if err := os.WriteFile(e.svc.cache.Path("shaBAD-abcd"+Ext), []byte("not flac"), 0o640); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(e.svc.cache.Path("shaOTHER-zzzz"+Ext), []byte("not flac"), 0o640); err != nil {
		t.Fatal(err)
	}
	e.svc.backfillGains(context.Background())
	var rows int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM render_gain`).Scan(&rows)
	if rows != 0 {
		t.Fatalf("%d rows: a damaged file must not be recorded, and a render of another bank is not ours", rows)
	}
}
