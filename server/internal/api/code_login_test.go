package api

import (
	"context"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/auth"
)

func (e *testEnv) startCode(t *testing.T, ip string) *kantahev1.StartCodeLoginResponse {
	t.Helper()
	res, err := e.startCodeErr(ip)
	if err != nil {
		t.Fatalf("StartCodeLogin: %v", err)
	}
	return res
}

func (e *testEnv) startCodeErr(ip string) (*kantahev1.StartCodeLoginResponse, error) {
	req := connect.NewRequest(&kantahev1.StartCodeLoginRequest{DeviceName: "Living room TV", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV})
	if ip != "" {
		req.Header().Set("X-Forwarded-For", ip)
	}
	res, err := e.auth.StartCodeLogin(context.Background(), req)
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (e *testEnv) approve(token, code string) (*kantahev1.ApproveCodeResponse, error) {
	res, err := e.auth.ApproveCode(context.Background(), with(connect.NewRequest(&kantahev1.ApproveCodeRequest{Code: code}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

// waitCode reads the single event of a WaitCodeLogin stream.
func (e *testEnv) waitCode(ctx context.Context, loginID string) (*kantahev1.WaitCodeLoginResponse, error) {
	stream, err := e.auth.WaitCodeLogin(ctx, connect.NewRequest(&kantahev1.WaitCodeLoginRequest{LoginId: loginID}))
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	if !stream.Receive() {
		if err := stream.Err(); err != nil {
			return nil, err
		}
		return nil, context.Canceled
	}
	msg := stream.Msg()
	if stream.Receive() {
		panic("a second event on the stream")
	}
	return msg, stream.Err()
}

func fastPoll(e *testEnv) { e.mounted.codes.Poll = 5 * time.Millisecond }

func TestCodeLoginApproveFlow(t *testing.T) {
	a := newAdminEnv(t)
	fastPoll(a.testEnv)
	start := a.startCode(t, "")
	if len(start.Code) != 6 || start.LoginId == "" || start.ExpiresAtUnix != a.clock.now().Add(5*time.Minute).Unix() {
		t.Fatalf("%+v", start)
	}
	if start.ApproveUrl != "" {
		t.Fatalf("no public url is configured: %q", start.ApproveUrl)
	}
	got := make(chan *kantahev1.WaitCodeLoginResponse, 1)
	go func() {
		r, err := a.waitCode(context.Background(), start.LoginId)
		if err != nil {
			t.Error(err)
		}
		got <- r
	}()
	time.Sleep(50 * time.Millisecond)
	res, err := a.approve(a.user.Token, strings.ToLower(start.Code))
	if err != nil || res.DeviceName != "Living room TV" {
		t.Fatalf("%+v %v", res, err)
	}
	r := <-got
	tok := r.GetApproved()
	if tok == nil || tok.Token == "" || tok.User.Email != "user@example.com" {
		t.Fatalf("%+v", r)
	}
	// the token works and the device is the TV, owned by the approver
	me, err := a.auth.Me(context.Background(), with(connect.NewRequest(&kantahev1.MeRequest{}), tok.Token))
	if err != nil || me.Msg.User.Email != "user@example.com" {
		t.Fatalf("Me: %v %v", me, err)
	}
	devs, _ := a.auth.ListMyDevices(context.Background(), with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), a.user.Token))
	found := false
	for _, d := range devs.Msg.Devices {
		if d.Id == tok.DeviceId && d.Name == "Living room TV" && d.Type == kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV {
			found = true
		}
	}
	if !found {
		t.Fatalf("the TV is not among the approver's devices: %v", devs.Msg.Devices)
	}
}

func TestCodeLoginApprovedBeforeStreamOpens(t *testing.T) {
	a := newAdminEnv(t)
	start := a.startCode(t, "")
	if _, err := a.approve(a.admin.Token, start.Code); err != nil {
		t.Fatal(err)
	}
	r, err := a.waitCode(context.Background(), start.LoginId)
	if err != nil || r.GetApproved() == nil || r.GetApproved().User.Email != "admin@example.com" {
		t.Fatalf("%+v %v", r, err)
	}
}

func TestCodeLoginExpiry(t *testing.T) {
	a := newAdminEnv(t)
	fastPoll(a.testEnv)
	start := a.startCode(t, "")
	a.clock.advance(5*time.Minute + time.Second)
	r, err := a.waitCode(context.Background(), start.LoginId)
	if err != nil || !r.GetExpired() {
		t.Fatalf("%+v %v", r, err)
	}
	other := a.startCode(t, "")
	a.clock.advance(5*time.Minute + time.Second)
	if _, err := a.approve(a.user.Token, other.Code); code(err) != connect.CodeNotFound {
		t.Fatalf("ApproveCode after expiry: %v", err)
	}
}

func TestCodeLoginExpiresWhileStreamIsOpen(t *testing.T) {
	a := newAdminEnv(t)
	fastPoll(a.testEnv)
	start := a.startCode(t, "")
	got := make(chan *kantahev1.WaitCodeLoginResponse, 1)
	go func() { r, _ := a.waitCode(context.Background(), start.LoginId); got <- r }()
	time.Sleep(50 * time.Millisecond)
	a.clock.advance(5*time.Minute + time.Second)
	select {
	case r := <-got:
		if r == nil || !r.GetExpired() {
			t.Fatalf("%+v", r)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("the stream did not report the expiry")
	}
}

func TestCodeLoginSingleUse(t *testing.T) {
	a := newAdminEnv(t)
	start := a.startCode(t, "")
	if _, err := a.approve(a.user.Token, start.Code); err != nil {
		t.Fatal(err)
	}
	if _, err := a.waitCode(context.Background(), start.LoginId); err != nil {
		t.Fatal(err)
	}
	if _, err := a.waitCode(context.Background(), start.LoginId); code(err) != connect.CodeNotFound {
		t.Fatalf("second WaitCodeLogin: %v", err)
	}
	if _, err := a.approve(a.user.Token, start.Code); code(err) != connect.CodeNotFound {
		t.Fatalf("second ApproveCode: %v", err)
	}
}

func TestCodeLoginUnknownLoginID(t *testing.T) {
	a := newAdminEnv(t)
	if _, err := a.waitCode(context.Background(), "nope"); code(err) != connect.CodeNotFound {
		t.Fatalf("%v", err)
	}
}

func TestCodeLoginPerIPLimit(t *testing.T) {
	a := newAdminEnv(t)
	for i := 0; i < 10; i++ {
		a.startCode(t, "203.0.113.5")
	}
	if _, err := a.startCodeErr("203.0.113.5"); code(err) != connect.CodeResourceExhausted {
		t.Fatalf("11th: %v", err)
	}
	if _, err := a.startCodeErr("203.0.113.6"); err != nil {
		t.Fatalf("another IP: %v", err)
	}
}

func TestCodeLoginStartValidatesDevice(t *testing.T) {
	a := newAdminEnv(t)
	for _, req := range []*kantahev1.StartCodeLoginRequest{
		{DeviceName: "", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV},
		{DeviceName: strings.Repeat("x", 101), DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV},
		{DeviceName: "TV", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_UNSPECIFIED},
		{DeviceName: "TV", DeviceType: 99},
	} {
		if _, err := a.auth.StartCodeLogin(context.Background(), connect.NewRequest(req)); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%+v: %v", req, err)
		}
	}
}

func TestCodeLoginApproveRequiresAuth(t *testing.T) {
	a := newAdminEnv(t)
	start := a.startCode(t, "")
	if _, err := a.approve("", start.Code); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("no token: %v", err)
	}
	if _, err := a.approve("bogus", start.Code); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("bad token: %v", err)
	}
	// still approvable by a signed-in user
	if _, err := a.approve(a.user.Token, start.Code); err != nil {
		t.Fatal(err)
	}
}

func TestCodeLoginApproveBlockedWhileMustChangePassword(t *testing.T) {
	a := newAdminEnv(t)
	a.createUser(t, "temp@example.com", "temporary1", false, false)
	tmp, err := a.login("temp@example.com", "temporary1", "Phone")
	if err != nil {
		t.Fatal(err)
	}
	start := a.startCode(t, "")
	if _, err := a.approve(tmp.Token, start.Code); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("%v", err)
	}
}

