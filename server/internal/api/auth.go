package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"net/mail"
	"net/netip"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/catalog"
	"github.com/andrewloable/kantahe/server/internal/devices"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/media"
	"github.com/andrewloable/kantahe/server/internal/render"
	"github.com/andrewloable/kantahe/server/internal/session"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/userlib"
	"github.com/andrewloable/kantahe/server/internal/users"
)

const (
	maxEmailLen  = 254
	maxNameLen   = 100
	readMaxBytes = 1 << 20
	// uploads may be larger than the 50 MB default limit if the admin raises it, up to this message size
	maxUploadMessage = 64 << 20
	midiModeAuto     = int(kantahev1.MidiMode_MIDI_MODE_AUTO)
	badLogin         = "invalid email or password"
	setupDoneText    = "setup is already complete"
)

// Deps are the shared dependencies of the services.
type Deps struct {
	DB             *store.DB
	Version        string
	Name           string // the --name flag, told to a client that is looking for its server
	Now            func() time.Time
	Logger         *slog.Logger
	TrustedProxies []netip.Prefix
	// HashCost is the argon2id cost for new passwords; the zero value means
	// auth.DefaultCost. Only tests set something cheaper.
	HashCost auth.Cost
	// DataDir holds songs/ and media/; Importer imports uploads.
	DataDir  string
	Importer *library.Importer
	// ScoreSeconds is the --score-seconds flag, the default of the score_seconds setting.
	ScoreSeconds int
	// SoundFont is the --soundfont path of the full bank, "" when none is configured.
	SoundFont string
	// Session overrides the clock, picker and wall time of the playback service (tests).
	Session SessionOverrides
	// RenderCacheBytes is the size limit of the cache of server-rendered audio (--render-cache-gb);
	// 0 switches rendering off. Mount creates the renderer from it.
	RenderCacheBytes int64
	// Render says whether the server can render MIDI to audio (nil: Mount uses its own renderer, if any).
	Render devices.RenderAvailability
	// Modes decides each device's effective MIDI mode; Mount creates it from Render.
	Modes *devices.Modes
	// Online tells whether a device has an open WatchState stream; Mount fills it in.
	Online func(userID, deviceID string) bool
	// UserLib reads favourites, history and playlists; Mount creates it.
	UserLib *userlib.Library
	// PublicURL is the external base URL (--public-url), "" when not set.
	PublicURL string
}

// SessionOverrides replaces parts of the playback service; zero values mean the defaults.
type SessionOverrides struct {
	Clock    session.Clock
	Picker   session.Picker
	Wall     func() time.Time
	Preparer session.Preparer // replaces the SoundFont preparer
}

// AuthServer implements AuthService: accounts, devices and the TV code sign-in.
type AuthServer struct {
	d       Deps
	backoff *auth.Backoff
	h       *hasher
	codes   *auth.CodeLogins

	dummyOnce sync.Once
	dummyHash string
}

// NewAuthServer builds the service.
func NewAuthServer(d Deps, b *auth.Backoff) *AuthServer {
	return newAuthServer(d, b, newHasher(d.HashCost))
}

func newAuthServer(d Deps, b *auth.Backoff, h *hasher) *AuthServer {
	if d.Now == nil {
		d.Now = time.Now
	}
	if d.Modes == nil {
		d.Modes = devices.NewModes(d.Render)
	}
	return &AuthServer{d: d, backoff: b, h: h, codes: auth.NewCodeLogins(d.Now)}
}

// Mounted is the set of services registered by Mount.
type Mounted struct {
	media   *media.Service
	render  *render.Service // nil when the server cannot render
	session *session.Service
	backoff *auth.Backoff // tests inspect it
	codes   *auth.CodeLogins
	uploads *UploadServer // its cleanup of unfinished video uploads runs in Run
}

// Run does the background work of the services (building SoundFonts) until ctx is cancelled.
func (m *Mounted) Run(ctx context.Context) {
	done := make(chan struct{})
	go func() { m.session.Run(ctx); close(done) }()
	codesDone := make(chan struct{})
	go func() { m.codes.Run(ctx); close(codesDone) }()
	renderDone := make(chan struct{})
	go func() {
		if m.render != nil {
			m.render.Run(ctx)
		}
		close(renderDone)
	}()
	uploadsDone := make(chan struct{})
	go func() { m.uploads.RunCleanup(ctx); close(uploadsDone) }()
	m.media.Run(ctx)
	<-done
	<-codesDone
	<-renderDone
	<-uploadsDone
}

