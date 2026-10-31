package api

import (
	"context"
	"database/sql"
	"errors"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/users"
)

// StartCodeLogin gives a TV a 5-minute code to show; the login id it returns stays secret on the TV.
func (s *AuthServer) StartCodeLogin(_ context.Context, req *connect.Request[kantahev1.StartCodeLoginRequest]) (*connect.Response[kantahev1.StartCodeLoginResponse], error) {
	m := req.Msg
	name, err := validDevice(m.DeviceName, m.DeviceType)
	if err != nil {
		return nil, err
	}
	ip := auth.ClientIPFrom(req.Peer().Addr, req.Header(), s.d.TrustedProxies)
	loginID, code, expires, err := s.codes.Start(name, int32(m.DeviceType), ip)
	if errors.Is(err, auth.ErrTooManyCodes) {
		return nil, newErr(connect.CodeResourceExhausted, "too many sign-in codes are pending, try again later")
	}
	if err != nil {
		return nil, internalErr(s.d.Logger, "StartCodeLogin", err)
	}
	out := &kantahev1.StartCodeLoginResponse{LoginId: loginID, Code: code, ExpiresAtUnix: expires.Unix()}
	if s.d.PublicURL != "" {
		out.ApproveUrl = s.d.PublicURL + "/code"
	}
	return connect.NewResponse(out), nil
}

// ApproveCode lets a signed-in user approve the code shown on a TV. Wrong codes slow the
// caller down the way wrong passwords do, so that a code cannot be guessed.
func (s *AuthServer) ApproveCode(ctx context.Context, req *connect.Request[kantahev1.ApproveCodeRequest]) (*connect.Response[kantahev1.ApproveCodeResponse], error) {
	id, err := identity(ctx)
	if err != nil {
		return nil, err
	}
	key := "approve:" + id.UserID
	if wait := s.backoff.Check(key); wait > 0 {
		return nil, newErr(connect.CodeResourceExhausted, waitText(wait))
	}
	name, err := s.codes.Approve(req.Msg.Code, id.UserID)
	if errors.Is(err, auth.ErrCodeNotFound) {
		s.backoff.Fail(key)
		return nil, newErr(connect.CodeNotFound, "unknown or expired code")
	}
	if err != nil {
		return nil, internalErr(s.d.Logger, "ApproveCode", err)
	}
	// no Succeed here: an attacker could approve a code of their own between guesses to reset the counter
	return connect.NewResponse(&kantahev1.ApproveCodeResponse{DeviceName: name}), nil
}

// WaitCodeLogin streams one event: the token once the code is approved, or expired.
func (s *AuthServer) WaitCodeLogin(ctx context.Context, req *connect.Request[kantahev1.WaitCodeLoginRequest], stream *connect.ServerStream[kantahev1.WaitCodeLoginResponse]) error {
	a, err := s.codes.Wait(ctx, req.Msg.LoginId)
	switch {
	case errors.Is(err, auth.ErrCodeNotFound):
		return newErr(connect.CodeNotFound, "unknown or used sign-in")
	case errors.Is(err, auth.ErrCodeBusy):
		return newErr(connect.CodeAborted, "another stream is already waiting for this sign-in")
	case errors.Is(err, auth.ErrCodeExpired):
		return stream.Send(&kantahev1.WaitCodeLoginResponse{Result: &kantahev1.WaitCodeLoginResponse_Expired{Expired: true}})
	case err != nil && ctx.Err() != nil:
		return ctx.Err()
	case err != nil:
		return internalErr(s.d.Logger, "WaitCodeLogin", err)
	}
	return s.issueDevice(ctx, a, func(tok *kantahev1.AuthToken) error {
		return stream.Send(&kantahev1.WaitCodeLoginResponse{Result: &kantahev1.WaitCodeLoginResponse_Approved{Approved: tok}})
	})
}

// issueDevice signs the TV in as the approving user and hands the token to send. When send
// fails the TV never got the token, so the new device is revoked again instead of being left
// signed in with nobody holding it.
func (s *AuthServer) issueDevice(ctx context.Context, a auth.Approval, send func(*kantahev1.AuthToken) error) error {
	u, err := users.ByID(ctx, s.d.DB, a.UserID)
	if errors.Is(err, users.ErrNotFound) || (err == nil && u.Disabled) {
		return newErr(connect.CodePermissionDenied, "account disabled")
	}
	if err != nil {
		return internalErr(s.d.Logger, "WaitCodeLogin", err)
	}
	var tok *kantahev1.AuthToken
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		var err error
		tok, err = s.newSession(ctx, tx, u, a.DeviceName, kantahev1.DeviceType(a.DeviceType))
		return err
	})
	if err != nil {
		return internalErr(s.d.Logger, "WaitCodeLogin", err)
	}
	if err := send(tok); err != nil {
		bg := context.WithoutCancel(ctx)
		_ = s.d.DB.WriteTx(bg, func(tx *sql.Tx) error {
			_, err := users.RevokeDevice(bg, tx, u.ID, tok.DeviceId)
			return err
		})
		return err
	}
	return nil
}
