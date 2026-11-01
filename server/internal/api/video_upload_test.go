package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

const mib = 1 << 20

// bigMP4 is a valid MP4 (testfix.MP4, moov first) whose mdat is padded so that the whole file is size bytes; seed makes two files differ.
func bigMP4(size int, seed byte, o testfix.MP4Options) []byte {
	o.MoovFirst = true
	base := testfix.MP4(o)
	base = base[:len(base)-24] // the small mdat of the fixture: 8 bytes of header and 16 of content
	mdat := make([]byte, size-len(base))
	binary.BigEndian.PutUint32(mdat, uint32(len(mdat)))
	copy(mdat[4:], "mdat")
	for i := 8; i < len(mdat); i++ {
		mdat[i] = byte(i*31) + seed
	}
	return append(base, mdat...)
}

func sum(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func (a *adminEnv) begin(token, name string, size int64) (*kantahev1.BeginVideoUploadResponse, error) {
	res, err := a.uploadClient.BeginVideoUpload(context.Background(), with(connect.NewRequest(&kantahev1.BeginVideoUploadRequest{Filename: name, SizeBytes: size}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) chunk(token, id string, offset int64, content []byte) (*kantahev1.UploadVideoChunkResponse, error) {
	res, err := a.uploadClient.UploadVideoChunk(context.Background(), with(connect.NewRequest(&kantahev1.UploadVideoChunkRequest{UploadId: id, Offset: offset, Content: content}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) complete(token, id string) (*kantahev1.CompleteVideoUploadResponse, error) {
	res, err := a.uploadClient.CompleteVideoUpload(context.Background(), with(connect.NewRequest(&kantahev1.CompleteVideoUploadRequest{UploadId: id}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) abort(token, id string) error {
	_, err := a.uploadClient.AbortVideoUpload(context.Background(), with(connect.NewRequest(&kantahev1.AbortVideoUploadRequest{UploadId: id}), token))
	return err
}

// sendAll sends data from offset in chunks of the size the server asked for.
func (a *adminEnv) sendAll(t *testing.T, token, id string, chunk int, data []byte, from int) {
	t.Helper()
	for off := from; off < len(data); off += chunk {
		end := min(off+chunk, len(data))
		res, err := a.chunk(token, id, int64(off), data[off:end])
		if err != nil || res.Received != int64(end) {
			t.Fatalf("chunk at %d: %+v %v", off, res, err)
		}
	}
}

// upload runs a whole upload and returns the answer of Complete.
func (a *adminEnv) upload(t *testing.T, name string, data []byte) *kantahev1.CompleteVideoUploadResponse {
	t.Helper()
	b, err := a.begin(a.admin.Token, name, int64(len(data)))
	if err != nil || b.Status == kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED {
		t.Fatalf("begin: %+v %v", b, err)
	}
	a.sendAll(t, a.admin.Token, b.UploadId, int(b.ChunkSize), data, int(b.Received))
	res, err := a.complete(a.admin.Token, b.UploadId)
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	return res
}

func (a *adminEnv) videosDirFiles(t *testing.T) []string {
	t.Helper()
	entries, _ := os.ReadDir(filepath.Join(a.dataDir, "videos"))
	var out []string
	for _, e := range entries {
		out = append(out, e.Name())
	}
	return out
}

func (a *adminEnv) count(t *testing.T, table string) int {
	t.Helper()
	var n int
	if err := a.db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestVideoUploadInChunksAddsTheVideoNamedByItsHash(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(10*mib, 1, testfix.MP4Options{DurationMs: 5000})
	b, err := a.begin(a.admin.Token, "My_beach  clip.mp4", int64(len(data)))
	if err != nil || b.Status != kantahev1.UploadStatus_UPLOAD_STATUS_UNSPECIFIED || b.ChunkSize != 4*mib || b.Received != 0 || len(b.UploadId) != 32 {
		t.Fatalf("begin: %+v %v", b, err)
	}
	a.sendAll(t, a.admin.Token, b.UploadId, int(b.ChunkSize), data, 0) // 4 + 4 + 2 MiB
	res, err := a.complete(a.admin.Token, b.UploadId)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED || res.Video == nil {
		t.Fatalf("complete: %+v %v", res, err)
	}
	v := res.Video
	if v.Name != "My beach clip" || v.Width != 1920 || v.Height != 1080 || v.DurationMs != 5000 || v.Codec != "avc1" || !v.Faststart || !v.Enabled || v.Position != 1 || v.SizeBytes != int64(len(data)) || v.Url != "" || len(v.Warnings) != 0 {
		t.Fatalf("video = %+v", v)
	}
	var stored string
	if err := a.db.QueryRow(`SELECT sha256 FROM videos WHERE id = ?`, v.Id).Scan(&stored); err != nil || stored != sum(data) {
		t.Fatalf("stored hash %q (%v), want %q", stored, err, sum(data))
	}
	got, err := os.ReadFile(filepath.Join(a.dataDir, "videos", stored+".mp4"))
	if err != nil || !bytes.Equal(got, data) {
		t.Fatalf("the stored file differs from the bytes sent: %v", err)
	}
	if files := a.videosDirFiles(t); len(files) != 1 || files[0] != stored+".mp4" {
		t.Fatalf("files = %v, want only the video (no .upload file)", files)
	}
	if n := a.count(t, "video_uploads"); n != 0 {
		t.Fatalf("%d upload rows left", n)
	}
}

func TestVideoUploadOfTheSameFileAgainIsADuplicate(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(5*mib, 2, testfix.MP4Options{})
	first := a.upload(t, "a.mp4", data)
	again := a.upload(t, "b.mov", data)
	if again.Status != kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE || again.Video == nil || again.Video.Id != first.Video.Id {
		t.Fatalf("second upload: %+v", again)
	}
	if files := a.videosDirFiles(t); len(files) != 1 {
		t.Fatalf("files = %v, want one", files)
	}
	if n := a.count(t, "videos"); n != 1 {
		t.Fatalf("%d videos", n)
	}
}

func TestVideoUploadWrongOffsetIsRefusedAndRetriesAreSafe(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(9*mib, 3, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	first := data[:4*mib]
	if _, err := a.chunk(a.admin.Token, b.UploadId, 8, first); connect.CodeOf(err) != connect.CodeFailedPrecondition || !strings.Contains(err.Error(), "offset 8 expected 0") {
		t.Fatalf("wrong offset at the start: %v", err)
	}
	// nothing was appended, so the same chunk at the right offset goes through
	if res, err := a.chunk(a.admin.Token, b.UploadId, 0, first); err != nil || res.Received != 4*mib {
		t.Fatalf("first chunk: %+v %v", res, err)
	}
	// a retry after a lost response: the data is there already, so the retry with the SAME offset is refused and says where to go on
	if _, err := a.chunk(a.admin.Token, b.UploadId, 0, first); connect.CodeOf(err) != connect.CodeFailedPrecondition || !strings.Contains(err.Error(), "offset 0 expected 4194304") {
		t.Fatalf("retry of a chunk that arrived: %v", err)
	}
	// a gap is refused too
	if _, err := a.chunk(a.admin.Token, b.UploadId, 5*mib, data[5*mib:6*mib]); connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("a gap: %v", err)
	}
	if again, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data))); again.Received != 4*mib {
		t.Fatalf("received after the refusals = %d, want 4 MiB: nothing was appended", again.Received)
	}
	// the client continues from the expected offset and finishes
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 4*mib)
	if res, err := a.complete(a.admin.Token, b.UploadId); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("complete: %+v %v", res, err)
	}
}

func TestVideoUploadResumesAfterAReloadAndAServerRestart(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(10*mib, 4, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data[:8*mib], 0)
	// a page reload: the same file is offered again
	again, err := a.begin(a.admin.Token, "../some/dir/a.mp4", int64(len(data)))
	if err != nil || again.UploadId != b.UploadId || again.Received != 8*mib {
		t.Fatalf("resume: %+v %v", again, err)
	}
	// a restart: a new server over the same data directory and database
	mux := http.NewServeMux()
	m2, err := mount(mux.Handle, a.deps)
	if err != nil {
		t.Fatal(err)
	}
	srv2 := httptest.NewServer(mux)
	t.Cleanup(func() { srv2.Close(); _ = m2.Close() })
	client2 := kantahev1connect.NewUploadServiceClient(srv2.Client(), srv2.URL)
	res, err := client2.BeginVideoUpload(context.Background(), with(connect.NewRequest(&kantahev1.BeginVideoUploadRequest{Filename: "a.mp4", SizeBytes: int64(len(data))}), a.admin.Token))
	if err != nil || res.Msg.UploadId != b.UploadId || res.Msg.Received != 8*mib {
		t.Fatalf("resume after a restart: %+v %v", res, err)
	}
	if _, err := client2.UploadVideoChunk(context.Background(), with(connect.NewRequest(&kantahev1.UploadVideoChunkRequest{UploadId: b.UploadId, Offset: 8 * mib, Content: data[8*mib:]}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	done, err := client2.CompleteVideoUpload(context.Background(), with(connect.NewRequest(&kantahev1.CompleteVideoUploadRequest{UploadId: b.UploadId}), a.admin.Token))
	if err != nil || done.Msg.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("complete: %+v %v", done, err)
	}
}

func TestVideoUploadResumeCutsBackAFileLongerThanItsRow(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(6*mib, 5, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data[:4*mib], 0)
	// a crash between the append and the update of the row: the file has 2 MiB more than the row says
	f, err := os.OpenFile(filepath.Join(a.dataDir, "videos", ".upload-"+b.UploadId), os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.Write(data[4*mib : 6*mib])
	f.Close()
	again, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	if again.Received != 4*mib {
		t.Fatalf("received = %d, want 4 MiB (the smaller wins)", again.Received)
	}
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 4*mib)
	if res, err := a.complete(a.admin.Token, b.UploadId); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("complete: %+v %v", res, err)
	}
}

func TestVideoUploadChunkLimits(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(10*mib, 6, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	if _, err := a.chunk(a.admin.Token, b.UploadId, 0, data[:9*mib]); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("a 9 MiB chunk: %v", err)
	}
	if _, err := a.chunk(a.admin.Token, b.UploadId, 0, nil); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("an empty chunk: %v", err)
	}
	a.sendAll(t, a.admin.Token, b.UploadId, 8*mib, data[:8*mib], 0)
	if _, err := a.chunk(a.admin.Token, b.UploadId, 8*mib, make([]byte, 3*mib)); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("a chunk past the declared size: %v", err)
	}
	if again, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data))); again.Received != 8*mib {
		t.Fatalf("received = %d after the refusals", again.Received)
	}
}

func TestVideoUploadCompleteBeforeTheEndIsRefused(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(6*mib, 7, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data[:4*mib], 0)
	if _, err := a.complete(a.admin.Token, b.UploadId); connect.CodeOf(err) != connect.CodeFailedPrecondition || !strings.Contains(err.Error(), "4194304 of 6291456 bytes") {
		t.Fatalf("complete too early: %v", err)
	}
	// the upload is still there and can be finished
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 4*mib)
	if res, err := a.complete(a.admin.Token, b.UploadId); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("complete: %+v %v", res, err)
	}
}

