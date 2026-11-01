package api

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

type fakeClock struct{ t atomic.Int64 }

func (c *fakeClock) now() time.Time          { return time.Unix(c.t.Load(), 0) }
func (c *fakeClock) advance(d time.Duration) { c.t.Add(int64(d / time.Second)) }

type testEnv struct {
	backoff      *auth.Backoff
	db           *store.DB
	clock        *fakeClock
	srv          *httptest.Server
	auth         kantahev1connect.AuthServiceClient
	adminClient  kantahev1connect.AdminServiceClient
	uploadClient kantahev1connect.UploadServiceClient
	dataDir      string
	importer     *library.Importer
	logger       *slog.Logger
	libDir       string
	ms           *msClock
	prep         *recordingPreparer
	mounted      *Mounted
	deps         Deps
}

func newEnv(t *testing.T) *testEnv {
	t.Helper()
	dataDir := t.TempDir()
	db, err := store.Open(context.Background(), dataDir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	libDir, _ := fsutil.Canonical(t.TempDir())
	importer := library.NewImporter(db, dataDir, []string{libDir}, logger)
	clock := &fakeClock{}
	ms := &msClock{}
	ms.v.Store(1000)
	prep := &recordingPreparer{}
	clock.t.Store(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC).Unix())
	deps := Deps{
		DB: db, Version: "test-1.0", Name: "Test box", Now: clock.now,
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		TrustedProxies: []netip.Prefix{netip.MustParsePrefix("127.0.0.0/8")},
		HashCost:       auth.CheapCost,
		Session:        SessionOverrides{Clock: ms, Wall: clock.now, Preparer: prep},
		DataDir:        dataDir,
		SoundFont:      soundFontPath(t),
		ScoreSeconds:   6,
		Importer:       importer,
	}
	mux := http.NewServeMux()
	mounted, err := mount(mux.Handle, deps)
	if err != nil {
		t.Fatal(err)
	}
	bgCtx, stopBg := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { mounted.Run(bgCtx); close(done) }()
	t.Cleanup(func() { stopBg(); <-done; _ = mounted.Close() })
	backoff := mounted.backoff
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &testEnv{backoff, db, clock, srv, kantahev1connect.NewAuthServiceClient(srv.Client(), srv.URL), kantahev1connect.NewAdminServiceClient(srv.Client(), srv.URL), kantahev1connect.NewUploadServiceClient(srv.Client(), srv.URL), dataDir, importer, logger, libDir, ms, prep, mounted, deps}
}

func with[T any](r *connect.Request[T], token string) *connect.Request[T] {
	if token != "" {
		r.Header().Set("Authorization", "Bearer "+token)
	}
	return r
}

func code(err error) connect.Code { return connect.CodeOf(err) }

func (e *testEnv) setup(t *testing.T, email, pw string) *kantahev1.AuthToken {
	t.Helper()
	res, err := e.auth.Setup(context.Background(), connect.NewRequest(&kantahev1.SetupRequest{
		Email: email, Password: pw, DisplayName: "Admin", DeviceName: "Laptop", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB,
	}))
	if err != nil {
		t.Fatalf("setup: %v", err)
	}
	return res.Msg.Auth
}

func (e *testEnv) login(email, pw, device string) (*kantahev1.AuthToken, error) {
	res, err := e.auth.Login(context.Background(), connect.NewRequest(&kantahev1.LoginRequest{
		Email: email, Password: pw, DeviceName: device, DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID,
	}))
	if err != nil {
		return nil, err
	}
	return res.Msg.Auth, nil
}

func (e *testEnv) addUser(t *testing.T, email, pw string, mut ...string) {
	t.Helper()
	h, _ := auth.HashWithCost(pw, auth.CheapCost)
	if _, err := e.db.Exec(`INSERT INTO users(id,email,display_name,password_hash,created_at) VALUES (?,?,?,?,1)`, "u-"+email, email, "User", h); err != nil {
		t.Fatal(err)
	}
	for _, q := range mut {
		if _, err := e.db.Exec(q, "u-"+email); err != nil {
			t.Fatal(err)
		}
	}
}

