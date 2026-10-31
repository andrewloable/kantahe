// Package session holds the per-user playback rules (PLAN.md sections 2 and 7)
// as a pure state machine: no I/O, no goroutines, no clock or randomness of its
// own. The service around it serialises calls per user and turns the returned
// effects into side effects.
package session

import (
	"errors"
	"fmt"

	"github.com/andrewloable/kantahe/server/internal/score"
)

// Errors returned by the machine.
var (
	ErrNotFound  = errors.New("session: queue item not found")
	ErrNotPlayer = errors.New("session: only the player device may do that")
	ErrStale     = errors.New("session: the report is for a different song")
)

const (
	recentLimit   = 100
	playerGoneMs  = 30_000
	scoreMsPerSec = 1000
)

// Song is a library entry as the machine needs it.
type Song struct {
	Number     string
	Format     int
	DurationMs int64
}

// Source says where the current or next song came from.
type Source int

// Song sources.
const (
	SourceQueue Source = iota + 1
	SourceRandom
)

// Status is whether playback runs.
type Status int

// Playback states.
const (
	StatusPaused Status = iota + 1
	StatusPlaying
)

// Action is what a device asks for.
type Action int

// Control actions.
const (
	ActionPlay Action = iota + 1
	ActionPlayHere
	ActionPause
	ActionSkip
)

// Item is a queue entry.
type Item struct {
	ID   string
	Song Song
}

// Current is the song being played, or the next one.
type Current struct {
	Song         Song
	Source       Source
	PositionMs   int64
	PositionAtMs int64 // server monotonic time of PositionMs
}

// Settings are the user's score settings.
type Settings struct {
	ScoreMode  score.Mode
	ScoreLevel score.Level
}

// ScoreState is the score screen between two songs.
type ScoreState struct {
	Number  string
	Result  score.Result
	UntilMs int64
}

// State is a snapshot of everything the user's devices need.
type State struct {
	Status         Status
	PlayerDeviceID string
	Now            *Current
	Queue          []Item
	UpNext         *Current
	Settings       Settings
	Score          *ScoreState
	ServerTimeMs   int64
}

// Effect is something the caller must do after a call; the set is closed.
type Effect interface{ isEffect() }

// HistoryEntry records a finished or skipped song; Score is nil for skipped songs and when scoring is off.
type HistoryEntry struct {
	Song    Song
	Skipped bool
	Score   *score.Result
}

// PrepareSong asks for the song's media (the trimmed SoundFont) to be prepared.
type PrepareSong struct{ Number string }

// StopPlayer tells a device that it is no longer the player.
type StopPlayer struct{ DeviceID string }

func (HistoryEntry) isEffect() {}
func (PrepareSong) isEffect()  {}
func (StopPlayer) isEffect()   {}

// Clock is the server's monotonic time in milliseconds.
type Clock interface{ NowMs() int64 }

// Picker chooses a random song among those that are neither failed nor deleted
// and for which exclude returns false.
type Picker interface {
	Pick(exclude func(number string) bool) (Song, bool)
}

// Rand supplies the random number of a score.
type Rand interface{ Uint32() uint32 }

// Deps are the machine's outside world.
type Deps struct {
	Clock        Clock
	Picker       Picker
	Rand         Rand
	ScoreSeconds func() int
}

// Machine is one user's queue and playback state. It is not safe for concurrent use.
type Machine struct {
	d Deps

	status   Status
	player   string
	now      *Current
	queue    []Item
	upNext   *Current
	settings Settings
	score    *ScoreState
	recent   []string
	nextID   int

	online       map[string]bool
	offlineSince map[string]int64
}

// New returns a machine with an empty queue, paused, scoring randomly on the low level.
func New(d Deps) *Machine {
	return &Machine{
		d: d, status: StatusPaused,
		settings:     Settings{ScoreMode: score.ModeRandom, ScoreLevel: score.LevelLow},
		online:       map[string]bool{},
		offlineSince: map[string]int64{},
	}
}

func (m *Machine) nowMs() int64 { return m.d.Clock.NowMs() }

