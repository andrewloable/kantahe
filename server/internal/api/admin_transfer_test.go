package api

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/transfer"
)

// runExport calls ExportData and returns every message of the stream.
func (a *adminEnv) runExport(token, folder string) ([]*kantahev1.ExportDataResponse, error) {
	stream, err := a.adminClient.ExportData(context.Background(), with(connect.NewRequest(&kantahev1.ExportDataRequest{Folder: folder}), token))
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	var out []*kantahev1.ExportDataResponse
	for stream.Receive() {
		out = append(out, stream.Msg())
	}
	return out, stream.Err()
}

func TestExportDataAdminOnly(t *testing.T) {
	a := newAdminEnv(t)
	folder := filepath.Join(t.TempDir(), "export")
	if _, err := a.runExport(a.user.Token, folder); code(err) != connect.CodePermissionDenied {
		t.Fatalf("as a user: %v", err)
	}
	if _, err := a.runExport("", folder); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("without a token: %v", err)
	}
	if _, err := os.Stat(folder); !os.IsNotExist(err) {
		t.Fatalf("nothing may be written for a refused caller: %v", err)
	}
}

func TestExportDataStreamsProgressAndDone(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.karmp3", "One", "Band", false)
	n2 := a.seedVocals(t, "Two.karmp3", "Two")
	folder := filepath.Join(t.TempDir(), "export")
	msgs, err := a.runExport(a.admin.Token, folder)
	if err != nil {
		t.Fatal(err)
	}
	last := msgs[len(msgs)-1]
	if !last.Done || last.Folder != folder || last.FilesTotal == 0 || last.FilesDone != last.FilesTotal || last.BytesDone != last.BytesTotal || len(last.SkippedNumbers) != 0 {
		t.Fatalf("last message %+v", last)
	}
	for _, m := range msgs[:len(msgs)-1] {
		if m.Done {
			t.Fatalf("done before the end: %+v", m)
		}
	}
	if _, err := os.Stat(filepath.Join(folder, "kantahe-export.json")); err != nil {
		t.Fatalf("no manifest: %v", err)
	}
	// a song whose file is gone is reported on the last message
	if err := os.Remove(a.songFile(t, n1)); err != nil {
		t.Fatal(err)
	}
	msgs, err = a.runExport(a.admin.Token, filepath.Join(t.TempDir(), "export"))
	if err != nil {
		t.Fatal(err)
	}
	if got := msgs[len(msgs)-1].SkippedNumbers; len(got) != 1 || got[0] != n1 {
		t.Fatalf("skipped %v, want [%s] (the other song is %s)", got, n1, n2)
	}
}

func (a *adminEnv) songFile(t *testing.T, number string) string {
	t.Helper()
	var p string
	if err := a.db.QueryRow(`SELECT path FROM songs WHERE number = ?`, number).Scan(&p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestExportDataBadFolderIsInvalidArgument(t *testing.T) {
	a := newAdminEnv(t)
	_, err := a.runExport(a.admin.Token, "relative/folder")
	var ce *connect.Error
	if code(err) != connect.CodeInvalidArgument || !errors.As(err, &ce) || !strings.Contains(ce.Message(), "absolute path") {
		t.Fatalf("relative: %v", err)
	}
	if _, err := a.runExport(a.admin.Token, filepath.Join(a.dataDir, "export")); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("inside the data folder: %v", err)
	}
}

func TestExportDataOneAtATime(t *testing.T) {
	a := newAdminEnv(t)
	a.seed(t, "One.karmp3", "One", "Band", false)
	hold := make(chan struct{})
	started := make(chan struct{}, 1)
	a.mounted.admin.exportHook = func() {
		select {
		case started <- struct{}{}:
		default:
		}
		select { // a bounded wait, so that a broken guard fails the test instead of hanging it
		case <-hold:
		case <-time.After(3 * time.Second):
		}
	}
	done := make(chan error, 1)
	go func() {
		_, err := a.runExport(a.admin.Token, filepath.Join(t.TempDir(), "first"))
		done <- err
	}()
	<-started
	second := filepath.Join(t.TempDir(), "second")
	if _, err := a.runExport(a.admin.Token, second); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("a second export while one runs: %v", err)
	}
	if _, err := os.Stat(second); !os.IsNotExist(err) {
		t.Fatalf("the refused export wrote something: %v", err)
	}
	close(hold)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	a.mounted.admin.exportHook = nil
	if _, err := a.runExport(a.admin.Token, second); err != nil {
		t.Fatalf("after the first one ended: %v", err)
	}
}

