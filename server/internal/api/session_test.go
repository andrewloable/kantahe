package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
)

func (e *testEnv) sessionClient() kantahev1connect.SessionServiceClient {
	return kantahev1connect.NewSessionServiceClient(e.srv.Client(), e.srv.URL)
}

// watcher reads a WatchState stream in the background.
type watcher struct {
	msgs   chan *kantahev1.State
	cancel context.CancelFunc
	done   chan struct{}
}

func (a *adminEnv) watch(t *testing.T, token string) *watcher {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	w := &watcher{msgs: make(chan *kantahev1.State, 100), cancel: cancel, done: make(chan struct{})}
	stream, err := a.sessionClient().WatchState(ctx, with(connect.NewRequest(&kantahev1.WatchStateRequest{}), token))
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		defer close(w.done)
		for stream.Receive() {
			w.msgs <- stream.Msg().State
		}
		_ = stream.Close()
	}()
	t.Cleanup(w.stop)
	return w
}

func (w *watcher) stop() {
	w.cancel()
	<-w.done
}

func (w *watcher) next(t *testing.T, within time.Duration) *kantahev1.State {
	t.Helper()
	select {
	case s := <-w.msgs:
		return s
	case <-time.After(within):
		t.Fatalf("no state within %v", within)
		return nil
	}
}

func (w *watcher) expectSilence(t *testing.T, d time.Duration) {
	t.Helper()
	select {
	case s := <-w.msgs:
		t.Fatalf("unexpected push: %+v", s)
	case <-time.After(d):
	}
}

// nextWhere reads messages until one satisfies ok.
func (w *watcher) nextWhere(t *testing.T, within time.Duration, ok func(*kantahev1.State) bool) *kantahev1.State {
	t.Helper()
	deadline := time.Now().Add(within)
	for {
		left := time.Until(deadline)
		if left <= 0 {
			t.Fatal("no matching state in time")
		}
		if s := w.next(t, left); ok(s) {
			return s
		}
	}
}

func (a *adminEnv) addToQueue(t *testing.T, token, number string) *kantahev1.QueueItem {
	t.Helper()
	res, err := a.sessionClient().AddToQueue(context.Background(), with(connect.NewRequest(&kantahev1.AddToQueueRequest{Number: number}), token))
	if err != nil {
		t.Fatalf("AddToQueue %s: %v", number, err)
	}
	return res.Msg.Item
}

func (a *adminEnv) control(t *testing.T, token string, action kantahev1.ControlAction) {
	t.Helper()
	if _, err := a.sessionClient().Control(context.Background(), with(connect.NewRequest(&kantahev1.ControlRequest{Action: action}), token)); err != nil {
		t.Fatalf("Control %v: %v", action, err)
	}
}

func (a *adminEnv) state(t *testing.T, token string) *kantahev1.State {
	t.Helper()
	res, err := a.sessionClient().GetState(context.Background(), with(connect.NewRequest(&kantahev1.GetStateRequest{}), token))
	if err != nil {
		t.Fatal(err)
	}
	return res.Msg.State
}

// secondDevice signs the admin in again from another device.
func (a *adminEnv) secondDevice(t *testing.T) *kantahev1.AuthToken {
	t.Helper()
	tok, err := a.login("admin@example.com", "password1", "Second")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestWatchStateInitialAndUpdates(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	w := a.watch(t, a.admin.Token)
	first := w.next(t, 2*time.Second)
	if first.Status != kantahev1.PlayStatus_PLAY_STATUS_PAUSED || len(first.Queue) != 0 || first.Settings.ScoreMode != kantahev1.ScoreMode_SCORE_MODE_RANDOM ||
		first.Settings.ScoreLevel != kantahev1.ScoreLevel_SCORE_LEVEL_LOW || len(first.Devices) != 1 || !first.Devices[0].Online || !first.Devices[0].IsCaller {
		t.Fatalf("initial state: %+v", first)
	}
	other := a.secondDevice(t)
	item := a.addToQueue(t, other.Token, n1)
	got := w.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return len(s.Queue) == 1 })
	if got.Queue[0].Id != item.Id || got.Queue[0].Song.Title != "One" || got.Queue[0].Song.Number != n1 {
		t.Fatalf("%+v", got.Queue)
	}
	// a device that signed in but has no stream is listed as offline
	var offline int
	for _, d := range got.Devices {
		if !d.Online {
			offline++
		}
	}
	if len(got.Devices) != 2 || offline != 1 {
		t.Fatalf("devices %+v", got.Devices)
	}
}

