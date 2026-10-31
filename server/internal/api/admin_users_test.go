package api

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

type adminEnv struct {
	*testEnv
	admin *kantahev1.AuthToken // the first admin from Setup
	user  *kantahev1.AuthToken // a regular user
}

func newAdminEnv(t *testing.T) *adminEnv {
	t.Helper()
	e := newEnv(t)
	admin := e.setup(t, "admin@example.com", "password1")
	e.addUser(t, "user@example.com", "password1")
	user, err := e.login("user@example.com", "password1", "Phone")
	if err != nil {
		t.Fatal(err)
	}
	return &adminEnv{e, admin, user}
}

func (a *adminEnv) createUser(t *testing.T, email, pw string, admin, uploader bool) *kantahev1.User {
	t.Helper()
	res, err := a.adminClient.CreateUser(context.Background(), with(connect.NewRequest(&kantahev1.CreateUserRequest{
		Email: email, DisplayName: "New", TemporaryPassword: pw, Admin: admin, Uploader: uploader}), a.admin.Token))
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return res.Msg.User
}

func TestNonAdminDenied(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	tok := a.user.Token
	calls := map[string]func() error{
		"ListUsers": func() error {
			_, err := a.adminClient.ListUsers(ctx, with(connect.NewRequest(&kantahev1.ListUsersRequest{}), tok))
			return err
		},
		"CreateUser": func() error {
			_, err := a.adminClient.CreateUser(ctx, with(connect.NewRequest(&kantahev1.CreateUserRequest{Email: "x@example.com", DisplayName: "X", TemporaryPassword: "password1"}), tok))
			return err
		},
		"UpdateUser": func() error {
			_, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: a.admin.User.Id}), tok))
			return err
		},
		"ResetPassword": func() error {
			_, err := a.adminClient.ResetPassword(ctx, with(connect.NewRequest(&kantahev1.ResetPasswordRequest{UserId: a.admin.User.Id, TemporaryPassword: "password9"}), tok))
			return err
		},
		"DeleteUser": func() error {
			_, err := a.adminClient.DeleteUser(ctx, with(connect.NewRequest(&kantahev1.DeleteUserRequest{UserId: a.admin.User.Id}), tok))
			return err
		},
		"RevokeUserDevices": func() error {
			_, err := a.adminClient.RevokeUserDevices(ctx, with(connect.NewRequest(&kantahev1.RevokeUserDevicesRequest{UserId: a.admin.User.Id}), tok))
			return err
		},
		"DeleteSong": func() error {
			_, err := a.adminClient.DeleteSong(ctx, with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: "1"}), tok))
			return err
		},
		"UpdateServerSettings": func() error {
			_, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{}), tok))
			return err
		},
		"UpdateSong": func() error {
			_, err := a.adminClient.UpdateSong(ctx, with(connect.NewRequest(&kantahev1.UpdateSongRequest{Number: "1"}), tok))
			return err
		},
		"Rescan": func() error {
			_, err := a.adminClient.Rescan(ctx, with(connect.NewRequest(&kantahev1.RescanRequest{}), tok))
			return err
		},
		"GetServerSettings": func() error {
			_, err := a.adminClient.GetServerSettings(ctx, with(connect.NewRequest(&kantahev1.GetServerSettingsRequest{}), tok))
			return err
		},
	}
	for name, call := range calls {
		if err := call(); code(err) != connect.CodePermissionDenied {
			t.Errorf("%s: err = %v, want PermissionDenied", name, err)
		}
	}
	if _, err := a.adminClient.ListUsers(ctx, connect.NewRequest(&kantahev1.ListUsersRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("no token: %v", err)
	}
	// the admin gets through
	if _, err := a.adminClient.Rescan(ctx, with(connect.NewRequest(&kantahev1.RescanRequest{}), a.admin.Token)); err != nil {
		t.Errorf("admin Rescan: %v", err)
	}
}