func TestGetServerInfoName(t *testing.T) {
	e := newEnv(t)
	info, err := e.auth.GetServerInfo(context.Background(), connect.NewRequest(&kantahev1.GetServerInfoRequest{}))
	if err != nil || info.Msg.Name != "Test box" {
		t.Fatalf("name = %q, %v", info.Msg.GetName(), err)
	}
}

func TestSetupOnce(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	info, err := e.auth.GetServerInfo(ctx, connect.NewRequest(&kantahev1.GetServerInfoRequest{}))
	if err != nil || !info.Msg.SetupRequired || info.Msg.Version != "test-1.0" {
		t.Fatalf("before: %v %v", info, err)
	}
	tok := e.setup(t, "Admin@Example.com", "password1")
	if tok.Token == "" || tok.DeviceId == "" || tok.User.Id == "" || !tok.User.Admin || !tok.User.Uploader || tok.User.Email != "admin@example.com" || tok.User.MustChangePassword {
		t.Fatalf("bad token reply: %+v", tok)
	}
	_, err = e.auth.Setup(ctx, connect.NewRequest(&kantahev1.SetupRequest{Email: "b@example.com", Password: "password2", DisplayName: "B", DeviceName: "x", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB}))
	if code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("second Setup: %v", err)
	}
	info, _ = e.auth.GetServerInfo(ctx, connect.NewRequest(&kantahev1.GetServerInfoRequest{}))
	if info.Msg.SetupRequired {
		t.Fatal("setup_required should be false after Setup")
	}
	me, err := e.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), tok.Token))
	if err != nil || me.Msg.User.Id != tok.User.Id {
		t.Fatalf("token from Setup must work: %v %v", me, err)
	}
}

func TestSetupConcurrent(t *testing.T) {
	e := newEnv(t)
	var wg sync.WaitGroup
	var ok, refused atomic.Int32
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := e.auth.Setup(context.Background(), connect.NewRequest(&kantahev1.SetupRequest{
				Email: "a" + string(rune('a'+i)) + "@example.com", Password: "password1", DisplayName: "A", DeviceName: "x", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB,
			}))
			switch {
			case err == nil:
				ok.Add(1)
			case code(err) == connect.CodeFailedPrecondition:
				refused.Add(1)
			default:
				t.Errorf("unexpected: %v", err)
			}
		}()
	}
	wg.Wait()
	if ok.Load() != 1 || refused.Load() != 9 {
		t.Fatalf("ok=%d refused=%d, want 1 and 9", ok.Load(), refused.Load())
	}
	var n int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	if n != 1 {
		t.Fatalf("users = %d", n)
	}
}

func TestSetupValidation(t *testing.T) {
	e := newEnv(t)
	good := func() *kantahev1.SetupRequest {
		return &kantahev1.SetupRequest{Email: "a@example.com", Password: "password1", DisplayName: "A", DeviceName: "x", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB}
	}
	cases := map[string]func(*kantahev1.SetupRequest){
		"short password":    func(r *kantahev1.SetupRequest) { r.Password = "short" },
		"empty name":        func(r *kantahev1.SetupRequest) { r.DisplayName = "  " },
		"long name":         func(r *kantahev1.SetupRequest) { r.DisplayName = strings.Repeat("a", 101) },
		"no device name":    func(r *kantahev1.SetupRequest) { r.DeviceName = "" },
		"no device type":    func(r *kantahev1.SetupRequest) { r.DeviceType = kantahev1.DeviceType_DEVICE_TYPE_UNSPECIFIED },
		"empty email":       func(r *kantahev1.SetupRequest) { r.Email = "" },
		"email without dom": func(r *kantahev1.SetupRequest) { r.Email = "a@" },
		"display form":      func(r *kantahev1.SetupRequest) { r.Email = "A <a@b.c>" },
		"angle form":        func(r *kantahev1.SetupRequest) { r.Email = "<a@b.c>" },
	}
	for name, mut := range cases {
		r := good()
		mut(r)
		if _, err := e.auth.Setup(context.Background(), connect.NewRequest(r)); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%s: err = %v, want InvalidArgument", name, err)
		}
	}
	var n int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	if n != 0 {
		t.Fatalf("invalid requests created %d users", n)
	}
}