func TestNoPushOnPosition(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "One.kar", "One", "X", true)
	a.addToQueue(t, a.admin.Token, n)
	w := a.watch(t, a.admin.Token)
	w.next(t, 2*time.Second)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	w.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return s.Now != nil })
	a.ms.v.Add(1500)
	if _, err := a.sessionClient().ReportPosition(context.Background(), with(connect.NewRequest(&kantahev1.ReportPositionRequest{Number: n, PositionMs: 4242}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	w.expectSilence(t, 300*time.Millisecond)
	st := a.state(t, a.admin.Token)
	if st.Now.PositionMs != 4242 || st.Now.PositionAtMs != a.ms.v.Load() {
		t.Fatalf("GetState position %d at %d", st.Now.PositionMs, st.Now.PositionAtMs)
	}
	if st.ServerTimeMs != a.ms.v.Load() {
		t.Fatalf("server time %d", st.ServerTimeMs)
	}
}

func TestUserIsolation(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "One.kar", "One", "X", true)
	wa := a.watch(t, a.admin.Token)
	wa.next(t, 2*time.Second)
	itemA := a.addToQueue(t, a.admin.Token, n)
	wa.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return len(s.Queue) == 1 })
	itemB := a.addToQueue(t, a.user.Token, n)
	wa.expectSilence(t, 300*time.Millisecond)
	if st := a.state(t, a.user.Token); len(st.Queue) != 1 || st.Queue[0].Id != itemB.Id {
		t.Fatalf("B's queue: %+v", st.Queue)
	}
	// B cannot touch A's item (ids collide in form, q1, but queues are separate) ...
	for _, id := range []string{itemA.Id + "x", "q99"} {
		_, err := a.sessionClient().RemoveFromQueue(context.Background(), with(connect.NewRequest(&kantahev1.RemoveFromQueueRequest{ItemId: id}), a.user.Token))
		if code(err) != connect.CodeNotFound {
			t.Errorf("RemoveFromQueue(%s): %v", id, err)
		}
	}
	// ... and removing "its own" q1 removes B's item, never A's
	if _, err := a.sessionClient().RemoveFromQueue(context.Background(), with(connect.NewRequest(&kantahev1.RemoveFromQueueRequest{ItemId: itemA.Id}), a.user.Token)); err != nil {
		t.Fatal(err)
	}
	if st := a.state(t, a.admin.Token); len(st.Queue) != 1 || st.Queue[0].Id != itemA.Id {
		t.Fatalf("A's queue was touched: %+v", st.Queue)
	}
	if st := a.state(t, a.user.Token); len(st.Queue) != 0 {
		t.Fatalf("B's queue: %+v", st.Queue)
	}
}

