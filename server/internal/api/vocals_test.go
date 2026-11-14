package api

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

// The guide vocals as server state per device (kantahe-der): SetVocals from any of the user's devices, the live state reported by the player,
// and "guide cancelled" for the current song.

func yesNo(b bool) *bool { return &b }

func (a *adminEnv) setVocals(token, deviceID string, on *bool, pct *int32) (*kantahev1.SetVocalsResponse, error) {
	res, err := a.sessionClient().SetVocals(context.Background(), with(connect.NewRequest(&kantahev1.SetVocalsRequest{DeviceId: deviceID, On: on, Pct: pct}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) deviceInState(t *testing.T, token, id string) *kantahev1.Device {
	t.Helper()
	for _, d := range a.state(t, token).Devices {
		if d.Id == id {
			return d
		}
	}
	t.Fatalf("device %s not in the state", id)
	return nil
}

func TestSetVocalsOwnDeviceOnly(t *testing.T) {
	a := newAdminEnv(t)
	d2 := a.secondDevice(t)
	res, err := a.setVocals(a.admin.Token, d2.DeviceId, yesNo(true), pct(80))
	if err != nil || !res.Device.GetVocalsOn() || res.Device.GetVocalsPct() != 80 || res.Device.IsCaller {
		t.Fatalf("%v %v", res, err)
	}
	if d := a.deviceInState(t, a.admin.Token, d2.DeviceId); !d.GetVocalsOn() || d.GetVocalsPct() != 80 {
		t.Fatalf("in the state: %+v", d)
	}
	// only the field given changes
	if res, err = a.setVocals(a.admin.Token, d2.DeviceId, nil, pct(30)); err != nil || !res.Device.GetVocalsOn() || res.Device.GetVocalsPct() != 30 {
		t.Fatalf("pct only: %v %v", res, err)
	}
	if res, err = a.setVocals(a.admin.Token, d2.DeviceId, yesNo(false), nil); err != nil || res.Device.GetVocalsOn() || res.Device.GetVocalsPct() != 30 {
		t.Fatalf("on only: %v %v", res, err)
	}
	for name, c := range map[string]struct {
		on  *bool
		pct *int32
	}{"101": {nil, pct(101)}, "minus one": {nil, pct(-1)}, "no field": {nil, nil}} {
		if _, err := a.setVocals(a.admin.Token, d2.DeviceId, c.on, c.pct); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%s: %v", name, err)
		}
	}
	for _, p := range []int32{0, 100} {
		if _, err := a.setVocals(a.admin.Token, d2.DeviceId, nil, pct(p)); err != nil {
			t.Errorf("%d: %v", p, err)
		}
	}
	// another user's device, an unknown device, no token
	if _, err := a.setVocals(a.admin.Token, a.user.DeviceId, yesNo(true), nil); code(err) != connect.CodeNotFound {
		t.Fatalf("other user: %v", err)
	}
	if _, err := a.setVocals(a.admin.Token, "nope", yesNo(true), nil); code(err) != connect.CodeNotFound {
		t.Fatalf("unknown: %v", err)
	}
	if _, err := a.setVocals("", d2.DeviceId, yesNo(true), nil); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("no token: %v", err)
	}
	var on, p int
	_ = a.db.QueryRow(`SELECT vocals_on, vocals_pct FROM devices WHERE id=?`, a.user.DeviceId).Scan(&on, &p)
	if on != 0 || p != 60 {
		t.Fatalf("the other user's device was changed: %d, %d", on, p)
	}
}

func TestVocalsDefaults(t *testing.T) {
	a := newAdminEnv(t)
	d := a.deviceInState(t, a.admin.Token, a.admin.DeviceId)
	if d.VocalsOn == nil || d.VocalsPct == nil || *d.VocalsOn || *d.VocalsPct != 60 || d.VocalsState != kantahev1.VocalsState_VOCALS_STATE_UNSPECIFIED {
		t.Fatalf("%+v", d)
	}
}

func (a *adminEnv) reportVocals(token string, s kantahev1.VocalsState) error {
	_, err := a.sessionClient().ReportDevice(context.Background(), with(connect.NewRequest(&kantahev1.ReportDeviceRequest{VocalsState: s}), token))
	return err
}

func TestVocalsStateReportedByThePlayerOnly(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "One.kar", "One", "X", true)
	a.addToQueue(t, a.admin.Token, n)
	d2 := a.secondDevice(t)
	a.control(t, d2.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)

	if err := a.reportVocals(d2.Token, kantahev1.VocalsState_VOCALS_STATE_ON); err != nil {
		t.Fatal(err)
	}
	if d := a.deviceInState(t, a.admin.Token, d2.DeviceId); d.VocalsState != kantahev1.VocalsState_VOCALS_STATE_ON {
		t.Fatalf("the player's report: %+v", d)
	}
	// a device that is not the player cannot claim anything: its report is ignored, not an error (a report races with Play here)
	if err := a.reportVocals(a.admin.Token, kantahev1.VocalsState_VOCALS_STATE_ON); err != nil {
		t.Fatal(err)
	}
	if d := a.deviceInState(t, a.admin.Token, a.admin.DeviceId); d.VocalsState != kantahev1.VocalsState_VOCALS_STATE_UNSPECIFIED {
		t.Fatalf("a remote's report was taken: %+v", d)
	}
	// when another device becomes the player, the old state is not shown any more
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	if d := a.deviceInState(t, a.admin.Token, d2.DeviceId); d.VocalsState != kantahev1.VocalsState_VOCALS_STATE_UNSPECIFIED {
		t.Fatalf("stale state of a device that no longer plays: %+v", d)
	}
}