func TestVideoUploadLimitsAndTheSetting(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	get := func() *kantahev1.ServerSettings {
		res, err := a.adminClient.GetServerSettings(ctx, with(connect.NewRequest(&kantahev1.GetServerSettingsRequest{}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Settings
	}
	if got := get().MaxVideoBytes; got != 500*mib {
		t.Fatalf("default max_video_bytes = %d", got)
	}
	if res, err := a.begin(a.admin.Token, "big.mp4", 501*mib); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || !strings.Contains(res.Reason, "limit of 500 MB") {
		t.Fatalf("over the limit: %+v %v", res, err)
	}
	update := func(v int64) error {
		_, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{MaxVideoBytes: &v}), a.admin.Token))
		return err
	}
	if err := update(100 * mib); err != nil || get().MaxVideoBytes != 100*mib {
		t.Fatalf("round trip: %v %d", err, get().MaxVideoBytes)
	}
	if res, _ := a.begin(a.admin.Token, "big.mp4", 101*mib); res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || !strings.Contains(res.Reason, "limit of 100 MB") {
		t.Fatalf("over the new limit: %+v", res)
	}
	for _, bad := range []int64{0, 9 << 30} {
		if err := update(bad); connect.CodeOf(err) != connect.CodeInvalidArgument {
			t.Errorf("max_video_bytes %d: %v", bad, err)
		}
	}
	if get().MaxVideoBytes != 100*mib {
		t.Fatal("a refused value changed the setting")
	}
	// names and sizes
	for name, size := range map[string]int64{"clip.mkv": 10, "clip.txt": 10, "..": 10, "": 10, ".mp4": 10, "a.mp4": 0, "b.mp4": -5} {
		if res, err := a.begin(a.admin.Token, name, size); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason == "" {
			t.Errorf("%q size %d: %+v %v", name, size, res, err)
		}
	}
	// two unfinished uploads at most
	for _, n := range []string{"one.mp4", "two.mp4"} {
		if res, err := a.begin(a.admin.Token, n, 1000); err != nil || res.Status == kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED {
			t.Fatalf("%s: %+v %v", n, res, err)
		}
	}
	if res, _ := a.begin(a.admin.Token, "three.mp4", 1000); res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || !strings.Contains(res.Reason, "too many uploads in progress") {
		t.Fatalf("third upload: %+v", res)
	}
	// and the same file again is a resume, not a third upload
	if res, _ := a.begin(a.admin.Token, "one.mp4", 1000); res.Status == kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED {
		t.Fatalf("resume of one.mp4: %+v", res)
	}
}

