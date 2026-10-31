package session

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/score"
	"github.com/andrewloable/kantahe/server/internal/settings"
	"github.com/andrewloable/kantahe/server/internal/store"
)

const (
	positionSaveEvery = 30 * time.Second
	idleUnloadAfter   = time.Hour
	tickEvery         = time.Second
)

// SongLookup finds a song users may play (not failed, not deleted).
type SongLookup interface {
	Get(ctx context.Context, number string) (library.SongInfo, error)
}

// Preparer starts preparing a song's media ahead of time; it must not block.
type Preparer interface{ Prepare(number string) }

// PrepareFor is Preparer for work that depends on who plays: it learns the user and the device that
// is the user's player at that moment ("" when there is none). It must not block.
type PrepareFor func(userID, playerDeviceID, number string)

// Config holds the service's dependencies. Zero values give production defaults.
type Config struct {
	DB                  *store.DB
	Songs               SongLookup
	Preparer            Preparer   // may be nil
	PrepareFor          PrepareFor // may be nil
	Picker              Picker     // nil: random songs from the library
	Clock               Clock      // nil: monotonic milliseconds since the service started
	Rand                Rand       // nil: crypto/rand
	Wall                func() time.Time
	DefaultScoreSeconds int
	Logger              *slog.Logger
}

// Service keeps one Machine per user, loaded on first use and saved on every change.
type Service struct {
	cfg   Config
	start time.Time

	mu     sync.Mutex
	actors map[string]*actor
}

type actor struct {
	userID string
	mu     sync.Mutex // serialises everything for this user

	m        *Machine
	loaded   bool
	subs     map[*Subscription]struct{}
	devCount map[string]int
	dead     bool      // unloaded: callers that waited for the lock must fetch the current actor
	lastPos  time.Time // wall time of the last position save
	activity time.Time // wall time of the last use
}

// Snapshot is the machine state plus which devices have an open stream.
type Snapshot struct {
	State
	Online map[string]bool
}

// NewService builds the service.
func NewService(cfg Config) *Service {
	s := &Service{cfg: cfg, start: time.Now(), actors: map[string]*actor{}}
	if s.cfg.Logger == nil {
		s.cfg.Logger = slog.Default()
	}
	if s.cfg.Wall == nil {
		s.cfg.Wall = time.Now
	}
	if s.cfg.Rand == nil {
		s.cfg.Rand = cryptoRand{}
	}
	if s.cfg.Picker == nil {
		s.cfg.Picker = &sqlPicker{db: cfg.DB}
	}
	return s
}

type cryptoRand struct{}

func (cryptoRand) Uint32() uint32 {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("session: no randomness available: " + err.Error())
	}
	return binary.LittleEndian.Uint32(b[:])
}

// NowMs is the machines' clock: monotonic milliseconds since the service started.
func (s *Service) NowMs() int64 {
	if s.cfg.Clock != nil {
		return s.cfg.Clock.NowMs()
	}
	return time.Since(s.start).Milliseconds()
}

func (s *Service) scoreSeconds() int {
	n, err := settings.ScoreSeconds(context.Background(), s.cfg.DB, s.cfg.DefaultScoreSeconds)
	if err != nil {
		return s.cfg.DefaultScoreSeconds
	}
	return n
}

// lockActor returns the user's current actor with its lock held. An actor that was
// unloaded while the caller waited for the lock is dead: the caller fetches the new one.
func (s *Service) lockActor(userID string) *actor {
	for {
		a := s.actor(userID)
		a.mu.Lock()
		if !a.dead {
			return a
		}
		a.mu.Unlock()
	}
}

func (s *Service) actor(userID string) *actor {
	s.mu.Lock()
	defer s.mu.Unlock()
	a := s.actors[userID]
	if a == nil {
		a = &actor{userID: userID, subs: map[*Subscription]struct{}{}, devCount: map[string]int{}}
		s.actors[userID] = a
	}
	return a
}

// ensureLoaded builds the machine from the database; the caller holds a.mu.
func (s *Service) ensureLoaded(ctx context.Context, a *actor) error {
	if a.loaded {
		return nil
	}
	m := New(Deps{Clock: clockFunc(s.NowMs), Picker: s.cfg.Picker, Rand: s.cfg.Rand, ScoreSeconds: s.scoreSeconds})
	restored, err := s.load(ctx, a.userID)
	if err != nil {
		return err
	}
	effects := m.Restore(restored)
	a.m, a.loaded = m, true
	s.runEffects(ctx, effects, a)
	return nil
}

type clockFunc func() int64

func (f clockFunc) NowMs() int64 { return f() }

