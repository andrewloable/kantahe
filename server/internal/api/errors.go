// Package api implements the ConnectRPC services on top of the domain packages.
package api

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"connectrpc.com/connect"

	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/users"
)

func newErr(code connect.Code, msg string) error {
	return connect.NewError(code, errors.New(msg))
}

func invalidArgument(msg string) error { return newErr(connect.CodeInvalidArgument, msg) }

// internalErr logs the cause and returns a generic error: internal details
// (SQL text, file paths) never reach the client.
func internalErr(logger *slog.Logger, op string, err error) error {
	if connect.CodeOf(err) != connect.CodeUnknown {
		return err // already a connect error with a code
	}
	logger.Error("request failed", "op", op, "err", err)
	return newErr(connect.CodeInternal, "internal error")
}

// fromUsers maps domain errors to connect codes; anything else is internal.
func fromUsers(logger *slog.Logger, op string, err error) error {
	switch {
	case errors.Is(err, users.ErrNotFound):
		return newErr(connect.CodeNotFound, "not found")
	case errors.Is(err, users.ErrEmailTaken):
		return newErr(connect.CodeAlreadyExists, "email already in use")
	}
	return internalErr(logger, op, err)
}

// requireAdmin returns the caller's identity if they are an admin.
func requireAdmin(ctx context.Context) (auth.Identity, error) {
	id, ok := auth.IdentityFrom(ctx)
	if !ok {
		return id, newErr(connect.CodeUnauthenticated, "sign in required")
	}
	if !id.Admin {
		return id, newErr(connect.CodePermissionDenied, "administrator access required")
	}
	return id, nil
}

// adminOnly is an interceptor that demands the admin role for every AdminService
// procedure, so that RPCs added later are protected before their handler runs.
type adminOnly struct{}

func (adminOnly) check(ctx context.Context, procedure string) error {
	if !strings.HasPrefix(procedure, kantahev1connect.AdminServiceName+"/") && !strings.HasPrefix(procedure, "/"+kantahev1connect.AdminServiceName+"/") {
		return nil
	}
	_, err := requireAdmin(ctx)
	return err
}

func (a adminOnly) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if err := a.check(ctx, req.Spec().Procedure); err != nil {
			return nil, err
		}
		return next(ctx, req)
	}
}

func (adminOnly) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (a adminOnly) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		if err := a.check(ctx, conn.Spec().Procedure); err != nil {
			return err
		}
		return next(ctx, conn)
	}
}