func TestInvalidEmail(t *testing.T) {
	e := newEnv(t)
	for _, em := range []string{"a@", "A <a@b.c>", "", "  ", "no-at-sign", "a b@c.d", strings.Repeat("a", 251) + "@b.c"} {
		_, err := e.auth.Setup(context.Background(), connect.NewRequest(&kantahev1.SetupRequest{
			Email: em, Password: "password1", DisplayName: "A", DeviceName: "x", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB}))
		if code(err) != connect.CodeInvalidArgument {
			t.Errorf("%q: err = %v", em, err)
		}
	}
}

func TestLoginOK(t *testing.T) {
	e := newEnv(t)
	first := e.setup(t, "a@example.com", "password1")
	tok, err := e.login("a@example.com", "password1", "Phone")
	if err != nil || tok.Token == "" || tok.Token == first.Token || tok.DeviceId == first.DeviceId || tok.User.Id != first.User.Id {
		t.Fatalf("%+v %v", tok, err)
	}
	if _, err := e.auth.Me(context.Background(), with(connect.NewRequest(&kantahev1.MeRequest{}), tok.Token)); err != nil {
		t.Fatalf("new token must work: %v", err)
	}
}

func TestLoginEmailCaseInsensitive(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	if _, err := e.login("  A@EXAMPLE.com ", "password1", "Phone"); err != nil {
		t.Fatalf("err = %v", err)
	}
}

func TestLoginWrongPasswordAndUnknownEmailLookAlike(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	_, err1 := e.login("a@example.com", "wrong-password", "Phone")
	_, err2 := e.login("nobody@example.com", "password1", "Phone")
	if code(err1) != connect.CodeUnauthenticated || code(err2) != connect.CodeUnauthenticated {
		t.Fatalf("codes: %v / %v", err1, err2)
	}
	var c1, c2 *connect.Error
	if !asConnect(err1, &c1) || !asConnect(err2, &c2) || c1.Message() != c2.Message() || c1.Message() != "invalid email or password" {
		t.Fatalf("messages differ: %q / %q", c1.Message(), c2.Message())
	}
}