func TestOnlineFlagsAndPlayerGone(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "One.kar", "One", "X", true)
	a.addToQueue(t, a.admin.Token, n)
	d2 := a.secondDevice(t)
	w1 := a.watch(t, a.admin.Token)
	w1.next(t, 2*time.Second)
	w2 := a.watch(t, d2.Token)
	st := w1.nextWhere(t, time.Second, func(s *kantahev1.State) bool {
		on := 0
		for _, d := range s.Devices {
			if d.Online {
				on++
			}
		}
		return on == 2
	})
	_ = st
	a.control(t, d2.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE) // d2 is the player
	w1.nextWhere(t, time.Second, func(s *kantahev1.State) bool {
		return s.PlayerDeviceId == d2.DeviceId && s.Status == kantahev1.PlayStatus_PLAY_STATUS_PLAYING
	})
	// d2's stream closes: d1 sees it offline
	w2.stop()
	off := w1.nextWhere(t, time.Second, func(s *kantahev1.State) bool {
		for _, d := range s.Devices {
			if d.Id == d2.DeviceId && !d.Online {
				return true
			}
		}
		return false
	})
	if off.Status != kantahev1.PlayStatus_PLAY_STATUS_PLAYING {
		t.Fatalf("still playing for 30 s: %v", off.Status)
	}
	// 30 s exactly is still fine, 30 001 ms pauses (the fake clock and an explicit tick)
	a.ms.v.Add(30_000)
	a.mounted.session.TickAll(context.Background())
	if st := a.state(t, a.admin.Token); st.Status != kantahev1.PlayStatus_PLAY_STATUS_PLAYING {
		t.Fatal("paused too early")
	}
	a.ms.v.Add(1)
	a.mounted.session.TickAll(context.Background())
	paused := w1.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return s.Status == kantahev1.PlayStatus_PLAY_STATUS_PAUSED })
	if paused.Now == nil || paused.PlayerDeviceId != d2.DeviceId {
		t.Fatalf("%+v", paused)
	}
}

func TestPlayHereStopsOldPlayer(t *testing.T) {
	a := newAdminEnv(t)
	a.seed(t, "One.kar", "One", "X", true)
	d2 := a.secondDevice(t)
	w1 := a.watch(t, a.admin.Token)
	w1.next(t, 2*time.Second)
	w2 := a.watch(t, d2.Token)
	w2.next(t, 2*time.Second)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY)
	w1.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return s.PlayerDeviceId == a.admin.DeviceId })
	a.control(t, d2.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	for name, w := range map[string]*watcher{"old player": w1, "new player": w2} {
		s := w.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return s.PlayerDeviceId == d2.DeviceId })
		if s.Status != kantahev1.PlayStatus_PLAY_STATUS_PLAYING {
			t.Errorf("%s: %v", name, s.Status)
		}
	}
}

