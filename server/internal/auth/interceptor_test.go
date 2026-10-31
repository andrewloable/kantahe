package auth

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/store"
)

type fakeStore struct {
	mu      sync.Mutex
	recs    map[string]TokenRecord
	touched []string
	revoked []string
}

func (f *fakeStore) LookupToken(_ context.Context, hash string) (TokenRecord, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	r, ok := f.recs[hash]
	if !ok {
		return TokenRecord{}, ErrTokenNotFound
	}
	return r, nil
}

func (f *fakeStore) Touch(_ context.Context, deviceID string, _ time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.touched = append(f.touched, deviceID)
	return nil
}

func (f *fakeStore) Revoke(_ context.Context, deviceID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.revoked = append(f.revoked, deviceID)
	return nil
}

type authStub struct {
	kantahev1connect.UnimplementedAuthServiceHandler
}

func (authStub) Me(ctx context.Context, _ *connect.Request[kantahev1.MeRequest]) (*connect.Response[kantahev1.MeResponse], error) {
	id, _ := IdentityFrom(ctx)
	return connect.NewResponse(&kantahev1.MeResponse{User: &kantahev1.User{Id: id.UserID, Admin: id.Admin, Uploader: id.Uploader}}), nil
}

func (authStub) GetServerInfo(ctx context.Context, _ *connect.Request[kantahev1.GetServerInfoRequest]) (*connect.Response[kantahev1.GetServerInfoResponse], error) {
	_, signedIn := IdentityFrom(ctx)
	v := "anonymous"
	if signedIn {
		v = "signed-in"
	}
	return connect.NewResponse(&kantahev1.GetServerInfoResponse{Version: v}), nil
}

func (authStub) ChangePassword(context.Context, *connect.Request[kantahev1.ChangePasswordRequest]) (*connect.Response[kantahev1.ChangePasswordResponse], error) {
	return connect.NewResponse(&kantahev1.ChangePasswordResponse{}), nil
}

func (authStub) Logout(context.Context, *connect.Request[kantahev1.LogoutRequest]) (*connect.Response[kantahev1.LogoutResponse], error) {
	return connect.NewResponse(&kantahev1.LogoutResponse{}), nil
}

func (authStub) Login(context.Context, *connect.Request[kantahev1.LoginRequest]) (*connect.Response[kantahev1.LoginResponse], error) {
	return connect.NewResponse(&kantahev1.LoginResponse{}), nil
}

func (authStub) WaitCodeLogin(_ context.Context, _ *connect.Request[kantahev1.WaitCodeLoginRequest], s *connect.ServerStream[kantahev1.WaitCodeLoginResponse]) error {
	return s.Send(&kantahev1.WaitCodeLoginResponse{Result: &kantahev1.WaitCodeLoginResponse_Expired{Expired: true}})
}

type sessionStub struct {
	kantahev1connect.UnimplementedSessionServiceHandler
}

func (sessionStub) GetState(ctx context.Context, _ *connect.Request[kantahev1.GetStateRequest]) (*connect.Response[kantahev1.GetStateResponse], error) {
	id, _ := IdentityFrom(ctx)
	return connect.NewResponse(&kantahev1.GetStateResponse{State: &kantahev1.State{PlayerDeviceId: id.DeviceID}}), nil
}

func (sessionStub) WatchState(ctx context.Context, _ *connect.Request[kantahev1.WatchStateRequest], s *connect.ServerStream[kantahev1.WatchStateResponse]) error {
	id, _ := IdentityFrom(ctx)
	return s.Send(&kantahev1.WatchStateResponse{State: &kantahev1.State{PlayerDeviceId: id.DeviceID}})
}

type env struct {
	srv   *httptest.Server
	store DeviceStore
	clock *clock
	auth  kantahev1connect.AuthServiceClient
	sess  kantahev1connect.SessionServiceClient
}

func newEnv(t *testing.T, st DeviceStore) *env {
	t.Helper()
	c := newClock()
	ic := NewInterceptor(st, c.now)
	mux := http.NewServeMux()
	p, h := kantahev1connect.NewAuthServiceHandler(authStub{}, connect.WithInterceptors(ic))
	mux.Handle(p, h)
	p, h = kantahev1connect.NewSessionServiceHandler(sessionStub{}, connect.WithInterceptors(ic))
	mux.Handle(p, h)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &env{srv, st, c, kantahev1connect.NewAuthServiceClient(srv.Client(), srv.URL), kantahev1connect.NewSessionServiceClient(srv.Client(), srv.URL)}
}

func bearer[T any](r *connect.Request[T], token string) *connect.Request[T] {
	if token != "" {
		r.Header().Set("Authorization", "Bearer "+token)
	}
	return r
}