// Close releases files held by the services.
func (m *Mounted) Close() error { return m.media.Close() }

// Mount registers every service on the mux with the authentication interceptor.
func Mount(handle func(pattern string, h http.Handler), d Deps) (*Mounted, error) {
	return mount(handle, d)
}

func mount(handle func(pattern string, h http.Handler), d Deps) (*Mounted, error) {
	if d.Now == nil {
		d.Now = time.Now
	}
	ic := auth.NewInterceptor(auth.NewSQLStore(d.DB), d.Now)
	opts := []connect.HandlerOption{connect.WithInterceptors(ic), connect.WithReadMaxBytes(readMaxBytes)}
	backoff := auth.NewBackoff(d.Now)
	h := newHasher(d.HashCost)
	mediaSvc, err := media.New(context.Background(), media.Config{DB: d.DB, SoundFont: d.SoundFont, DataDir: d.DataDir, Now: d.Now, Logger: d.Logger})
	if err != nil {
		return nil, err
	}
	var renderSvc *render.Service
	if fonts := mediaSvc.Fonts(); fonts != nil && d.RenderCacheBytes > 0 {
		renderSvc, err = render.New(render.Config{DB: d.DB, DataDir: d.DataDir, Fonts: fonts, FullBank: d.SoundFont, Tag: fonts.Tag(),
			LimitBytes: d.RenderCacheBytes, Logger: d.Logger, Now: d.Now})
		if err != nil {
			_ = mediaSvc.Close()
			return nil, fmt.Errorf("render cache: %w", err)
		}
		mediaSvc.SetRenderer(renderSvc)
		if d.Render == nil {
			d.Render = renderSvc
		}
	}
	if d.Modes == nil {
		d.Modes = devices.NewModes(d.Render)
	}
	cat := catalog.New(d.DB)
	prep := d.Session.Preparer
	if f := mediaSvc.Fonts(); prep == nil && f != nil {
		prep = f
	}
	sess := session.NewService(session.Config{
		DB: d.DB, Songs: cat, Preparer: prep, Picker: d.Session.Picker, Clock: d.Session.Clock, Wall: d.Session.Wall,
		DefaultScoreSeconds: d.ScoreSeconds, Logger: d.Logger,
		PrepareFor: func(userID, playerDeviceID, number string) {
			// render ahead, but only for a player that plays server renders
			if renderSvc == nil || playerDeviceID == "" {
				return
			}
			dev, err := users.DeviceByID(context.Background(), d.DB, userID, playerDeviceID)
			if err != nil {
				return
			}
			if d.Modes.Effective(kantahev1.MidiMode(dev.MidiMode), kantahev1.DeviceType(dev.Type), dev.MemoryMB, dev.ID) == kantahev1.MidiMode_MIDI_MODE_SERVER {
				renderSvc.Prepare(number)
			}
		},
	})
	d.Online = sess.IsOnline
	d.UserLib = userlib.New(d.DB, func() int64 { return d.Now().Unix() })

	authSrv := newAuthServer(d, backoff, h)
	handle(kantahev1connect.NewAuthServiceHandler(authSrv, opts...))
	adminOpts := append([]connect.HandlerOption{connect.WithInterceptors(ic, adminOnly{})}, opts[1:]...)
	adminSrv := newAdminServer(d, h)
	adminSrv.media = mediaSvc
	handle(kantahev1connect.NewAdminServiceHandler(adminSrv, adminOpts...))
	uploadOpts := []connect.HandlerOption{connect.WithInterceptors(ic), connect.WithReadMaxBytes(maxUploadMessage)}
	uploadSrv := newUploadServer(d)
	handle(kantahev1connect.NewUploadServiceHandler(uploadSrv, uploadOpts...))
	mediaSvc.Routes(handle)
	handle(kantahev1connect.NewCatalogServiceHandler(newCatalogServer(d, cat, mediaSvc), opts...))
	handle(kantahev1connect.NewSessionServiceHandler(newSessionServer(d, sess, cat), opts...))
	handle(kantahev1connect.NewUserLibraryServiceHandler(newUserLibraryServer(d), opts...))
	return &Mounted{media: mediaSvc, render: renderSvc, session: sess, backoff: backoff, codes: authSrv.codes, uploads: uploadSrv}, nil
}

