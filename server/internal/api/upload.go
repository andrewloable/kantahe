package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path"
	"path/filepath"
	"strings"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/settings"
)

const maxFilenameBytes = 255

// UploadServer implements UploadService.
type UploadServer struct {
	kantahev1connect.UnimplementedUploadServiceHandler
	d Deps
}

func newUploadServer(d Deps) *UploadServer { return &UploadServer{d: d} }

func rejected(reason string) (*connect.Response[kantahev1.UploadSongResponse], error) {
	return connect.NewResponse(&kantahev1.UploadSongResponse{Status: kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED, Reason: reason}), nil
}

// uploadName reduces a client file name to its base name and finds the format.
// The name is only used for the song number and the title, never as a path.
func uploadName(filename string) (name string, format library.Format, ok bool) {
	name = path.Base(strings.ReplaceAll(filename, `\`, "/"))
	if len(name) < 1 || len(name) > maxFilenameBytes {
		return "", 0, false
	}
	for _, r := range name {
		if r < 0x20 || r == 0x7f {
			return "", 0, false
		}
	}
	ext := strings.ToLower(path.Ext(name))
	if len(name) == len(ext) { // nothing before the extension
		return "", 0, false
	}
	switch ext {
	case ".kar":
		return name, library.FormatMIDI, true
	case ".karmp3":
		return name, library.FormatMP3, true
	}
	return "", 0, false
}

// UploadSong stores and imports one .kar or .karmp3 for users with the uploader role.
func (s *UploadServer) UploadSong(ctx context.Context, req *connect.Request[kantahev1.UploadSongRequest]) (*connect.Response[kantahev1.UploadSongResponse], error) {
	id, ok := auth.IdentityFrom(ctx)
	if !ok {
		return nil, newErr(connect.CodeUnauthenticated, "sign in required")
	}
	if !id.Uploader {
		return nil, newErr(connect.CodePermissionDenied, "upload permission required")
	}
	limit, err := settings.MaxUploadBytes(ctx, s.d.DB)
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	content := req.Msg.Content
	if int64(len(content)) > limit {
		return rejected("file too large")
	}
	name, format, ok := uploadName(req.Msg.Filename)
	if !ok {
		return rejected("unsupported file type")
	}
	if format == library.FormatMIDI && !strings.HasPrefix(string(content[:min(4, len(content))]), "MThd") {
		return rejected("not a valid MIDI file")
	}
	if format == library.FormatMP3 && !strings.HasPrefix(string(content[:min(4, len(content))]), "PK\x03\x04") {
		return rejected("not a valid .karmp3 file")
	}
	if reason := library.CheckContent(format, content); reason != "" {
		return rejected(reason)
	}

	stored, created, err := s.store(content, format)
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	res, err := s.d.Importer.ImportFile(ctx, stored, library.SourceUpload, name)
	if err != nil {
		s.dropIfCreated(ctx, stored, created)
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	if res.Status == library.StatusDuplicate {
		// the content is already in the library; keep our copy only if it is the library's file
		if existing, perr := s.d.Importer.PathOf(ctx, res.Number); perr != nil || existing != stored {
			s.dropIfCreated(ctx, stored, created)
		}
	}
	info, err := library.GetSong(ctx, s.d.DB, res.Number)
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	if info.Failed && res.Status != library.StatusDuplicate {
		// the file passed the checks but could not be prepared (for example the MP3 could not be extracted)
		if derr := s.d.Importer.Discard(ctx, res.Number); derr != nil {
			return nil, internalErr(s.d.Logger, "UploadSong", derr)
		}
		return rejected("the file could not be processed")
	}
	status := kantahev1.UploadStatus_UPLOAD_STATUS_ADDED
	if res.Status == library.StatusDuplicate {
		status = kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE
	}
	song := toProtoSong(info, false)
	if err := markFavourites(ctx, s.d.UserLib, id.UserID, song); err != nil {
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	return connect.NewResponse(&kantahev1.UploadSongResponse{Status: status, Song: song}), nil
}

// store writes the bytes to <data>/songs/<sha256>.<ext> through a temporary
// file; created tells whether the file is new.
func (s *UploadServer) store(content []byte, format library.Format) (finalPath string, created bool, err error) {
	dir := filepath.Join(s.d.DataDir, "songs")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", false, err
	}
	sum := sha256.Sum256(content)
	ext := ".kar"
	if format == library.FormatMP3 {
		ext = ".karmp3"
	}
	finalPath = filepath.Join(dir, hex.EncodeToString(sum[:])+ext)
	_, statErr := os.Stat(finalPath)
	created = errors.Is(statErr, os.ErrNotExist)

	tmp, err := os.CreateTemp(dir, ".upload-*")
	if err != nil {
		return "", false, err
	}
	defer os.Remove(tmp.Name()) // no-op after the rename
	if _, err := tmp.Write(content); err != nil {
		tmp.Close()
		return "", false, err
	}
	if err := tmp.Close(); err != nil {
		return "", false, err
	}
	if err := os.Chmod(tmp.Name(), 0o640); err != nil {
		return "", false, err
	}
	if err := os.Rename(tmp.Name(), finalPath); err != nil {
		return "", false, err
	}
	return finalPath, created, nil
}

func (s *UploadServer) dropIfCreated(ctx context.Context, p string, created bool) {
	if created {
		s.dropUnreferenced(ctx, p)
	}
}

// dropUnreferenced removes a stored upload unless a song entry points at it: a
// concurrent upload of the same bytes shares the file.
func (s *UploadServer) dropUnreferenced(ctx context.Context, p string) {
	if used, err := s.d.Importer.IsReferenced(ctx, p); err != nil || used {
		return
	}
	if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
		s.d.Logger.Warn("cannot remove a rejected upload", "err", err)
	}
}