// Snapshot copies the current state.
func (m *Machine) Snapshot() State {
	s := State{Status: m.status, PlayerDeviceID: m.player, Settings: m.settings, ServerTimeMs: m.nowMs()}
	if m.now != nil {
		c := *m.now
		s.Now = &c
	}
	if m.upNext != nil {
		c := *m.upNext
		s.UpNext = &c
	}
	if m.score != nil {
		c := *m.score
		s.Score = &c
	}
	s.Queue = append([]Item(nil), m.queue...)
	return s
}

// Online reports whether the device has an open stream.
func (m *Machine) Online(device string) bool { return m.online[device] }

// SetOnline records that a device's stream opened or closed. The time a device went
// offline is the first such event; repeats do not restart it.
func (m *Machine) SetOnline(device string, online bool) {
	if online {
		m.online[device] = true
		delete(m.offlineSince, device)
		return
	}
	if _, known := m.offlineSince[device]; !known {
		m.offlineSince[device] = m.nowMs()
	}
	m.online[device] = false
}

// UpdateSettings changes the fields that are set.
func (m *Machine) UpdateSettings(mode *score.Mode, level *score.Level) {
	if mode != nil {
		m.settings.ScoreMode = *mode
	}
	if level != nil {
		m.settings.ScoreLevel = *level
	}
}

func (m *Machine) excludeCurrent(number string) bool {
	return m.now != nil && m.now.Song.Number == number
}

func (m *Machine) excludeRecent(number string) bool {
	if m.excludeCurrent(number) {
		return true
	}
	for _, n := range m.recent {
		if n == number {
			return true
		}
	}
	return false
}

// pick chooses a random song, avoiding the last 100 played; a small library that
// has nothing left outside that window only avoids the current song, so playback never runs dry.
func (m *Machine) pick() (Song, bool) {
	if s, ok := m.d.Picker.Pick(m.excludeRecent); ok {
		return s, true
	}
	return m.d.Picker.Pick(m.excludeCurrent)
}

func (m *Machine) pushRecent(number string) {
	m.recent = append(m.recent, number)
	if len(m.recent) > recentLimit {
		m.recent = m.recent[len(m.recent)-recentLimit:]
	}
}

// recomputeUpNext makes the up-next song the queue head or, with an empty queue,
// a random pick (kept if it already is one). It returns a PrepareSong when the
// up-next song changed.
func (m *Machine) recomputeUpNext() []Effect {
	prev := ""
	if m.upNext != nil {
		prev = m.upNext.Song.Number
	}
	switch {
	case m.now == nil:
		m.upNext = nil
	case len(m.queue) > 0:
		m.upNext = &Current{Song: m.queue[0].Song, Source: SourceQueue}
	case m.upNext != nil && m.upNext.Source == SourceRandom:
		return nil
	default:
		m.upNext = nil
		if s, ok := m.pick(); ok {
			m.upNext = &Current{Song: s, Source: SourceRandom}
		}
	}
	if m.upNext != nil && m.upNext.Song.Number != prev {
		return []Effect{PrepareSong{m.upNext.Song.Number}}
	}
	return nil
}

// loadNext makes the next song current: the queue head, else the random pre-pick,
// else a new random pick. With nothing to play the machine pauses.
func (m *Machine) loadNext() []Effect {
	var cur *Current
	switch {
	case len(m.queue) > 0:
		cur = &Current{Song: m.queue[0].Song, Source: SourceQueue}
		m.queue = m.queue[1:]
	case m.upNext != nil && m.upNext.Source == SourceRandom:
		cur = &Current{Song: m.upNext.Song, Source: SourceRandom}
	default:
		if s, ok := m.pick(); ok {
			cur = &Current{Song: s, Source: SourceRandom}
		}
	}
	m.upNext = nil
	if cur == nil {
		m.now = nil
		m.status = StatusPaused
		return nil
	}
	cur.PositionAtMs = m.nowMs()
	m.now = cur
	m.pushRecent(cur.Song.Number)
	effects := []Effect{PrepareSong{cur.Song.Number}}
	return append(effects, m.recomputeUpNext()...)
}

