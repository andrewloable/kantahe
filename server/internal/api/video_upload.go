package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/settings"
	"github.com/andrewloable/kantahe/server/internal/video"
)

// Background video upload (docs/PLAN.md section 4.2): a video is too big for one message, so it goes up in chunks of unary calls
// that append to <data>/videos/.upload-<id>. Begin, Chunk, Complete and Abort are for the administrator only; the UploadService has
// no adminOnly interceptor, so each method asks for the role itself.
const (
	videoChunkSize    = 4 << 20 // the chunk size told to the client
	maxVideoChunk     = 8 << 20 // the largest chunk accepted
	maxVideoUploads   = 2       // unfinished uploads at once
	videoUploadTTL    = 24 * time.Hour
	videoCleanupEvery = time.Hour
	partPrefix        = ".upload-"
)

var uploadIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

// videoUpload is a row of video_uploads.
type videoUpload struct {
	id, userID, filename string
	size, received       int64
}

func (s *UploadServer) videosDir() string { return filepath.Join(s.d.DataDir, "videos") }

// partPath is the partial file of an upload. id comes from a row of the table, never from the client, so it is always 32 hex digits.
func (s *UploadServer) partPath(id string) string { return filepath.Join(s.videosDir(), partPrefix+id) }

func (s *UploadServer) lockFor(id string) *sync.Mutex {
	m, _ := s.locks.LoadOrStore(id, &sync.Mutex{})
	return m.(*sync.Mutex)
}

func beginRejected(reason string) (*connect.Response[kantahev1.BeginVideoUploadResponse], error) {
	return connect.NewResponse(&kantahev1.BeginVideoUploadResponse{Status: kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED, Reason: reason}), nil
}

func completeRejected(reason string) (*connect.Response[kantahev1.CompleteVideoUploadResponse], error) {
	return connect.NewResponse(&kantahev1.CompleteVideoUploadResponse{Status: kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED, Reason: reason}), nil
}

