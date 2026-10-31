package session

import (
	"errors"
	"fmt"
	"math/rand"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/score"
)

type fakeClock struct{ ms int64 }

func (c *fakeClock) NowMs() int64 { return c.ms }

// fakePicker returns library songs in a fixed order, skipping excluded ones, and remembers the last exclude function.
type fakePicker struct {
	songs       []Song
	cursor      int
	lastExclude func(string) bool
	calls       int
}

func (p *fakePicker) Pick(exclude func(string) bool) (Song, bool) {
	p.calls++
	p.lastExclude = exclude
	for i := 0; i < len(p.songs); i++ {
		s := p.songs[(p.cursor+i)%len(p.songs)]
		if !exclude(s.Number) {
			p.cursor = (p.cursor + i + 1) % len(p.songs)
			return s, true
		}
	}
	return Song{}, false
}

type fakeRand struct{ v uint32 }

func (r *fakeRand) Uint32() uint32 { return r.v }

type rig struct {
	m      *Machine
	clock  *fakeClock
	picker *fakePicker
	rnd    *fakeRand
	secs   int
}

func song(n string) Song { return Song{Number: n, Format: 1, DurationMs: 180000} }

func newRig(t *testing.T, library ...string) *rig {
	t.Helper()
	r := &rig{clock: &fakeClock{ms: 1000}, picker: &fakePicker{}, rnd: &fakeRand{v: 27}, secs: 6}
	for _, n := range library {
		r.picker.songs = append(r.picker.songs, song(n))
	}
	r.m = New(Deps{Clock: r.clock, Picker: r.picker, Rand: r.rnd, ScoreSeconds: func() int { return r.secs }})
	r.m.SetOnline("d1", true)
	r.m.SetOnline("d2", true)
	return r
}

func nowNumber(s State) string {
	if s.Now == nil {
		return "<nil>"
	}
	return s.Now.Song.Number
}

func upNumber(s State) string {
	if s.UpNext == nil {
		return "<nil>"
	}
	return s.UpNext.Song.Number
}

func queueNumbers(s State) []string {
	var out []string
	for _, it := range s.Queue {
		out = append(out, it.Song.Number)
	}
	return out
}

func eq(a, b []string) bool { return fmt.Sprint(a) == fmt.Sprint(b) }

func histories(effects []Effect) []HistoryEntry {
	var out []HistoryEntry
	for _, e := range effects {
		if h, ok := e.(HistoryEntry); ok {
			out = append(out, h)
		}
	}
	return out
}

func prepares(effects []Effect) []string {
	var out []string
	for _, e := range effects {
		if p, ok := e.(PrepareSong); ok {
			out = append(out, p.Number)
		}
	}
	return out
}

func stops(effects []Effect) []string {
	var out []string
	for _, e := range effects {
		if s, ok := e.(StopPlayer); ok {
			out = append(out, s.DeviceID)
		}
	}
	return out
}

func TestAddNeverInterrupts(t *testing.T) {
	r := newRig(t, "R1", "R2", "R3")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	if s := r.m.Snapshot(); nowNumber(s) != "A" {
		t.Fatalf("now %s", nowNumber(s))
	}
	item, eff := r.m.Add(song("B"))
	s := r.m.Snapshot()
	if nowNumber(s) != "A" || !eq(queueNumbers(s), []string{"B"}) || upNumber(s) != "B" || item.Song.Number != "B" || item.ID == "" {
		t.Fatalf("now %s queue %v up %s", nowNumber(s), queueNumbers(s), upNumber(s))
	}
	if !eq(prepares(eff), []string{"B"}) {
		t.Fatalf("effects %v: the new up-next song must be prepared", eff)
	}
	// also while paused: Add never replaces the song that is loaded
	r.m.Control("d1", ActionPause)
	r.m.Add(song("C"))
	if s := r.m.Snapshot(); nowNumber(s) != "A" || s.Status != StatusPaused || !eq(queueNumbers(s), []string{"B", "C"}) {
		t.Fatalf("paused: now %s queue %v", nowNumber(s), queueNumbers(s))
	}
}

func TestAddWithNothingLoadedOnlyQueues(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	s := r.m.Snapshot()
	if s.Now != nil || s.Status != StatusPaused || !eq(queueNumbers(s), []string{"A"}) || s.UpNext != nil {
		t.Fatalf("%+v", s)
	}
}

func TestQueueIDsAreUnique(t *testing.T) {
	r := newRig(t, "R1")
	a, _ := r.m.Add(song("A"))
	b, _ := r.m.Add(song("A"))
	if a.ID == b.ID || a.ID != "q1" || b.ID != "q2" {
		t.Fatalf("%s %s", a.ID, b.ID)
	}
}

func TestPlayLoadsQueueHead(t *testing.T) {
	r := newRig(t, "R1", "R2")
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	eff := r.m.Control("d1", ActionPlay)
	s := r.m.Snapshot()
	if nowNumber(s) != "A" || s.Now.Source != SourceQueue || upNumber(s) != "B" || s.UpNext.Source != SourceQueue || s.Status != StatusPlaying || s.PlayerDeviceID != "d1" {
		t.Fatalf("%+v", s)
	}
	if !eq(queueNumbers(s), []string{"B"}) {
		t.Fatalf("the loaded song leaves the queue: %v", queueNumbers(s))
	}
	if !eq(prepares(eff), []string{"A", "B"}) {
		t.Fatalf("effects %v", eff)
	}
	if s.Now.PositionMs != 0 || s.Now.PositionAtMs != r.clock.ms {
		t.Fatalf("position %+v", s.Now)
	}
}

