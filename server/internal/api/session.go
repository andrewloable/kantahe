package api

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/catalog"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/score"
	"github.com/andrewloable/kantahe/server/internal/session"
	"github.com/andrewloable/kantahe/server/internal/users"
)

// deviceRecheck is how often an open stream checks that its device is still signed in.
var deviceRecheck = 30 * time.Second

// keepAlive is how long an open stream may stay silent before it repeats the current state. A client
// cannot tell a quiet server from a dead link otherwise, and treats a longer silence as a dead stream.
var keepAlive = 25 * time.Second

// SessionServer implements the per-user playback RPCs of SessionService. Device
// settings and playlists are added by their own tasks (the embedded handler).
type SessionServer struct {
	kantahev1connect.UnimplementedSessionServiceHandler
	d   Deps
	svc *session.Service
	cat *catalog.Catalog
}

func newSessionServer(d Deps, svc *session.Service, cat *catalog.Catalog) *SessionServer {
	return &SessionServer{d: d, svc: svc, cat: cat}
}

func (s *SessionServer) fail(op string, err error) error {
	switch {
	case errors.Is(err, session.ErrNotPlayer):
		return newErr(connect.CodePermissionDenied, "only the player device may do that")
	case errors.Is(err, session.ErrStale):
		return newErr(connect.CodeFailedPrecondition, "that is not the song being played")
	case errors.Is(err, session.ErrNotFound), errors.Is(err, library.ErrNotFound):
		return newErr(connect.CodeNotFound, "not found")
	case errors.Is(err, catalog.ErrInvalid):
		return newErr(connect.CodeInvalidArgument, err.Error())
	}
	return internalErr(s.d.Logger, op, err)
}

func (s *SessionServer) song(ctx context.Context, number string) (*kantahev1.Song, error) {
	info, err := s.cat.Get(ctx, number)
	if err != nil {
		return nil, err
	}
	return toProtoSong(info, false), nil
}

// songOrStub describes a song for a state push; a song that vanished meanwhile
// is shown by number only instead of failing the whole push.
func (s *SessionServer) songOrStub(ctx context.Context, number string) *kantahev1.Song {
	if p, err := s.song(ctx, number); err == nil {
		return p
	}
	return &kantahev1.Song{Number: number}
}

func (s *SessionServer) current(ctx context.Context, c *session.Current) *kantahev1.NowPlaying {
	if c == nil {
		return nil
	}
	return &kantahev1.NowPlaying{
		Song: s.songOrStub(ctx, c.Song.Number), Source: kantahev1.SongSource(c.Source),
		PositionMs: c.PositionMs, PositionAtMs: c.PositionAtMs,
	}
}

// toProto converts a snapshot for one caller device (is_caller marks its device).
func (s *SessionServer) toProto(ctx context.Context, userID, callerDevice string, snap session.Snapshot) (*kantahev1.State, error) {
	devs, err := users.ListDevices(ctx, s.d.DB, userID)
	if err != nil {
		return nil, err
	}
	out := &kantahev1.State{
		Status: kantahev1.PlayStatus(snap.Status), PlayerDeviceId: snap.PlayerDeviceID, Now: s.current(ctx, snap.Now),
		Settings:     &kantahev1.UserSettings{ScoreMode: kantahev1.ScoreMode(snap.Settings.ScoreMode), ScoreLevel: kantahev1.ScoreLevel(snap.Settings.ScoreLevel)},
		ServerTimeMs: snap.ServerTimeMs,
	}
	for _, d := range devs {
		pd := toProtoDevice(d, callerDevice, s.d.Modes)
		pd.Online = snap.Online[d.ID]
		out.Devices = append(out.Devices, pd)
	}
	for _, it := range snap.Queue {
		out.Queue = append(out.Queue, &kantahev1.QueueItem{Id: it.ID, Song: s.songOrStub(ctx, it.Song.Number)})
	}
	if snap.UpNext != nil {
		out.UpNext = &kantahev1.UpNext{Song: s.songOrStub(ctx, snap.UpNext.Song.Number), Source: kantahev1.SongSource(snap.UpNext.Source)}
	}
	if sc := snap.Score; sc != nil {
		r := sc.Result
		out.Score = &kantahev1.Score{
			Number: sc.Number, HasValue: r.HasValue, Value: int32(r.Value), Comment: r.Comment,
			Fanfare: int32(r.Fanfare), Reason: r.Reason, UntilMs: sc.UntilMs,
		}
	}
	songs := []*kantahev1.Song{}
	if out.Now != nil {
		songs = append(songs, out.Now.Song)
	}
	for _, q := range out.Queue {
		songs = append(songs, q.Song)
	}
	if out.UpNext != nil {
		songs = append(songs, out.UpNext.Song)
	}
	if err := markFavourites(ctx, s.d.UserLib, userID, songs...); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *SessionServer) stateResponse(ctx context.Context, id string, device string, snap session.Snapshot) (*kantahev1.State, error) {
	st, err := s.toProto(ctx, id, device, snap)
	if err != nil {
		return nil, internalErr(s.d.Logger, "State", err)
	}
	return st, nil
}