func (a *adminEnv) historyRows(t *testing.T) [][4]any {
	t.Helper()
	rows, err := a.db.Query(`SELECT number, skipped, has_score, score FROM history ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out [][4]any
	for rows.Next() {
		var n string
		var sk, hs, sc int
		_ = rows.Scan(&n, &sk, &hs, &sc)
		out = append(out, [4]any{n, sk, hs, sc})
	}
	return out
}

func TestEndedWritesHistory(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	n2 := a.seed(t, "Two.kar", "Two", "X", true)
	n3 := a.seed(t, "Three.kar", "Three", "X", true)
	for _, n := range []string{n1, n2, n3} {
		a.addToQueue(t, a.admin.Token, n)
	}
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	c := a.sessionClient()
	if _, err := c.Ended(context.Background(), with(connect.NewRequest(&kantahev1.EndedRequest{Number: n1}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	st := a.state(t, a.admin.Token)
	if st.Score == nil || !st.Score.HasValue || st.Score.Value < 50 || st.Score.Value > 100 || st.Score.Comment == "" || st.Score.UntilMs != a.ms.v.Load()+6000 || st.Score.Number != n1 {
		t.Fatalf("score screen: %+v", st.Score)
	}
	a.ms.v.Add(6000)
	a.mounted.session.TickAll(context.Background())
	if st = a.state(t, a.admin.Token); st.Score != nil || st.Now.Song.Number != n2 {
		t.Fatalf("after the score: %+v", st)
	}
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_SKIP)
	rows := a.historyRows(t)
	if len(rows) != 2 || rows[0][0] != n1 || rows[0][1] != 0 || rows[0][2] != 1 || rows[1][0] != n2 || rows[1][1] != 1 || rows[1][2] != 0 {
		t.Fatalf("history %v: finished with a score, then skipped without one", rows)
	}
}

func TestPersistenceAcrossRestart(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	n2 := a.seed(t, "Two.kar", "Two", "X", true)
	n3 := a.seed(t, "Three.kar", "Three", "X", true)
	for _, n := range []string{n1, n2, n3} {
		a.addToQueue(t, a.admin.Token, n)
	}
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	a.ms.v.Add(42_000)
	if _, err := a.sessionClient().ReportPosition(context.Background(), with(connect.NewRequest(&kantahev1.ReportPositionRequest{Number: n1, PositionMs: 42_000}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	level := kantahev1.ScoreLevel_SCORE_LEVEL_HIGH
	if _, err := a.sessionClient().UpdateUserSettings(context.Background(), with(connect.NewRequest(&kantahev1.UpdateUserSettingsRequest{ScoreLevel: &level}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PAUSE)

	// a new server over the same database: nothing is kept in memory
	mux := http.NewServeMux()
	deps := a.deps
	deps.Session.Clock = &msClock{}
	deps.Session.Clock.(*msClock).v.Store(5)
	if _, err := Mount(mux.Handle, deps); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(mux)
	defer srv.Close()
	res, err := kantahev1connect.NewSessionServiceClient(srv.Client(), srv.URL).GetState(context.Background(), with(connect.NewRequest(&kantahev1.GetStateRequest{}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	st := res.Msg.State
	if st.Now == nil || st.Now.Song.Number != n1 || st.Now.PositionMs != 42_000 || st.Status != kantahev1.PlayStatus_PLAY_STATUS_PAUSED ||
		len(st.Queue) != 2 || st.Queue[0].Song.Number != n2 || st.Queue[1].Song.Number != n3 || st.PlayerDeviceId != a.admin.DeviceId ||
		st.Settings.ScoreLevel != kantahev1.ScoreLevel_SCORE_LEVEL_HIGH || st.UpNext == nil || st.UpNext.Song.Number != n2 {
		t.Fatalf("restored state: %+v", st)
	}
	// new queue ids do not collide with the stored ones
	add, err := kantahev1connect.NewSessionServiceClient(srv.Client(), srv.URL).AddToQueue(context.Background(), with(connect.NewRequest(&kantahev1.AddToQueueRequest{Number: n1}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range st.Queue {
		if q.Id == add.Msg.Item.Id {
			t.Fatalf("queue id %s was reused", q.Id)
		}
	}
}

func TestPreparesAhead(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	n2 := a.seed(t, "Two.kar", "Two", "X", true)
	n3 := a.seed(t, "Three.kar", "Three", "X", true)
	a.addToQueue(t, a.admin.Token, n1)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	if seen := a.prep.seen(); len(seen) < 2 || seen[0] != n1 {
		t.Fatalf("the current song and the random up-next pick are prepared when the song loads: %v", seen)
	}
	// whatever the random pre-pick was, the song the user adds ends up prepared
	a.addToQueue(t, a.admin.Token, n2)
	a.addToQueue(t, a.admin.Token, n3)
	seen := a.prep.seen()
	if !contains(seen, n2) {
		t.Fatalf("the up-next song %s was not prepared: %v", n2, seen)
	}
	// moving another song to the top prepares it as the new up-next song
	st := a.state(t, a.admin.Token)
	if st.UpNext == nil || st.UpNext.Song.Number != n2 || st.UpNext.Source != kantahev1.SongSource_SONG_SOURCE_QUEUE {
		t.Fatalf("up next %+v", st.UpNext)
	}
	before := len(a.prep.seen())
	if _, err := a.sessionClient().MoveToTop(context.Background(), with(connect.NewRequest(&kantahev1.MoveToTopRequest{ItemId: st.Queue[1].Id}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	after := a.prep.seen()
	if len(after) != before+1 || after[before] != n3 {
		t.Fatalf("MoveToTop must prepare the new up-next song %s: %v", n3, after[before:])
	}
}

func contains(l []string, s string) bool {
	for _, x := range l {
		if x == s {
			return true
		}
	}
	return false
}

func TestSessionErrorsMapping(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "One.kar", "One", "X", true)
	a.addToQueue(t, a.admin.Token, n)
	d2 := a.secondDevice(t)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	c := a.sessionClient()
	ctx := context.Background()
	_, err := c.ReportPosition(ctx, with(connect.NewRequest(&kantahev1.ReportPositionRequest{Number: n, PositionMs: 1}), d2.Token))
	if code(err) != connect.CodePermissionDenied {
		t.Errorf("report from a remote: %v", err)
	}
	_, err = c.ReportPosition(ctx, with(connect.NewRequest(&kantahev1.ReportPositionRequest{Number: "99999", PositionMs: 1}), a.admin.Token))
	if code(err) != connect.CodeFailedPrecondition {
		t.Errorf("stale number: %v", err)
	}
	_, err = c.Ended(ctx, with(connect.NewRequest(&kantahev1.EndedRequest{Number: "99999"}), a.admin.Token))
	if code(err) != connect.CodeFailedPrecondition {
		t.Errorf("stale Ended: %v", err)
	}
	_, err = c.Ready(ctx, with(connect.NewRequest(&kantahev1.ReadyRequest{Number: n}), d2.Token))
	if code(err) != connect.CodePermissionDenied {
		t.Errorf("Ready from a remote: %v", err)
	}
	if _, err = c.AddToQueue(ctx, with(connect.NewRequest(&kantahev1.AddToQueueRequest{Number: "77777"}), a.admin.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("unknown song: %v", err)
	}
	if _, err = c.AddToQueue(ctx, with(connect.NewRequest(&kantahev1.AddToQueueRequest{Number: "abc"}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Errorf("not a number: %v", err)
	}
	if _, err = c.RemoveFromQueue(ctx, with(connect.NewRequest(&kantahev1.RemoveFromQueueRequest{ItemId: "nope"}), a.admin.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("unknown item: %v", err)
	}
	if _, err = c.MoveToTop(ctx, with(connect.NewRequest(&kantahev1.MoveToTopRequest{ItemId: "nope"}), a.admin.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("unknown item: %v", err)
	}
	if _, err = c.Control(ctx, with(connect.NewRequest(&kantahev1.ControlRequest{Action: kantahev1.ControlAction_CONTROL_ACTION_UNSPECIFIED}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Errorf("unknown action: %v", err)
	}
	bad := kantahev1.ScoreMode(9)
	if _, err = c.UpdateUserSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateUserSettingsRequest{ScoreMode: &bad}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Errorf("unknown score mode: %v", err)
	}
	badLevel := kantahev1.ScoreLevel_SCORE_LEVEL_UNSPECIFIED
	if _, err = c.UpdateUserSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateUserSettingsRequest{ScoreLevel: &badLevel}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Errorf("unknown score level: %v", err)
	}
	if _, err = c.Ready(ctx, with(connect.NewRequest(&kantahev1.ReadyRequest{Number: "x"}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Errorf("bad number: %v", err)
	}
	if _, err = c.GetState(ctx, connect.NewRequest(&kantahev1.GetStateRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("no token: %v", err)
	}
}

func TestSettingsAndMic(t *testing.T) {
	a := newAdminEnv(t)
	c := a.sessionClient()
	ctx := context.Background()
	mode := kantahev1.ScoreMode_SCORE_MODE_MICROPHONE
	res, err := c.UpdateUserSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateUserSettingsRequest{ScoreMode: &mode}), a.admin.Token))
	if err != nil || res.Msg.Settings.ScoreMode != kantahev1.ScoreMode_SCORE_MODE_MICROPHONE || res.Msg.Settings.ScoreLevel != kantahev1.ScoreLevel_SCORE_LEVEL_LOW {
		t.Fatalf("only the present field changes: %v %v", res, err)
	}
	w := a.watch(t, a.admin.Token)
	w.next(t, 2*time.Second)
	if _, err := c.ReportMic(ctx, with(connect.NewRequest(&kantahev1.ReportMicRequest{Available: true}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	s := w.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return len(s.Devices) == 1 && s.Devices[0].MicAvailable })
	if !s.Devices[0].MicAvailable {
		t.Fatal("mic flag not pushed")
	}
	var mic int
	_ = a.db.QueryRow(`SELECT mic_available FROM devices WHERE id=?`, a.admin.DeviceId).Scan(&mic)
	if mic != 1 {
		t.Fatal("mic flag not stored")
	}
}

func TestStreamEndsWhenTheClientCancels(t *testing.T) {
	a := newAdminEnv(t)
	w := a.watch(t, a.admin.Token)
	w.next(t, 2*time.Second)
	w.stop() // returns only once the reader goroutine has ended
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		a.mounted.session.TickAll(context.Background())
		st := a.state(t, a.admin.Token)
		if !st.Devices[0].Online {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("the device is still online after its stream closed")
}

func TestRegression_RevokedDeviceStreamEnds(t *testing.T) {
	old := deviceRecheck
	deviceRecheck = 50 * time.Millisecond
	defer func() { deviceRecheck = old }()
	a := newAdminEnv(t)
	d2 := a.secondDevice(t)
	ctx := context.Background()
	stream, err := a.sessionClient().WatchState(ctx, with(connect.NewRequest(&kantahev1.WatchStateRequest{}), d2.Token))
	if err != nil {
		t.Fatal(err)
	}
	if !stream.Receive() {
		t.Fatalf("first message: %v", stream.Err())
	}
	// the first device signs the second one out
	if _, err := a.auth.RevokeDevice(ctx, with(connect.NewRequest(&kantahev1.RevokeDeviceRequest{DeviceId: d2.DeviceId}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	ended := make(chan error, 1)
	go func() {
		for stream.Receive() {
		}
		ended <- stream.Err()
	}()
	select {
	case err := <-ended:
		if code(err) != connect.CodeUnauthenticated {
			t.Fatalf("stream ended with %v, want unauthenticated", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("a revoked device keeps receiving its user's state")
	}
}

func (a *adminEnv) reportDevice(t *testing.T, token string, memory, dropouts int32) *kantahev1.Device {
	t.Helper()
	res, err := a.sessionClient().ReportDevice(context.Background(), with(connect.NewRequest(&kantahev1.ReportDeviceRequest{MemoryMb: memory, Dropouts: dropouts}), token))
	if err != nil {
		t.Fatal(err)
	}
	return res.Msg.Device
}

func (a *adminEnv) callerDevice(t *testing.T, token string) *kantahev1.Device {
	t.Helper()
	for _, d := range a.state(t, token).Devices {
		if d.IsCaller {
			return d
		}
	}
	t.Fatal("no caller device in the state")
	return nil
}

func TestReportDeviceDropouts(t *testing.T) {
	a := newAdminEnv(t)
	d := a.reportDevice(t, a.admin.Token, 4096, 0)
	if d.MemoryMb != 4096 || d.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_FULL || d.MidiMode != kantahev1.MidiMode_MIDI_MODE_AUTO || !d.IsCaller {
		t.Fatalf("%+v", d)
	}
	// without a renderer a step down from low power would be SERVER, which falls back to LOW_POWER
	d = a.reportDevice(t, a.admin.Token, 4096, 3)
	if d.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER {
		t.Fatalf("after dropouts: %v", d.EffectiveMidiMode)
	}
	d = a.reportDevice(t, a.admin.Token, 4096, 1)
	if d.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER {
		t.Fatalf("second episode, no renderer: %v", d.EffectiveMidiMode)
	}
	if got := a.callerDevice(t, a.admin.Token); got.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || got.MemoryMb != 4096 {
		t.Fatalf("GetState shows %+v", got)
	}
}

func TestReportDeviceStepsDownTwiceWithARenderer(t *testing.T) {
	a := newAdminEnv(t)
	a.deps.Render = renderOn{}
	mux := http.NewServeMux()
	if _, err := Mount(mux.Handle, a.deps); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(mux)
	defer srv.Close()
	c := kantahev1connect.NewSessionServiceClient(srv.Client(), srv.URL)
	report := func(dropouts int32) kantahev1.MidiMode {
		res, err := c.ReportDevice(context.Background(), with(connect.NewRequest(&kantahev1.ReportDeviceRequest{MemoryMb: 4096, Dropouts: dropouts}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Device.EffectiveMidiMode
	}
	want := []kantahev1.MidiMode{kantahev1.MidiMode_MIDI_MODE_FULL, kantahev1.MidiMode_MIDI_MODE_LOW_POWER, kantahev1.MidiMode_MIDI_MODE_SERVER, kantahev1.MidiMode_MIDI_MODE_SERVER}
	got := []kantahev1.MidiMode{report(0), report(2), report(1), report(1)}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("step %d: %v, want %v (got %v)", i, got[i], want[i], got)
		}
	}
}

type renderOn struct{}

func (renderOn) Available() bool { return true }

func TestReportDeviceValidation(t *testing.T) {
	a := newAdminEnv(t)
	c := a.sessionClient()
	for name, r := range map[string]*kantahev1.ReportDeviceRequest{
		"negative memory":   {MemoryMb: -1},
		"absurd memory":     {MemoryMb: 2_000_000},
		"negative dropouts": {Dropouts: -1},
	} {
		if _, err := c.ReportDevice(context.Background(), with(connect.NewRequest(r), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestSetMidiMode(t *testing.T) {
	a := newAdminEnv(t)
	d2 := a.secondDevice(t)
	c := a.sessionClient()
	ctx := context.Background()
	// the first device sets the mode of the second one (a phone configuring the TV)
	res, err := c.SetMidiMode(ctx, with(connect.NewRequest(&kantahev1.SetMidiModeRequest{DeviceId: d2.DeviceId, Mode: kantahev1.MidiMode_MIDI_MODE_LOW_POWER}), a.admin.Token))
	if err != nil || res.Msg.Device.MidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || res.Msg.Device.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || res.Msg.Device.IsCaller {
		t.Fatalf("%v %v", res, err)
	}
	// a pushed state reaches the open streams
	w := a.watch(t, a.admin.Token)
	w.next(t, 2*time.Second)
	if _, err := c.SetMidiMode(ctx, with(connect.NewRequest(&kantahev1.SetMidiModeRequest{DeviceId: d2.DeviceId, Mode: kantahev1.MidiMode_MIDI_MODE_FULL}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	w.nextWhere(t, time.Second, func(s *kantahev1.State) bool {
		for _, d := range s.Devices {
			if d.Id == d2.DeviceId && d.MidiMode == kantahev1.MidiMode_MIDI_MODE_FULL {
				return true
			}
		}
		return false
	})
	if _, err := c.SetMidiMode(ctx, with(connect.NewRequest(&kantahev1.SetMidiModeRequest{DeviceId: d2.DeviceId, Mode: kantahev1.MidiMode_MIDI_MODE_UNSPECIFIED}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("unspecified: %v", err)
	}
}

func TestSetMidiModeOtherUsersDevice(t *testing.T) {
	a := newAdminEnv(t)
	_, err := a.sessionClient().SetMidiMode(context.Background(), with(connect.NewRequest(&kantahev1.SetMidiModeRequest{DeviceId: a.user.DeviceId, Mode: kantahev1.MidiMode_MIDI_MODE_FULL}), a.admin.Token))
	if code(err) != connect.CodeNotFound {
		t.Fatalf("err = %v", err)
	}
	if _, err := a.sessionClient().SetMidiMode(context.Background(), with(connect.NewRequest(&kantahev1.SetMidiModeRequest{DeviceId: "nope", Mode: kantahev1.MidiMode_MIDI_MODE_FULL}), a.admin.Token)); code(err) != connect.CodeNotFound {
		t.Fatalf("unknown: %v", err)
	}
	var mode int
	_ = a.db.QueryRow(`SELECT midi_mode FROM devices WHERE id=?`, a.user.DeviceId).Scan(&mode)
	if mode != 1 {
		t.Fatalf("the other user's device was changed: %d", mode)
	}
}

func TestGetPlaybackLowPower(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Song.kar", "Song", "Artist", true)
	a.reportDevice(t, a.user.Token, 2048, 0)
	c := a.catalogClient()
	res, err := c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: n}), a.user.Token))
	if err != nil {
		t.Fatal(err)
	}
	pb := res.Msg.Playback
	if pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_MIDI_SYNTH || pb.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || pb.SoundfontUrl == "" {
		t.Fatalf("%+v", pb)
	}
	// a weak TV with no renderer also plays in low power (the synth with the small SoundFont)
	a.reportDevice(t, a.user.Token, 512, 0)
	res, _ = c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: n}), a.user.Token))
	if res.Msg.Playback.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || res.Msg.Playback.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_MIDI_SYNTH {
		t.Fatalf("%+v", res.Msg.Playback)
	}
	// a big device is FULL
	a.reportDevice(t, a.user.Token, 8192, 0)
	res, _ = c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: n}), a.user.Token))
	if res.Msg.Playback.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_FULL {
		t.Fatalf("%+v", res.Msg.Playback)
	}
	// an MP3 song ignores the modes
	m := a.seed(t, "Tune.karmp3", "Tune", "Band", false)
	res, _ = c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: m}), a.user.Token))
	if res.Msg.Playback.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO || res.Msg.Playback.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_UNSPECIFIED {
		t.Fatalf("%+v", res.Msg.Playback)
	}
}

func TestListMyDevicesShowsTheEffectiveMode(t *testing.T) {
	a := newAdminEnv(t)
	a.reportDevice(t, a.admin.Token, 2048, 0)
	res, err := a.auth.ListMyDevices(context.Background(), with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), a.admin.Token))
	if err != nil || res.Msg.Devices[0].EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || res.Msg.Devices[0].MemoryMb != 2048 {
		t.Fatalf("%v %v", res, err)
	}
}

func TestRegression_ListMyDevicesShowsWhichDevicesAreOnline(t *testing.T) {
	a := newAdminEnv(t)
	d2 := a.secondDevice(t)
	w := a.watch(t, d2.Token)
	w.next(t, 2*time.Second)
	res, err := a.auth.ListMyDevices(context.Background(), with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	online := map[string]bool{}
	for _, d := range res.Msg.Devices {
		online[d.Id] = d.Online
	}
	if online[d2.DeviceId] != true || online[a.admin.DeviceId] != false {
		t.Fatalf("online flags %v: only the device with an open stream is online", online)
	}
}

func TestWatchStateKeepAliveRepeatsTheSnapshotOnAnIdleStream(t *testing.T) {
	old := keepAlive
	keepAlive = 80 * time.Millisecond
	defer func() { keepAlive = old }()
	a := newAdminEnv(t)
	n := a.seed(t, "One.kar", "One", "X", true)
	a.addToQueue(t, a.admin.Token, n)
	w := a.watch(t, a.admin.Token)
	first := w.next(t, 2*time.Second)
	// nothing changes, yet a client gets a message every keepAlive: it can tell a quiet server from a dead link
	for i := 0; i < 2; i++ {
		again := w.next(t, 2*time.Second)
		if again.Status != first.Status || len(again.Queue) != 1 || again.Queue[0].Song.Number != n || again.ServerTimeMs < first.ServerTimeMs {
			t.Fatalf("repeat %d is not the same state: %+v", i, again)
		}
	}
}

func TestWatchStateKeepAliveWaitsWhileMessagesKeepComing(t *testing.T) {
	old := keepAlive
	keepAlive = 400 * time.Millisecond
	defer func() { keepAlive = old }()
	a := newAdminEnv(t)
	n := a.seed(t, "One.kar", "One", "X", true)
	w := a.watch(t, a.admin.Token)
	w.next(t, 2*time.Second)
	// a change every 150 ms for about a second: each one is sent, and no repeat is added between them
	changes := 0
	for end := time.Now().Add(1100 * time.Millisecond); time.Now().Before(end); changes++ {
		a.addToQueue(t, a.admin.Token, n)
		time.Sleep(150 * time.Millisecond)
	}
	time.Sleep(50 * time.Millisecond)
	got := 0
drain:
	for {
		select {
		case <-w.msgs:
			got++
		default:
			break drain
		}
	}
	if got != changes {
		t.Fatalf("%d messages for %d changes: the keep-alive fired while messages were coming", got, changes)
	}
}