// videoUploadName reduces a client file name to its base name; only .mp4, .m4v and .mov are accepted. It is never used as a path.
func videoUploadName(filename string) (string, bool) {
	name := path.Base(strings.ReplaceAll(filename, `\`, "/"))
	if len(name) < 1 || len(name) > maxFilenameBytes {
		return "", false
	}
	for _, r := range name {
		if r < 0x20 || r == 0x7f {
			return "", false
		}
	}
	ext := strings.ToLower(path.Ext(name))
	if len(name) == len(ext) { // nothing before the extension
		return "", false
	}
	switch ext {
	case ".mp4", ".m4v", ".mov":
		return name, true
	}
	return "", false
}

// tidyVideoName is the name shown for an uploaded file: the file name without its extension, underscores as spaces, spaces collapsed.
func tidyVideoName(filename string) string {
	name := strings.TrimSuffix(filename, path.Ext(filename))
	name = strings.Join(strings.Fields(strings.ReplaceAll(name, "_", " ")), " ")
	if r := []rune(name); len(r) > 200 {
		name = strings.TrimSpace(string(r[:200]))
	}
	if name == "" || !utf8.ValidString(name) {
		return "Video"
	}
	return name
}

// overLimit is the refusal text when size is above the limit of the moment, or "". The limit is read again at every chunk and at
// Complete: an administrator may lower it while an upload is under way.
func (s *UploadServer) overLimit(ctx context.Context, size int64) (string, error) {
	limit, err := settings.MaxVideoBytes(ctx, s.d.DB)
	if err != nil {
		return "", err
	}
	if size > limit {
		return fmt.Sprintf("larger than the limit of %d MB", limit>>20), nil
	}
	return "", nil
}

// BeginVideoUpload starts an upload, or resumes the unfinished one of the same file.
func (s *UploadServer) BeginVideoUpload(ctx context.Context, req *connect.Request[kantahev1.BeginVideoUploadRequest]) (*connect.Response[kantahev1.BeginVideoUploadResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	name, ok := videoUploadName(req.Msg.Filename)
	if !ok {
		return beginRejected("unsupported file type: use an .mp4, .m4v or .mov file")
	}
	size := req.Msg.SizeBytes
	if size <= 0 {
		return beginRejected("empty file")
	}
	reason, err := s.overLimit(ctx, size)
	if err != nil {
		return nil, internalErr(s.d.Logger, "BeginVideoUpload", err)
	}
	if reason != "" {
		return beginRejected(reason)
	}
	s.beginMu.Lock()
	defer s.beginMu.Unlock()

	var up videoUpload
	err = s.d.DB.QueryRowContext(ctx, `SELECT id, user_id, filename, size, received FROM video_uploads WHERE user_id = ? AND filename = ? AND size = ?`,
		caller.UserID, name, size).Scan(&up.id, &up.userID, &up.filename, &up.size, &up.received)
	switch {
	case err == nil:
		received, err := s.resume(ctx, up)
		if err != nil {
			return nil, internalErr(s.d.Logger, "BeginVideoUpload", err)
		}
		return connect.NewResponse(&kantahev1.BeginVideoUploadResponse{UploadId: up.id, ChunkSize: videoChunkSize, Received: received}), nil
	case !errors.Is(err, sql.ErrNoRows):
		return nil, internalErr(s.d.Logger, "BeginVideoUpload", err)
	}
	var open int
	if err := s.d.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM video_uploads`).Scan(&open); err != nil {
		return nil, internalErr(s.d.Logger, "BeginVideoUpload", err)
	}
	if open >= maxVideoUploads {
		return beginRejected("too many uploads in progress: finish or cancel one")
	}
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return nil, internalErr(s.d.Logger, "BeginVideoUpload", err)
	}
	id := hex.EncodeToString(raw)
	now := s.now().Unix()
	// the row first: the sweeper removes a partial file that has none
	if _, err := s.d.DB.ExecContext(ctx, `INSERT INTO video_uploads(id, user_id, filename, size, received, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`,
		id, caller.UserID, name, size, now, now); err != nil {
		return nil, internalErr(s.d.Logger, "BeginVideoUpload", err)
	}
	if err := s.createPart(id); err != nil {
		_, _ = s.d.DB.ExecContext(ctx, `DELETE FROM video_uploads WHERE id = ?`, id)
		return nil, internalErr(s.d.Logger, "BeginVideoUpload", err)
	}
	return connect.NewResponse(&kantahev1.BeginVideoUploadResponse{UploadId: id, ChunkSize: videoChunkSize}), nil
}