// dummy is verified against when the email is unknown, so that an unknown
// email costs as much time as a wrong password.
func (s *AuthServer) dummy() string {
	s.dummyOnce.Do(func() { s.dummyHash, _ = auth.HashWithCost("kantahe-dummy-password", s.h.cost) })
	return s.dummyHash
}

func validEmail(raw string) (string, error) {
	e := strings.TrimSpace(raw)
	if e == "" || len(e) > maxEmailLen {
		return "", invalidArgument("invalid email address")
	}
	a, err := mail.ParseAddress(e)
	if err != nil || a.Name != "" || a.Address != e {
		return "", invalidArgument("invalid email address")
	}
	return strings.ToLower(e), nil
}

func validName(what, raw string) (string, error) {
	n := strings.TrimSpace(raw)
	if c := utf8.RuneCountInString(n); c < 1 || c > maxNameLen {
		return "", invalidArgument(fmt.Sprintf("%s must be 1 to %d characters", what, maxNameLen))
	}
	return n, nil
}

func validDevice(name string, typ kantahev1.DeviceType) (string, error) {
	n, err := validName("device name", name)
	if err != nil {
		return "", err
	}
	if _, known := kantahev1.DeviceType_name[int32(typ)]; !known || typ == kantahev1.DeviceType_DEVICE_TYPE_UNSPECIFIED {
		return "", invalidArgument("device type is required")
	}
	return n, nil
}

func toProtoUser(u users.User) *kantahev1.User {
	return &kantahev1.User{
		Id: u.ID, Email: u.Email, DisplayName: u.DisplayName, Admin: u.Admin, Uploader: u.Uploader,
		MustChangePassword: u.MustChangePassword, Disabled: u.Disabled,
	}
}

func toProtoDevice(d users.Device, callerID string, modes *devices.Modes) *kantahev1.Device {
	mode := kantahev1.MidiMode(d.MidiMode)
	background := kantahev1.BackgroundMode(d.BackgroundMode)
	return &kantahev1.Device{
		Id: d.ID, Name: d.Name, Type: kantahev1.DeviceType(d.Type), MicAvailable: d.MicAvailable, MemoryMb: int32(d.MemoryMB),
		MidiMode: mode, EffectiveMidiMode: modes.Effective(mode, kantahev1.DeviceType(d.Type), d.MemoryMB, d.ID),
		BackgroundMode:      background,
		EffectiveBackground: modes.EffectiveBackground(background, mode, kantahev1.DeviceType(d.Type), d.MemoryMB, d.ID),
		IsCaller:            d.ID == callerID, LastSeenUnix: d.LastSeen,
	}
}

// newSession creates a device for the user inside tx and returns the token reply.
func (s *AuthServer) newSession(ctx context.Context, tx users.Querier, u users.User, name string, typ kantahev1.DeviceType) (*kantahev1.AuthToken, error) {
	token, hash := auth.NewToken()
	now := s.d.Now().Unix()
	dev := users.Device{
		ID: users.NewID(), UserID: u.ID, Name: name, Type: int(typ), TokenHash: hash,
		CreatedAt: now, LastSeen: now, MidiMode: midiModeAuto,
	}
	if err := users.CreateDevice(ctx, tx, dev); err != nil {
		return nil, err
	}
	return &kantahev1.AuthToken{Token: token, DeviceId: dev.ID, User: toProtoUser(u)}, nil
}

// GetServerInfo returns the version, the server name and whether the first admin is still missing.
func (s *AuthServer) GetServerInfo(ctx context.Context, _ *connect.Request[kantahev1.GetServerInfoRequest]) (*connect.Response[kantahev1.GetServerInfoResponse], error) {
	n, err := users.Count(ctx, s.d.DB)
	if err != nil {
		return nil, internalErr(s.d.Logger, "GetServerInfo", err)
	}
	return connect.NewResponse(&kantahev1.GetServerInfoResponse{Version: s.d.Version, Name: s.d.Name, SetupRequired: n == 0}), nil
}

var errSetupDone = errors.New(setupDoneText)

