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
	"sync"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/settings"
	"github.com/andrewloable/kantahe/server/internal/video"
)

const maxFilenameBytes = 255

// UploadServer implements UploadService.
type UploadServer struct {
	kantahev1connect.UnimplementedUploadServiceHandler
	d Deps

	// background videos (video_upload.go)
	videos  *video.Store
	now     func() time.Time
	beginMu sync.Mutex // one Begin at a time, so that the count of unfinished uploads and the resume lookup are not raced
	locks   sync.Map   // upload id -> *sync.Mutex, one chunk, complete or abort at a time for an upload
}

func newUploadServer(d Deps) *UploadServer {
	now := d.Now
	if now == nil {
		now = time.Now
	}
	return &UploadServer{d: d, videos: video.New(d.DB), now: now}
}

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

// UploadSong stores and imports one .kar or .karmp3. Only administrators upload (the uploader role of a user has no effect since 1.2.0); with
// replace_number set the file replaces the content of that song instead of being added.
func (s *UploadServer) UploadSong(ctx context.Context, req *connect.Request[kantahev1.UploadSongRequest]) (*connect.Response[kantahev1.UploadSongResponse], error) {
	id, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
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
	if req.Msg.ReplaceNumber != "" {
		return s.replace(ctx, id, req.Msg.ReplaceNumber, format, content)
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
	// the name is the SHA-256 of the content: a file that is there already is identical and stays, even while a player reads it
	if err := fsutil.Place(tmp.Name(), finalPath, fsutil.PlaceBudget); err != nil {
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
	s.d.Importer.RemoveIfUnreferenced(ctx, p) // never fails the upload: a file in use is swept later
}

// replace gives an existing song the content of an uploaded file (premise P3 of the epic "Song files": the number and what hangs on it stay).
func (s *UploadServer) replace(ctx context.Context, id auth.Identity, replaceNumber string, format library.Format, content []byte) (*connect.Response[kantahev1.UploadSongResponse], error) {
	number, ok := library.CanonicalNumber(replaceNumber)
	if !ok {
		return rejected("no such song")
	}
	cur, err := library.GetSong(ctx, s.d.DB, number)
	if errors.Is(err, library.ErrNotFound) {
		return rejected("no such song")
	}
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	if cur.Format != format {
		if cur.Format == library.FormatMIDI {
			return rejected("the file must be a .kar, like the song it replaces")
		}
		return rejected("the file must be a .karmp3, like the song it replaces")
	}
	res, err := s.d.Importer.Replace(ctx, number, content)
	var dup *library.DuplicateError
	switch {
	case errors.As(err, &dup):
		return rejected("this file is already the song " + dup.Number)
	case errors.Is(err, library.ErrNotFound):
		return rejected("no such song")
	case errors.Is(err, library.ErrNotWritable), errors.Is(err, library.ErrOutsideManaged):
		return rejected("the file of this song cannot be written")
	case err != nil:
		s.d.Logger.Error("song replace failed", "number", number, "err", err)
		return rejected("the file could not be processed")
	}
	info, err := library.GetSong(ctx, s.d.DB, number)
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	status := kantahev1.UploadStatus_UPLOAD_STATUS_UPDATED
	if res.Unchanged {
		status = kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE
	} else {
		s.d.Logger.Info("song replaced", "number", number, "user", id.UserID)
	}
	song := toProtoSong(info, false)
	if err := markFavourites(ctx, s.d.UserLib, id.UserID, song); err != nil {
		return nil, internalErr(s.d.Logger, "UploadSong", err)
	}
	return connect.NewResponse(&kantahev1.UploadSongResponse{Status: status, Song: song}), nil
}