func TestPlayEmptyQueueRandom(t *testing.T) {
	r := newRig(t, "R1", "R2", "R3")
	r.m.Control("d1", ActionPlay)
	s := r.m.Snapshot()
	if nowNumber(s) != "R1" || s.Now.Source != SourceRandom || upNumber(s) != "R2" || s.UpNext.Source != SourceRandom || s.Status != StatusPlaying {
		t.Fatalf("%+v", s)
	}
}

func TestRandomKeepsGoingUntilTheUserAdds(t *testing.T) {
	r := newRig(t, "R1", "R2", "R3", "R4")
	r.m.Control("d1", ActionPlay)
	for i := 0; i < 3; i++ {
		r.m.Control("d1", ActionSkip)
	}
	if s := r.m.Snapshot(); nowNumber(s) != "R4" || s.Now.Source != SourceRandom {
		t.Fatalf("%+v", s.Now)
	}
}

func TestQueueBeatsPrePick(t *testing.T) {
	r := newRig(t, "R1", "R2", "R3")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay) // now A, nothing left in the queue: up next is a random pre-pick
	s := r.m.Snapshot()
	if upNumber(s) != "R1" || s.UpNext.Source != SourceRandom {
		t.Fatalf("pre-pick %+v", s.UpNext)
	}
	_, eff := r.m.Add(song("B"))
	s = r.m.Snapshot()
	if upNumber(s) != "B" || s.UpNext.Source != SourceQueue || !eq(prepares(eff), []string{"B"}) {
		t.Fatalf("up next %+v effects %v", s.UpNext, eff)
	}
	r.m.Control("d1", ActionSkip)
	if s = r.m.Snapshot(); nowNumber(s) != "B" || s.Now.Source != SourceQueue {
		t.Fatalf("now %+v", s.Now)
	}
}

func TestRandomPrePickIsUsedWhenTheQueueStaysEmpty(t *testing.T) {
	r := newRig(t, "R1", "R2", "R3")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	pick := upNumber(r.m.Snapshot())
	calls := r.picker.calls
	r.m.Control("d1", ActionSkip)
	if s := r.m.Snapshot(); nowNumber(s) != pick || s.Now.Source != SourceRandom {
		t.Fatalf("the announced next song must be the one that plays: %s vs %s", nowNumber(s), pick)
	}
	if r.picker.calls != calls+1 {
		t.Fatalf("only one new pick (for the next up-next) expected, calls %d -> %d", calls, r.picker.calls)
	}
}

func TestSkipKeepsStatus(t *testing.T) {
	r := newRig(t, "R1", "R2")
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	r.m.Control("d1", ActionPause)
	eff := r.m.Control("d2", ActionSkip)
	s := r.m.Snapshot()
	if nowNumber(s) != "B" || s.Status != StatusPaused {
		t.Fatalf("now %s status %v", nowNumber(s), s.Status)
	}
	h := histories(eff)
	if len(h) != 1 || h[0].Song.Number != "A" || !h[0].Skipped || h[0].Score != nil {
		t.Fatalf("history %+v", h)
	}
	// skipping while playing keeps Playing
	r.m.Control("d1", ActionPlay)
	r.m.Control("d1", ActionSkip)
	if s = r.m.Snapshot(); s.Status != StatusPlaying {
		t.Fatalf("status %v", s.Status)
	}
}

func TestSkipWithNothingLoadedLoadsTheFirstSongWithoutHistory(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	eff := r.m.Control("d1", ActionSkip)
	s := r.m.Snapshot()
	if nowNumber(s) != "A" || s.Status != StatusPaused || len(histories(eff)) != 0 {
		t.Fatalf("now %s status %v history %v", nowNumber(s), s.Status, histories(eff))
	}
}

func TestPlayHereMovesPlayer(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	eff := r.m.Control("d2", ActionPlayHere)
	s := r.m.Snapshot()
	if s.PlayerDeviceID != "d2" || s.Status != StatusPlaying || !eq(stops(eff), []string{"d1"}) {
		t.Fatalf("player %s status %v effects %v", s.PlayerDeviceID, s.Status, eff)
	}
	// Play here on the current player changes nothing and stops nobody
	eff = r.m.Control("d2", ActionPlayHere)
	if len(stops(eff)) != 0 || r.m.Snapshot().PlayerDeviceID != "d2" {
		t.Fatalf("effects %v", eff)
	}
	// Play here while paused starts playing on this device
	r.m.Control("d1", ActionPause)
	eff = r.m.Control("d1", ActionPlayHere)
	if s = r.m.Snapshot(); s.PlayerDeviceID != "d1" || s.Status != StatusPlaying || !eq(stops(eff), []string{"d2"}) {
		t.Fatalf("%+v %v", s, eff)
	}
}