// Setup creates the first admin while no user exists.
func (s *AuthServer) Setup(ctx context.Context, req *connect.Request[kantahev1.SetupRequest]) (*connect.Response[kantahev1.SetupResponse], error) {
	m := req.Msg
	email, err := validEmail(m.Email)
	if err != nil {
		return nil, err
	}
	if err := auth.ValidatePassword(m.Password); err != nil {
		return nil, invalidArgument(err.Error())
	}
	display, err := validName("display name", m.DisplayName)
	if err != nil {
		return nil, err
	}
	devName, err := validDevice(m.DeviceName, m.DeviceType)
	if err != nil {
		return nil, err
	}
	hash, err := s.h.hash(ctx, m.Password)
	if err != nil {
		return nil, internalErr(s.d.Logger, "Setup", err)
	}
	var out *kantahev1.AuthToken
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		// the count is checked inside the write transaction: two racing
		// Setup calls cannot both see an empty table
		if n, err := users.Count(ctx, tx); err != nil {
			return err
		} else if n > 0 {
			return errSetupDone
		}
		u := users.User{ID: users.NewID(), Email: email, DisplayName: display, PasswordHash: hash, Admin: true, Uploader: true, CreatedAt: s.d.Now().Unix()}
		if err := users.Create(ctx, tx, u); err != nil {
			return err
		}
		out, err = s.newSession(ctx, tx, u, devName, m.DeviceType)
		return err
	})
	if errors.Is(err, errSetupDone) {
		return nil, newErr(connect.CodeFailedPrecondition, setupDoneText)
	}
	if err != nil {
		return nil, fromUsers(s.d.Logger, "Setup", err)
	}
	return connect.NewResponse(&kantahev1.SetupResponse{Auth: out}), nil
}

// loginKeys are the back-off keys of an attempt: the email (only when it is a
// plausible length, so that attacker-chosen strings cannot fill the table) and
// the client IP (an IPv6 client is identified by its /64, which one subscriber
// can rotate through freely).
func (s *AuthServer) loginKeys(req connect.AnyRequest, email string) []string {
	ip := auth.ClientIPFrom(req.Peer().Addr, req.Header(), s.d.TrustedProxies)
	ipKey := "ip:unknown"
	switch {
	case ip.Is4():
		ipKey = "ip:" + ip.String()
	case ip.IsValid():
		ipKey = "ip:" + netip.PrefixFrom(ip, 64).Masked().String()
	}
	if len(email) > maxEmailLen {
		return []string{ipKey}
	}
	return []string{"email:" + email, ipKey}
}

// Login signs a device in with email and password.
func (s *AuthServer) Login(ctx context.Context, req *connect.Request[kantahev1.LoginRequest]) (*connect.Response[kantahev1.LoginResponse], error) {
	m := req.Msg
	devName, err := validDevice(m.DeviceName, m.DeviceType)
	if err != nil {
		return nil, err
	}
	email := strings.ToLower(strings.TrimSpace(m.Email))
	keys := s.loginKeys(req, email)
	if wait := s.backoff.Check(keys...); wait > 0 {
		return nil, newErr(connect.CodeResourceExhausted, waitText(wait))
	}
	u, err := users.ByEmail(ctx, s.d.DB, email)
	if err != nil && !errors.Is(err, users.ErrNotFound) {
		return nil, internalErr(s.d.Logger, "Login", err)
	}
	hash := u.PasswordHash
	if errors.Is(err, users.ErrNotFound) {
		hash = s.dummy()
	}
	ok, verr := s.h.verify(ctx, hash, m.Password)
	if verr != nil && ctx.Err() != nil {
		return nil, internalErr(s.d.Logger, "Login", verr)
	}
	if !ok || errors.Is(err, users.ErrNotFound) {
		s.backoff.Fail(keys...)
		return nil, newErr(connect.CodeUnauthenticated, badLogin)
	}
	if u.Disabled {
		return nil, newErr(connect.CodePermissionDenied, "account disabled")
	}
	s.backoff.Succeed(keys...)
	var out *kantahev1.AuthToken
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		var err error
		out, err = s.newSession(ctx, tx, u, devName, m.DeviceType)
		return err
	})
	if err != nil {
		return nil, internalErr(s.d.Logger, "Login", err)
	}
	return connect.NewResponse(&kantahev1.LoginResponse{Auth: out}), nil
}

func waitText(wait time.Duration) string {
	return fmt.Sprintf("try again in %d s", int(math.Ceil(wait.Seconds())))
}

func identity(ctx context.Context) (auth.Identity, error) {
	id, ok := auth.IdentityFrom(ctx)
	if !ok {
		return id, newErr(connect.CodeUnauthenticated, "sign in required")
	}
	return id, nil
}