func TestLoginValidation(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	for name, r := range map[string]*kantahev1.LoginRequest{
		"no device name": {Email: "a@example.com", Password: "password1", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB},
		"no device type": {Email: "a@example.com", Password: "password1", DeviceName: "x"},
		"long name":      {Email: "a@example.com", Password: "password1", DeviceName: strings.Repeat("x", 101), DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB},
	} {
		if _, err := e.auth.Login(context.Background(), connect.NewRequest(r)); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestLoginBackoff(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	for i := 0; i < 5; i++ {
		if _, err := e.login("a@example.com", "wrong-password", "Phone"); code(err) != connect.CodeUnauthenticated {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	_, err := e.login("a@example.com", "password1", "Phone")
	var ce *connect.Error
	if code(err) != connect.CodeResourceExhausted || !asConnect(err, &ce) || ce.Message() != "try again in 1 s" {
		t.Fatalf("right password during back-off: %v", err)
	}
	e.clock.advance(2 * time.Second)
	if _, err := e.login("a@example.com", "password1", "Phone"); err != nil {
		t.Fatalf("after the wait: %v", err)
	}
	// success resets the counter
	if _, err := e.login("a@example.com", "wrong-password", "Phone"); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("one failure after success should not be slowed: %v", err)
	}
}

func TestLoginBackoffPerIPAcrossEmails(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	for i := 0; i < 5; i++ {
		_, _ = e.login("user"+string(rune('a'+i))+"@example.com", "x", "Phone")
	}
	if _, err := e.login("a@example.com", "password1", "Phone"); code(err) != connect.CodeResourceExhausted {
		t.Fatalf("5 failures from one IP must slow the IP even for another email: %v", err)
	}
}

func TestLoginBackoffUsesForwardedIPFromTrustedProxy(t *testing.T) {
	e := newEnv(t) // 127.0.0.0/8 is trusted, the test client connects from 127.0.0.1
	e.setup(t, "a@example.com", "password1")
	try := func(ip, email string) error {
		r := connect.NewRequest(&kantahev1.LoginRequest{Email: email, Password: "x", DeviceName: "p", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB})
		r.Header().Set("X-Forwarded-For", ip)
		_, err := e.auth.Login(context.Background(), r)
		return err
	}
	for i := 0; i < 5; i++ {
		_ = try("198.51.100.7", "x"+string(rune('a'+i))+"@example.com")
	}
	if code(try("198.51.100.7", "other@example.com")) != connect.CodeResourceExhausted {
		t.Fatal("the forwarded client IP should be slowed")
	}
	if code(try("198.51.100.8", "other2@example.com")) != connect.CodeUnauthenticated {
		t.Fatal("a different client behind the same proxy must not be slowed")
	}
}

func TestLoginDisabled(t *testing.T) {
	e := newEnv(t)
	e.addUser(t, "d@example.com", "password1", `UPDATE users SET disabled=1 WHERE id=?`)
	_, err := e.login("d@example.com", "password1", "Phone")
	if code(err) != connect.CodePermissionDenied {
		t.Fatalf("err = %v", err)
	}
	if _, err := e.login("d@example.com", "wrong", "Phone"); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("wrong password for a disabled user must not reveal the state: %v", err)
	}
}

func TestLogoutRevokes(t *testing.T) {
	e := newEnv(t)
	tok := e.setup(t, "a@example.com", "password1")
	ctx := context.Background()
	if _, err := e.auth.Logout(ctx, with(connect.NewRequest(&kantahev1.LogoutRequest{}), tok.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := e.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), tok.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("Me after Logout: %v", err)
	}
}

func TestChangePasswordRevokesOthers(t *testing.T) {
	e := newEnv(t)
	t1 := e.setup(t, "a@example.com", "password1")
	t2, err := e.login("a@example.com", "password1", "Phone")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Exec(`UPDATE users SET must_change_password=1`); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err := e.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "password1", NewPassword: "password2"}), t1.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := e.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), t2.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("other device must be signed out: %v", err)
	}
	me, err := e.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), t1.Token))
	if err != nil || me.Msg.User.MustChangePassword {
		t.Fatalf("current device must keep working and must_change must be cleared: %v %v", me, err)
	}
	if _, err := e.login("a@example.com", "password1", "Phone"); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("old password must stop working: %v", err)
	}
	if _, err := e.login("a@example.com", "password2", "Phone"); err != nil {
		t.Fatalf("new password: %v", err)
	}
}

func TestChangePasswordWrongCurrentAndSame(t *testing.T) {
	e := newEnv(t)
	tok := e.setup(t, "a@example.com", "password1")
	ctx := context.Background()
	_, err := e.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "nope", NewPassword: "password2"}), tok.Token))
	if code(err) != connect.CodePermissionDenied {
		t.Fatalf("wrong current: %v", err)
	}
	_, err = e.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "password1", NewPassword: "password1"}), tok.Token))
	if code(err) != connect.CodeInvalidArgument {
		t.Fatalf("same password: %v", err)
	}
	_, err = e.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "password1", NewPassword: "short"}), tok.Token))
	if code(err) != connect.CodeInvalidArgument {
		t.Fatalf("weak new password: %v", err)
	}
}

func TestListMyDevicesIsCaller(t *testing.T) {
	e := newEnv(t)
	t1 := e.setup(t, "a@example.com", "password1")
	t2, _ := e.login("a@example.com", "password1", "Phone")
	e.addUser(t, "other@example.com", "password1")
	if _, err := e.login("other@example.com", "password1", "Other phone"); err != nil {
		t.Fatal(err)
	}
	res, err := e.auth.ListMyDevices(context.Background(), with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), t2.Token))
	if err != nil || len(res.Msg.Devices) != 2 {
		t.Fatalf("devices: %v %v", res, err)
	}
	callers := 0
	for _, d := range res.Msg.Devices {
		if d.IsCaller {
			callers++
			if d.Id != t2.DeviceId || d.Name != "Phone" || d.Type != kantahev1.DeviceType_DEVICE_TYPE_ANDROID {
				t.Errorf("caller device wrong: %+v", d)
			}
		}
		if d.Online {
			t.Errorf("online is false until the session service sets it: %+v", d)
		}
		if d.MidiMode != kantahev1.MidiMode_MIDI_MODE_AUTO {
			t.Errorf("default midi mode should be AUTO: %+v", d)
		}
	}
	if callers != 1 {
		t.Fatalf("exactly one device is the caller, got %d", callers)
	}
	_ = t1
}