func TestPlayResumesOnPlayer(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	r.m.Control("d1", ActionPause)
	eff := r.m.Control("d2", ActionPlay)
	s := r.m.Snapshot()
	if s.Status != StatusPlaying || s.PlayerDeviceID != "d1" || len(stops(eff)) != 0 {
		t.Fatalf("player %s status %v effects %v", s.PlayerDeviceID, s.Status, eff)
	}
}

func TestPlayWithoutAPlayerMakesTheCallerThePlayer(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d2", ActionPlay)
	if s := r.m.Snapshot(); s.PlayerDeviceID != "d2" || s.Status != StatusPlaying {
		t.Fatalf("%+v", s)
	}
	// the player went away: Play from another device takes over without stopping the (gone) device
	r.m.SetOnline("d2", false)
	r.m.Control("d1", ActionPause)
	eff := r.m.Control("d1", ActionPlay)
	if s := r.m.Snapshot(); s.PlayerDeviceID != "d1" || s.Status != StatusPlaying || len(stops(eff)) != 0 {
		t.Fatalf("%+v %v", s, eff)
	}
}

func TestReportsOnlyFromPlayer(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	if _, err := r.m.ReportPosition("d2", "R1", 500); !errors.Is(err, ErrNotPlayer) {
		t.Fatalf("err = %v", err)
	}
	if _, err := r.m.ReportPosition("d1", "other", 500); !errors.Is(err, ErrStale) {
		t.Fatalf("err = %v", err)
	}
	r.clock.ms += 700
	changed, err := r.m.ReportPosition("d1", "R1", 500)
	if err != nil || changed {
		t.Fatalf("changed %v err %v: position reports never push", changed, err)
	}
	if s := r.m.Snapshot(); s.Now.PositionMs != 500 || s.Now.PositionAtMs != r.clock.ms {
		t.Fatalf("%+v", s.Now)
	}
	if _, err := r.m.ReportPosition("d1", "R1", -5); err != nil || r.m.Snapshot().Now.PositionMs != 0 {
		t.Fatalf("a negative position is clamped to 0")
	}
	if err := r.m.Ready("d2", "R1"); !errors.Is(err, ErrNotPlayer) {
		t.Fatalf("Ready from a remote: %v", err)
	}
	if err := r.m.Ready("d1", "zzz"); !errors.Is(err, ErrStale) {
		t.Fatalf("Ready for another song: %v", err)
	}
	if err := r.m.Ready("d1", "R1"); err != nil {
		t.Fatalf("Ready: %v", err)
	}
	if _, err := r.m.Ended("d2", "R1", 0); !errors.Is(err, ErrNotPlayer) {
		t.Fatalf("Ended from a remote: %v", err)
	}
	if _, err := r.m.Ended("d1", "zzz", 0); !errors.Is(err, ErrStale) {
		t.Fatalf("Ended for another song: %v", err)
	}
}

func TestReportsWithNothingLoaded(t *testing.T) {
	r := newRig(t)
	if _, err := r.m.ReportPosition("d1", "x", 1); !errors.Is(err, ErrNotPlayer) {
		t.Fatalf("%v", err)
	}
	r.m.Control("d1", ActionPlay) // empty library: nothing loads, but d1 is the player
	if _, err := r.m.ReportPosition("d1", "x", 1); !errors.Is(err, ErrStale) {
		t.Fatalf("%v", err)
	}
}

func TestEndedScoreInterlude(t *testing.T) {
	r := newRig(t, "R1", "R2")
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	r.clock.ms = 10_000
	eff, err := r.m.Ended("d1", "A", 0)
	if err != nil {
		t.Fatal(err)
	}
	h := histories(eff)
	if len(h) != 1 || h[0].Song.Number != "A" || h[0].Skipped || h[0].Score == nil || !h[0].Score.HasValue || h[0].Score.Value != 76 {
		t.Fatalf("history %+v", h)
	}
	s := r.m.Snapshot()
	if nowNumber(s) != "A" || s.Score == nil || s.Score.UntilMs != 16_000 || s.Score.Number != "A" || s.Status != StatusPlaying {
		t.Fatalf("%+v", s)
	}
	if eff = r.m.Tick(); len(eff) != 0 {
		t.Fatalf("effects %v", eff)
	}
	r.clock.ms = 10_000 + 5_999
	r.m.Tick()
	if s = r.m.Snapshot(); nowNumber(s) != "A" || s.Score == nil {
		t.Fatalf("5999 ms: now %s score %v", nowNumber(s), s.Score)
	}
	r.clock.ms = 10_000 + 6_000
	eff = r.m.Tick()
	if s = r.m.Snapshot(); nowNumber(s) != "B" || s.Score != nil || s.Status != StatusPlaying || len(prepares(eff)) == 0 {
		t.Fatalf("6000 ms: now %s score %v", nowNumber(s), s.Score)
	}
}

func TestEndedModeOff(t *testing.T) {
	r := newRig(t, "R1")
	off := score.ModeOff
	r.m.UpdateSettings(&off, nil)
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	eff, _ := r.m.Ended("d1", "A", 100)
	h := histories(eff)
	s := r.m.Snapshot()
	if len(h) != 1 || h[0].Score != nil || h[0].Skipped || s.Score != nil || nowNumber(s) != "B" {
		t.Fatalf("history %+v now %s score %v", h, nowNumber(s), s.Score)
	}
}