func TestListUsersOrderedByEmail(t *testing.T) {
	a := newAdminEnv(t)
	a.createUser(t, "zed@example.com", "password1", false, false)
	a.createUser(t, "bob@example.com", "password1", false, true)
	res, err := a.adminClient.ListUsers(context.Background(), with(connect.NewRequest(&kantahev1.ListUsersRequest{}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	var emails []string
	for _, u := range res.Msg.Users {
		emails = append(emails, u.Email)
	}
	if got := strings.Join(emails, ","); got != "admin@example.com,bob@example.com,user@example.com,zed@example.com" {
		t.Fatalf("emails = %s", got)
	}
}

func TestCreateUserMustChange(t *testing.T) {
	a := newAdminEnv(t)
	u := a.createUser(t, "New@Example.com", "temp-password", false, true)
	if !u.MustChangePassword || !u.Uploader || u.Admin || u.Email != "new@example.com" || u.Id == "" {
		t.Fatalf("created user: %+v", u)
	}
	tok, err := a.login("new@example.com", "temp-password", "Phone")
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err := a.auth.ListMyDevices(ctx, with(connect.NewRequest(&kantahev1.ListMyDevicesRequest{}), tok.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("a user who must change the password: %v", err)
	}
	if _, err := a.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "temp-password", NewPassword: "my-new-password"}), tok.Token)); err != nil {
		t.Fatalf("ChangePassword: %v", err)
	}
}

func TestCreateUserValidation(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	bad := []*kantahev1.CreateUserRequest{
		{Email: "A <a@b.c>", DisplayName: "A", TemporaryPassword: "password1"},
		{Email: "a@b.c", DisplayName: "", TemporaryPassword: "password1"},
		{Email: "a@b.c", DisplayName: "A", TemporaryPassword: "short"},
	}
	for i, r := range bad {
		if _, err := a.adminClient.CreateUser(ctx, with(connect.NewRequest(r), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
			t.Errorf("case %d: %v", i, err)
		}
	}
}

func TestCreateDuplicate(t *testing.T) {
	a := newAdminEnv(t)
	a.createUser(t, "dup@example.com", "password1", false, false)
	_, err := a.adminClient.CreateUser(context.Background(), with(connect.NewRequest(&kantahev1.CreateUserRequest{
		Email: "DUP@example.com", DisplayName: "D", TemporaryPassword: "password1"}), a.admin.Token))
	if code(err) != connect.CodeAlreadyExists {
		t.Fatalf("err = %v", err)
	}
}

func TestUpdatePartial(t *testing.T) {
	a := newAdminEnv(t)
	u := a.createUser(t, "p@example.com", "password1", false, false)
	up := true
	res, err := a.adminClient.UpdateUser(context.Background(), with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: u.Id, Uploader: &up}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	if !res.Msg.User.Uploader || res.Msg.User.DisplayName != "New" || res.Msg.User.Admin || res.Msg.User.Disabled {
		t.Fatalf("only uploader may change: %+v", res.Msg.User)
	}
	name := "  Renamed  "
	res, _ = a.adminClient.UpdateUser(context.Background(), with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: u.Id, DisplayName: &name}), a.admin.Token))
	if res.Msg.User.DisplayName != "Renamed" || !res.Msg.User.Uploader {
		t.Fatalf("%+v", res.Msg.User)
	}
	empty := " "
	if _, err := a.adminClient.UpdateUser(context.Background(), with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: u.Id, DisplayName: &empty}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("blank name: %v", err)
	}
}

func TestLastAdminProtected(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	no, yes := false, true
	id := a.admin.User.Id
	// another admin, so that the admin may change themself, but not into nothing
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: id, Admin: &no}), a.admin.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("remove admin from the only admin: %v", err)
	}
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: id, Disabled: &yes}), a.admin.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("disable the only admin: %v", err)
	}
	if _, err := a.adminClient.DeleteUser(ctx, with(connect.NewRequest(&kantahev1.DeleteUserRequest{UserId: id}), a.admin.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("delete the only admin: %v", err)
	}
	// a second admin makes the first removable from the second one's session
	second := a.createUser(t, "second@example.com", "password1", true, false)
	tok2, err := a.login("second@example.com", "password1", "x")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "password1", NewPassword: "password2"}), tok2.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: id, Admin: &no}), tok2.Token)); err != nil {
		t.Fatalf("with a second admin the first can lose the role: %v", err)
	}
	// ... and now `second` is the only admin again
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: second.Id, Admin: &no}), tok2.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("the new last admin must be protected: %v", err)
	}
}

