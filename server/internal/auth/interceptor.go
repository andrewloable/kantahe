package auth

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"connectrpc.com/connect"

	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/store"
)

const (
	tokenIdleExpiry = 90 * 24 * time.Hour
	touchInterval   = 60 * time.Second
	maxTokenLen     = 256
)

// ErrTokenNotFound is returned by DeviceStore.LookupToken for an unknown hash.
var ErrTokenNotFound = errors.New("auth: unknown token")

// Identity is the signed-in caller; handlers read it with IdentityFrom.
type Identity struct {
	UserID, DeviceID   string
	Admin, Uploader    bool
	MustChangePassword bool
}

type identityKey struct{}

// IdentityFrom returns the caller attached by the interceptor.
func IdentityFrom(ctx context.Context) (Identity, bool) {
	id, ok := ctx.Value(identityKey{}).(Identity)
	return id, ok
}

// WithIdentity attaches an identity to a context (used by the interceptor and tests).
func WithIdentity(ctx context.Context, id Identity) context.Context {
	return context.WithValue(ctx, identityKey{}, id)
}

// TokenRecord is a device joined with its user.
type TokenRecord struct {
	DeviceID, UserID   string
	Admin, Uploader    bool
	MustChangePassword bool
	Disabled, Revoked  bool
	LastSeen           time.Time
}

// DeviceStore is what the interceptor needs from persistence.
type DeviceStore interface {
	LookupToken(ctx context.Context, tokenHash string) (TokenRecord, error)
	Touch(ctx context.Context, deviceID string, now time.Time) error
	Revoke(ctx context.Context, deviceID string) error
}

// SQLStore implements DeviceStore on the application database.
type SQLStore struct{ db *store.DB }

// NewSQLStore wraps the database.
func NewSQLStore(db *store.DB) *SQLStore { return &SQLStore{db} }

// LookupToken finds a device by token hash, with its user's flags.
func (s *SQLStore) LookupToken(ctx context.Context, hash string) (TokenRecord, error) {
	var r TokenRecord
	var lastSeen int64
	err := s.db.QueryRowContext(ctx, `
		SELECT d.id, d.user_id, d.last_seen, d.revoked <> 0,
		       u.admin <> 0, u.uploader <> 0, u.must_change_password <> 0, u.disabled <> 0
		FROM devices d JOIN users u ON u.id = d.user_id
		WHERE d.token_hash = ?`, hash).
		Scan(&r.DeviceID, &r.UserID, &lastSeen, &r.Revoked, &r.Admin, &r.Uploader, &r.MustChangePassword, &r.Disabled)
	if errors.Is(err, sql.ErrNoRows) {
		return TokenRecord{}, ErrTokenNotFound
	}
	r.LastSeen = time.Unix(lastSeen, 0)
	return r, err
}

// Touch records that the device was seen at now.
func (s *SQLStore) Touch(ctx context.Context, deviceID string, now time.Time) error {
	return s.db.WriteTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `UPDATE devices SET last_seen = ? WHERE id = ?`, now.Unix(), deviceID)
		return err
	})
}

// Revoke signs a device out.
func (s *SQLStore) Revoke(ctx context.Context, deviceID string) error {
	return s.db.WriteTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `UPDATE devices SET revoked = 1 WHERE id = ?`, deviceID)
		return err
	})
}

// Interceptor authenticates every RPC with the device bearer token.
type Interceptor struct {
	store DeviceStore
	now   func() time.Time
}

// NewInterceptor builds the interceptor; now defaults to time.Now.
func NewInterceptor(st DeviceStore, now func() time.Time) *Interceptor {
	if now == nil {
		now = time.Now
	}
	return &Interceptor{st, now}
}

var publicProcedures = map[string]bool{
	kantahev1connect.AuthServiceGetServerInfoProcedure:  true,
	kantahev1connect.AuthServiceSetupProcedure:          true,
	kantahev1connect.AuthServiceLoginProcedure:          true,
	kantahev1connect.AuthServiceStartCodeLoginProcedure: true,
	kantahev1connect.AuthServiceWaitCodeLoginProcedure:  true,
}

// allowedWhileMustChange are the procedures a user with must_change_password may call.
var allowedWhileMustChange = map[string]bool{
	kantahev1connect.AuthServiceChangePasswordProcedure: true,
	kantahev1connect.AuthServiceMeProcedure:             true,
	kantahev1connect.AuthServiceLogoutProcedure:         true,
	kantahev1connect.AuthServiceGetServerInfoProcedure:  true,
}

// One message for every authentication failure: it must not say whether a
// token was unknown, revoked or expired, or whether the user is disabled.
func errUnauthenticated() error {
	// a fresh value each time: connect mutates error metadata
	return connect.NewError(connect.CodeUnauthenticated, errors.New("sign in required"))
}

func bearerToken(authorization string) string {
	scheme, token, ok := strings.Cut(authorization, " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	token = strings.TrimSpace(token)
	if len(token) > maxTokenLen {
		return ""
	}
	return token
}

// authenticate returns the identity for the request or an error to send back.
func (i *Interceptor) authenticate(ctx context.Context, procedure, authorization string) (context.Context, error) {
	public := publicProcedures[procedure]
	token := bearerToken(authorization)
	if token == "" {
		if public {
			return ctx, nil
		}
		return ctx, errUnauthenticated()
	}
	rec, err := i.store.LookupToken(ctx, HashToken(token))
	now := i.now()
	switch {
	case err != nil && !errors.Is(err, ErrTokenNotFound):
		return ctx, connect.NewError(connect.CodeInternal, errors.New("authentication failed"))
	case err != nil, rec.Revoked, rec.Disabled:
		if public {
			return ctx, nil
		}
		return ctx, errUnauthenticated()
	case now.Sub(rec.LastSeen) > tokenIdleExpiry:
		_ = i.store.Revoke(ctx, rec.DeviceID)
		if public {
			return ctx, nil
		}
		return ctx, errUnauthenticated()
	}
	if now.Sub(rec.LastSeen) > touchInterval {
		_ = i.store.Touch(ctx, rec.DeviceID, now)
	}
	if rec.MustChangePassword && !public && !allowedWhileMustChange[procedure] {
		return ctx, connect.NewError(connect.CodeFailedPrecondition, errors.New("password change required"))
	}
	return WithIdentity(ctx, Identity{
		UserID: rec.UserID, DeviceID: rec.DeviceID,
		Admin: rec.Admin, Uploader: rec.Uploader, MustChangePassword: rec.MustChangePassword,
	}), nil
}

// WrapUnary implements connect.Interceptor.
func (i *Interceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		ctx, err := i.authenticate(ctx, req.Spec().Procedure, req.Header().Get("Authorization"))
		if err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

// WrapStreamingClient implements connect.Interceptor; clients are not authenticated here.
func (i *Interceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

// WrapStreamingHandler implements connect.Interceptor.
func (i *Interceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		ctx, err := i.authenticate(ctx, conn.Spec().Procedure, conn.RequestHeader().Get("Authorization"))
		if err != nil {
			return err
		}
		return next(ctx, conn)
	}
}