func TestEndedWithZeroScoreSecondsStillRecordsTheScore(t *testing.T) {
	r := newRig(t, "R1")
	r.secs = 0
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	eff, _ := r.m.Ended("d1", "A", 0)
	h := histories(eff)
	s := r.m.Snapshot()
	if len(h) != 1 || h[0].Score == nil || s.Score != nil || nowNumber(s) != "B" {
		t.Fatalf("history %+v now %s score %v", h, nowNumber(s), s.Score)
	}
}

func TestSkipDuringScore(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	r.m.Ended("d1", "A", 0)
	eff := r.m.Control("d2", ActionSkip)
	s := r.m.Snapshot()
	if nowNumber(s) != "B" || s.Score != nil || s.Status != StatusPlaying || len(histories(eff)) != 0 {
		t.Fatalf("now %s score %v history %v: the song already has its history entry", nowNumber(s), s.Score, histories(eff))
	}
}

func TestPauseDuringScore(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	r.m.Ended("d1", "A", 0)
	eff := r.m.Control("d1", ActionPause)
	s := r.m.Snapshot()
	if nowNumber(s) != "B" || s.Score != nil || s.Status != StatusPaused || len(histories(eff)) != 0 {
		t.Fatalf("now %s score %v status %v", nowNumber(s), s.Score, s.Status)
	}
}

func TestEndedTwiceIsStale(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	r.m.Ended("d1", "A", 0)
	if _, err := r.m.Ended("d1", "A", 0); !errors.Is(err, ErrStale) {
		t.Fatalf("a second Ended during the score screen: %v", err)
	}
}

func TestRandomExcludesRecent(t *testing.T) {
	var lib []string
	for i := 1; i <= 300; i++ {
		lib = append(lib, fmt.Sprintf("S%03d", i))
	}
	r := newRig(t, lib...)
	r.m.Control("d1", ActionPlay)
	for i := 0; i < 104; i++ {
		r.m.Control("d1", ActionSkip)
	}
	// S001 was the first song played; 105 songs have played, the last 100 are S006..S105
	ex := r.picker.lastExclude
	for i := 1; i <= 105; i++ {
		n := fmt.Sprintf("S%03d", i)
		want := i >= 6
		if ex(n) != want {
			t.Errorf("exclude(%s) = %v, want %v", n, ex(n), want)
		}
	}
	if ex("S200") {
		t.Error("a song that never played is not excluded")
	}
}

func TestRandomPickExcludesTheCurrentSong(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	s := r.m.Snapshot()
	if nowNumber(s) != "R1" || s.UpNext != nil {
		t.Fatalf("with one song in the library there is no different next song: now %s up %s", nowNumber(s), upNumber(s))
	}
}

func TestPlayerGone(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	r.clock.ms = 5000
	r.m.ReportPosition("d1", "R1", 1234)
	r.m.SetOnline("d1", false)
	r.clock.ms = 5000 + 30_000
	r.m.Tick()
	if s := r.m.Snapshot(); s.Status != StatusPlaying {
		t.Fatal("30 s exactly is still within the grace period")
	}
	r.clock.ms = 5000 + 30_001
	r.m.Tick()
	s := r.m.Snapshot()
	if s.Status != StatusPaused || s.Now == nil || s.Now.PositionMs != 1234 || s.PlayerDeviceID != "d1" {
		t.Fatalf("%+v", s)
	}
	// any device can continue from there
	r.m.Control("d2", ActionPlayHere)
	if s = r.m.Snapshot(); s.Status != StatusPlaying || s.PlayerDeviceID != "d2" || s.Now.PositionMs != 1234 {
		t.Fatalf("%+v", s)
	}
}

func TestPlayerComingBackInTimeKeepsPlaying(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	r.m.SetOnline("d1", false)
	r.clock.ms += 20_000
	r.m.SetOnline("d1", true)
	r.clock.ms += 60_000
	r.m.Tick()
	if s := r.m.Snapshot(); s.Status != StatusPlaying {
		t.Fatalf("%v", s.Status)
	}
	// the offline clock starts at the first offline event, not at every repeat
	r.m.SetOnline("d1", false)
	r.clock.ms += 20_000
	r.m.SetOnline("d1", false)
	r.clock.ms += 10_001
	r.m.Tick()
	if s := r.m.Snapshot(); s.Status != StatusPaused {
		t.Fatalf("a repeated offline event must not restart the 30 s: %v", s.Status)
	}
}

func TestPausedPlayerGoneStaysPaused(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	r.m.Control("d1", ActionPause)
	r.m.SetOnline("d1", false)
	r.clock.ms += 100_000
	r.m.Tick()
	if s := r.m.Snapshot(); s.Status != StatusPaused || s.PlayerDeviceID != "d1" {
		t.Fatalf("%+v", s)
	}
}