func code(err error) connect.Code { return connect.CodeOf(err) }

func newFake(c *clock) (*fakeStore, string) {
	tok, hash := NewToken()
	return &fakeStore{recs: map[string]TokenRecord{hash: {DeviceID: "d1", UserID: "u1", Admin: true, Uploader: true, LastSeen: c.now()}}}, tok
}

func TestInterceptorRejectsMissingAndUnknownTokens(t *testing.T) {
	e := newEnv(t, &fakeStore{recs: map[string]TokenRecord{}})
	ctx := context.Background()
	_, err := e.sess.GetState(ctx, connect.NewRequest(&kantahev1.GetStateRequest{}))
	if code(err) != connect.CodeUnauthenticated {
		t.Fatalf("no header: %v", err)
	}
	_, err = e.sess.GetState(ctx, bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), "nope"))
	if code(err) != connect.CodeUnauthenticated {
		t.Fatalf("unknown token: %v", err)
	}
	r := connect.NewRequest(&kantahev1.GetStateRequest{})
	r.Header().Set("Authorization", "Basic abc")
	if _, err = e.sess.GetState(ctx, r); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("wrong scheme: %v", err)
	}
	r = connect.NewRequest(&kantahev1.GetStateRequest{})
	r.Header().Set("Authorization", "Bearer")
	if _, err = e.sess.GetState(ctx, r); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("empty bearer: %v", err)
	}
}

func TestInterceptorErrorMessagesDoNotRevealWhy(t *testing.T) {
	c := newClock()
	st, tok := newFake(c)
	for h, r := range st.recs {
		r.Disabled = true
		st.recs[h] = r
	}
	e := newEnv(t, st)
	_, err1 := e.sess.GetState(context.Background(), bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), tok))
	_, err2 := e.sess.GetState(context.Background(), connect.NewRequest(&kantahev1.GetStateRequest{}))
	var ce1, ce2 *connect.Error
	if !errors.As(err1, &ce1) || !errors.As(err2, &ce2) || ce1.Message() != ce2.Message() {
		t.Fatalf("messages differ: %v / %v", err1, err2)
	}
}

func TestInterceptorRevokedAndDisabled(t *testing.T) {
	for _, mut := range []func(*TokenRecord){func(r *TokenRecord) { r.Revoked = true }, func(r *TokenRecord) { r.Disabled = true }} {
		c := newClock()
		st, tok := newFake(c)
		for h, r := range st.recs {
			mut(&r)
			st.recs[h] = r
		}
		e := newEnv(t, st)
		if _, err := e.sess.GetState(context.Background(), bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), tok)); code(err) != connect.CodeUnauthenticated {
			t.Fatalf("err = %v", err)
		}
	}
}

func TestInterceptorValidTokenSetsIdentity(t *testing.T) {
	st, tok := newFake(newClock())
	e := newEnv(t, st)
	res, err := e.auth.Me(context.Background(), bearer(connect.NewRequest(&kantahev1.MeRequest{}), tok))
	if err != nil || res.Msg.User.Id != "u1" || !res.Msg.User.Admin || !res.Msg.User.Uploader {
		t.Fatalf("%v %v", res, err)
	}
	st2, err2 := e.sess.GetState(context.Background(), bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), tok))
	if err2 != nil || st2.Msg.State.PlayerDeviceId != "d1" {
		t.Fatalf("device id missing: %v %v", st2, err2)
	}
	// scheme is case-insensitive
	r := connect.NewRequest(&kantahev1.MeRequest{})
	r.Header().Set("Authorization", "bearer "+tok)
	if _, err := e.auth.Me(context.Background(), r); err != nil {
		t.Fatalf("lowercase scheme: %v", err)
	}
}

func TestInterceptorExpiresAfter90Days(t *testing.T) {
	c := newClock()
	st, tok := newFake(c)
	e := newEnv(t, st)
	e.clock.advance(91 * 24 * time.Hour)
	// the interceptor's clock is e.clock; the record was seen at the start
	_, err := e.sess.GetState(context.Background(), bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), tok))
	if code(err) != connect.CodeUnauthenticated {
		t.Fatalf("err = %v", err)
	}
	if len(st.revoked) != 1 || st.revoked[0] != "d1" {
		t.Fatalf("expired device must be revoked, revoked = %v", st.revoked)
	}
}

func TestInterceptorJustInsideTheExpiry(t *testing.T) {
	c := newClock()
	st, tok := newFake(c)
	e := newEnv(t, st)
	e.clock.advance(89 * 24 * time.Hour)
	if _, err := e.sess.GetState(context.Background(), bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), tok)); err != nil {
		t.Fatalf("89 days idle should still work: %v", err)
	}
}

