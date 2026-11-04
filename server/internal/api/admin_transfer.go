package api

import (
	"context"
	"errors"
	"path/filepath"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/transfer"
)

// Moving a whole server (docs/PLAN.md section 6): the administrator exports into a folder on the server's disk. The AdminService
// handler has the adminOnly interceptor, and each method asks for the role again, like the others.

// progressEvery is the least time between two progress messages of an export or an import.
const progressEvery = 250 * time.Millisecond

func (s *AdminServer) exportOptions() transfer.ExportOptions {
	return transfer.ExportOptions{DB: s.d.DB, DataDir: s.d.DataDir, Libraries: s.d.Libraries, Root: s.d.TransferRoot,
		Version: s.d.Version, ServerName: s.d.Name, Now: s.d.Now, Logger: s.d.Logger}
}

// transferErr turns a refusal that the administrator can fix into INVALID_ARGUMENT with its text; anything else is internal.
func (s *AdminServer) transferErr(op string, err error) error {
	var fe *transfer.FolderError
	if errors.As(err, &fe) {
		return invalidArgument(fe.Msg)
	}
	if transfer.IsDiskFull(err) {
		return newErr(connect.CodeFailedPrecondition, "the disk is full: free some space and try again. An export that stopped leaves an incomplete folder; delete it")
	}
	return internalErr(s.d.Logger, op, err)
}

// ExportData writes a copy of the whole server into a new or empty folder and streams its progress.
func (s *AdminServer) ExportData(ctx context.Context, req *connect.Request[kantahev1.ExportDataRequest], stream *connect.ServerStream[kantahev1.ExportDataResponse]) error {
	if _, err := requireAdmin(ctx); err != nil {
		return err
	}
	if !s.transferring.CompareAndSwap(false, true) {
		return newErr(connect.CodeFailedPrecondition, "an export or import is already running")
	}
	defer s.transferring.Store(false)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	var (
		last    time.Time
		latest  transfer.Progress
		sendErr error
	)
	report := func(p transfer.Progress) {
		latest = p
		if s.exportHook != nil {
			s.exportHook()
		}
		if sendErr != nil || time.Since(last) < progressEvery {
			return
		}
		last = time.Now()
		if sendErr = stream.Send(&kantahev1.ExportDataResponse{FilesDone: int32(p.FilesDone), FilesTotal: int32(p.FilesTotal), BytesDone: p.BytesDone, BytesTotal: p.BytesTotal}); sendErr != nil {
			cancel() // nobody is listening: stop copying
		}
	}
	s.d.Logger.Info("export started", "folder", req.Msg.Folder)
	skipped, err := transfer.Export(ctx, req.Msg.Folder, s.exportOptions(), report)
	if err != nil {
		if ctx.Err() != nil {
			return nil // the client went away; nobody is left to tell
		}
		return s.transferErr("ExportData", err)
	}
	s.d.Logger.Info("export finished", "files", latest.FilesDone, "bytes", latest.BytesDone, "skipped", len(skipped))
	return stream.Send(&kantahev1.ExportDataResponse{FilesDone: int32(latest.FilesDone), FilesTotal: int32(latest.FilesTotal),
		BytesDone: latest.BytesDone, BytesTotal: latest.BytesTotal, Done: true, SkippedNumbers: skipped, Folder: filepath.Clean(req.Msg.Folder)})
}

func (s *AdminServer) importOptions() transfer.ImportOptions {
	return transfer.ImportOptions{DataDir: s.d.DataDir, Root: s.d.TransferRoot, Logger: s.d.Logger}
}

// InspectExport reads the manifest of an export folder. A folder that cannot be imported is an answer (importable false, and why), not
// an error of the call, so that the page can show the reason beside the folder that was typed.
func (s *AdminServer) InspectExport(ctx context.Context, req *connect.Request[kantahev1.InspectExportRequest]) (*connect.Response[kantahev1.InspectExportResponse], error) {
	if _, err := requireAdmin(ctx); err != nil {
		return nil, err
	}
	refused := func(err error) (*connect.Response[kantahev1.InspectExportResponse], error) {
		var fe *transfer.FolderError
		if errors.As(err, &fe) {
			return connect.NewResponse(&kantahev1.InspectExportResponse{Reason: fe.Msg}), nil
		}
		return nil, internalErr(s.d.Logger, "InspectExport", err)
	}
	folder, err := transfer.CheckImportFolder(req.Msg.Folder, s.importOptions())
	if err != nil {
		return refused(err)
	}
	m, err := transfer.ReadManifest(folder)
	if err == nil {
		err = transfer.CheckFilesPresent(folder, m)
	}
	if err != nil {
		return refused(err)
	}
	return connect.NewResponse(&kantahev1.InspectExportResponse{
		ServerName: m.ServerName, KantaheVersion: m.KantaheVersion, CreatedUnix: m.CreatedUnix,
		Songs: int32(m.Counts.Songs), Users: int32(m.Counts.Users), Videos: int32(m.Counts.Videos), BytesTotal: m.TotalBytes(), Importable: true,
	}), nil
}

// restartDelay is how long after the last message of an import the server restarts: the message must reach the client first, and
// the restart cancels every request still open. Long enough for a local network, short enough not to be noticed.
const restartDelay = time.Second

// ImportData checks an export folder and stages it. It never touches the running data: the server restarts afterwards (when Deps.Restart
// is set), and the import is applied while nothing is running. Until then no other export or import may start.
func (s *AdminServer) ImportData(ctx context.Context, req *connect.Request[kantahev1.ImportDataRequest], stream *connect.ServerStream[kantahev1.ImportDataResponse]) error {
	if _, err := requireAdmin(ctx); err != nil {
		return err
	}
	if !s.transferring.CompareAndSwap(false, true) {
		return newErr(connect.CodeFailedPrecondition, "an export or import is already running")
	}
	restarting := false
	defer func() {
		if !restarting {
			s.transferring.Store(false)
		}
	}()

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	var (
		last    time.Time
		latest  transfer.Progress
		sendErr error
	)
	report := func(p transfer.Progress) {
		latest = p
		if sendErr != nil || time.Since(last) < progressEvery {
			return
		}
		last = time.Now()
		if sendErr = stream.Send(&kantahev1.ImportDataResponse{FilesDone: int32(p.FilesDone), FilesTotal: int32(p.FilesTotal), BytesDone: p.BytesDone, BytesTotal: p.BytesTotal}); sendErr != nil {
			cancel() // nobody is listening: stop copying
		}
	}
	s.d.Logger.Info("import started", "folder", req.Msg.Folder)
	if err := transfer.Stage(ctx, req.Msg.Folder, s.importOptions(), report); err != nil {
		if ctx.Err() != nil {
			return nil // the client went away; nothing was staged
		}
		return s.transferErr("ImportData", err)
	}
	s.d.Logger.Info("import staged", "files", latest.FilesDone, "bytes", latest.BytesDone, "restart", s.d.Restart != nil)
	restarting = s.d.Restart != nil
	err := stream.Send(&kantahev1.ImportDataResponse{FilesDone: int32(latest.FilesDone), FilesTotal: int32(latest.FilesTotal),
		BytesDone: latest.BytesDone, BytesTotal: latest.BytesTotal, Done: true, Restarting: restarting})
	if restarting {
		time.AfterFunc(restartDelay, s.d.Restart)
	}
	return err
}
