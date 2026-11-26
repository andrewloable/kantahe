package api

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

// The title card (kantahe-2d3): the intro_seconds setting, and the start time of a new song in NowPlaying.

func (a *adminEnv) setIntroSeconds(t *testing.T, token string, n int32) error {
	t.Helper()
	_, err := a.adminClient.UpdateServerSettings(context.Background(), with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{IntroSeconds: &n}), token))
	return err
}

func TestServerSettingsIntroSeconds(t *testing.T) {
	a := newAdminEnv(t)
	get := func() *kantahev1.ServerSettings {
		res, err := a.adminClient.GetServerSettings(context.Background(), with(connect.NewRequest(&kantahev1.GetServerSettingsRequest{}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Settings
	}
	if s := get(); s.IntroSeconds != 3 {
		t.Fatalf("3 by default: %+v", s)
	}
	if err := a.setIntroSeconds(t, a.admin.Token, 5); err != nil {
		t.Fatal(err)
	}
	if s := get(); s.IntroSeconds != 5 {
		t.Fatalf("after the update: %+v", s)
	}
	for _, bad := range []int32{-1, 11} {
		if err := a.setIntroSeconds(t, a.admin.Token, bad); connect.CodeOf(err) != connect.CodeInvalidArgument {
			t.Errorf("%d: %v", bad, err)
		}
	}
	if err := a.setIntroSeconds(t, a.user.Token, 0); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("a user: %v", err)
	}
	if s := get(); s.IntroSeconds != 5 {
		t.Fatalf("a refused update changed it: %+v", s)
	}
}

func TestNewSongCarriesItsStartTime(t *testing.T) {
	a := newAdminEnv(t)
	one := a.seed(t, "One.kar", "One", "X", true)
	two := a.seed(t, "Two.kar", "Two", "X", true)
	a.addToQueue(t, a.admin.Token, one)
	a.addToQueue(t, a.admin.Token, two)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	st := a.state(t, a.admin.Token)
	if st.Now == nil || st.Now.StartsAtMs == 0 {
		t.Fatalf("the first song after Play has a start time: %+v", st.Now)
	}
	if ahead := st.Now.StartsAtMs - st.ServerTimeMs; ahead < 2500 || ahead > 3000 {
		t.Fatalf("starts %d ms after the server time, want about 3000", ahead)
	}
	if st.Now.PositionAtMs != st.Now.StartsAtMs || st.Now.PositionMs != 0 {
		t.Fatalf("the clock stands at 0 from the start time: %+v", st.Now)
	}
	// switched off: the next song starts at once
	if err := a.setIntroSeconds(t, a.admin.Token, 0); err != nil {
		t.Fatal(err)
	}
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_SKIP)
	if st := a.state(t, a.admin.Token); st.Now.Song.Number != two || st.Now.StartsAtMs != 0 {
		t.Fatalf("with 0 seconds: %+v", st.Now)
	}
}