func TestRevokeDevice(t *testing.T) {
	e := newEnv(t)
	t1 := e.setup(t, "a@example.com", "password1")
	t2, _ := e.login("a@example.com", "password1", "Phone")
	ctx := context.Background()
	if _, err := e.auth.RevokeDevice(ctx, with(connect.NewRequest(&kantahev1.RevokeDeviceRequest{DeviceId: t2.DeviceId}), t1.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := e.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), t2.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("revoked device still works: %v", err)
	}
	res, _ := e.auth.ListMyDevices(ctx, with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), t1.Token))
	if len(res.Msg.Devices) != 1 {
		t.Fatalf("revoked devices must not be listed: %d", len(res.Msg.Devices))
	}
	if _, err := e.auth.RevokeDevice(ctx, with(connect.NewRequest(&kantahev1.RevokeDeviceRequest{DeviceId: t2.DeviceId}), t1.Token)); code(err) != connect.CodeNotFound {
		t.Fatalf("revoking twice: %v", err)
	}
}

func TestRevokeOtherUsersDevice(t *testing.T) {
	e := newEnv(t)
	t1 := e.setup(t, "a@example.com", "password1")
	e.addUser(t, "other@example.com", "password1")
	other, _ := e.login("other@example.com", "password1", "Phone")
	_, err := e.auth.RevokeDevice(context.Background(), with(connect.NewRequest(&kantahev1.RevokeDeviceRequest{DeviceId: other.DeviceId}), t1.Token))
	if code(err) != connect.CodeNotFound {
		t.Fatalf("err = %v, want NotFound", err)
	}
	if _, err := e.auth.Me(context.Background(), with(connect.NewRequest(&kantahev1.MeRequest{}), other.Token)); err != nil {
		t.Fatalf("the other user's device must be untouched: %v", err)
	}
}

func TestNoSecretsInResponses(t *testing.T) {
	e := newEnv(t)
	tok := e.setup(t, "a@example.com", "password1")
	me, _ := e.auth.Me(context.Background(), with(connect.NewRequest(&kantahev1.MeRequest{}), tok.Token))
	if strings.Contains(me.Msg.String(), "argon2") {
		t.Fatal("a password hash leaked")
	}
	var hash string
	_ = e.db.QueryRow(`SELECT token_hash FROM devices`).Scan(&hash)
	if hash == tok.Token || hash != auth.HashToken(tok.Token) {
		t.Fatal("only the token hash may be stored")
	}
}

func TestMustChangeFlowEndToEnd(t *testing.T) {
	e := newEnv(t)
	e.addUser(t, "m@example.com", "temp-password", `UPDATE users SET must_change_password=1 WHERE id=?`)
	tok, err := e.login("m@example.com", "temp-password", "Phone")
	if err != nil || !tok.User.MustChangePassword {
		t.Fatalf("%v %v", tok, err)
	}
	ctx := context.Background()
	if _, err := e.auth.ListMyDevices(ctx, with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), tok.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("ListMyDevices while must change: %v", err)
	}
	if _, err := e.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "temp-password", NewPassword: "new-password"}), tok.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := e.auth.ListMyDevices(ctx, with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), tok.Token)); err != nil {
		t.Fatalf("after the change: %v", err)
	}
}

func asConnect(err error, target **connect.Error) bool {
	ce, ok := err.(*connect.Error)
	if ok {
		*target = ce
	}
	return ok
}