// Add appends a song to the queue. It never interrupts the current song.
func (m *Machine) Add(song Song) (Item, []Effect) {
	m.nextID++
	it := Item{ID: fmt.Sprintf("q%d", m.nextID), Song: song}
	m.queue = append(m.queue, it)
	return it, m.recomputeUpNext()
}

func (m *Machine) indexOf(id string) int {
	for i, it := range m.queue {
		if it.ID == id {
			return i
		}
	}
	return -1
}

// Remove deletes a queue item.
func (m *Machine) Remove(itemID string) ([]Effect, error) {
	i := m.indexOf(itemID)
	if i < 0 {
		return nil, ErrNotFound
	}
	m.queue = append(m.queue[:i:i], m.queue[i+1:]...)
	return m.recomputeUpNext(), nil
}

// MoveToTop moves a queue item to the front.
func (m *Machine) MoveToTop(itemID string) ([]Effect, error) {
	i := m.indexOf(itemID)
	if i < 0 {
		return nil, ErrNotFound
	}
	it := m.queue[i]
	rest := append(append([]Item(nil), m.queue[:i]...), m.queue[i+1:]...)
	m.queue = append([]Item{it}, rest...)
	return m.recomputeUpNext(), nil
}

// clearScoreAndLoadNext ends the score screen early.
func (m *Machine) clearScoreAndLoadNext() []Effect {
	m.score = nil
	return m.loadNext()
}

// Control applies Play, Play here, Pause or Skip from a device.
func (m *Machine) Control(device string, a Action) []Effect {
	var effects []Effect
	switch a {
	case ActionPlay:
		if m.player == "" || !m.online[m.player] {
			m.player = device
		}
		m.resumeClock()
		m.status = StatusPlaying
		if m.now == nil {
			effects = m.loadNext()
		}
	case ActionPlayHere:
		if m.player != "" && m.player != device {
			effects = append(effects, StopPlayer{m.player})
		}
		m.player = device
		m.resumeClock()
		m.status = StatusPlaying
		if m.now == nil {
			effects = append(effects, m.loadNext()...)
		}
	case ActionPause:
		m.freezeClock()
		m.status = StatusPaused
		if m.score != nil {
			effects = m.clearScoreAndLoadNext()
			m.status = StatusPaused
		}
	case ActionSkip:
		switch {
		case m.score != nil:
			effects = m.clearScoreAndLoadNext()
		case m.now != nil:
			effects = append(effects, HistoryEntry{Song: m.now.Song, Skipped: true})
			effects = append(effects, m.loadNext()...)
		default:
			effects = m.loadNext()
			m.status = StatusPaused
		}
	}
	m.settleStatus()
	return effects
}

// freezeClock fixes the position of a playing song where it really is now: the last
// report is up to a second old, and a paused song is not extrapolated any more.
func (m *Machine) freezeClock() {
	if m.status != StatusPlaying || m.now == nil {
		return
	}
	now := m.nowMs()
	reported := m.now.PositionMs
	m.now.PositionMs = reported + max(now-m.now.PositionAtMs, 0)
	if d := m.now.Song.DurationMs; d > 0 && m.now.PositionMs > d {
		// the extrapolation stops at the end of the song; what the player itself reported is kept
		m.now.PositionMs = max(d, reported)
	}
	m.now.PositionAtMs = now
}

// resumeClock starts the position clock again when a paused song is played: devices
// extrapolate from (PositionMs, PositionAtMs), so the pause must not count.
func (m *Machine) resumeClock() {
	if m.status != StatusPlaying && m.now != nil {
		m.now.PositionAtMs = m.nowMs()
	}
}

// settleStatus keeps the invariant that a playing machine has a song and a player.
func (m *Machine) settleStatus() {
	if m.status == StatusPlaying && (m.now == nil || m.player == "") {
		m.status = StatusPaused
	}
}

func (m *Machine) fromPlayer(device, number string) error {
	if m.player == "" || device != m.player {
		return ErrNotPlayer
	}
	if m.now == nil || m.now.Song.Number != number {
		return ErrStale
	}
	return nil
}