func TestInterceptorPublicProcedures(t *testing.T) {
	e := newEnv(t, &fakeStore{recs: map[string]TokenRecord{}})
	ctx := context.Background()
	res, err := e.auth.GetServerInfo(ctx, connect.NewRequest(&kantahev1.GetServerInfoRequest{}))
	if err != nil || res.Msg.Version != "anonymous" {
		t.Fatalf("GetServerInfo: %v %v", res, err)
	}
	if _, err := e.auth.Login(ctx, connect.NewRequest(&kantahev1.LoginRequest{})); err != nil {
		t.Fatalf("Login: %v", err)
	}
	stream, err := e.auth.WaitCodeLogin(ctx, connect.NewRequest(&kantahev1.WaitCodeLoginRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	if !stream.Receive() || stream.Err() != nil {
		t.Fatalf("WaitCodeLogin stream: %v", stream.Err())
	}
	// a stale token on a public procedure does not block it
	res, err = e.auth.GetServerInfo(ctx, bearer(connect.NewRequest(&kantahev1.GetServerInfoRequest{}), "stale"))
	if err != nil || res.Msg.Version != "anonymous" {
		t.Fatalf("stale token on public procedure: %v %v", res, err)
	}
}

func TestInterceptorPublicProcedureStillAttachesValidIdentity(t *testing.T) {
	st, tok := newFake(newClock())
	e := newEnv(t, st)
	res, err := e.auth.GetServerInfo(context.Background(), bearer(connect.NewRequest(&kantahev1.GetServerInfoRequest{}), tok))
	if err != nil || res.Msg.Version != "signed-in" {
		t.Fatalf("%v %v", res, err)
	}
}

func TestInterceptorStreamingRequiresToken(t *testing.T) {
	st, tok := newFake(newClock())
	e := newEnv(t, st)
	ctx := context.Background()
	s, err := e.sess.WatchState(ctx, connect.NewRequest(&kantahev1.WatchStateRequest{}))
	if err == nil {
		s.Receive()
		err = s.Err()
	}
	if code(err) != connect.CodeUnauthenticated {
		t.Fatalf("anonymous stream: %v", err)
	}
	s, err = e.sess.WatchState(ctx, bearer(connect.NewRequest(&kantahev1.WatchStateRequest{}), tok))
	if err != nil || !s.Receive() || s.Msg().State.PlayerDeviceId != "d1" {
		t.Fatalf("signed-in stream: %v %v", err, s.Err())
	}
}

func TestInterceptorMustChangePassword(t *testing.T) {
	c := newClock()
	st, tok := newFake(c)
	for h, r := range st.recs {
		r.MustChangePassword = true
		st.recs[h] = r
	}
	e := newEnv(t, st)
	ctx := context.Background()
	_, err := e.sess.GetState(ctx, bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), tok))
	var ce *connect.Error
	if code(err) != connect.CodeFailedPrecondition || !errors.As(err, &ce) || ce.Message() != "password change required" {
		t.Fatalf("GetState: %v", err)
	}
	s, err := e.sess.WatchState(ctx, bearer(connect.NewRequest(&kantahev1.WatchStateRequest{}), tok))
	if err == nil {
		s.Receive()
		err = s.Err()
	}
	if code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("WatchState: %v", err)
	}
	for name, call := range map[string]func() error{
		"Me": func() error {
			_, e2 := e.auth.Me(ctx, bearer(connect.NewRequest(&kantahev1.MeRequest{}), tok))
			return e2
		},
		"ChangePassword": func() error {
			_, e2 := e.auth.ChangePassword(ctx, bearer(connect.NewRequest(&kantahev1.ChangePasswordRequest{}), tok))
			return e2
		},
		"Logout": func() error {
			_, e2 := e.auth.Logout(ctx, bearer(connect.NewRequest(&kantahev1.LogoutRequest{}), tok))
			return e2
		},
		"GetServerInfo": func() error {
			_, e2 := e.auth.GetServerInfo(ctx, bearer(connect.NewRequest(&kantahev1.GetServerInfoRequest{}), tok))
			return e2
		},
	} {
		if err := call(); err != nil {
			t.Errorf("%s must be allowed while a password change is required: %v", name, err)
		}
	}
	// ListMyDevices is not in the allow list
	if _, err := e.auth.ListMyDevices(ctx, bearer(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), tok)); code(err) != connect.CodeFailedPrecondition {
		t.Errorf("ListMyDevices: %v", err)
	}
}