// WatchState streams the caller's full state at once and after every change.
func (s *SessionServer) WatchState(ctx context.Context, _ *connect.Request[kantahev1.WatchStateRequest], stream *connect.ServerStream[kantahev1.WatchStateResponse]) error {
	id, err := identity(ctx)
	if err != nil {
		return err
	}
	sub, first, err := s.svc.Subscribe(ctx, id.UserID, id.DeviceID)
	if err != nil {
		return internalErr(s.d.Logger, "WatchState", err)
	}
	defer sub.Close()
	send := func(snap session.Snapshot) error {
		st, err := s.stateResponse(ctx, id.UserID, id.DeviceID, snap)
		if err != nil {
			return err
		}
		return stream.Send(&kantahev1.WatchStateResponse{State: st})
	}
	// a stream outlives the request that opened it, so it re-checks the device now and then
	active := func() error {
		ok, err := users.DeviceActive(ctx, s.d.DB, id.UserID, id.DeviceID)
		if err != nil {
			return internalErr(s.d.Logger, "WatchState", err)
		}
		if !ok {
			return newErr(connect.CodeUnauthenticated, "sign in required")
		}
		return nil
	}
	if err := send(first); err != nil {
		return err
	}
	recheck := time.NewTicker(deviceRecheck)
	defer recheck.Stop()
	quiet := keepAlive           // read once: a stream that is already open keeps its interval
	idle := time.NewTimer(quiet) // restarted by every message
	defer idle.Stop()
	sent := func(err error) error {
		if err == nil {
			idle.Reset(quiet) // the timer is only reset after it fired or was drained
		}
		return err
	}
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-recheck.C:
			if err := active(); err != nil {
				return err
			}
		case snap := <-sub.C:
			if err := active(); err != nil {
				return err
			}
			if !idle.Stop() {
				select {
				case <-idle.C:
				default:
				}
			}
			if err := sent(send(snap)); err != nil {
				return err
			}
		case <-idle.C:
			snap, err := s.svc.Do(ctx, id.UserID, nil)
			if err != nil {
				return s.fail("WatchState", err)
			}
			if err := active(); err != nil {
				return err
			}
			if err := sent(send(snap)); err != nil {
				return err
			}
		}
	}
}

// GetState is the polling fallback of WatchState.
func (s *SessionServer) GetState(ctx context.Context, _ *connect.Request[kantahev1.GetStateRequest]) (*connect.Response[kantahev1.GetStateResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	snap, err := s.svc.Do(ctx, id.UserID, nil)
	if err != nil {
		return nil, s.fail("GetState", err)
	}
	st, err := s.stateResponse(ctx, id.UserID, id.DeviceID, snap)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(&kantahev1.GetStateResponse{State: st}), nil
}

// AddToQueue appends a song; it never interrupts the current one.
func (s *SessionServer) AddToQueue(ctx context.Context, req *connect.Request[kantahev1.AddToQueueRequest]) (*connect.Response[kantahev1.AddToQueueResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	info, err := s.cat.Get(ctx, req.Msg.Number)
	if err != nil {
		return nil, s.fail("AddToQueue", err)
	}
	var item session.Item
	if _, err := s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) {
		var eff []session.Effect
		item, eff = m.Add(session.Song{Number: info.Number, Format: int(info.Format), DurationMs: info.DurationMs})
		return eff, nil
	}); err != nil {
		return nil, s.fail("AddToQueue", err)
	}
	song := toProtoSong(info, false)
	if err := markFavourites(ctx, s.d.UserLib, id.UserID, song); err != nil {
		return nil, s.fail("AddToQueue", err)
	}
	return connect.NewResponse(&kantahev1.AddToQueueResponse{Item: &kantahev1.QueueItem{Id: item.ID, Song: song}}), nil
}

