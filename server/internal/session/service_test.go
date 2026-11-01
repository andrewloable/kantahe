package session

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/catalog"
	"github.com/andrewloable/kantahe/server/internal/store"
)

type svcEnv struct {
	svc   *Service
	db    *store.DB
	ms    atomic.Int64
	wall  atomic.Int64
	preps []string
	mu    sync.Mutex
}

func (e *svcEnv) NowMs() int64 { return e.ms.Load() }

func (e *svcEnv) Prepare(n string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.preps = append(e.preps, n)
}

func newSvcEnv(t *testing.T, songs int) *svcEnv {
	t.Helper()
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	e := &svcEnv{db: db}
	e.ms.Store(1000)
	e.wall.Store(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC).Unix())
	for _, u := range []string{"u1", "u2"} {
		if _, err := db.Exec(`INSERT INTO users(id, email, display_name, password_hash, created_at) VALUES (?, ?, 'U', 'h', 1)`, u, u+"@x.y"); err != nil {
			t.Fatal(err)
		}
	}
	for i := 1; i <= songs; i++ {
		n := fmt.Sprintf("%05d", i)
		if _, err := db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, duration_ms, metadata_done, created_at, display_title)
			VALUES (?, 2, 1, ?, ?, 1, 1, 'x', 1000, 1, 1, 'T')`, n, "/p/"+n, "sha"+n); err != nil {
			t.Fatal(err)
		}
	}
	e.svc = e.newService()
	return e
}

func (e *svcEnv) newService() *Service {
	return NewService(Config{
		DB: e.db, Songs: catalog.New(e.db), Preparer: e, Clock: e,
		Wall:                func() time.Time { return time.Unix(e.wall.Load(), 0) },
		DefaultScoreSeconds: 6, Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
}

func add(t *testing.T, s *Service, user, number string) Item {
	t.Helper()
	var it Item
	if _, err := s.Do(context.Background(), user, func(m *Machine) ([]Effect, error) {
		var eff []Effect
		it, eff = m.Add(Song{Number: number, Format: 2})
		return eff, nil
	}); err != nil {
		t.Fatal(err)
	}
	return it
}

func control(t *testing.T, s *Service, user, device string, a Action) Snapshot {
	t.Helper()
	snap, err := s.Do(context.Background(), user, func(m *Machine) ([]Effect, error) { return m.Control(device, a), nil })
	if err != nil {
		t.Fatal(err)
	}
	return snap
}

func recvWithin(t *testing.T, sub *Subscription, d time.Duration) (Snapshot, bool) {
	t.Helper()
	select {
	case s := <-sub.C:
		return s, true
	case <-time.After(d):
		return Snapshot{}, false
	}
}

func TestSlowSubscriberDoesNotBlock(t *testing.T) {
	e := newSvcEnv(t, 3)
	ctx := context.Background()
	slow, _, err := e.svc.Subscribe(ctx, "u1", "slow") // never reads
	if err != nil {
		t.Fatal(err)
	}
	defer slow.Close()
	fast, _, err := e.svc.Subscribe(ctx, "u1", "fast")
	if err != nil {
		t.Fatal(err)
	}
	defer fast.Close()
	step := make(chan struct{})
	go func() {
		defer close(step)
		for i := 0; i < 200; i++ {
			add(t, e.svc, "u1", "00001")
			step <- struct{}{}
		}
	}()
	// each add has its own deadline: a subscriber that blocks the others hangs one add for good, while a slow or busy
	// machine (200 database writes under -race) only stretches all of them, so a total budget would measure the machine
	for i := 1; i <= 200; i++ {
		select {
		case <-step:
		case <-time.After(30 * time.Second):
			t.Fatalf("add %d did not finish: an unread subscriber blocked the others", i)
		}
	}
	// the slow subscriber holds only the newest snapshot, not 200
	s, ok := recvWithin(t, slow, 100*time.Millisecond)
	if !ok || len(s.Queue) != 200 {
		t.Fatalf("slow subscriber: ok=%v queue=%d, want the latest snapshot", ok, len(s.Queue))
	}
	if _, ok := recvWithin(t, slow, 50*time.Millisecond); ok {
		t.Fatal("only one snapshot may be pending")
	}
}

func TestSubscribeAndCloseTrackOnlineAndRefCount(t *testing.T) {
	e := newSvcEnv(t, 1)
	ctx := context.Background()
	obs, first, err := e.svc.Subscribe(ctx, "u1", "observer")
	if err != nil || !first.Online["observer"] {
		t.Fatalf("%v %v", err, first.Online)
	}
	defer obs.Close()
	// two streams of one device: it stays online until both are closed
	a, _, _ := e.svc.Subscribe(ctx, "u1", "tv")
	b, _, _ := e.svc.Subscribe(ctx, "u1", "tv")
	if s, ok := recvWithin(t, obs, time.Second); !ok || !s.Online["tv"] {
		t.Fatalf("the observer sees the tv come online: %v", s.Online)
	}
	a.Close()
	a.Close() // closing twice is harmless
	if s, _ := e.svc.Do(ctx, "u1", nil); !s.Online["tv"] {
		t.Fatal("one stream is still open")
	}
	b.Close()
	s, ok := recvWithin(t, obs, time.Second)
	for ok && s.Online["tv"] {
		s, ok = recvWithin(t, obs, time.Second)
	}
	if !ok || s.Online["tv"] {
		t.Fatal("the observer must see the tv go offline")
	}
}

func TestPersistenceAndRestartRestoresEverything(t *testing.T) {
	e := newSvcEnv(t, 5)
	ctx := context.Background()
	add(t, e.svc, "u1", "00001")
	add(t, e.svc, "u1", "00002")
	add(t, e.svc, "u1", "00003")
	control(t, e.svc, "u1", "d1", ActionPlayHere)
	if _, err := e.svc.Do(ctx, "u1", func(m *Machine) ([]Effect, error) { _, err := m.ReportPosition("d1", "00001", 42_000); return nil, err }); err != nil {
		t.Fatal(err)
	}
	control(t, e.svc, "u1", "d1", ActionPause)
	e2 := e.newService()
	s, err := e2.Do(ctx, "u1", nil)
	if err != nil {
		t.Fatal(err)
	}
	if s.Status != StatusPaused || s.Now == nil || s.Now.Song.Number != "00001" || s.Now.PositionMs != 42_000 || len(s.Queue) != 2 || s.PlayerDeviceID != "d1" {
		t.Fatalf("%+v", s)
	}
	// another user is untouched
	if o, _ := e2.Do(ctx, "u2", nil); o.Now != nil || len(o.Queue) != 0 {
		t.Fatalf("%+v", o)
	}
	// songs deleted meanwhile drop out of the restored queue and a missing current song is forgotten
	if _, err := e.db.Exec(`UPDATE songs SET deleted = 1 WHERE number IN ('00002', '00001')`); err != nil {
		t.Fatal(err)
	}
	e3 := e.newService()
	s, _ = e3.Do(ctx, "u1", nil)
	if s.Now != nil || len(s.Queue) != 1 || s.Queue[0].Song.Number != "00003" {
		t.Fatalf("%+v", s)
	}
}

func TestPositionIsSavedEvery30SecondsOnly(t *testing.T) {
	e := newSvcEnv(t, 2)
	ctx := context.Background()
	add(t, e.svc, "u1", "00001")
	control(t, e.svc, "u1", "d1", ActionPlayHere)
	stored := func() int64 {
		var p int64
		_ = e.db.QueryRow(`SELECT position_ms FROM user_state WHERE user_id='u1'`).Scan(&p)
		return p
	}
	report := func(pos int64) {
		if _, err := e.svc.Do(ctx, "u1", func(m *Machine) ([]Effect, error) { _, err := m.ReportPosition("d1", "00001", pos); return nil, err }); err != nil {
			t.Fatal(err)
		}
	}
	e.wall.Add(10)
	report(10_000)
	if stored() != 0 {
		t.Fatalf("stored %d after 10 s: positions are not written on every report", stored())
	}
	e.wall.Add(21)
	report(31_000)
	if stored() != 31_000 {
		t.Fatalf("stored %d, want 31000 after more than 30 s", stored())
	}
}

func TestTickUnloadsIdleUsers(t *testing.T) {
	e := newSvcEnv(t, 1)
	ctx := context.Background()
	if _, err := e.svc.Do(ctx, "u1", nil); err != nil {
		t.Fatal(err)
	}
	e.svc.mu.Lock()
	loaded := len(e.svc.actors)
	e.svc.mu.Unlock()
	if loaded != 1 {
		t.Fatal("not loaded")
	}
	e.wall.Add(3601)
	e.svc.TickAll(ctx)
	e.svc.mu.Lock()
	loaded = len(e.svc.actors)
	e.svc.mu.Unlock()
	if loaded != 0 {
		t.Fatal("an idle user without streams must be unloaded after an hour")
	}
	// a user with an open stream stays
	sub, _, _ := e.svc.Subscribe(ctx, "u2", "d")
	defer sub.Close()
	e.wall.Add(7200)
	e.svc.TickAll(ctx)
	e.svc.mu.Lock()
	loaded = len(e.svc.actors)
	e.svc.mu.Unlock()
	if loaded != 1 {
		t.Fatal("a user with a stream must stay loaded")
	}
}

func TestRunTicksUntilCancelled(t *testing.T) {
	e := newSvcEnv(t, 2)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.svc.Run(ctx); close(done) }()
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not stop")
	}
}

func TestNotifyAndEffectsAreSafe(t *testing.T) {
	e := newSvcEnv(t, 2)
	ctx := context.Background()
	sub, _, _ := e.svc.Subscribe(ctx, "u1", "d1")
	defer sub.Close()
	if err := e.svc.Notify(ctx, "u1"); err != nil {
		t.Fatal(err)
	}
	if _, ok := recvWithin(t, sub, time.Second); !ok {
		t.Fatal("Notify must push the current state")
	}
	s := NewService(Config{DB: e.db, Songs: catalog.New(e.db), Clock: e}) // no preparer, no logger, defaults everywhere
	add(t, s, "u1", "00001")
	control(t, s, "u1", "d1", ActionPlayHere) // PrepareSong effects with a nil preparer must not panic
	if got := s.NowMs(); got != 1000 {
		t.Fatalf("NowMs %d", got)
	}
	if NewService(Config{DB: e.db}).NowMs() < 0 {
		t.Fatal("monotonic clock")
	}
}

func TestSQLPicker(t *testing.T) {
	e := newSvcEnv(t, 5)
	p := &sqlPicker{db: e.db}
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		s, ok := p.Pick(func(n string) bool { return n == "00001" || n == "00002" })
		if !ok || s.Number == "00001" || s.Number == "00002" || s.Format != 2 || s.DurationMs != 1000 {
			t.Fatalf("%+v %v", s, ok)
		}
		seen[s.Number] = true
	}
	if len(seen) != 3 {
		t.Fatalf("all three allowed songs must be reachable: %v", seen)
	}
	// everything excluded
	if _, ok := p.Pick(func(string) bool { return true }); ok {
		t.Fatal("nothing to pick")
	}
	// failed, deleted and pending songs are never picked
	if _, err := e.db.Exec(`UPDATE songs SET failed = 1 WHERE number = '00003'; UPDATE songs SET deleted = 1 WHERE number = '00004'; UPDATE songs SET metadata_done = 0 WHERE number = '00005'`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 50; i++ {
		s, ok := p.Pick(func(n string) bool { return n == "00001" })
		if !ok || s.Number != "00002" {
			t.Fatalf("only 00002 is left: %+v %v", s, ok)
		}
	}
	// a library with one song, empty library
	e2 := newSvcEnv(t, 0)
	if _, ok := (&sqlPicker{db: e2.db}).Pick(func(string) bool { return false }); ok {
		t.Fatal("empty library")
	}
	// deterministic injected randomness
	p2 := &sqlPicker{db: e.db, rnd: func(n int) int { return 0 }}
	if s, ok := p2.Pick(func(string) bool { return false }); !ok || s.Number != "00001" {
		t.Fatalf("%+v", s)
	}
}

func TestSQLPickerScansWhenProbesKeepHittingExcludedSongs(t *testing.T) {
	e := newSvcEnv(t, 200)
	p := &sqlPicker{db: e.db}
	// 199 of 200 songs excluded: random probes rarely find the one, the full scan must
	for i := 0; i < 20; i++ {
		s, ok := p.Pick(func(n string) bool { return n != "00137" })
		if !ok || s.Number != "00137" {
			t.Fatalf("%+v %v", s, ok)
		}
	}
}

// An actor can be unloaded between a caller fetching it and locking it. The caller
// must not use the unloaded actor: a second actor for the same user would run in parallel.
func TestRegression_CallsRacingWithAnUnloadUseTheCurrentActor(t *testing.T) {
	e := newSvcEnv(t, 2)
	ctx := context.Background()
	if _, err := e.svc.Do(ctx, "u1", nil); err != nil {
		t.Fatal(err)
	}
	stale := e.svc.actor("u1")
	stale.mu.Lock() // a call that fetched `stale` now waits for its lock
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _ = e.svc.Do(ctx, "u1", func(m *Machine) ([]Effect, error) {
			_, eff := m.Add(Song{Number: "00001", Format: 2})
			return eff, nil
		})
	}()
	time.Sleep(50 * time.Millisecond)
	// meanwhile the user is unloaded, exactly as TickAll does it
	e.svc.mu.Lock()
	delete(e.svc.actors, "u1")
	e.svc.mu.Unlock()
	stale.dead = true
	stale.mu.Unlock()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the call hung")
	}
	if n := len(stale.m.Snapshot().Queue); n != 0 {
		t.Fatalf("the unloaded actor was used: its queue has %d items", n)
	}
	cur, err := e.svc.Do(ctx, "u1", nil)
	if err != nil || len(cur.Queue) != 1 {
		t.Fatalf("the current actor must have the song: %v %v", cur.Queue, err)
	}
}

func TestPrepareForGetsTheUserAndThePlayerDevice(t *testing.T) {
	e := newSvcEnv(t, 3)
	var mu sync.Mutex
	var calls [][3]string
	s := NewService(Config{
		DB: e.db, Songs: catalog.New(e.db), Preparer: e, Clock: e,
		Wall:                func() time.Time { return time.Unix(e.wall.Load(), 0) },
		DefaultScoreSeconds: 6, Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		PrepareFor: func(userID, playerDeviceID, number string) {
			mu.Lock()
			defer mu.Unlock()
			calls = append(calls, [3]string{userID, playerDeviceID, number})
		},
	})
	got := func() [][3]string {
		mu.Lock()
		defer mu.Unlock()
		return append([][3]string(nil), calls...)
	}
	do := func(user string, fn func(m *Machine) []Effect) {
		t.Helper()
		if _, err := s.Do(context.Background(), user, func(m *Machine) ([]Effect, error) { return fn(m), nil }); err != nil {
			t.Fatal(err)
		}
	}

	add(t, s, "u1", "00001") // nothing is playing, so nothing is up next yet
	if len(got()) != 0 {
		t.Fatalf("calls before anything plays: %v", got())
	}
	do("u1", func(m *Machine) []Effect { return m.Control("dev1", ActionPlayHere) })
	add(t, s, "u1", "00002")
	// 00001 starts; the queue is empty, so a random song is picked and prepared as up next; then 00002 is
	// queued and becomes the up-next song
	g := got()
	if len(g) < 2 || g[0] != [3]string{"u1", "dev1", "00001"} || g[len(g)-1] != [3]string{"u1", "dev1", "00002"} {
		t.Fatalf("calls = %v, want the start of 00001 first and the queued 00002 last", g)
	}
	var numbers []string
	for _, c := range g {
		if c[0] != "u1" || c[1] != "dev1" {
			t.Errorf("call %v has the wrong user or player", c)
		}
		numbers = append(numbers, c[2])
	}
	// the plain Preparer is told the same songs, whoever the player is
	e.mu.Lock()
	preps := append([]string(nil), e.preps...)
	e.mu.Unlock()
	if fmt.Sprint(preps) != fmt.Sprint(numbers) {
		t.Errorf("Preparer calls = %v, PrepareFor calls = %v", preps, numbers)
	}

	// another user has another player
	add(t, s, "u2", "00003")
	do("u2", func(m *Machine) []Effect { return m.Control("phone", ActionPlayHere) })
	g = got()
	if last := g[len(g)-1]; last[0] != "u2" || last[1] != "phone" {
		t.Fatalf("calls = %v: the last one should be about u2 and its player", g)
	}
}