func TestEmptyLibrary(t *testing.T) {
	r := newRig(t)
	eff := r.m.Control("d1", ActionPlay)
	s := r.m.Snapshot()
	if s.Status != StatusPaused || s.Now != nil || s.UpNext != nil || len(eff) != 0 {
		t.Fatalf("%+v %v", s, eff)
	}
	// when the first song is added it waits for Play
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	if s = r.m.Snapshot(); nowNumber(s) != "A" || s.Status != StatusPlaying {
		t.Fatalf("%+v", s)
	}
	// the queue and the library run out: playing stops
	eff, _ = r.m.Ended("d1", "A", 0)
	r.clock.ms += 6000
	r.m.Tick()
	if s = r.m.Snapshot(); s.Now != nil || s.Status != StatusPaused {
		t.Fatalf("%+v", s)
	}
}

func TestMicThreshold(t *testing.T) {
	r := newRig(t, "R1")
	mic := score.ModeMicrophone
	r.m.UpdateSettings(&mic, nil)
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	eff, _ := r.m.Ended("d1", "A", 20)
	s := r.m.Snapshot()
	if s.Score == nil || s.Score.Result.HasValue || s.Score.Result.Reason == "" {
		t.Fatalf("%+v", s.Score)
	}
	h := histories(eff)
	if len(h) != 1 || h[0].Score == nil || h[0].Score.HasValue {
		t.Fatalf("history %+v", h)
	}
	r.clock.ms += 6000
	r.m.Tick()
	r.m.Ended("d1", "B", 21)
	if s = r.m.Snapshot(); s.Score == nil || !s.Score.Result.HasValue {
		t.Fatalf("21 loud readings score: %+v", s.Score)
	}
}