// RemoveFromQueue deletes one of the caller's queue items.
func (s *SessionServer) RemoveFromQueue(ctx context.Context, req *connect.Request[kantahev1.RemoveFromQueueRequest]) (*connect.Response[kantahev1.RemoveFromQueueResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	_, err = s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) { return m.Remove(req.Msg.ItemId) })
	if err != nil {
		return nil, s.fail("RemoveFromQueue", err)
	}
	return connect.NewResponse(&kantahev1.RemoveFromQueueResponse{}), nil
}

// MoveToTop moves one of the caller's queue items to the front.
func (s *SessionServer) MoveToTop(ctx context.Context, req *connect.Request[kantahev1.MoveToTopRequest]) (*connect.Response[kantahev1.MoveToTopResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	_, err = s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) { return m.MoveToTop(req.Msg.ItemId) })
	if err != nil {
		return nil, s.fail("MoveToTop", err)
	}
	return connect.NewResponse(&kantahev1.MoveToTopResponse{}), nil
}

// Control applies Play, Play here, Pause or Skip from the calling device.
func (s *SessionServer) Control(ctx context.Context, req *connect.Request[kantahev1.ControlRequest]) (*connect.Response[kantahev1.ControlResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	var action session.Action
	switch req.Msg.Action {
	case kantahev1.ControlAction_CONTROL_ACTION_PLAY:
		action = session.ActionPlay
	case kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE:
		action = session.ActionPlayHere
	case kantahev1.ControlAction_CONTROL_ACTION_PAUSE:
		action = session.ActionPause
	case kantahev1.ControlAction_CONTROL_ACTION_SKIP:
		action = session.ActionSkip
	default:
		return nil, invalidArgument("unknown action")
	}
	_, err = s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) { return m.Control(id.DeviceID, action), nil })
	if err != nil {
		return nil, s.fail("Control", err)
	}
	return connect.NewResponse(&kantahev1.ControlResponse{}), nil
}

// UpdateUserSettings changes only the score settings that are set.
func (s *SessionServer) UpdateUserSettings(ctx context.Context, req *connect.Request[kantahev1.UpdateUserSettingsRequest]) (*connect.Response[kantahev1.UpdateUserSettingsResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	var mode *score.Mode
	var level *score.Level
	if req.Msg.ScoreMode != nil {
		switch m := req.Msg.GetScoreMode(); m {
		case kantahev1.ScoreMode_SCORE_MODE_OFF, kantahev1.ScoreMode_SCORE_MODE_RANDOM, kantahev1.ScoreMode_SCORE_MODE_MICROPHONE:
			v := score.Mode(m)
			mode = &v
		default:
			return nil, invalidArgument("unknown score mode")
		}
	}
	if req.Msg.ScoreLevel != nil {
		switch l := req.Msg.GetScoreLevel(); l {
		case kantahev1.ScoreLevel_SCORE_LEVEL_LOW, kantahev1.ScoreLevel_SCORE_LEVEL_MIDDLE, kantahev1.ScoreLevel_SCORE_LEVEL_HIGH:
			v := score.Level(l)
			level = &v
		default:
			return nil, invalidArgument("unknown score level")
		}
	}
	snap, err := s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) {
		m.UpdateSettings(mode, level)
		return nil, nil
	})
	if err != nil {
		return nil, s.fail("UpdateUserSettings", err)
	}
	return connect.NewResponse(&kantahev1.UpdateUserSettingsResponse{Settings: &kantahev1.UserSettings{
		ScoreMode: kantahev1.ScoreMode(snap.Settings.ScoreMode), ScoreLevel: kantahev1.ScoreLevel(snap.Settings.ScoreLevel),
	}}), nil
}

func songNumberArg(raw string) (string, error) {
	n, ok := library.CanonicalNumber(raw)
	if !ok {
		return "", invalidArgument("a song number is made of digits")
	}
	return n, nil
}