func TestDisabledAdminDoesNotCountAsAnAdmin(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	yes := true
	other := a.createUser(t, "other@example.com", "password1", true, false)
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: other.Id, Disabled: &yes}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	// the only enabled admin is now a.admin again: it may not be disabled by anyone, itself included
	if _, err := a.adminClient.DeleteUser(ctx, with(connect.NewRequest(&kantahev1.DeleteUserRequest{UserId: a.admin.User.Id}), a.admin.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("%v", err)
	}
	// a disabled admin can be deleted
	if _, err := a.adminClient.DeleteUser(ctx, with(connect.NewRequest(&kantahev1.DeleteUserRequest{UserId: other.Id}), a.admin.Token)); err != nil {
		t.Fatalf("deleting a disabled admin: %v", err)
	}
}

func TestDisableRevokes(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	yes := true
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: a.user.User.Id, Disabled: &yes}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := a.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), a.user.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("a disabled user's token: %v", err)
	}
	if _, err := a.login("user@example.com", "password1", "Phone"); code(err) != connect.CodePermissionDenied {
		t.Fatalf("a disabled user cannot sign in: %v", err)
	}
	var revoked int
	_ = a.db.QueryRow(`SELECT COUNT(*) FROM devices WHERE user_id=? AND revoked=0`, a.user.User.Id).Scan(&revoked)
	if revoked != 0 {
		t.Fatalf("%d devices left active", revoked)
	}
	// re-enabling works and the user can sign in again
	no := false
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: a.user.User.Id, Disabled: &no}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := a.login("user@example.com", "password1", "Phone"); err != nil {
		t.Fatalf("after re-enabling: %v", err)
	}
}

func TestDisableSelfRefused(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	a.createUser(t, "second@example.com", "password1", true, false)
	yes := true
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: a.admin.User.Id, Disabled: &yes}), a.admin.Token)); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("disable yourself: %v", err)
	}
}

func TestResetPassword(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	if _, err := a.adminClient.ResetPassword(ctx, with(connect.NewRequest(&kantahev1.ResetPasswordRequest{UserId: a.user.User.Id, TemporaryPassword: "temp-pass-1"}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := a.login("user@example.com", "password1", "x"); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("old password: %v", err)
	}
	tok, err := a.login("user@example.com", "temp-pass-1", "x")
	if err != nil || !tok.User.MustChangePassword {
		t.Fatalf("temp password: %v %+v", err, tok)
	}
	if _, err := a.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), a.user.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("old devices must be revoked: %v", err)
	}
	if _, err := a.adminClient.ResetPassword(ctx, with(connect.NewRequest(&kantahev1.ResetPasswordRequest{UserId: a.user.User.Id, TemporaryPassword: "short"}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("weak temp password: %v", err)
	}
}

func TestDeleteUser(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	if _, err := a.adminClient.DeleteUser(ctx, with(connect.NewRequest(&kantahev1.DeleteUserRequest{UserId: a.user.User.Id}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	var n int
	_ = a.db.QueryRow(`SELECT COUNT(*) FROM devices WHERE user_id=?`, a.user.User.Id).Scan(&n)
	if n != 0 {
		t.Fatalf("devices of a deleted user must cascade, %d left", n)
	}
	if _, err := a.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), a.user.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("token of a deleted user: %v", err)
	}
}

func TestDeleteSelf(t *testing.T) {
	a := newAdminEnv(t)
	a.createUser(t, "second@example.com", "password1", true, false)
	_, err := a.adminClient.DeleteUser(context.Background(), with(connect.NewRequest(&kantahev1.DeleteUserRequest{UserId: a.admin.User.Id}), a.admin.Token))
	if code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("err = %v", err)
	}
}

func TestRevokeUserDevices(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	if _, err := a.login("user@example.com", "password1", "Tablet"); err != nil {
		t.Fatal(err)
	}
	res, err := a.adminClient.RevokeUserDevices(ctx, with(connect.NewRequest(&kantahev1.RevokeUserDevicesRequest{UserId: a.user.User.Id}), a.admin.Token))
	if err != nil || res.Msg.Revoked != 2 {
		t.Fatalf("%v %v", res, err)
	}
	if _, err := a.auth.Me(ctx, with(connect.NewRequest(&kantahev1.MeRequest{}), a.user.Token)); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("%v", err)
	}
	res, _ = a.adminClient.RevokeUserDevices(ctx, with(connect.NewRequest(&kantahev1.RevokeUserDevicesRequest{UserId: a.user.User.Id}), a.admin.Token))
	if res.Msg.Revoked != 0 {
		t.Fatalf("second time revoked = %d", res.Msg.Revoked)
	}
}

func TestUnknownUser(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	tok := a.admin.Token
	yes := true
	for name, err := range map[string]error{
		"UpdateUser": func() error {
			_, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: "nope", Disabled: &yes}), tok))
			return err
		}(),
		"ResetPassword": func() error {
			_, err := a.adminClient.ResetPassword(ctx, with(connect.NewRequest(&kantahev1.ResetPasswordRequest{UserId: "nope", TemporaryPassword: "password9"}), tok))
			return err
		}(),
		"DeleteUser": func() error {
			_, err := a.adminClient.DeleteUser(ctx, with(connect.NewRequest(&kantahev1.DeleteUserRequest{UserId: "nope"}), tok))
			return err
		}(),
		"RevokeUserDevices": func() error {
			_, err := a.adminClient.RevokeUserDevices(ctx, with(connect.NewRequest(&kantahev1.RevokeUserDevicesRequest{UserId: "nope"}), tok))
			return err
		}(),
	} {
		if code(err) != connect.CodeNotFound {
			t.Errorf("%s: err = %v, want NotFound", name, err)
		}
	}
}