func TestCodeLoginGuessingIsSlowedDown(t *testing.T) {
	a := newAdminEnv(t)
	start := a.startCode(t, "")
	for i := 0; i < 5; i++ {
		if _, err := a.approve(a.user.Token, "AAAAAA"); code(err) != connect.CodeNotFound {
			t.Fatalf("guess %d: %v", i, err)
		}
	}
	if _, err := a.approve(a.user.Token, start.Code); code(err) != connect.CodeResourceExhausted {
		t.Fatalf("after 5 wrong codes even the right one waits: %v", err)
	}
	a.clock.advance(2 * time.Second)
	if _, err := a.approve(a.user.Token, start.Code); err != nil {
		t.Fatalf("after the back-off: %v", err)
	}
	// someone else is not affected
	other := a.startCode(t, "")
	if _, err := a.approve(a.admin.Token, other.Code); err != nil {
		t.Fatalf("another user: %v", err)
	}
}

func TestCodeLoginWaitCancelReleasesTheStream(t *testing.T) {
	a := newAdminEnv(t)
	fastPoll(a.testEnv)
	start := a.startCode(t, "")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { _, _ = a.waitCode(ctx, start.LoginId); close(done) }()
	time.Sleep(100 * time.Millisecond)
	// while the first stream is open a second one is refused
	if _, err := a.waitCode(context.Background(), start.LoginId); code(err) != connect.CodeAborted {
		t.Fatalf("second concurrent stream: %v", err)
	}
	cancel()
	<-done
	// the server side ends too: a new stream is accepted again and gets the approval
	deadline := time.Now().Add(3 * time.Second)
	for {
		ctx2, cancel2 := context.WithTimeout(context.Background(), 200*time.Millisecond)
		got := make(chan error, 1)
		go func() { _, err := a.waitCode(ctx2, start.LoginId); got <- err }()
		time.Sleep(50 * time.Millisecond)
		if _, err := a.approve(a.user.Token, start.Code); err == nil {
			err := <-got
			cancel2()
			if err != nil {
				t.Fatalf("reconnected stream: %v", err)
			}
			return
		}
		cancel2()
		<-got
		if time.Now().After(deadline) {
			t.Fatal("the server kept the cancelled stream")
		}
		start = a.startCode(t, "")
	}
}