func TestVideoUploadRejectsTheContentAtCompleteAndCleansUp(t *testing.T) {
	a := newAdminEnv(t)
	whole := bigMP4(3*mib, 8, testfix.MP4Options{})
	for name, tc := range map[string]struct {
		data   []byte
		reason string
	}{
		"hevc":      {bigMP4(3*mib, 9, testfix.MP4Options{Codec: "hvc1"}), "hvc1"},
		"text":      {[]byte(strings.Repeat("this is a text file, not a video\n", 100)), "not an MP4 video file"},
		"cut short": {whole[:2*mib], "damaged"},
		"too wide":  {bigMP4(3*mib, 10, testfix.MP4Options{Width: 4096}), "wider than 3840"},
		"no video":  {bigMP4(3*mib, 11, testfix.MP4Options{NoVideo: true}), "no video track"},
	} {
		res := a.upload(t, name+".mp4", tc.data)
		if res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || !strings.Contains(res.Reason, tc.reason) || res.Video != nil {
			t.Errorf("%s: %+v", name, res)
		}
		if files := a.videosDirFiles(t); len(files) != 0 {
			t.Errorf("%s: files left: %v", name, files)
		}
		if n := a.count(t, "video_uploads") + a.count(t, "videos"); n != 0 {
			t.Errorf("%s: %d rows left", name, n)
		}
	}
}