// Ready tells the server that the player loaded the song.
func (s *SessionServer) Ready(ctx context.Context, req *connect.Request[kantahev1.ReadyRequest]) (*connect.Response[kantahev1.ReadyResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	number, err := songNumberArg(req.Msg.Number)
	if err != nil {
		return nil, err
	}
	_, err = s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) { return nil, m.Ready(id.DeviceID, number) })
	if err != nil {
		return nil, s.fail("Ready", err)
	}
	return connect.NewResponse(&kantahev1.ReadyResponse{}), nil
}

// ReportPosition stores the player's position; it never pushes.
func (s *SessionServer) ReportPosition(ctx context.Context, req *connect.Request[kantahev1.ReportPositionRequest]) (*connect.Response[kantahev1.ReportPositionResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	number, err := songNumberArg(req.Msg.Number)
	if err != nil {
		return nil, err
	}
	_, err = s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) {
		_, err := m.ReportPosition(id.DeviceID, number, req.Msg.PositionMs)
		return nil, err
	})
	if err != nil {
		return nil, s.fail("ReportPosition", err)
	}
	return connect.NewResponse(&kantahev1.ReportPositionResponse{}), nil
}

// Ended tells the server that the song finished on its own.
func (s *SessionServer) Ended(ctx context.Context, req *connect.Request[kantahev1.EndedRequest]) (*connect.Response[kantahev1.EndedResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	number, err := songNumberArg(req.Msg.Number)
	if err != nil {
		return nil, err
	}
	loud := int(max(req.Msg.LoudReadings, 0))
	_, err = s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) { return m.Ended(id.DeviceID, number, loud) })
	if err != nil {
		return nil, s.fail("Ended", err)
	}
	return connect.NewResponse(&kantahev1.EndedResponse{}), nil
}

// ReportMic records whether the calling device has a usable microphone.
func (s *SessionServer) ReportMic(ctx context.Context, req *connect.Request[kantahev1.ReportMicRequest]) (*connect.Response[kantahev1.ReportMicResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	var found bool
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		var err error
		found, err = users.SetDeviceMic(ctx, tx, id.UserID, id.DeviceID, req.Msg.Available)
		return err
	})
	if err != nil {
		return nil, s.fail("ReportMic", err)
	}
	if !found {
		return nil, newErr(connect.CodeNotFound, "device not found")
	}
	if err := s.svc.Notify(ctx, id.UserID); err != nil {
		return nil, s.fail("ReportMic", err)
	}
	return connect.NewResponse(&kantahev1.ReportMicResponse{}), nil
}

// ReportDevice stores the device's memory and counts a dropout episode, which
// steps the automatic MIDI mode down one level for the rest of the session.
func (s *SessionServer) ReportDevice(ctx context.Context, req *connect.Request[kantahev1.ReportDeviceRequest]) (*connect.Response[kantahev1.ReportDeviceResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	if m.MemoryMb < 0 || m.MemoryMb > maxMemoryMB || m.Dropouts < 0 {
		return nil, invalidArgument("memory and dropouts must not be negative")
	}
	var found bool
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		var err error
		found, err = users.SetDeviceMemory(ctx, tx, id.UserID, id.DeviceID, int(m.MemoryMb))
		return err
	})
	if err != nil {
		return nil, s.fail("ReportDevice", err)
	}
	if !found {
		return nil, newErr(connect.CodeNotFound, "device not found")
	}
	if m.Dropouts > 0 {
		s.d.Modes.StepDowns.Add(id.DeviceID)
	}
	dev, err := users.DeviceByID(ctx, s.d.DB, id.UserID, id.DeviceID)
	if err != nil {
		return nil, s.fail("ReportDevice", err)
	}
	if err := s.svc.Notify(ctx, id.UserID); err != nil {
		return nil, s.fail("ReportDevice", err)
	}
	pd := toProtoDevice(dev, id.DeviceID, s.d.Modes)
	pd.Online = s.svc.IsOnline(id.UserID, id.DeviceID)
	return connect.NewResponse(&kantahev1.ReportDeviceResponse{Device: pd}), nil
}