func TestCodeLoginDisabledApproverGetsNoToken(t *testing.T) {
	a := newAdminEnv(t)
	start := a.startCode(t, "")
	if _, err := a.approve(a.user.Token, start.Code); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.Exec(`UPDATE users SET disabled = 1 WHERE email = 'user@example.com'`); err != nil {
		t.Fatal(err)
	}
	_, err := a.waitCode(context.Background(), start.LoginId)
	if code(err) != connect.CodePermissionDenied {
		t.Fatalf("%v", err)
	}
	var n int
	_ = a.db.QueryRow(`SELECT COUNT(*) FROM devices WHERE name = 'Living room TV'`).Scan(&n)
	if n != 0 {
		t.Fatalf("%d devices were created for a disabled user", n)
	}
}

func TestCodeLoginApproveURL(t *testing.T) {
	e := newEnv(t)
	d := e.deps
	d.PublicURL = "https://k.example"
	srv := newAuthServer(d, e.backoff, newHasher(auth.CheapCost))
	req := connect.NewRequest(&kantahev1.StartCodeLoginRequest{DeviceName: "TV", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV})
	res, err := srv.StartCodeLogin(context.Background(), req)
	if err != nil || res.Msg.ApproveUrl != "https://k.example/code" {
		t.Fatalf("%v %v", res, err)
	}
}