func TestVideoUploadIsForAdministratorsOnly(t *testing.T) {
	a := newAdminEnv(t)
	a.addUser(t, "up@example.com", "password1", `UPDATE users SET uploader = 1 WHERE id = ?`)
	upTok, err := a.login("up@example.com", "password1", "Phone")
	if err != nil {
		t.Fatal(err)
	}
	a.addUser(t, "admin2@example.com", "password1", `UPDATE users SET admin = 1 WHERE id = ?`)
	admin2, err := a.login("admin2@example.com", "password1", "Laptop")
	if err != nil {
		t.Fatal(err)
	}
	data := bigMP4(2*mib, 12, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	calls := map[string]func(token string) error{
		"Begin":    func(tok string) error { _, err := a.begin(tok, "x.mp4", 1000); return err },
		"Chunk":    func(tok string) error { _, err := a.chunk(tok, b.UploadId, 0, data[:1000]); return err },
		"Complete": func(tok string) error { _, err := a.complete(tok, b.UploadId); return err },
		"Abort":    func(tok string) error { return a.abort(tok, b.UploadId) },
	}
	for name, call := range calls {
		if err := call(""); connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Errorf("%s without a token: %v", name, err)
		}
		for who, tok := range map[string]string{"user": a.user.Token, "uploader": upTok.Token} {
			if err := call(tok); connect.CodeOf(err) != connect.CodePermissionDenied {
				t.Errorf("%s as %s: %v", name, who, err)
			}
		}
	}
	// another administrator does not see the upload; aborting it is a no-op
	if _, err := a.chunk(admin2.Token, b.UploadId, 0, data[:1000]); connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("chunk of another admin's upload: %v", err)
	}
	if _, err := a.complete(admin2.Token, b.UploadId); connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("complete of another admin's upload: %v", err)
	}
	if err := a.abort(admin2.Token, b.UploadId); err != nil {
		t.Errorf("abort of another admin's upload: %v", err)
	}
	if again, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data))); again.UploadId != b.UploadId {
		t.Fatalf("the upload of the first admin was touched: %+v", again)
	}
	// ids that are not ours
	for _, bad := range []string{"", "../../etc/passwd", strings.Repeat("g", 32), strings.Repeat("0", 32)} {
		if _, err := a.chunk(a.admin.Token, bad, 0, data[:10]); connect.CodeOf(err) != connect.CodeNotFound {
			t.Errorf("chunk with id %q: %v", bad, err)
		}
		if err := a.abort(a.admin.Token, bad); err != nil {
			t.Errorf("abort with id %q: %v", bad, err)
		}
	}
}