func TestRemoteOffCancelsTheGuideForThisSong(t *testing.T) {
	a := newAdminEnv(t)
	a.setAmateurMode(t, true)
	one := a.seedVocalsLines(t, "Four.karmp3", "Four", "[00:01.00]One\n[00:03.00]Two\n[00:05.00]Three\n[00:07.00]Four")
	two := a.seedVocalsLines(t, "Five.karmp3", "Five", "[00:01.00]One\n[00:03.00]Two\n[00:05.00]Three\n[00:07.00]Four")
	a.addToQueue(t, a.admin.Token, one)
	a.addToQueue(t, a.admin.Token, two)
	tv := a.secondDevice(t)
	a.control(t, tv.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	if st := a.state(t, a.admin.Token); st.Now == nil || st.Now.GuideCancelled || st.Now.Song.Number != one {
		t.Fatalf("start: %+v", st.Now)
	}
	// the phone switches the vocals of the TV off: the guide stops for this song
	if _, err := a.setVocals(a.admin.Token, tv.DeviceId, yesNo(false), nil); err != nil {
		t.Fatal(err)
	}
	if st := a.state(t, a.admin.Token); !st.Now.GuideCancelled {
		t.Fatalf("not cancelled: %+v", st.Now)
	}
	// a volume change of the vocals alone does not matter, and the next song starts with the guide again
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_SKIP)
	if st := a.state(t, a.admin.Token); st.Now.Song.Number != two || st.Now.GuideCancelled {
		t.Fatalf("after Skip: %+v", st.Now)
	}
}

func TestGuideCancelledOnlyForTheDeviceThatPlays(t *testing.T) {
	a := newAdminEnv(t)
	one := a.seedVocalsLines(t, "Four.karmp3", "Four", "[00:01.00]One\n[00:03.00]Two\n[00:05.00]Three\n[00:07.00]Four")
	a.addToQueue(t, a.admin.Token, one)
	tv, other := a.secondDevice(t), a.admin
	a.control(t, tv.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	// switching off a device that does not play leaves the guide alone; so does a volume-only or an "on" change of the player
	if _, err := a.setVocals(other.Token, other.DeviceId, yesNo(false), nil); err != nil {
		t.Fatal(err)
	}
	if _, err := a.setVocals(other.Token, tv.DeviceId, yesNo(true), pct(10)); err != nil {
		t.Fatal(err)
	}
	if st := a.state(t, other.Token); st.Now.GuideCancelled {
		t.Fatalf("cancelled by something that is not an Off of the player: %+v", st.Now)
	}
}

func TestGuideCancelledSurvivesARestart(t *testing.T) {
	a := newAdminEnv(t)
	one := a.seedVocalsLines(t, "Four.karmp3", "Four", "[00:01.00]One\n[00:03.00]Two\n[00:05.00]Three\n[00:07.00]Four")
	a.addToQueue(t, a.admin.Token, one)
	tv := a.secondDevice(t)
	a.control(t, tv.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	if _, err := a.setVocals(a.admin.Token, tv.DeviceId, yesNo(false), nil); err != nil {
		t.Fatal(err)
	}
	var c int
	if err := a.db.QueryRow(`SELECT guide_cancelled FROM user_state`).Scan(&c); err != nil || c != 1 {
		t.Fatalf("stored %d, %v", c, err)
	}
}