func fingerprint(st State) string {
	b := fmt.Sprintf("%d|%s|", st.Status, st.PlayerDeviceID)
	if st.Now != nil {
		b += fmt.Sprintf("now=%s/%d|", st.Now.Song.Number, st.Now.Source)
	}
	for _, it := range st.Queue {
		b += it.ID + ","
	}
	if st.UpNext != nil {
		b += fmt.Sprintf("|up=%s/%d", st.UpNext.Song.Number, st.UpNext.Source)
	}
	b += fmt.Sprintf("|%d/%d", st.Settings.ScoreMode, st.Settings.ScoreLevel)
	if st.Score != nil {
		b += fmt.Sprintf("|score=%s/%d", st.Score.Number, st.Score.UntilMs)
	}
	return b
}

func (a *actor) snapshot() Snapshot {
	online := map[string]bool{}
	for d, n := range a.devCount {
		if n > 0 {
			online[d] = true
		}
	}
	return Snapshot{State: a.m.Snapshot(), Online: online}
}

// runEffects performs the effects that need no database: preparing media. The caller holds a.mu.
func (s *Service) runEffects(ctx context.Context, effects []Effect, a *actor) {
	for _, e := range effects {
		p, ok := e.(PrepareSong)
		if !ok {
			continue
		}
		if s.cfg.Preparer != nil {
			s.cfg.Preparer.Prepare(p.Number)
		}
		if s.cfg.PrepareFor != nil && a != nil {
			s.cfg.PrepareFor(a.userID, a.m.player, p.Number)
		}
	}
}

// Do runs fn on the user's machine. Machine errors (ErrNotPlayer, ...) leave the
// state untouched and are returned as they are. A changed state is saved and pushed.
func (s *Service) Do(ctx context.Context, userID string, fn func(m *Machine) ([]Effect, error)) (Snapshot, error) {
	a := s.lockActor(userID)
	defer a.mu.Unlock()
	if err := s.ensureLoaded(ctx, a); err != nil {
		return Snapshot{}, err
	}
	a.activity = s.cfg.Wall()
	before := fingerprint(a.m.Snapshot())
	var effects []Effect
	if fn != nil {
		var err error
		if effects, err = fn(a.m); err != nil {
			return a.snapshot(), err
		}
	}
	return s.finish(ctx, a, before, effects)
}

// finish saves and pushes after a call; the caller holds a.mu.
func (s *Service) finish(ctx context.Context, a *actor, before string, effects []Effect) (Snapshot, error) {
	snap := a.snapshot()
	changed := fingerprint(snap.State) != before
	wall := s.cfg.Wall()
	savePosition := !changed && len(effects) == 0 && snap.Now != nil && wall.Sub(a.lastPos) >= positionSaveEvery
	if changed || len(effects) > 0 || savePosition {
		if err := s.save(ctx, a.userID, snap.State, effects, wall); err != nil {
			s.cfg.Logger.Error("cannot save the playback state", "user", a.userID, "err", err)
			return snap, err
		}
		a.lastPos = wall
	}
	s.runEffects(ctx, effects, a)
	if changed {
		a.broadcast(snap)
	}
	return snap, nil
}

// Notify pushes the user's current state to the open streams (for example after
// a device changed outside the machine).
func (s *Service) Notify(ctx context.Context, userID string) error {
	a := s.lockActor(userID)
	defer a.mu.Unlock()
	if err := s.ensureLoaded(ctx, a); err != nil {
		return err
	}
	a.broadcast(a.snapshot())
	return nil
}

// TickAll applies time-based rules to every loaded machine that needs it and
// unloads machines that have been idle for an hour without a stream.
func (s *Service) TickAll(ctx context.Context) {
	s.mu.Lock()
	list := make([]*actor, 0, len(s.actors))
	for _, a := range s.actors {
		list = append(list, a)
	}
	s.mu.Unlock()
	for _, a := range list {
		s.tick(ctx, a)
	}
}

func (s *Service) tick(ctx context.Context, a *actor) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.loaded {
		return
	}
	st := a.m.Snapshot()
	if st.Status == StatusPlaying || st.Score != nil {
		before := fingerprint(st)
		effects := a.m.Tick()
		if _, err := s.finish(ctx, a, before, effects); err != nil {
			s.cfg.Logger.Warn("tick failed", "user", a.userID, "err", err)
		}
		return
	}
	if len(a.subs) == 0 && s.cfg.Wall().Sub(a.activity) > idleUnloadAfter {
		s.mu.Lock()
		delete(s.actors, a.userID)
		s.mu.Unlock()
		a.dead = true
	}
}

// Run ticks once a second until ctx is cancelled.
func (s *Service) Run(ctx context.Context) {
	t := time.NewTicker(tickEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.TickAll(ctx)
		}
	}
}

// ---- persistence ----