func TestVideoUploadUsesOnlyTheBaseNameOfTheFile(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(2*mib, 13, testfix.MP4Options{})
	res := a.upload(t, `../../escape\..\up/x.MP4`, data)
	if res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("%+v", res)
	}
	var orig string
	if err := a.db.QueryRow(`SELECT original_name FROM videos WHERE id = ?`, res.Video.Id).Scan(&orig); err != nil || orig != "x.MP4" {
		t.Fatalf("original_name = %q (%v)", orig, err)
	}
	if res.Video.Name != "x" {
		t.Fatalf("name = %q", res.Video.Name)
	}
	// nothing outside <data>/videos was written
	top, _ := os.ReadDir(a.dataDir)
	for _, e := range top {
		if strings.Contains(e.Name(), "escape") || strings.Contains(e.Name(), "x.") {
			t.Errorf("stray entry %q in the data directory", e.Name())
		}
	}
	if parent, _ := os.ReadDir(filepath.Dir(a.dataDir)); len(parent) > 0 {
		for _, e := range parent {
			if strings.Contains(e.Name(), "escape") || e.Name() == "up" {
				t.Errorf("stray entry %q above the data directory", e.Name())
			}
		}
	}
}

func TestVideoUploadAbortRemovesTheFileAndTheRow(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(5*mib, 14, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data[:4*mib], 0)
	if err := a.abort(a.admin.Token, b.UploadId); err != nil {
		t.Fatal(err)
	}
	if files := a.videosDirFiles(t); len(files) != 0 || a.count(t, "video_uploads") != 0 {
		t.Fatalf("files %v, rows %d", files, a.count(t, "video_uploads"))
	}
	if err := a.abort(a.admin.Token, b.UploadId); err != nil {
		t.Fatalf("aborting twice: %v", err)
	}
	if _, err := a.chunk(a.admin.Token, b.UploadId, 0, data[:10]); connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("a chunk after the abort: %v", err)
	}
}

func TestVideoUploadCleanupRemovesStaleUploadsAndOrphans(t *testing.T) {
	a := newAdminEnv(t)
	old, _ := a.begin(a.admin.Token, "old.mp4", 1000)
	a.sendAll(t, a.admin.Token, old.UploadId, 500, make([]byte, 500), 0)
	a.clock.t.Add(int64((25 * time.Hour).Seconds()))
	fresh, _ := a.begin(a.admin.Token, "fresh.mp4", 1000)
	orphan := filepath.Join(a.dataDir, "videos", ".upload-"+strings.Repeat("a", 32))
	other := filepath.Join(a.dataDir, "videos", strings.Repeat("b", 64)+".mp4")
	for _, p := range []string{orphan, other} {
		if err := os.WriteFile(p, []byte("x"), 0o640); err != nil {
			t.Fatal(err)
		}
	}
	a.mounted.uploads.cleanup(context.Background())
	files := strings.Join(a.videosDirFiles(t), ",")
	if strings.Contains(files, old.UploadId) || strings.Contains(files, strings.Repeat("a", 32)) {
		t.Fatalf("the stale upload and the orphan must be gone: %s", files)
	}
	if !strings.Contains(files, fresh.UploadId) || !strings.Contains(files, strings.Repeat("b", 64)+".mp4") {
		t.Fatalf("the fresh upload and the finished video must stay: %s", files)
	}
	if a.count(t, "video_uploads") != 1 {
		t.Fatalf("%d rows, want only the fresh one", a.count(t, "video_uploads"))
	}
}