func TestInterceptorTouchesLastSeenOnlyWhenOlderThan60s(t *testing.T) {
	c := newClock()
	st, tok := newFake(c)
	e := newEnv(t, st)
	ctx := context.Background()
	call := func() {
		if _, err := e.sess.GetState(ctx, bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), tok)); err != nil {
			t.Fatal(err)
		}
	}
	call() // seen "just now"
	e.clock.advance(30 * time.Second)
	call()
	if len(st.touched) != 0 {
		t.Fatalf("touched after 30 s: %v", st.touched)
	}
	e.clock.advance(31 * time.Second) // now 61 s since last_seen
	call()
	if len(st.touched) != 1 || st.touched[0] != "d1" {
		t.Fatalf("touched after 61 s: %v", st.touched)
	}
}

func TestSQLStoreIntegration(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	now := time.Now()
	tok, hash := NewToken()
	mustExec(t, db, `INSERT INTO users(id,email,display_name,password_hash,admin,uploader,must_change_password,created_at) VALUES ('u1','a@b.c','A','h',1,0,0,1)`)
	mustExec(t, db, `INSERT INTO devices(id,user_id,name,type,token_hash,created_at,last_seen) VALUES ('d1','u1','TV',1,?,1,?)`, hash, now.Unix())
	st := NewSQLStore(db)

	rec, err := st.LookupToken(context.Background(), hash)
	if err != nil || rec.DeviceID != "d1" || rec.UserID != "u1" || !rec.Admin || rec.Uploader || rec.Disabled || rec.Revoked {
		t.Fatalf("%+v %v", rec, err)
	}
	if _, err := st.LookupToken(context.Background(), "nope"); !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("unknown hash: %v", err)
	}

	e := newEnv(t, st)
	e.clock.t = now
	if res, err := e.auth.Me(context.Background(), bearer(connect.NewRequest(&kantahev1.MeRequest{}), tok)); err != nil || res.Msg.User.Id != "u1" {
		t.Fatalf("%v %v", res, err)
	}
	// touch moves last_seen forward
	e.clock.advance(2 * time.Minute)
	if _, err := e.auth.Me(context.Background(), bearer(connect.NewRequest(&kantahev1.MeRequest{}), tok)); err != nil {
		t.Fatal(err)
	}
	var seen int64
	_ = db.QueryRow(`SELECT last_seen FROM devices WHERE id='d1'`).Scan(&seen)
	if seen != e.clock.now().Unix() {
		t.Fatalf("last_seen = %d, want %d", seen, e.clock.now().Unix())
	}
	// 91 idle days: rejected and revoked in the database
	e.clock.advance(91 * 24 * time.Hour)
	if _, err := e.auth.Me(context.Background(), bearer(connect.NewRequest(&kantahev1.MeRequest{}), tok)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("err = %v", err)
	}
	var revoked int
	_ = db.QueryRow(`SELECT revoked FROM devices WHERE id='d1'`).Scan(&revoked)
	if revoked != 1 {
		t.Fatal("device should be revoked in the database")
	}
	// disabled user
	mustExec(t, db, `UPDATE devices SET revoked=0, last_seen=? WHERE id='d1'`, e.clock.now().Unix())
	mustExec(t, db, `UPDATE users SET disabled=1 WHERE id='u1'`)
	if _, err := e.auth.Me(context.Background(), bearer(connect.NewRequest(&kantahev1.MeRequest{}), tok)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("disabled user: %v", err)
	}
}

func mustExec(t *testing.T, db *store.DB, q string, args ...any) {
	t.Helper()
	if _, err := db.Exec(q, args...); err != nil {
		t.Fatal(err)
	}
}

var _ = sql.ErrNoRows

type brokenStore struct{ fakeStore }

func (*brokenStore) LookupToken(context.Context, string) (TokenRecord, error) {
	return TokenRecord{}, errors.New("database is locked")
}

func TestInterceptorStoreFailureIsInternalAndLeaksNothing(t *testing.T) {
	e := newEnv(t, &brokenStore{})
	_, err := e.sess.GetState(context.Background(), bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), "some-token"))
	var ce *connect.Error
	if !errors.As(err, &ce) || ce.Code() != connect.CodeInternal || ce.Message() == "database is locked" {
		t.Fatalf("err = %v", err)
	}
}

func TestInterceptorOverlongTokenIsRejectedWithoutLookup(t *testing.T) {
	st := &brokenStore{} // would fail the test with CodeInternal if it were consulted
	e := newEnv(t, st)
	long := make([]byte, 5000)
	for i := range long {
		long[i] = 'a'
	}
	_, err := e.sess.GetState(context.Background(), bearer(connect.NewRequest(&kantahev1.GetStateRequest{}), string(long)))
	if code(err) != connect.CodeUnauthenticated {
		t.Fatalf("err = %v", err)
	}
}
