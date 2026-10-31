package api

import (
	"context"
	"database/sql"
	"errors"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/users"
)

// AdminServer implements AdminService. The song and settings RPCs stay
// unimplemented (the embedded handler) until their task.
type AdminServer struct {
	kantahev1connect.UnimplementedAdminServiceHandler
	d Deps
	h *hasher
}

func newAdminServer(d Deps, h *hasher) *AdminServer { return &AdminServer{d: d, h: h} }

var errLastAdmin = errors.New("there must be at least one enabled administrator")

func lastAdmin() error { return newErr(connect.CodeFailedPrecondition, errLastAdmin.Error()) }

// ListUsers lists every account ordered by email.
func (s *AdminServer) ListUsers(ctx context.Context, _ *connect.Request[kantahev1.ListUsersRequest]) (*connect.Response[kantahev1.ListUsersResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	list, err := users.List(ctx, s.d.DB)
	if err != nil {
		return nil, internalErr(s.d.Logger, "ListUsers", err)
	}
	out := &kantahev1.ListUsersResponse{}
	for _, u := range list {
		out.Users = append(out.Users, toProtoUser(u))
	}
	return connect.NewResponse(out), nil
}

// CreateUser creates an account with a temporary password the user must change.
func (s *AdminServer) CreateUser(ctx context.Context, req *connect.Request[kantahev1.CreateUserRequest]) (*connect.Response[kantahev1.CreateUserResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	m := req.Msg
	email, err := validEmail(m.Email)
	if err != nil {
		return nil, err
	}
	display, err := validName("display name", m.DisplayName)
	if err != nil {
		return nil, err
	}
	if err := auth.ValidatePassword(m.TemporaryPassword); err != nil {
		return nil, invalidArgument(err.Error())
	}
	hash, err := s.h.hash(ctx, m.TemporaryPassword)
	if err != nil {
		return nil, internalErr(s.d.Logger, "CreateUser", err)
	}
	u := users.User{
		ID: users.NewID(), Email: email, DisplayName: display, PasswordHash: hash,
		Admin: m.Admin, Uploader: m.Uploader, MustChangePassword: true, CreatedAt: s.d.Now().Unix(),
	}
	if err := s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error { return users.Create(ctx, tx, u) }); err != nil {
		return nil, fromUsers(s.d.Logger, "CreateUser", err)
	}
	return connect.NewResponse(&kantahev1.CreateUserResponse{User: toProtoUser(u)}), nil
}

// UpdateUser changes only the fields that are set.
func (s *AdminServer) UpdateUser(ctx context.Context, req *connect.Request[kantahev1.UpdateUserRequest]) (*connect.Response[kantahev1.UpdateUserResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	var name string
	if m.DisplayName != nil {
		if name, err = validName("display name", m.GetDisplayName()); err != nil {
			return nil, err
		}
	}
	var out users.User
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		u, err := users.ByID(ctx, tx, m.UserId)
		if err != nil {
			return err
		}
		wasEnabledAdmin := u.Admin && !u.Disabled
		if m.DisplayName != nil {
			u.DisplayName = name
		}
		if m.Admin != nil {
			u.Admin = m.GetAdmin()
		}
		if m.Uploader != nil {
			u.Uploader = m.GetUploader()
		}
		if m.Disabled != nil {
			u.Disabled = m.GetDisabled()
		}
		if u.Disabled && u.ID == caller.UserID {
			return newErr(connect.CodeFailedPrecondition, "you cannot disable your own account")
		}
		if wasEnabledAdmin && (!u.Admin || u.Disabled) {
			if n, err := users.CountEnabledAdmins(ctx, tx); err != nil {
				return err
			} else if n <= 1 {
				return lastAdmin()
			}
		}
		if err := users.Update(ctx, tx, u); err != nil {
			return err
		}
		if m.Disabled != nil && u.Disabled {
			if _, err := users.RevokeAll(ctx, tx, u.ID); err != nil {
				return err
			}
		}
		out = u
		return nil
	})
	if err != nil {
		return nil, fromUsers(s.d.Logger, "UpdateUser", err)
	}
	return connect.NewResponse(&kantahev1.UpdateUserResponse{User: toProtoUser(out)}), nil
}

// ResetPassword sets a temporary password, forces a change and signs the user out everywhere.
func (s *AdminServer) ResetPassword(ctx context.Context, req *connect.Request[kantahev1.ResetPasswordRequest]) (*connect.Response[kantahev1.ResetPasswordResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	m := req.Msg
	if err := auth.ValidatePassword(m.TemporaryPassword); err != nil {
		return nil, invalidArgument(err.Error())
	}
	if _, err := users.ByID(ctx, s.d.DB, m.UserId); err != nil {
		return nil, fromUsers(s.d.Logger, "ResetPassword", err)
	}
	hash, err := s.h.hash(ctx, m.TemporaryPassword)
	if err != nil {
		return nil, internalErr(s.d.Logger, "ResetPassword", err)
	}
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		if err := users.SetPassword(ctx, tx, m.UserId, hash, true); err != nil {
			return err
		}
		_, err := users.RevokeAll(ctx, tx, m.UserId)
		return err
	})
	if err != nil {
		return nil, fromUsers(s.d.Logger, "ResetPassword", err)
	}
	return connect.NewResponse(&kantahev1.ResetPasswordResponse{}), nil
}

// DeleteUser removes an account other than the caller's and the last enabled admin.
func (s *AdminServer) DeleteUser(ctx context.Context, req *connect.Request[kantahev1.DeleteUserRequest]) (*connect.Response[kantahev1.DeleteUserResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	id := req.Msg.UserId
	if id == caller.UserID {
		return nil, newErr(connect.CodeFailedPrecondition, "you cannot delete your own account")
	}
	err = s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		u, err := users.ByID(ctx, tx, id)
		if err != nil {
			return err
		}
		if u.Admin && !u.Disabled {
			if n, err := users.CountEnabledAdmins(ctx, tx); err != nil {
				return err
			} else if n <= 1 {
				return lastAdmin()
			}
		}
		return users.Delete(ctx, tx, id)
	})
	if err != nil {
		return nil, fromUsers(s.d.Logger, "DeleteUser", err)
	}
	return connect.NewResponse(&kantahev1.DeleteUserResponse{}), nil
}

// RevokeUserDevices signs a user out of every device.
func (s *AdminServer) RevokeUserDevices(ctx context.Context, req *connect.Request[kantahev1.RevokeUserDevicesRequest]) (*connect.Response[kantahev1.RevokeUserDevicesResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	var n int
	err := s.d.DB.WriteTx(ctx, func(tx *sql.Tx) error {
		if _, err := users.ByID(ctx, tx, req.Msg.UserId); err != nil {
			return err
		}
		var err error
		n, err = users.RevokeAll(ctx, tx, req.Msg.UserId)
		return err
	})
	if err != nil {
		return nil, fromUsers(s.d.Logger, "RevokeUserDevices", err)
	}
	return connect.NewResponse(&kantahev1.RevokeUserDevicesResponse{Revoked: int32(n)}), nil
}