// Completing an upload must not hold the file in memory: the SHA-256 is computed through io.Copy and Inspect reads only headers.
func TestVideoUploadCompleteDoesNotAllocateTheWholeFile(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(64*mib, 15, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "big.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 0)
	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)
	res, err := a.complete(a.admin.Token, b.UploadId)
	runtime.ReadMemStats(&after)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("complete: %+v %v", res, err)
	}
	if grew := after.TotalAlloc - before.TotalAlloc; grew > 8*mib {
		t.Fatalf("Complete allocated %d MiB for a 64 MiB file", grew/mib)
	}
}

func (a *adminEnv) setMaxVideo(t *testing.T, v int64) {
	t.Helper()
	if _, err := a.adminClient.UpdateServerSettings(context.Background(), with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{MaxVideoBytes: &v}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
}

// The limit is the administrator's setting of the moment: an upload that was begun under a higher limit stops at the next chunk, and a
// finished one is refused at Complete, when the limit was lowered meanwhile.
func TestVideoUploadRespectsALimitLoweredMidway(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(6*mib, 16, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data[:4*mib], 0)
	a.setMaxVideo(t, 5*mib)
	if _, err := a.chunk(a.admin.Token, b.UploadId, 4*mib, data[4*mib:]); connect.CodeOf(err) != connect.CodeInvalidArgument || !strings.Contains(err.Error(), "limit of 5 MB") {
		t.Fatalf("chunk after the limit was lowered: %v", err)
	}
	// a finished upload is refused at Complete and nothing is kept
	a.setMaxVideo(t, 500*mib)
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 4*mib)
	a.setMaxVideo(t, 5*mib)
	res, err := a.complete(a.admin.Token, b.UploadId)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || !strings.Contains(res.Reason, "limit of 5 MB") {
		t.Fatalf("complete after the limit was lowered: %+v %v", res, err)
	}
	if files := a.videosDirFiles(t); len(files) != 0 || a.count(t, "video_uploads") != 0 || a.count(t, "videos") != 0 {
		t.Fatalf("files %v, upload rows %d, videos %d", files, a.count(t, "video_uploads"), a.count(t, "videos"))
	}
}

// After a crash the file may be shorter than the row, or gone: the smaller of the two wins, and a missing file starts again from 0.
func TestVideoUploadResumeFindsAShorterOrMissingFile(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(10*mib, 17, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data[:8*mib], 0)
	part := filepath.Join(a.dataDir, "videos", ".upload-"+b.UploadId)
	if err := os.Truncate(part, 3*mib); err != nil {
		t.Fatal(err)
	}
	if again, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data))); again.UploadId != b.UploadId || again.Received != 3*mib {
		t.Fatalf("shorter file: %+v", again)
	}
	if err := os.Remove(part); err != nil {
		t.Fatal(err)
	}
	if again, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data))); again.UploadId != b.UploadId || again.Received != 0 {
		t.Fatalf("missing file: %+v", again)
	}
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 0)
	if res, err := a.complete(a.admin.Token, b.UploadId); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("complete: %+v %v", res, err)
	}
}

// When the finished file cannot be moved into place, the upload is kept: the administrator can complete it again.
func TestVideoUploadCompleteThatCannotMoveTheFileKeepsTheUploadForARetry(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(2*mib, 31, testfix.MP4Options{})
	b, _ := a.begin(a.admin.Token, "a.mp4", int64(len(data)))
	a.sendAll(t, a.admin.Token, b.UploadId, 4*mib, data, 0)
	restore := fsutil.SetHooksForTest(fsutil.Hooks{Rename: func(string, string) error { return errors.New("disk full") }, IsBusy: func(error) bool { return false }})
	_, err := a.complete(a.admin.Token, b.UploadId)
	restore()
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Fatalf("complete with a failing move: %v", err)
	}
	if a.count(t, "video_uploads") != 1 || a.count(t, "videos") != 0 {
		t.Fatalf("the upload must stay: %d upload rows, %d videos", a.count(t, "video_uploads"), a.count(t, "videos"))
	}
	if res, err := a.complete(a.admin.Token, b.UploadId); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("the retry: %+v %v", res, err)
	}
}