func (s *Service) load(ctx context.Context, userID string) (Restored, error) {
	r := Restored{Status: StatusPaused, Settings: Settings{ScoreMode: score.ModeRandom, ScoreLevel: score.LevelLow}}
	var nowNumber string
	var nowSource, position int64
	var status, mode, level int
	err := s.cfg.DB.QueryRowContext(ctx, `SELECT status, player_device_id, now_number, now_source, position_ms, score_mode, score_level FROM user_state WHERE user_id = ?`, userID).
		Scan(&status, &r.Player, &nowNumber, &nowSource, &position, &mode, &level)
	switch {
	case errors.Is(err, sql.ErrNoRows):
	case err != nil:
		return r, err
	default:
		r.Status, r.Settings = Status(status), Settings{ScoreMode: score.Mode(mode), ScoreLevel: score.Level(level)}
	}
	if nowNumber != "" {
		if info, err := s.cfg.Songs.Get(ctx, nowNumber); err == nil {
			r.Now = &Current{Song: toSong(info), Source: Source(nowSource), PositionMs: position}
		} else if !errors.Is(err, library.ErrNotFound) {
			return r, err
		}
	}
	rows, err := s.cfg.DB.QueryContext(ctx, `SELECT id, number FROM queue_items WHERE user_id = ? ORDER BY pos`, userID)
	if err != nil {
		return r, err
	}
	type qi struct{ id, number string }
	var stored []qi
	for rows.Next() {
		var q qi
		if err := rows.Scan(&q.id, &q.number); err != nil {
			rows.Close()
			return r, err
		}
		stored = append(stored, q)
	}
	if err := rows.Err(); err != nil {
		return r, err
	}
	rows.Close()
	for _, q := range stored { // songs that were deleted or failed meanwhile drop out of the queue
		info, err := s.cfg.Songs.Get(ctx, q.number)
		if errors.Is(err, library.ErrNotFound) {
			continue
		}
		if err != nil {
			return r, err
		}
		r.Queue = append(r.Queue, Item{ID: q.id, Song: toSong(info)})
	}
	hist, err := s.cfg.DB.QueryContext(ctx, `SELECT number FROM history WHERE user_id = ? ORDER BY id DESC LIMIT ?`, userID, recentLimit)
	if err != nil {
		return r, err
	}
	defer hist.Close()
	var newestFirst []string
	for hist.Next() {
		var n string
		if err := hist.Scan(&n); err != nil {
			return r, err
		}
		newestFirst = append(newestFirst, n)
	}
	for i := len(newestFirst) - 1; i >= 0; i-- {
		r.Recent = append(r.Recent, newestFirst[i])
	}
	if r.Now != nil && (len(r.Recent) == 0 || r.Recent[len(r.Recent)-1] != r.Now.Song.Number) {
		r.Recent = append(r.Recent, r.Now.Song.Number)
	}
	return r, hist.Err()
}

func toSong(i library.SongInfo) Song {
	return Song{Number: i.Number, Format: int(i.Format), DurationMs: i.DurationMs}
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

func (s *Service) save(ctx context.Context, userID string, st State, effects []Effect, wall time.Time) error {
	return s.cfg.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		nowNumber, nowSource, pos := "", 0, int64(0)
		if st.Now != nil {
			nowNumber, nowSource, pos = st.Now.Song.Number, int(st.Now.Source), st.Now.PositionMs
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_state(user_id, status, player_device_id, now_number, now_source, position_ms, score_mode, score_level)
			VALUES (?,?,?,?,?,?,?,?)
			ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, player_device_id = excluded.player_device_id, now_number = excluded.now_number,
				now_source = excluded.now_source, position_ms = excluded.position_ms, score_mode = excluded.score_mode, score_level = excluded.score_level`,
			userID, int(st.Status), st.PlayerDeviceID, nowNumber, nowSource, pos, int(st.Settings.ScoreMode), int(st.Settings.ScoreLevel)); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM queue_items WHERE user_id = ?`, userID); err != nil {
			return err
		}
		for i, it := range st.Queue {
			if _, err := tx.ExecContext(ctx, `INSERT INTO queue_items(user_id, id, pos, number) VALUES (?,?,?,?)`, userID, it.ID, i, it.Song.Number); err != nil {
				return err
			}
		}
		for _, e := range effects {
			h, ok := e.(HistoryEntry)
			if !ok {
				continue
			}
			value := 0
			if h.Score != nil && h.Score.HasValue {
				value = h.Score.Value
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO history(user_id, number, sung_at, skipped, has_score, score) VALUES (?,?,?,?,?,?)`,
				userID, h.Song.Number, wall.Unix(), b2i(h.Skipped), b2i(h.Score != nil && h.Score.HasValue), value); err != nil {
				return err
			}
		}
		return nil
	})
}

// IsOnline reports whether the device has an open stream.
func (s *Service) IsOnline(userID, deviceID string) bool {
	s.mu.Lock()
	a := s.actors[userID]
	s.mu.Unlock()
	if a == nil {
		return false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.devCount[deviceID] > 0
}