func TestAdminRoleChangeAppliesImmediately(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	yes := true
	if _, err := a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: a.user.User.Id, Admin: &yes}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	// the same token now has admin rights (flags are read per request)
	if _, err := a.adminClient.ListUsers(ctx, with(connect.NewRequest(&kantahev1.ListUsersRequest{}), a.user.Token)); err != nil {
		t.Fatalf("new admin: %v", err)
	}
}

// every method of the AdminService descriptor, present and future, must refuse a non-admin
func TestEveryAdminRPCRefusesNonAdmins(t *testing.T) {
	a := newAdminEnv(t)
	methods := kantahev1.File_kantahe_v1_admin_proto.Services().ByName("AdminService").Methods()
	if methods.Len() < 11 {
		t.Fatalf("only %d methods in the descriptor", methods.Len())
	}
	for i := 0; i < methods.Len(); i++ {
		name := string(methods.Get(i).Name())
		req, _ := http.NewRequest("POST", a.srv.URL+"/kantahe.v1.AdminService/"+name, strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+a.user.Token)
		res, err := a.srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusForbidden {
			t.Errorf("%s: HTTP %d for a non-admin, want 403 (permission_denied)", name, res.StatusCode)
		}
	}
}

func TestConcurrentDemotionsKeepOneAdmin(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	second := a.createUser(t, "second@example.com", "password1", true, false)
	tok2, err := a.login("second@example.com", "password1", "x")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.auth.ChangePassword(ctx, with(connect.NewRequest(&kantahev1.ChangePasswordRequest{CurrentPassword: "password1", NewPassword: "password2"}), tok2.Token)); err != nil {
		t.Fatal(err)
	}
	no := false
	var wg sync.WaitGroup
	results := make([]error, 2)
	for i, c := range []struct{ token, target string }{{a.admin.Token, second.Id}, {tok2.Token, a.admin.User.Id}} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, results[i] = a.adminClient.UpdateUser(ctx, with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: c.target, Admin: &no}), c.token))
		}()
	}
	wg.Wait()
	var n int
	_ = a.db.QueryRow(`SELECT COUNT(*) FROM users WHERE admin=1 AND disabled=0`).Scan(&n)
	if n < 1 {
		t.Fatalf("no administrator left: %v / %v", results[0], results[1])
	}
}

func TestUpdateUserWithoutFieldsChangesNothing(t *testing.T) {
	a := newAdminEnv(t)
	res, err := a.adminClient.UpdateUser(context.Background(), with(connect.NewRequest(&kantahev1.UpdateUserRequest{UserId: a.user.User.Id}), a.admin.Token))
	if err != nil || res.Msg.User.DisplayName != "User" || res.Msg.User.Admin || res.Msg.User.Disabled {
		t.Fatalf("%v %v", res, err)
	}
}