func TestExportDataFollowsTransferRoot(t *testing.T) {
	root := t.TempDir()
	a := newAdminEnvWith(t, func(d *Deps) { d.TransferRoot = root })
	if _, err := a.runExport(a.admin.Token, filepath.Join(t.TempDir(), "export")); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("outside the root: %v", err)
	}
	if _, err := a.runExport(a.admin.Token, filepath.Join(root, "export")); err != nil {
		t.Fatalf("inside the root: %v", err)
	}
}

// exported makes an export of the server and returns its folder.
func (a *adminEnv) exported(t *testing.T) string {
	t.Helper()
	folder := filepath.Join(t.TempDir(), "export")
	if _, err := a.runExport(a.admin.Token, folder); err != nil {
		t.Fatal(err)
	}
	return folder
}

func (a *adminEnv) inspect(token, folder string) (*kantahev1.InspectExportResponse, error) {
	res, err := a.adminClient.InspectExport(context.Background(), with(connect.NewRequest(&kantahev1.InspectExportRequest{Folder: folder}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

// runImport calls ImportData and returns every message of the stream.
func (a *adminEnv) runImport(token, folder string) ([]*kantahev1.ImportDataResponse, error) {
	stream, err := a.adminClient.ImportData(context.Background(), with(connect.NewRequest(&kantahev1.ImportDataRequest{Folder: folder}), token))
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	var out []*kantahev1.ImportDataResponse
	for stream.Receive() {
		out = append(out, stream.Msg())
	}
	return out, stream.Err()
}

func TestInspectExportReportsCounts(t *testing.T) {
	a := newAdminEnv(t)
	a.seed(t, "One.karmp3", "One", "Band", false)
	folder := a.exported(t)
	r, err := a.inspect(a.admin.Token, folder)
	if err != nil {
		t.Fatal(err)
	}
	if !r.Importable || r.Reason != "" || r.Songs != 1 || r.Users != 2 || r.Videos != 0 || r.ServerName != "Test box" || r.KantaheVersion != "test-1.0" ||
		r.BytesTotal == 0 || r.CreatedUnix != 1767268800 {
		t.Fatalf("%+v", r)
	}
}

func TestInspectExportExplainsARefusalInsteadOfFailing(t *testing.T) {
	a := newAdminEnv(t)
	for name, folder := range map[string]string{"no manifest": t.TempDir(), "relative": "relative/folder", "missing": filepath.Join(t.TempDir(), "nope")} {
		r, err := a.inspect(a.admin.Token, folder)
		if err != nil || r.Importable || r.Reason == "" {
			t.Errorf("%s: %+v %v", name, r, err)
		}
	}
	folder := a.exported(t)
	if err := os.Remove(filepath.Join(folder, "kantahe.db")); err != nil {
		t.Fatal(err)
	}
	if r, err := a.inspect(a.admin.Token, folder); err != nil || r.Importable || !strings.Contains(r.Reason, "kantahe.db") {
		t.Errorf("a file that is gone: %+v %v", r, err)
	}
}

func TestInspectExportAdminOnly(t *testing.T) {
	a := newAdminEnv(t)
	folder := a.exported(t)
	if _, err := a.inspect(a.user.Token, folder); code(err) != connect.CodePermissionDenied {
		t.Fatalf("as a user: %v", err)
	}
	if _, err := a.inspect("", folder); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("without a token: %v", err)
	}
}

func TestImportDataAdminOnly(t *testing.T) {
	a := newAdminEnv(t)
	folder := a.exported(t)
	if _, err := a.runImport(a.user.Token, folder); code(err) != connect.CodePermissionDenied {
		t.Fatalf("as a user: %v", err)
	}
	if _, err := a.runImport("", folder); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("without a token: %v", err)
	}
	if _, err := os.Stat(filepath.Join(a.dataDir, "import-pending")); !os.IsNotExist(err) {
		t.Fatalf("nothing may be staged for a refused caller: %v", err)
	}
}

func TestImportDataBadFolderIsInvalidArgument(t *testing.T) {
	a := newAdminEnv(t)
	for _, folder := range []string{"", "relative", t.TempDir()} {
		if _, err := a.runImport(a.admin.Token, folder); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%q: %v", folder, err)
		}
	}
	if _, err := os.Stat(filepath.Join(a.dataDir, "import-pending")); !os.IsNotExist(err) {
		t.Fatalf("%v", err)
	}
}

func TestImportDataStagesAndAsksForRestart(t *testing.T) {
	restarted := make(chan struct{}, 4)
	a := newAdminEnvWith(t, func(d *Deps) { d.Restart = func() { restarted <- struct{}{} } })
	a.seed(t, "One.karmp3", "One", "Band", false)
	folder := a.exported(t)
	msgs, err := a.runImport(a.admin.Token, folder)
	if err != nil {
		t.Fatal(err)
	}
	last := msgs[len(msgs)-1]
	if !last.Done || !last.Restarting || last.FilesTotal == 0 || last.FilesDone != last.FilesTotal || last.BytesDone != last.BytesTotal {
		t.Fatalf("last message %+v", last)
	}
	if _, err := os.Stat(filepath.Join(a.dataDir, "import-pending", "kantahe.db")); err != nil {
		t.Fatalf("not staged: %v", err)
	}
	// nothing is applied while the server runs: the old data stays in place until the restart
	if _, err := os.Stat(filepath.Join(a.dataDir, "backups")); !os.IsNotExist(err) {
		t.Errorf("the import was applied while the server runs: %v", err)
	}
	// until the restart no other export or import may start
	if _, err := a.runExport(a.admin.Token, filepath.Join(t.TempDir(), "again")); code(err) != connect.CodeFailedPrecondition {
		t.Errorf("export after a staged import: %v", err)
	}
	if _, err := a.runImport(a.admin.Token, folder); code(err) != connect.CodeFailedPrecondition {
		t.Errorf("import after a staged import: %v", err)
	}
	select {
	case <-restarted:
	case <-time.After(5 * time.Second):
		t.Fatal("the server was not asked to restart")
	}
	select {
	case <-restarted:
		t.Fatal("asked to restart twice")
	case <-time.After(1500 * time.Millisecond):
	}
}

func TestImportDataWithoutRestartStagesOnly(t *testing.T) {
	a := newAdminEnv(t) // no Restart: a test server, or one that cannot restart itself
	folder := a.exported(t)
	msgs, err := a.runImport(a.admin.Token, folder)
	if err != nil {
		t.Fatal(err)
	}
	if last := msgs[len(msgs)-1]; !last.Done || last.Restarting {
		t.Fatalf("last message %+v", last)
	}
	if _, err := a.runImport(a.admin.Token, folder); err != nil {
		t.Fatalf("a second import replaces the staged one: %v", err)
	}
}

func TestTransferErrDiskFull(t *testing.T) {
	s := &AdminServer{d: Deps{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}}
	err := s.transferErr("ExportData", fmt.Errorf("x: %w", syscall.ENOSPC))
	var ce *connect.Error
	if code(err) != connect.CodeFailedPrecondition || !errors.As(err, &ce) || !strings.Contains(ce.Message(), "disk is full") || strings.Contains(ce.Message(), "/") {
		t.Fatalf("disk full: %v", err)
	}
	if got := s.transferErr("ExportData", &transfer.FolderError{Msg: "no"}); code(got) != connect.CodeInvalidArgument {
		t.Errorf("a folder error: %v", got)
	}
	if got := s.transferErr("ExportData", errors.New("boom")); code(got) != connect.CodeInternal {
		t.Errorf("another error: %v", got)
	}
}