func TestChangePasswordBackoff(t *testing.T) {
	e := newEnv(t)
	tok := e.setup(t, "a@example.com", "password1")
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		_, err := e.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "wrong", NewPassword: "password2"}), tok.Token))
		if code(err) != connect.CodePermissionDenied {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	_, err := e.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "password1", NewPassword: "password2"}), tok.Token))
	if code(err) != connect.CodeResourceExhausted {
		t.Fatalf("guessing the current password must be slowed: %v", err)
	}
}

func TestAuthRPCsRequireIdentityWhenCalledWithoutInterceptor(t *testing.T) {
	s := NewAuthServer(Deps{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}, auth.NewBackoff(nil))
	ctx := context.Background()
	if _, err := s.Me(ctx, connect.NewRequest(&kantahev1.MeRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("Me: %v", err)
	}
	if _, err := s.Logout(ctx, connect.NewRequest(&kantahev1.LogoutRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("Logout: %v", err)
	}
	if _, err := s.ListMyDevices(ctx, connect.NewRequest(&kantahev1.ListMyDevicesRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("ListMyDevices: %v", err)
	}
	if _, err := s.RevokeDevice(ctx, connect.NewRequest(&kantahev1.RevokeDeviceRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("RevokeDevice: %v", err)
	}
	if _, err := s.ChangePassword(ctx, connect.NewRequest(&kantahev1.ChangePasswordRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("ChangePassword: %v", err)
	}
}

func TestRegression_UnknownDeviceTypeRejected(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	_, err := e.auth.Login(context.Background(), connect.NewRequest(&kantahev1.LoginRequest{
		Email: "a@example.com", Password: "password1", DeviceName: "x", DeviceType: kantahev1.DeviceType(99)}))
	if code(err) != connect.CodeInvalidArgument {
		t.Fatalf("an enum value outside the contract must be rejected, got %v", err)
	}
}

func TestRegression_HugeEmailIsNotUsedAsABackoffKey(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	huge := strings.Repeat("x", 300_000) + "@example.com"
	_, err := e.login(huge, "password1", "Phone")
	var ce *connect.Error
	if code(err) != connect.CodeUnauthenticated || !asConnect(err, &ce) || ce.Message() != "invalid email or password" {
		t.Fatalf("err = %v", err)
	}
	if got := e.backoffKeyBytes(); got > 1000 {
		t.Fatalf("the back-off table holds %d bytes of keys after one request", got)
	}
}

func TestRegression_IPv6AddressesOfOneSlash64ShareABackoffKey(t *testing.T) {
	e := newEnv(t)
	e.setup(t, "a@example.com", "password1")
	n := 0
	try := func(ip string) error {
		n++ // a fresh email each time, so that only the IP key can slow the caller
		r := connect.NewRequest(&kantahev1.LoginRequest{Email: fmt.Sprintf("x%d@example.com", n), Password: "x", DeviceName: "p", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB})
		r.Header().Set("X-Forwarded-For", ip)
		_, err := e.auth.Login(context.Background(), r)
		return err
	}
	for i := 0; i < 5; i++ {
		_ = try(fmt.Sprintf("2001:db8:1:2::%d", i+1))
	}
	if code(try("2001:db8:1:2:ffff::9")) != connect.CodeResourceExhausted {
		t.Fatal("rotating addresses inside one /64 must not evade the limit")
	}
	if code(try("2001:db8:1:3::1")) != connect.CodeUnauthenticated {
		t.Fatal("another /64 must not be affected")
	}
}

func (e *testEnv) backoffKeyBytes() int { return e.backoff.KeyBytes() }

// soundFontPath writes a tiny valid SoundFont for the tests that need a configured bank.
func soundFontPath(t *testing.T) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "bank.sf2")
	if err := os.WriteFile(p, testfix.SF2([]testfix.Preset{{Name: "Piano", Samples: [][]int16{make([]int16, 100)}}}), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

// msClock is the monotonic millisecond clock of the playback machines.
type msClock struct{ v atomic.Int64 }

func (c *msClock) NowMs() int64 { return c.v.Load() }

type recordingPreparer struct {
	mu   sync.Mutex
	list []string
}

func (p *recordingPreparer) Prepare(number string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.list = append(p.list, number)
}

func (p *recordingPreparer) seen() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]string(nil), p.list...)
}