func TestCodeLoginTokenNotDeliveredRevokesTheDevice(t *testing.T) {
	a := newAdminEnv(t)
	srv := newAuthServer(a.deps, a.backoff, newHasher(auth.CheapCost))
	var issued *kantahev1.AuthToken
	err := srv.issueDevice(context.Background(), auth.Approval{UserID: "u-user@example.com", DeviceName: "Lost TV", DeviceType: int32(kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV)},
		func(tok *kantahev1.AuthToken) error { issued = tok; return context.Canceled })
	if err != context.Canceled || issued == nil {
		t.Fatalf("%v %v", err, issued)
	}
	if _, err := a.auth.Me(context.Background(), with(connect.NewRequest(&kantahev1.MeRequest{}), issued.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("the undelivered token still works: %v", err)
	}
	// delivered: it keeps working
	err = srv.issueDevice(context.Background(), auth.Approval{UserID: "u-user@example.com", DeviceName: "TV", DeviceType: int32(kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV)},
		func(tok *kantahev1.AuthToken) error { issued = tok; return nil })
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.auth.Me(context.Background(), with(connect.NewRequest(&kantahev1.MeRequest{}), issued.Token)); err != nil {
		t.Fatalf("delivered token: %v", err)
	}
	// the approver no longer exists
	if err := srv.issueDevice(context.Background(), auth.Approval{UserID: "ghost", DeviceName: "TV", DeviceType: 1}, func(*kantahev1.AuthToken) error { return nil }); code(err) != connect.CodePermissionDenied {
		t.Fatalf("%v", err)
	}
}

// Regression: a successful approval used to clear the guess counter, so a signed-in attacker
// could start a code of their own, approve it after every few wrong guesses and never be slowed down.
func TestRegression_CodeGuessCounterSurvivesOwnApprovals(t *testing.T) {
	a := newAdminEnv(t)
	for i := 0; i < 4; i++ {
		if _, err := a.approve(a.user.Token, "AAAAAA"); code(err) != connect.CodeNotFound {
			t.Fatalf("guess %d: %v", i, err)
		}
	}
	own := a.startCode(t, "")
	if _, err := a.approve(a.user.Token, own.Code); err != nil {
		t.Fatalf("own code: %v", err)
	}
	// the 5th wrong guess must now trigger the back-off
	if _, err := a.approve(a.user.Token, "AAAAAA"); code(err) != connect.CodeNotFound {
		t.Fatalf("5th guess: %v", err)
	}
	if _, err := a.approve(a.user.Token, "AAAAAA"); code(err) != connect.CodeResourceExhausted {
		t.Fatalf("the approval in between reset the counter: %v", err)
	}
}

// The forwarded-for header only counts when the direct peer is a trusted proxy, otherwise
// anyone could dodge the per-IP limit by inventing addresses.
func TestCodeLoginIgnoresForwardedForFromUntrustedPeer(t *testing.T) {
	e := newEnv(t)
	d := e.deps
	d.TrustedProxies = nil
	srv := newAuthServer(d, e.backoff, newHasher(auth.CheapCost))
	start := func(xff string) error {
		req := connect.NewRequest(&kantahev1.StartCodeLoginRequest{DeviceName: "TV", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV})
		req.Header().Set("X-Forwarded-For", xff)
		_, err := srv.StartCodeLogin(context.Background(), req)
		return err
	}
	for i := 0; i < 10; i++ {
		if err := start("203.0.113." + string(rune('1'+i))); err != nil {
			t.Fatal(err)
		}
	}
	if err := start("198.51.100.99"); code(err) != connect.CodeResourceExhausted {
		t.Fatalf("a made-up forwarded address must not give a fresh allowance: %v", err)
	}
}
