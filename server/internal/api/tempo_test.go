package api

import (
	"context"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

// The tempo of the current song (kantahe-vaz): SetTempo from any device, shown in NowPlaying, back to 100 with the next song.

func (a *adminEnv) setTempo(token string, p int32) error {
	_, err := a.sessionClient().SetTempo(context.Background(), with(connect.NewRequest(&kantahev1.SetTempoRequest{Pct: p}), token))
	return err
}

func TestSetTempoFromAnyDevice(t *testing.T) {
	a := newAdminEnv(t)
	one := a.seed(t, "One.kar", "One", "X", true)
	two := a.seed(t, "Two.kar", "Two", "X", true)
	if err := a.setTempo(a.admin.Token, 100); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("no song: %v", err)
	}
	a.addToQueue(t, a.admin.Token, one)
	a.addToQueue(t, a.admin.Token, two)
	tv := a.secondDevice(t)
	a.control(t, tv.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	if st := a.state(t, a.admin.Token); st.Now.TempoPct != 100 {
		t.Fatalf("default: %d", st.Now.TempoPct)
	}
	w := a.watch(t, a.admin.Token)
	w.next(t, 2*time.Second)
	// the phone sets the tempo of what the TV plays; it is pushed to the open streams
	if err := a.setTempo(a.admin.Token, 85); err != nil {
		t.Fatal(err)
	}
	w.nextWhere(t, time.Second, func(s *kantahev1.State) bool { return s.Now != nil && s.Now.TempoPct == 85 })
	for _, bad := range []int32{70, 130, 77, 0, -5} {
		if err := a.setTempo(a.admin.Token, bad); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%d: %v", bad, err)
		}
	}
	if st := a.state(t, a.admin.Token); st.Now.TempoPct != 85 {
		t.Fatalf("a refused value changed it: %d", st.Now.TempoPct)
	}
	if err := a.setTempo("", 90); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("no token: %v", err)
	}
	// the other user's song is not touched
	if err := a.setTempo(a.user.Token, 90); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("another user has no song: %v", err)
	}
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_SKIP)
	if st := a.state(t, a.admin.Token); st.Now.Song.Number != two || st.Now.TempoPct != 100 {
		t.Fatalf("the next song: %+v", st.Now)
	}
}