// createPart makes the folder and an empty partial file.
func (s *UploadServer) createPart(id string) error {
	if err := os.MkdirAll(s.videosDir(), 0o750); err != nil {
		return err
	}
	f, err := os.OpenFile(s.partPath(id), os.O_CREATE|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	return f.Close()
}

// resume makes the row and the file agree and returns the bytes received: the file is the truth for where the next chunk goes, the
// smaller of the two wins, and a file longer than the row (a crash between the append and the update) is cut back.
func (s *UploadServer) resume(ctx context.Context, up videoUpload) (int64, error) {
	mu := s.lockFor(up.id)
	mu.Lock()
	defer mu.Unlock()
	st, err := os.Stat(s.partPath(up.id))
	var onDisk int64
	switch {
	case err == nil:
		onDisk = st.Size()
	case errors.Is(err, fs.ErrNotExist):
		if err := s.createPart(up.id); err != nil {
			return 0, err
		}
	default:
		return 0, err
	}
	received := min(up.received, onDisk)
	if onDisk > received {
		if err := os.Truncate(s.partPath(up.id), received); err != nil {
			return 0, err
		}
	}
	if received != up.received {
		if _, err := s.d.DB.ExecContext(ctx, `UPDATE video_uploads SET received = ?, updated_at = ? WHERE id = ?`, received, s.now().Unix(), up.id); err != nil {
			return 0, err
		}
	}
	return received, nil
}

// ownUpload is the unfinished upload id of the caller, or NOT_FOUND (also for another administrator's upload and for any id that is
// not one of ours).
func (s *UploadServer) ownUpload(ctx context.Context, userID, id string) (videoUpload, error) {
	var up videoUpload
	if !uploadIDPattern.MatchString(id) {
		return up, newErr(connect.CodeNotFound, "upload not found")
	}
	err := s.d.DB.QueryRowContext(ctx, `SELECT id, user_id, filename, size, received FROM video_uploads WHERE id = ? AND user_id = ?`, id, userID).
		Scan(&up.id, &up.userID, &up.filename, &up.size, &up.received)
	if errors.Is(err, sql.ErrNoRows) {
		return up, newErr(connect.CodeNotFound, "upload not found")
	}
	return up, err
}

// UploadVideoChunk appends the next chunk of an upload.
func (s *UploadServer) UploadVideoChunk(ctx context.Context, req *connect.Request[kantahev1.UploadVideoChunkRequest]) (*connect.Response[kantahev1.UploadVideoChunkResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	m := req.Msg
	up, err := s.ownUpload(ctx, caller.UserID, m.UploadId)
	if err != nil {
		return nil, s.orInternal(err, "UploadVideoChunk")
	}
	if n := len(m.Content); n < 1 || n > maxVideoChunk {
		return nil, invalidArgument(fmt.Sprintf("a chunk is 1 byte to %d MiB", maxVideoChunk>>20))
	}
	mu := s.lockFor(up.id)
	mu.Lock()
	defer mu.Unlock()
	// the upload may have been completed or aborted while this call waited for the lock
	if up, err = s.ownUpload(ctx, caller.UserID, m.UploadId); err != nil {
		return nil, s.orInternal(err, "UploadVideoChunk")
	}
	reason, err := s.overLimit(ctx, up.size)
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadVideoChunk", err)
	}
	if reason != "" {
		return nil, invalidArgument(reason)
	}
	f, err := os.OpenFile(s.partPath(up.id), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadVideoChunk", err)
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return nil, internalErr(s.d.Logger, "UploadVideoChunk", err)
	}
	have := st.Size()
	if m.Offset != have {
		// a chunk whose response was lost is already there: its retry lands here with the offset the client has to continue from
		return nil, newErr(connect.CodeFailedPrecondition, fmt.Sprintf("offset %d expected %d", m.Offset, have))
	}
	if have+int64(len(m.Content)) > up.size {
		return nil, invalidArgument(fmt.Sprintf("the chunk goes past the declared size of %d bytes", up.size))
	}
	if _, err := f.Write(m.Content); err != nil {
		_ = f.Truncate(have) // never leave half a chunk behind
		return nil, internalErr(s.d.Logger, "UploadVideoChunk", err)
	}
	if err := f.Close(); err != nil {
		return nil, internalErr(s.d.Logger, "UploadVideoChunk", err)
	}
	received := have + int64(len(m.Content))
	if _, err := s.d.DB.ExecContext(ctx, `UPDATE video_uploads SET received = ?, updated_at = ? WHERE id = ?`, received, s.now().Unix(), up.id); err != nil {
		return nil, internalErr(s.d.Logger, "UploadVideoChunk", err)
	}
	return connect.NewResponse(&kantahev1.UploadVideoChunkResponse{Received: received}), nil
}

// orInternal passes on a connect error (NOT_FOUND) and makes anything else an internal error.
func (s *UploadServer) orInternal(err error, op string) error {
	var ce *connect.Error
	if errors.As(err, &ce) {
		return err
	}
	return internalErr(s.d.Logger, op, err)
}

// videoRefusal is the text for a file that Inspect refused, and whether it was a refusal of the file (not a read error).
func videoRefusal(err error) (string, bool) {
	var ce video.ErrCodec
	switch {
	case errors.As(err, &ce), errors.Is(err, video.ErrNoVideoTrack), errors.Is(err, video.ErrTooWide), errors.Is(err, video.ErrTooLarge), errors.Is(err, video.ErrCorrupt):
		return err.Error(), true
	case errors.Is(err, video.ErrNotMP4):
		return err.Error() + ": convert it to an MP4 with H.264 video (see the admin guide)", true
	}
	return "", false
}

// CompleteVideoUpload checks the finished file, names it by its SHA-256 and adds it to the end of the loop.
func (s *UploadServer) CompleteVideoUpload(ctx context.Context, req *connect.Request[kantahev1.CompleteVideoUploadRequest]) (*connect.Response[kantahev1.CompleteVideoUploadResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	up, err := s.ownUpload(ctx, caller.UserID, req.Msg.UploadId)
	if err != nil {
		return nil, s.orInternal(err, "CompleteVideoUpload")
	}
	mu := s.lockFor(up.id)
	mu.Lock()
	defer mu.Unlock()
	if up, err = s.ownUpload(ctx, caller.UserID, req.Msg.UploadId); err != nil {
		return nil, s.orInternal(err, "CompleteVideoUpload")
	}
	reason, err := s.overLimit(ctx, up.size)
	if err != nil {
		return nil, internalErr(s.d.Logger, "CompleteVideoUpload", err)
	}
	if reason != "" {
		s.discard(ctx, up)
		return completeRejected(reason)
	}
	part := s.partPath(up.id)
	info, sum, got, err := s.judge(part, up.size)
	switch {
	case err == nil:
	case got != up.size && got >= 0:
		return nil, newErr(connect.CodeFailedPrecondition, fmt.Sprintf("the upload is incomplete: %d of %d bytes", got, up.size))
	default:
		if reason, ok := videoRefusal(err); ok {
			s.discard(ctx, up)
			return completeRejected(reason)
		}
		return nil, internalErr(s.d.Logger, "CompleteVideoUpload", err)
	}

	v, err := s.placeAndAdd(ctx, part, video.Path(s.d.DataDir, sum),
		video.NewVideo{SHA256: sum, Size: up.size, Name: tidyVideoName(up.filename), OriginalName: up.filename, Info: info})
	var dup video.ErrDuplicate
	var pe placeError
	switch {
	case errors.As(err, &dup):
		s.forget(ctx, up)
		return connect.NewResponse(&kantahev1.CompleteVideoUploadResponse{Status: kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE, Video: toProtoVideo(dup.Existing, "")}), nil
	case errors.As(err, &pe):
		// the file could not be moved: the upload stays and Complete can be tried again
		return nil, internalErr(s.d.Logger, "CompleteVideoUpload", err)
	case err != nil:
		s.forget(ctx, up)
		return nil, internalErr(s.d.Logger, "CompleteVideoUpload", err)
	}
	s.forget(ctx, up)
	return connect.NewResponse(&kantahev1.CompleteVideoUploadResponse{Status: kantahev1.UploadStatus_UPLOAD_STATUS_ADDED, Video: toProtoVideo(v, "")}), nil
}

// placeError is a failure to move the finished file into place (the upload is kept, so that Complete can be repeated).
type placeError struct{ error }

func (e placeError) Unwrap() error { return e.error }

// placeAndAdd moves the finished file to <data>/videos/<sha256>.mp4 and adds the row. A video that is already there is a video.ErrDuplicate.
// It runs under video.FilesMu so that a delete of that same video cannot fall between the two steps.
func (s *UploadServer) placeAndAdd(ctx context.Context, part, dst string, nv video.NewVideo) (video.Video, error) {
	video.FilesMu.Lock()
	defer video.FilesMu.Unlock()
	_, statErr := os.Stat(dst)
	existed := statErr == nil
	// the name is the SHA-256 of the content: a file that is there already is identical and stays, even while a player reads it
	if err := fsutil.Place(part, dst, fsutil.PlaceBudget); err != nil {
		return video.Video{}, placeError{err}
	}
	v, err := s.videos.Add(ctx, nv)
	var dup video.ErrDuplicate
	if err != nil && !errors.As(err, &dup) && !existed {
		fsutil.RemoveQuietly(dst) // the row was not added: do not leave a file nobody lists
	}
	return v, err
}

// judge checks the partial file: its length is the declared size (got is the real length, -1 when it could not be read), Inspect
// accepts it, and its SHA-256 (the file is read once through io.Copy, never held in memory).
func (s *UploadServer) judge(part string, size int64) (info video.Info, sum string, got int64, err error) {
	f, err := os.Open(part)
	if err != nil {
		return info, "", -1, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return info, "", -1, err
	}
	if got = st.Size(); got != size {
		return info, "", got, errors.New("incomplete")
	}
	if info, err = video.Inspect(f, size); err != nil {
		return info, "", got, err
	}
	h := sha256.New()
	if _, err := io.Copy(h, io.NewSectionReader(f, 0, size)); err != nil {
		return info, "", got, err
	}
	return info, hex.EncodeToString(h.Sum(nil)), got, nil
}

// discard removes a partial file and its row; a file that cannot be deleted now is swept by the next cleanup.
func (s *UploadServer) discard(ctx context.Context, up videoUpload) {
	if err := fsutil.Remove(ctx, s.partPath(up.id), fsutil.DeleteBudget); err != nil {
		s.d.Logger.Warn("cannot delete a partial video upload now; the cleanup tries again", "err", err)
	}
	s.forget(ctx, up)
}

// forget deletes the row of an upload (its file is gone or moved) and the lock.
func (s *UploadServer) forget(ctx context.Context, up videoUpload) {
	if _, err := s.d.DB.ExecContext(ctx, `DELETE FROM video_uploads WHERE id = ?`, up.id); err != nil {
		s.d.Logger.Warn("cannot delete the row of a video upload", "err", err)
	}
	s.locks.Delete(up.id)
}

// AbortVideoUpload throws away an unfinished upload; an unknown id is not an error.
func (s *UploadServer) AbortVideoUpload(ctx context.Context, req *connect.Request[kantahev1.AbortVideoUploadRequest]) (*connect.Response[kantahev1.AbortVideoUploadResponse], error) {
	caller, err := requireAdmin(ctx)
	if err != nil {
		return nil, err
	}
	up, err := s.ownUpload(ctx, caller.UserID, req.Msg.UploadId)
	if err != nil {
		if connect.CodeOf(err) == connect.CodeNotFound {
			return connect.NewResponse(&kantahev1.AbortVideoUploadResponse{}), nil
		}
		return nil, internalErr(s.d.Logger, "AbortVideoUpload", err)
	}
	mu := s.lockFor(up.id)
	mu.Lock()
	defer mu.Unlock()
	s.discard(ctx, up)
	return connect.NewResponse(&kantahev1.AbortVideoUploadResponse{}), nil
}

// RunCleanup removes stale uploads at start and then every hour, until ctx is done.
func (s *UploadServer) RunCleanup(ctx context.Context) {
	s.cleanup(ctx)
	t := time.NewTicker(videoCleanupEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.cleanup(ctx)
		}
	}
}

// cleanup deletes the uploads (row and file) that were not touched for 24 hours, and partial files that have no row.
func (s *UploadServer) cleanup(ctx context.Context) {
	cutoff := s.now().Add(-videoUploadTTL).Unix()
	rows, err := s.d.DB.QueryContext(ctx, `SELECT id, user_id, filename, size, received FROM video_uploads WHERE updated_at < ?`, cutoff)
	if err != nil {
		s.d.Logger.Warn("cannot list stale video uploads", "err", err)
		return
	}
	var stale []videoUpload
	for rows.Next() {
		var up videoUpload
		if err := rows.Scan(&up.id, &up.userID, &up.filename, &up.size, &up.received); err == nil {
			stale = append(stale, up)
		}
	}
	rows.Close()
	for _, up := range stale {
		mu := s.lockFor(up.id)
		mu.Lock()
		s.discard(ctx, up)
		mu.Unlock()
	}
	entries, err := os.ReadDir(s.videosDir())
	if err != nil {
		return
	}
	for _, e := range entries {
		id, ok := strings.CutPrefix(e.Name(), partPrefix)
		if !ok {
			continue
		}
		var n int
		if err := s.d.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM video_uploads WHERE id = ?`, id).Scan(&n); err != nil || n > 0 {
			continue
		}
		if !fsutil.RemoveQuietly(filepath.Join(s.videosDir(), e.Name())) {
			s.d.Logger.Warn("cannot delete a partial video file now; the next cleanup tries again", "name", e.Name())
		}
	}
}
