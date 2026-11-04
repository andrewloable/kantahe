package main

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/store"
)

func bearer[T any](r *connect.Request[T], token string) *connect.Request[T] {
	r.Header().Set("Authorization", "Bearer "+token)
	return r
}

// The whole product on the Go side: an administrator exports the running server, changes it, and imports the export. The server restarts
// in its own process, on the same address, and has the data of the export.
func TestImportRestartsInProcess(t *testing.T) {
	addr, data, stop := runServerAt(t, "", "--discovery=false", "--render-cache-gb", "0")
	base := "http://" + addr
	ctx := context.Background()
	authc := kantahev1connect.NewAuthServiceClient(httpClient(), base)
	admin := kantahev1connect.NewAdminServiceClient(httpClient(), base)

	setup, err := authc.Setup(ctx, connect.NewRequest(&kantahev1.SetupRequest{Email: "admin@example.com", Password: "password-1234", DisplayName: "Admin", DeviceName: "Laptop", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB}))
	if err != nil {
		t.Fatal(err)
	}
	adminToken := setup.Msg.Auth.Token

	folder := filepath.Join(t.TempDir(), "export")
	exp, err := admin.ExportData(ctx, bearer(connect.NewRequest(&kantahev1.ExportDataRequest{Folder: folder}), adminToken))
	if err != nil {
		t.Fatal(err)
	}
	for exp.Receive() {
	}
	if err := exp.Err(); err != nil {
		t.Fatal(err)
	}

	// after the export: a second user who signs in (a device the export does not know)
	if _, err := admin.CreateUser(ctx, bearer(connect.NewRequest(&kantahev1.CreateUserRequest{Email: "later@example.com", DisplayName: "Later", TemporaryPassword: "password-5678"}), adminToken)); err != nil {
		t.Fatal(err)
	}
	later, err := authc.Login(ctx, connect.NewRequest(&kantahev1.LoginRequest{Email: "later@example.com", Password: "password-5678", DeviceName: "Phone", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID}))
	if err != nil {
		t.Fatal(err)
	}
	users := func() (int, error) {
		res, err := admin.ListUsers(ctx, bearer(connect.NewRequest(&kantahev1.ListUsersRequest{}), adminToken))
		if err != nil {
			return 0, err
		}
		return len(res.Msg.Users), nil
	}
	if n, err := users(); err != nil || n != 2 {
		t.Fatalf("before the import: %d users, %v", n, err)
	}

	imp, err := admin.ImportData(ctx, bearer(connect.NewRequest(&kantahev1.ImportDataRequest{Folder: folder}), adminToken))
	if err != nil {
		t.Fatal(err)
	}
	var last *kantahev1.ImportDataResponse
	for imp.Receive() {
		last = imp.Msg()
	}
	if err := imp.Err(); err != nil || last == nil || !last.Done || !last.Restarting {
		t.Fatalf("import: %v %+v", err, last)
	}

	// the server restarts by itself and answers again on the same address, with the data of the export
	deadline := time.Now().Add(30 * time.Second)
	for {
		n, err := users()
		if err == nil && n == 1 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("the server did not come back with the exported data (%d users, %v)", n, err)
		}
		time.Sleep(100 * time.Millisecond)
	}
	waitHealthy(t, addr)
	if _, err := authc.Login(ctx, connect.NewRequest(&kantahev1.LoginRequest{Email: "later@example.com", Password: "password-5678", DeviceName: "Phone", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_ANDROID})); err == nil {
		t.Error("a user created after the export must be gone")
	}
	if _, err := admin.ListUsers(ctx, bearer(connect.NewRequest(&kantahev1.ListUsersRequest{}), later.Msg.Auth.Token)); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Errorf("a device that signed in after the export must be signed out: %v", err)
	}
	if _, err := authc.Login(ctx, connect.NewRequest(&kantahev1.LoginRequest{Email: "admin@example.com", Password: "password-1234", DeviceName: "Laptop 2", DeviceType: kantahev1.DeviceType_DEVICE_TYPE_WEB})); err != nil {
		t.Errorf("the administrator of the export signs in: %v", err)
	}
	if m, _ := filepath.Glob(filepath.Join(data, "backups", "before-import-*", "kantahe.db")); len(m) != 1 {
		t.Errorf("backups %v", m)
	}
	if _, err := os.Stat(filepath.Join(data, "import-pending")); err == nil {
		t.Error("the staging folder must be gone")
	}
	if code := stop(); code != 0 {
		t.Fatalf("exit code %d after the restart", code)
	}
}

// A staged import that cannot be applied (here a folder that must hold files holds a file) leaves the server as it was.
func TestAnImportThatCannotBeAppliedStartsWithTheCurrentData(t *testing.T) {
	data := filepath.Join(t.TempDir(), "data")
	if err := os.MkdirAll(data, 0o750); err != nil {
		t.Fatal(err)
	}
	db, err := store.Open(context.Background(), data)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users(id, email, display_name, password_hash, admin, created_at) VALUES ('u1', 'old@example.com', 'Old', 'x', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	pending := filepath.Join(data, "import-pending")
	if err := os.MkdirAll(pending, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(pending, "kantahe.db"), []byte("not the one"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(pending, "songs"), []byte("a file where a folder belongs"), 0o600); err != nil {
		t.Fatal(err)
	}
	addr, _, stop := runServerAt(t, data, "--discovery=false", "--render-cache-gb", "0")
	info, err := kantahev1connect.NewAuthServiceClient(httpClient(), "http://"+addr).GetServerInfo(context.Background(), connect.NewRequest(&kantahev1.GetServerInfoRequest{}))
	if err != nil || info.Msg.SetupRequired {
		t.Fatalf("the current data must be used: %+v %v", info, err)
	}
	if m, _ := filepath.Glob(filepath.Join(data, "import-failed-*", "kantahe.db")); len(m) != 1 {
		t.Errorf("the import must be set aside: %v", m)
	}
	if _, err := os.Stat(pending); err == nil {
		t.Error("import-pending must be gone, or it would be tried at every start")
	}
	if code := stop(); code != 0 {
		t.Fatalf("exit code %d", code)
	}
}

func httpClient() *http.Client { return http.DefaultClient }

func TestAnInterruptedSwapDoesNotStartAnEmptyServer(t *testing.T) {
	// the old database is gone (moved to a backup) and the staged one cannot be put in place: the data folder has a folder where the
	// database belongs and the staged database is not there
	data := t.TempDir()
	pending := filepath.Join(data, "import-pending")
	if err := os.MkdirAll(filepath.Join(pending, "songs"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(pending, "kantahe.db"), []byte("the new one"), 0o600); err != nil {
		t.Fatal(err)
	}
	// make step 1 fail with no database in the data folder
	if err := os.WriteFile(filepath.Join(pending, "media"), []byte("a file where a folder belongs"), 0o600); err != nil {
		t.Fatal(err)
	}
	if applyStagedImport(data, slog.New(slog.NewTextHandler(io.Discard, nil))) {
		t.Fatal("with no database in place a failed import must stop the start")
	}
	if _, err := os.Stat(filepath.Join(pending, "kantahe.db")); err != nil {
		t.Errorf("the staged import must stay for the next start: %v", err)
	}
}