// Ready records that the player loaded the song and can start.
func (m *Machine) Ready(device, number string) error {
	if err := m.fromPlayer(device, number); err != nil {
		return err
	}
	if m.now.PositionMs == 0 { // the song starts now; later positions come with their own time
		m.now.PositionAtMs = m.nowMs()
	}
	return nil
}

// ReportPosition stores the player's position. It never changes what other
// devices see by itself, so changed is always false.
func (m *Machine) ReportPosition(device, number string, positionMs int64) (changed bool, err error) {
	if err := m.fromPlayer(device, number); err != nil {
		return false, err
	}
	m.now.PositionMs = max(positionMs, 0)
	m.now.PositionAtMs = m.nowMs()
	return false, nil
}

// Ended handles a song that ended on its own: it records the history entry and
// shows the score screen, or moves on at once when scoring is off.
func (m *Machine) Ended(device, number string, loudReadings int) ([]Effect, error) {
	if err := m.fromPlayer(device, number); err != nil {
		return nil, err
	}
	if m.score != nil {
		return nil, ErrStale // already on the score screen
	}
	res, show := score.Decide(m.settings.ScoreMode, m.settings.ScoreLevel, loudReadings, m.d.Rand.Uint32())
	entry := HistoryEntry{Song: m.now.Song}
	if show {
		r := res
		entry.Score = &r
	}
	effects := []Effect{entry}
	seconds := 0
	if show && m.d.ScoreSeconds != nil {
		seconds = m.d.ScoreSeconds()
	}
	if !show || seconds <= 0 {
		return append(effects, m.loadNext()...), nil
	}
	m.score = &ScoreState{Number: number, Result: res, UntilMs: m.nowMs() + int64(seconds)*scoreMsPerSec}
	return effects, nil
}

// Tick advances time-based rules: the end of the score screen and a player that
// has been gone for more than 30 seconds.
func (m *Machine) Tick() []Effect {
	var effects []Effect
	now := m.nowMs()
	if m.score != nil && now >= m.score.UntilMs {
		effects = m.clearScoreAndLoadNext()
	}
	if m.status == StatusPlaying && m.player != "" && !m.online[m.player] {
		if since, ok := m.offlineSince[m.player]; ok && now-since > playerGoneMs {
			m.status = StatusPaused
		}
	}
	m.settleStatus()
	return effects
}

// Restored is the persisted part of a machine's state.
type Restored struct {
	Status   Status
	Player   string
	Now      *Current // position fields as stored
	Queue    []Item
	Settings Settings
	Recent   []string // numbers played, oldest first
}

// Restore loads a persisted state into a fresh machine. The player counts as
// offline from now on, so a player that never reconnects is paused after 30 s.
// The returned effects ask for the current and up-next songs to be prepared.
func (m *Machine) Restore(r Restored) []Effect {
	m.status, m.player, m.settings = r.Status, r.Player, r.Settings
	if m.settings.ScoreMode == 0 {
		m.settings.ScoreMode = score.ModeRandom
	}
	if m.settings.ScoreLevel == 0 {
		m.settings.ScoreLevel = score.LevelLow
	}
	m.queue = append([]Item(nil), r.Queue...)
	for _, it := range m.queue {
		var n int
		if _, err := fmt.Sscanf(it.ID, "q%d", &n); err == nil && n > m.nextID {
			m.nextID = n
		}
	}
	m.recent = append([]string(nil), r.Recent...)
	if len(m.recent) > recentLimit {
		m.recent = m.recent[len(m.recent)-recentLimit:]
	}
	m.now, m.upNext, m.score = nil, nil, nil
	if r.Now != nil {
		c := *r.Now
		c.PositionAtMs = m.nowMs()
		m.now = &c
	}
	if m.player != "" {
		m.SetOnline(m.player, false)
	}
	m.settleStatus()
	var effects []Effect
	if m.now != nil {
		effects = append(effects, PrepareSong{m.now.Song.Number})
	}
	return append(effects, m.recomputeUpNext()...)
}