// Logout signs the calling device out.
func (s *AuthServer) Logout(ctx context.Context, _ *connect.Request[kantahev1.LogoutRequest]) (*connect.Response[kantahev1.LogoutResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		_, err := users.RevokeDevice(ctx, tx, id.UserID, id.DeviceID)
		return err
	}); err != nil {
		return nil, internalErr(s.d.Logger, "Logout", err)
	}
	return connect.NewResponse(&kantahev1.LogoutResponse{}), nil
}

// Me returns the calling user.
func (s *AuthServer) Me(ctx context.Context, _ *connect.Request[kantahev1.MeRequest]) (*connect.Response[kantahev1.MeResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	u, err := users.ByID(ctx, s.d.DB, id.UserID)
	if err != nil {
		return nil, fromUsers(s.d.Logger, "Me", err)
	}
	return connect.NewResponse(&kantahev1.MeResponse{User: toProtoUser(u)}), nil
}

// ChangePassword sets a new password and signs out the user's other devices.
func (s *AuthServer) ChangePassword(ctx context.Context, req *connect.Request[kantahev1.ChangePasswordRequest]) (*connect.Response[kantahev1.ChangePasswordResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	key := "user:" + id.UserID
	if wait := s.backoff.Check(key); wait > 0 {
		return nil, newErr(connect.CodeResourceExhausted, waitText(wait))
	}
	u, err := users.ByID(ctx, s.d.DB, id.UserID)
	if err != nil {
		return nil, fromUsers(s.d.Logger, "ChangePassword", err)
	}
	ok, verr := s.h.verify(ctx, u.PasswordHash, m.CurrentPassword)
	if verr != nil && ctx.Err() != nil {
		return nil, internalErr(s.d.Logger, "ChangePassword", verr)
	}
	if !ok {
		s.backoff.Fail(key)
		return nil, newErr(connect.CodePermissionDenied, "current password is incorrect")
	}
	s.backoff.Succeed(key)
	if err := auth.ValidatePassword(m.NewPassword); err != nil {
		return nil, invalidArgument(err.Error())
	}
	if m.NewPassword == m.CurrentPassword {
		return nil, invalidArgument("the new password must differ from the current one")
	}
	hash, err := s.h.hash(ctx, m.NewPassword)
	if err != nil {
		return nil, internalErr(s.d.Logger, "ChangePassword", err)
	}
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		if err := users.SetPassword(ctx, tx, id.UserID, hash, false); err != nil {
			return err
		}
		_, err := users.RevokeOthers(ctx, tx, id.UserID, id.DeviceID)
		return err
	})
	if err != nil {
		return nil, fromUsers(s.d.Logger, "ChangePassword", err)
	}
	return connect.NewResponse(&kantahev1.ChangePasswordResponse{}), nil
}

// ListMyDevices lists the caller's devices that are not revoked.
func (s *AuthServer) ListMyDevices(ctx context.Context, _ *connect.Request[kantahev1.ListMyDevicesRequest]) (*connect.Response[kantahev1.ListMyDevicesResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	devs, err := users.ListDevices(ctx, s.d.DB, id.UserID)
	if err != nil {
		return nil, internalErr(s.d.Logger, "ListMyDevices", err)
	}
	out := &kantahev1.ListMyDevicesResponse{}
	for _, d := range devs {
		pd := toProtoDevice(d, id.DeviceID, s.d.Modes)
		if s.d.Online != nil {
			pd.Online = s.d.Online(id.UserID, d.ID)
		}
		out.Devices = append(out.Devices, pd)
	}
	return connect.NewResponse(out), nil
}

// RevokeDevice signs out one of the caller's own devices.
func (s *AuthServer) RevokeDevice(ctx context.Context, req *connect.Request[kantahev1.RevokeDeviceRequest]) (*connect.Response[kantahev1.RevokeDeviceResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	var ok bool
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		var err error
		ok, err = users.RevokeDevice(ctx, tx, id.UserID, req.Msg.DeviceId)
		return err
	})
	if err != nil {
		return nil, internalErr(s.d.Logger, "RevokeDevice", err)
	}
	if !ok {
		return nil, newErr(connect.CodeNotFound, "device not found")
	}
	return connect.NewResponse(&kantahev1.RevokeDeviceResponse{}), nil
}