func TestRemoveAndMoveToTop(t *testing.T) {
	r := newRig(t, "R1", "R2")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	b, _ := r.m.Add(song("B"))
	c, _ := r.m.Add(song("C"))
	d, _ := r.m.Add(song("D"))
	eff, err := r.m.MoveToTop(d.ID)
	s := r.m.Snapshot()
	if err != nil || !eq(queueNumbers(s), []string{"D", "B", "C"}) || upNumber(s) != "D" || !eq(prepares(eff), []string{"D"}) {
		t.Fatalf("%v %v up %s effects %v", err, queueNumbers(s), upNumber(s), eff)
	}
	if _, err = r.m.Remove(c.ID); err != nil {
		t.Fatal(err)
	}
	if s = r.m.Snapshot(); !eq(queueNumbers(s), []string{"D", "B"}) || upNumber(s) != "D" {
		t.Fatalf("%v up %s", queueNumbers(s), upNumber(s))
	}
	// removing the head moves the up-next on
	eff, _ = r.m.Remove(d.ID)
	if s = r.m.Snapshot(); upNumber(s) != "B" || !eq(prepares(eff), []string{"B"}) {
		t.Fatalf("up %s effects %v", upNumber(s), eff)
	}
	// emptying the queue brings back a random pre-pick
	eff, _ = r.m.Remove(b.ID)
	if s = r.m.Snapshot(); len(s.Queue) != 0 || s.UpNext == nil || s.UpNext.Source != SourceRandom || len(prepares(eff)) != 1 {
		t.Fatalf("%+v %v", s.UpNext, eff)
	}
	if _, err = r.m.Remove("nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
	if _, err = r.m.MoveToTop("nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
	// moving the head to the top changes nothing
	e, _ := r.m.Add(song("E"))
	eff, err = r.m.MoveToTop(e.ID)
	if err != nil || len(eff) != 0 {
		t.Fatalf("%v %v", err, eff)
	}
}

func TestRemoveWithNothingLoaded(t *testing.T) {
	r := newRig(t, "R1")
	a, _ := r.m.Add(song("A"))
	if _, err := r.m.Remove(a.ID); err != nil {
		t.Fatal(err)
	}
	if s := r.m.Snapshot(); len(s.Queue) != 0 || s.UpNext != nil || s.Now != nil {
		t.Fatalf("%+v", s)
	}
}

func TestSettingsDefaultsAndUpdates(t *testing.T) {
	r := newRig(t)
	if s := r.m.Snapshot(); s.Settings.ScoreMode != score.ModeRandom || s.Settings.ScoreLevel != score.LevelLow {
		t.Fatalf("defaults %+v", s.Settings)
	}
	high := score.LevelHigh
	r.m.UpdateSettings(nil, &high)
	if s := r.m.Snapshot(); s.Settings.ScoreLevel != score.LevelHigh || s.Settings.ScoreMode != score.ModeRandom {
		t.Fatalf("%+v", s.Settings)
	}
}

func TestSnapshotIsACopy(t *testing.T) {
	r := newRig(t, "R1", "R2")
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Control("d1", ActionPlay)
	r.clock.ms = 4242
	s := r.m.Snapshot()
	if s.ServerTimeMs != 4242 {
		t.Fatalf("server time %d", s.ServerTimeMs)
	}
	s.Queue[0].Song.Number = "changed"
	s.Now.Song.Number = "changed"
	s.UpNext.Song.Number = "changed"
	again := r.m.Snapshot()
	if queueNumbers(again)[0] != "B" || nowNumber(again) != "A" || upNumber(again) != "B" {
		t.Fatalf("the snapshot shares memory with the machine: %+v", again)
	}
}

func TestOnlineQuery(t *testing.T) {
	r := newRig(t)
	if !r.m.Online("d1") || r.m.Online("ghost") {
		t.Fatal("Online")
	}
	r.m.SetOnline("d1", false)
	if r.m.Online("d1") {
		t.Fatal("offline")
	}
}

func TestUnknownActionDoesNothing(t *testing.T) {
	r := newRig(t, "R1")
	if eff := r.m.Control("d1", Action(99)); len(eff) != 0 || r.m.Snapshot().Status != StatusPaused {
		t.Fatalf("%v", eff)
	}
}

// invariants that must hold after any operation
func checkInvariants(t *testing.T, m *Machine, op string) {
	t.Helper()
	s := m.Snapshot()
	seen := map[string]bool{}
	for _, it := range s.Queue {
		if it.ID == "" || seen[it.ID] {
			t.Fatalf("%s: duplicate or empty queue id %q", op, it.ID)
		}
		seen[it.ID] = true
	}
	if s.Status == StatusPlaying && (s.Now == nil || s.PlayerDeviceID == "") {
		t.Fatalf("%s: playing without a song or a player: %+v", op, s)
	}
	if s.Score != nil && s.Now == nil {
		t.Fatalf("%s: a score without a song", op)
	}
	if s.Now == nil && s.UpNext != nil {
		t.Fatalf("%s: up next without a current song", op)
	}
	if s.Now != nil && len(s.Queue) > 0 && (s.UpNext == nil || s.UpNext.Source != SourceQueue || s.UpNext.Song.Number != s.Queue[0].Song.Number) {
		t.Fatalf("%s: with a non-empty queue the up-next song is the queue head: %+v", op, s)
	}
	if s.UpNext != nil && s.UpNext.Source == SourceQueue && (len(s.Queue) == 0 || s.Queue[0].Song.Number != s.UpNext.Song.Number) {
		t.Fatalf("%s: a queue up-next that is not the head", op)
	}
	if len(m.recent) > 100 {
		t.Fatalf("%s: recent has %d entries", op, len(m.recent))
	}
}

func TestRandomOperationSequencesKeepTheInvariants(t *testing.T) {
	for seed := int64(1); seed <= 20; seed++ {
		rng := rand.New(rand.NewSource(seed))
		var lib []string
		for i := 0; i < 1+rng.Intn(8); i++ {
			lib = append(lib, fmt.Sprintf("L%d", i))
		}
		r := newRig(t, lib...)
		r.m.SetOnline("d3", true)
		devices := []string{"d1", "d2", "d3"}
		var ids []string
		for i := 0; i < 1000; i++ {
			d := devices[rng.Intn(3)]
			var op string
			switch rng.Intn(14) {
			case 0, 1:
				op = "add"
				it, _ := r.m.Add(song(fmt.Sprintf("Q%d", rng.Intn(20))))
				ids = append(ids, it.ID)
			case 2:
				op = "remove"
				id := "bogus"
				if len(ids) > 0 {
					id = ids[rng.Intn(len(ids))]
				}
				_, _ = r.m.Remove(id)
			case 3:
				op = "top"
				id := "bogus"
				if len(ids) > 0 {
					id = ids[rng.Intn(len(ids))]
				}
				_, _ = r.m.MoveToTop(id)
			case 4, 5, 6:
				op = "control"
				r.m.Control(d, Action(1+rng.Intn(4)))
			case 7:
				op = "ready"
				s := r.m.Snapshot()
				if s.Now != nil {
					_ = r.m.Ready(d, s.Now.Song.Number)
				}
			case 8:
				op = "position"
				s := r.m.Snapshot()
				if s.Now != nil {
					_, _ = r.m.ReportPosition(d, s.Now.Song.Number, int64(rng.Intn(100000)))
				}
			case 9, 10:
				op = "ended"
				s := r.m.Snapshot()
				if s.Now != nil {
					_, _ = r.m.Ended(d, s.Now.Song.Number, rng.Intn(60))
				}
			case 11:
				op = "tick"
				r.clock.ms += int64(rng.Intn(8000))
				r.m.Tick()
			case 12:
				op = "online"
				r.m.SetOnline(d, rng.Intn(2) == 0)
			case 13:
				op = "settings"
				mode := score.Mode(1 + rng.Intn(3))
				r.m.UpdateSettings(&mode, nil)
			}
			checkInvariants(t, r.m, fmt.Sprintf("seed %d step %d %s", seed, i, op))
		}
	}
}

func TestSmallLibraryDoesNotRunDry(t *testing.T) {
	r := newRig(t, "R1", "R2", "R3") // fewer songs than the 100 that are kept out of the random pick
	r.m.Control("d1", ActionPlay)
	seen := map[string]int{}
	for i := 0; i < 30; i++ {
		s := r.m.Snapshot()
		if s.Now == nil || s.Status != StatusPlaying {
			t.Fatalf("step %d: playback stopped: %+v", i, s)
		}
		seen[nowNumber(s)]++
		if i > 0 && s.UpNext != nil && s.UpNext.Song.Number == nowNumber(s) {
			t.Fatalf("step %d: up next equals the current song", i)
		}
		r.m.Control("d1", ActionSkip)
	}
	if len(seen) != 3 {
		t.Fatalf("songs played: %v", seen)
	}
}

func TestRegression_OfflineTimeIsRememberedEvenAtClockZero(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPlay)
	r.clock.ms = 0
	r.m.SetOnline("d1", false) // the very first millisecond
	r.clock.ms = 20_000
	r.m.SetOnline("d1", false) // a repeat must not restart the clock
	r.clock.ms = 30_001
	r.m.Tick()
	if s := r.m.Snapshot(); s.Status != StatusPaused {
		t.Fatalf("status %v: the player has been gone for more than 30 s since time 0", s.Status)
	}
}

func TestNilScoreSecondsMeansNoInterlude(t *testing.T) {
	m := New(Deps{Clock: &fakeClock{ms: 1}, Picker: &fakePicker{songs: []Song{song("R1"), song("R2")}}, Rand: &fakeRand{v: 1}})
	m.Add(song("A"))
	m.Control("d1", ActionPlay)
	eff, err := m.Ended("d1", "A", 0)
	if err != nil || m.Snapshot().Score != nil || len(histories(eff)) != 1 {
		t.Fatalf("%v %v", err, eff)
	}
}

func TestRegression_ReadyDoesNotMovePositionBackwards(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	r.clock.ms += 5000
	_, _ = r.m.ReportPosition("d1", "A", 4000)
	reportedAt := r.clock.ms
	r.clock.ms += 3000
	// the player reconnects and says it is ready again; the stored pair (position, time) must stay consistent
	if err := r.m.Ready("d1", "A"); err != nil {
		t.Fatal(err)
	}
	if s := r.m.Snapshot(); s.Now.PositionMs != 4000 || s.Now.PositionAtMs != reportedAt {
		t.Fatalf("position %d at %d, want 4000 at %d: remotes would show a position that jumps back", s.Now.PositionMs, s.Now.PositionAtMs, reportedAt)
	}
	// a freshly loaded song starts its clock when the player is ready
	r.m.Control("d1", ActionSkip)
	loadedAt := r.m.Snapshot().Now.PositionAtMs
	r.clock.ms += 2000
	_ = r.m.Ready("d1", r.m.Snapshot().Now.Song.Number)
	if s := r.m.Snapshot(); s.Now.PositionMs != 0 || s.Now.PositionAtMs != loadedAt+2000 {
		t.Fatalf("%+v", s.Now)
	}
}

func TestExactlyOneHistoryEntryPerFinishedOrSkippedSong(t *testing.T) {
	r := newRig(t, "R1", "R2")
	var all []HistoryEntry
	collect := func(e []Effect) { all = append(all, histories(e)...) }
	r.m.Add(song("A"))
	r.m.Add(song("B"))
	r.m.Add(song("C"))
	r.m.Add(song("D"))
	collect(r.m.Control("d1", ActionPlay))
	e, _ := r.m.Ended("d1", "A", 0) // A finishes: one entry with a score
	collect(e)
	r.clock.ms += 6000
	collect(r.m.Tick()) // B loads
	collect(r.m.Control("d2", ActionSkip))
	e, _ = r.m.Ended("d1", "C", 0)
	collect(e)
	collect(r.m.Control("d2", ActionSkip))  // skipping the score screen: C already has its entry
	collect(r.m.Control("d2", ActionPause)) // pausing with D loaded and no score: nothing recorded
	var got []string
	for _, h := range all {
		got = append(got, fmt.Sprintf("%s skipped=%v scored=%v", h.Song.Number, h.Skipped, h.Score != nil))
	}
	want := []string{"A skipped=false scored=true", "B skipped=true scored=false", "C skipped=false scored=true"}
	if !eq(got, want) {
		t.Fatalf("history %v, want %v", got, want)
	}
}

func TestRestore(t *testing.T) {
	r := newRig(t, "R1", "R2")
	eff := r.m.Restore(Restored{
		Status: StatusPlaying, Player: "d1",
		Now:      &Current{Song: song("A"), Source: SourceQueue, PositionMs: 42_000},
		Queue:    []Item{{ID: "q4", Song: song("B")}, {ID: "q7", Song: song("C")}},
		Settings: Settings{ScoreMode: score.ModeMicrophone, ScoreLevel: score.LevelHigh},
		Recent:   []string{"X", "A"},
	})
	s := r.m.Snapshot()
	if nowNumber(s) != "A" || s.Now.PositionMs != 42_000 || s.Status != StatusPlaying || s.PlayerDeviceID != "d1" ||
		!eq(queueNumbers(s), []string{"B", "C"}) || upNumber(s) != "B" || s.Settings.ScoreMode != score.ModeMicrophone {
		t.Fatalf("%+v", s)
	}
	if !eq(prepares(eff), []string{"A", "B"}) {
		t.Fatalf("effects %v", eff)
	}
	// new queue ids continue after the stored ones
	it, _ := r.m.Add(song("D"))
	if it.ID != "q8" {
		t.Fatalf("id %s collides with restored ids", it.ID)
	}
	// the stored player counts as offline from the restore: 30 s later playback pauses
	r.clock.ms += 30_001
	r.m.Tick()
	if s = r.m.Snapshot(); s.Status != StatusPaused || s.Now.PositionMs != 42_000 {
		t.Fatalf("%+v", s)
	}
	// but if it reconnects in time it keeps playing
	r2 := newRig(t, "R1")
	r2.m.Restore(Restored{Status: StatusPlaying, Player: "d1", Now: &Current{Song: song("A"), Source: SourceQueue}})
	r2.clock.ms += 20_000
	r2.m.SetOnline("d1", true)
	r2.clock.ms += 60_000
	r2.m.Tick()
	if r2.m.Snapshot().Status != StatusPlaying {
		t.Fatal("a reconnected player keeps playing")
	}
}

func TestRestoreNormalisesInconsistentState(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Restore(Restored{Status: StatusPlaying, Player: "d1"}) // playing, but nothing loaded
	s := r.m.Snapshot()
	if s.Status != StatusPaused || s.Settings.ScoreMode != score.ModeRandom || s.Settings.ScoreLevel != score.LevelLow || s.UpNext != nil {
		t.Fatalf("%+v", s)
	}
	var recent []string
	for i := 0; i < 150; i++ {
		recent = append(recent, fmt.Sprint("N", i))
	}
	r.m.Restore(Restored{Recent: recent})
	if len(r.m.recent) != 100 || r.m.recent[0] != "N50" {
		t.Fatalf("recent %d first %s", len(r.m.recent), r.m.recent[0])
	}
}

// Remotes, and a device that takes over, extrapolate from the pair (PositionMs, PositionAtMs):
// the pair must say where the song really is, also after a pause.
func TestRegression_PauseFreezesThePositionWhereTheSongReallyIs(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	r.clock.ms += 1000
	_, _ = r.m.ReportPosition("d1", "A", 41200) // at the time 2000
	r.clock.ms += 500                           // the player has gone on to 41700 since its last report
	r.m.Control("d2", ActionPause)
	s := r.m.Snapshot()
	if s.Now.PositionMs != 41700 || s.Now.PositionAtMs != r.clock.ms {
		t.Fatalf("paused at %d (clock %d), want 41700 at %d: the last report is up to a second old", s.Now.PositionMs, s.Now.PositionAtMs, r.clock.ms)
	}
}

func TestRegression_ResumeStartsThePositionClockAgain(t *testing.T) {
	for _, action := range []Action{ActionPlay, ActionPlayHere} {
		r := newRig(t, "R1")
		r.m.Add(song("A"))
		r.m.Control("d1", ActionPlay)
		r.clock.ms += 1000
		_, _ = r.m.ReportPosition("d1", "A", 41200)
		r.m.Control("d1", ActionPause)
		r.clock.ms += 60_000 // a minute of pause
		r.m.Control("d2", action)
		s := r.m.Snapshot()
		if s.Status != StatusPlaying || s.Now.PositionMs != 41200 || s.Now.PositionAtMs != r.clock.ms {
			t.Fatalf("action %v: position %d at %d (clock %d), want 41200 at the moment of the resume: a taking-over device would jump a minute ahead", action, s.Now.PositionMs, s.Now.PositionAtMs, r.clock.ms)
		}
	}
}

func TestPlayWhilePlayingLeavesThePositionAlone(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	r.clock.ms += 1000
	_, _ = r.m.ReportPosition("d1", "A", 41200)
	at := r.m.Snapshot().Now.PositionAtMs
	r.clock.ms += 700
	r.m.Control("d2", ActionPlay) // resumes on the current player: it is playing already
	if s := r.m.Snapshot(); s.Now.PositionMs != 41200 || s.Now.PositionAtMs != at {
		t.Fatalf("%+v: playing again must not move the pair", s.Now)
	}
}

func TestPauseWhilePausedAndPauseOfNothingAreHarmless(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Control("d1", ActionPause) // nothing is playing
	r.m.Add(song("A"))
	r.m.Control("d1", ActionPlay)
	r.clock.ms += 1000
	_, _ = r.m.ReportPosition("d1", "A", 5000)
	r.m.Control("d1", ActionPause)
	first := r.m.Snapshot().Now.PositionMs
	r.clock.ms += 5000
	r.m.Control("d1", ActionPause)
	if s := r.m.Snapshot(); s.Now.PositionMs != first {
		t.Fatalf("a second Pause moved the position from %d to %d", first, s.Now.PositionMs)
	}
}

func TestPausePositionNeverPassesTheEndOfTheSong(t *testing.T) {
	r := newRig(t, "R1")
	r.m.Add(Song{Number: "A", Format: 1, DurationMs: 10_000})
	r.m.Control("d1", ActionPlay)
	r.clock.ms += 1000
	_, _ = r.m.ReportPosition("d1", "A", 9000)
	r.clock.ms += 30_000 // the player has gone quiet; nothing says the song is not over
	r.m.Control("d2", ActionPause)
	if s := r.m.Snapshot(); s.Now.PositionMs != 10_000 {
		t.Fatalf("paused at %d, want the end of the song (10000)", s.Now.PositionMs)
	}
}