// SetMidiMode sets the MIDI mode of one of the caller's devices.
func (s *SessionServer) SetMidiMode(ctx context.Context, req *connect.Request[kantahev1.SetMidiModeRequest]) (*connect.Response[kantahev1.SetMidiModeResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	switch m.Mode {
	case kantahev1.MidiMode_MIDI_MODE_AUTO, kantahev1.MidiMode_MIDI_MODE_FULL, kantahev1.MidiMode_MIDI_MODE_LOW_POWER, kantahev1.MidiMode_MIDI_MODE_SERVER:
	default:
		return nil, invalidArgument("unknown MIDI mode")
	}
	var found bool
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		var err error
		found, err = users.SetDeviceMidiMode(ctx, tx, id.UserID, m.DeviceId, int(m.Mode))
		return err
	})
	if err != nil {
		return nil, s.fail("SetMidiMode", err)
	}
	if !found {
		return nil, newErr(connect.CodeNotFound, "device not found")
	}
	dev, err := users.DeviceByID(ctx, s.d.DB, id.UserID, m.DeviceId)
	if err != nil {
		return nil, s.fail("SetMidiMode", err)
	}
	if err := s.svc.Notify(ctx, id.UserID); err != nil {
		return nil, s.fail("SetMidiMode", err)
	}
	pd := toProtoDevice(dev, id.DeviceID, s.d.Modes)
	pd.Online = s.svc.IsOnline(id.UserID, dev.ID)
	return connect.NewResponse(&kantahev1.SetMidiModeResponse{Device: pd}), nil
}

// SetBackgroundMode stores the background video choice of one of the caller's own devices (AUTO, ON or OFF) and returns the device with the
// value the server resolved from it.
func (s *SessionServer) SetBackgroundMode(ctx context.Context, req *connect.Request[kantahev1.SetBackgroundModeRequest]) (*connect.Response[kantahev1.SetBackgroundModeResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	switch m.Mode {
	case kantahev1.BackgroundMode_BACKGROUND_MODE_AUTO, kantahev1.BackgroundMode_BACKGROUND_MODE_ON, kantahev1.BackgroundMode_BACKGROUND_MODE_OFF:
	default:
		return nil, invalidArgument("unknown background video mode")
	}
	var found bool
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		var err error
		found, err = users.SetDeviceBackgroundMode(ctx, tx, id.UserID, m.DeviceId, int(m.Mode))
		return err
	})
	if err != nil {
		return nil, s.fail("SetBackgroundMode", err)
	}
	if !found {
		return nil, newErr(connect.CodeNotFound, "device not found")
	}
	dev, err := users.DeviceByID(ctx, s.d.DB, id.UserID, m.DeviceId)
	if err != nil {
		return nil, s.fail("SetBackgroundMode", err)
	}
	if err := s.svc.Notify(ctx, id.UserID); err != nil {
		return nil, s.fail("SetBackgroundMode", err)
	}
	pd := toProtoDevice(dev, id.DeviceID, s.d.Modes)
	pd.Online = s.svc.IsOnline(id.UserID, dev.ID)
	return connect.NewResponse(&kantahev1.SetBackgroundModeResponse{Device: pd}), nil
}

const maxMemoryMB = 1 << 20 // 1 TB: anything larger is a bad report

// AddPlaylistToQueue appends every playable song of one of the caller's playlists, in order, in one change.
func (s *SessionServer) AddPlaylistToQueue(ctx context.Context, req *connect.Request[kantahev1.AddPlaylistToQueueRequest]) (*connect.Response[kantahev1.AddPlaylistToQueueResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	songs, err := s.d.UserLib.PlayableSongs(ctx, id.UserID, req.Msg.PlaylistId)
	if err != nil {
		return nil, userLibErr(s.d.Logger, "AddPlaylistToQueue", err)
	}
	_, err = s.svc.Do(ctx, id.UserID, func(m *session.Machine) ([]session.Effect, error) {
		var all []session.Effect
		for _, info := range songs {
			_, eff := m.Add(session.Song{Number: info.Number, Format: int(info.Format), DurationMs: info.DurationMs})
			all = append(all, eff...)
		}
		return all, nil
	})
	if err != nil {
		return nil, s.fail("AddPlaylistToQueue", err)
	}
	return connect.NewResponse(&kantahev1.AddPlaylistToQueueResponse{Added: int32(len(songs))}), nil
}
