package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/testfix"
	"github.com/andrewloable/kantahe/server/internal/video"
)

// addVideo stores content as a background video: the file at video.Path and the row.
func (e *testEnv) addVideo(t *testing.T, name string, content []byte) video.Video {
	t.Helper()
	h := sha256.Sum256(content)
	sum := hex.EncodeToString(h[:])
	file := video.Path(e.data, sum)
	if err := os.MkdirAll(filepath.Dir(file), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, content, 0o640); err != nil {
		t.Fatal(err)
	}
	v, err := video.New(e.db).Add(context.Background(), video.NewVideo{SHA256: sum, Size: int64(len(content)), Name: name, OriginalName: name + ".mp4",
		Info: video.Info{Codec: "avc1", Width: 1920, Height: 1080, DurationMs: 1000, FastStart: true}})
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func sampleMP4(seed byte) []byte {
	b := testfix.MP4(testfix.MP4Options{MoovFirst: true})
	for i := 0; i < 2000; i++ {
		b = append(b, byte(i)+seed)
	}
	return b
}

func (e *testEnv) do(t *testing.T, method, rawURL string, headers ...string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(method, e.srv.URL+rawURL, nil)
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := e.srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestVideoRouteServesTheFileWithRangeAndCacheHeaders(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	data := sampleMP4(1)
	v := e.addVideo(t, "Beach", data)
	u := e.svc.VideoURL(v.ID, "u1", clock.t)
	sum := sha256.Sum256(data)
	etag := `"` + hex.EncodeToString(sum[:]) + `"`

	res := e.do(t, "GET", u)
	got := body(t, res)
	if res.StatusCode != 200 || !bytes.Equal(got, data) {
		t.Fatalf("GET: %d, %d bytes", res.StatusCode, len(got))
	}
	for k, want := range map[string]string{"Content-Type": "video/mp4", "X-Content-Type-Options": "nosniff", "Etag": etag, "Cache-Control": "private, max-age=21600", "Accept-Ranges": "bytes"} {
		if h := res.Header.Get(k); h != want {
			t.Errorf("%s = %q, want %q", k, h, want)
		}
	}
	// a range, and a suffix range
	res = e.do(t, "GET", u, "Range", "bytes=0-99")
	if got := body(t, res); res.StatusCode != 206 || len(got) != 100 || !bytes.Equal(got, data[:100]) || res.Header.Get("Content-Range") != "bytes 0-99/"+strconv.Itoa(len(data)) {
		t.Fatalf("range: %d %q %d bytes", res.StatusCode, res.Header.Get("Content-Range"), len(got))
	}
	res = e.do(t, "GET", u, "Range", "bytes=-50")
	if got := body(t, res); res.StatusCode != 206 || !bytes.Equal(got, data[len(data)-50:]) {
		t.Fatalf("suffix range: %d %d bytes", res.StatusCode, len(got))
	}
	// beyond the end
	res = e.do(t, "GET", u, "Range", "bytes="+strconv.Itoa(len(data)+100)+"-")
	_ = body(t, res)
	if res.StatusCode != http.StatusRequestedRangeNotSatisfiable {
		t.Fatalf("range past the end: %d", res.StatusCode)
	}
	// a cache that has the file asks with the ETag
	res = e.do(t, "GET", u, "If-None-Match", etag)
	if got := body(t, res); res.StatusCode != http.StatusNotModified || len(got) != 0 {
		t.Fatalf("If-None-Match: %d, %d bytes", res.StatusCode, len(got))
	}
	// HEAD
	res = e.do(t, "HEAD", u)
	if got := body(t, res); res.StatusCode != 200 || len(got) != 0 || res.Header.Get("Content-Length") != strconv.Itoa(len(data)) {
		t.Fatalf("HEAD: %d, length %q, %d bytes", res.StatusCode, res.Header.Get("Content-Length"), len(got))
	}
}

func TestVideoRouteIsNotPublic(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	e.addUser(t, "u2", false)
	e.addUser(t, "off", true)
	v := e.addVideo(t, "Beach", sampleMP4(2))
	good := e.svc.VideoURL(v.ID, "u1", clock.t)
	if res := e.do(t, "GET", good); res.StatusCode != 200 {
		t.Fatalf("the good URL: %d", res.StatusCode)
	}
	parsed, _ := url.Parse(good)
	q := parsed.Query()
	with := func(key, val string) string {
		c := url.Values{}
		for k, vs := range q {
			c[k] = vs
		}
		c.Set(key, val)
		return parsed.Path + "?" + c.Encode()
	}
	farExp := e.svc.Sign(parsed.Path, "u1", clock.t.Add(MaxLifetime+time.Hour))
	pastExp := e.svc.Sign(parsed.Path, "u1", clock.t.Add(-time.Minute))
	disabled := e.svc.Sign(parsed.Path, "off", clock.t.Add(2*time.Hour))
	for name, raw := range map[string]string{
		"no query":         parsed.Path,
		"tampered sig":     with("sig", "AAAA"),
		"other user":       with("u", "u2"),
		"expired":          pastExp,
		"more than 7 h":    farExp,
		"disabled user":    disabled,
		"other video path": strings.Replace(good, v.ID, "vaaaaaaaaaa", 1),
	} {
		if res := e.do(t, "GET", raw); res.StatusCode != http.StatusForbidden {
			t.Errorf("%s: %d, want 403", name, res.StatusCode)
		}
	}
	// a valid signature for an unknown id is 404, not 403
	if res := e.do(t, "GET", e.svc.VideoURL("vaaaaaaaaaa", "u1", clock.t)); res.StatusCode != http.StatusNotFound {
		t.Errorf("unknown id: %d, want 404", res.StatusCode)
	}
}

func TestVideoRouteReadsNothingOutsideTheVideosFolder(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	secret := filepath.Join(e.data, "secret.txt")
	if err := os.WriteFile(secret, []byte("do not serve"), 0o640); err != nil {
		t.Fatal(err)
	}
	// ids that are not ours, signed for real so that the signature is not what stops them
	for _, id := range []string{"..%2Fsecret.txt", "..%2F..%2Fetc%2Fpasswd", "v0000000000%2F..%2Fsecret.txt", "%2e%2e", "videos"} {
		decoded, _ := url.PathUnescape("/media/video/" + id)
		signed := e.svc.Sign(decoded, "u1", clock.t.Add(2*time.Hour))
		query := signed[strings.Index(signed, "?"):]
		res := e.do(t, "GET", "/media/video/"+id+query)
		b := body(t, res)
		if strings.Contains(string(b), "do not serve") || res.StatusCode == 200 {
			t.Errorf("id %q: %d %q", id, res.StatusCode, b)
		}
	}
	// a row whose hash is not a hash cannot name a file either
	if _, err := e.db.Exec(`INSERT INTO videos(id, sha256, name, original_name, size, duration_ms, width, height, codec, position, created_at)
		VALUES ('vbadbadbad', '../secret.txt', 'x', 'x', 1, 1, 1, 1, 'avc1', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	res := e.do(t, "GET", e.svc.VideoURL("vbadbadbad", "u1", clock.t))
	if b := body(t, res); res.StatusCode != http.StatusNotFound || strings.Contains(string(b), "do not serve") {
		t.Errorf("a row with a bad hash: %d %q", res.StatusCode, b)
	}
}

func TestVideoRouteWithAFileRemovedFromDiskIs404(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	data := sampleMP4(3)
	v := e.addVideo(t, "Gone", data)
	if err := os.Remove(video.Path(e.data, v.SHA256)); err != nil {
		t.Fatal(err)
	}
	if res := e.do(t, "GET", e.svc.VideoURL(v.ID, "u1", clock.t)); res.StatusCode != http.StatusNotFound {
		t.Fatalf("status %d, want 404", res.StatusCode)
	}
}

func TestVideoRouteServesADisabledVideo(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	v := e.addVideo(t, "Off", sampleMP4(4))
	if _, err := video.New(e.db).SetEnabled(context.Background(), v.ID, false); err != nil {
		t.Fatal(err)
	}
	if res := e.do(t, "GET", e.svc.PreviewURL(v.ID, "u1", clock.t)); res.StatusCode != 200 {
		t.Fatalf("a disabled video must still be served (preview, and lists fetched earlier): %d", res.StatusCode)
	}
}

func expOf(t *testing.T, signed string) time.Time {
	t.Helper()
	u, err := url.Parse(signed)
	if err != nil {
		t.Fatal(err)
	}
	n, err := strconv.ParseInt(u.Query().Get("exp"), 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	return time.Unix(n, 0)
}

func TestVideoURLStaysTheSameInsideAWindow(t *testing.T) {
	e, _ := newEnv(t, "")
	e.addUser(t, "u1", false)
	e.addUser(t, "u2", false)
	base := time.Date(2026, 1, 1, 12, 20, 0, 0, time.UTC) // the window ends at 18:00
	a := e.svc.VideoURL("v0123456789", "u1", base)
	if b := e.svc.VideoURL("v0123456789", "u1", base.Add(10*time.Minute)); a != b {
		t.Fatalf("two calls 10 minutes apart differ:\n%s\n%s", a, b)
	}
	if b := e.svc.VideoURL("v0123456789", "u1", base.Add(4*time.Hour)); a != b {
		t.Fatalf("a call at 16:20 (1 h 40 min before the end) differs:\n%s\n%s", a, b)
	}
	if b := e.svc.VideoURL("v0123456789", "u1", time.Date(2026, 1, 1, 17, 30, 0, 0, time.UTC)); a == b {
		t.Fatal("less than an hour before the boundary the URL must move to the next window")
	}
	if b := e.svc.VideoURL("v0123456789", "u2", base); a == b {
		t.Fatal("two users must not share a URL")
	}
	if b := e.svc.VideoURL("v9876543210", "u1", base); a == b {
		t.Fatal("two videos must not share a URL")
	}
}

func TestVideoURLIsAlwaysBetweenOneAndSevenHoursFromExpiry(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	seen := map[string]bool{}
	for d := time.Duration(0); d < 24*time.Hour; d += time.Minute {
		now := start.Add(d)
		clock.t = now
		signed := e.svc.VideoURL("v0123456789", "u1", now)
		life := expOf(t, signed).Sub(now)
		if life < time.Hour || life >= 7*time.Hour {
			t.Fatalf("at %s the URL has %v left", now.Format("15:04"), life)
		}
		r := httptest.NewRequest("GET", signed, nil)
		if uid, ok := e.svc.Verify(r); !ok || uid != "u1" {
			t.Fatalf("at %s the URL does not verify: %s", now.Format("15:04"), signed)
		}
		seen[signed] = true
	}
	if len(seen) != 4 && len(seen) != 5 {
		t.Fatalf("%d different URLs in 24 hours; a 6 hour window gives 4 or 5", len(seen))
	}
}

func TestPreviewURLLivesAboutAnHour(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	signed := e.svc.PreviewURL("v0123456789", "u1", clock.t)
	if life := expOf(t, signed).Sub(clock.t); life != time.Hour {
		t.Fatalf("life = %v", life)
	}
	if _, ok := e.svc.Verify(httptest.NewRequest("GET", signed, nil)); !ok {
		t.Fatal("the preview URL does not verify")
	}
}

// A Range request into a large file reads that range only: the file is never held in memory.
func TestVideoRouteReadsOnlyTheRangeOfALargeFile(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	sum := strings.Repeat("ab", 32)
	file := video.Path(e.data, sum)
	if err := os.MkdirAll(filepath.Dir(file), 0o750); err != nil {
		t.Fatal(err)
	}
	f, err := os.Create(file)
	if err != nil {
		t.Fatal(err)
	}
	const size = 200 << 20
	if err := f.Truncate(size); err != nil { // a sparse file
		t.Fatal(err)
	}
	if _, err := f.WriteAt([]byte("RANGE-START"), 150<<20); err != nil {
		t.Fatal(err)
	}
	f.Close()
	if _, err := e.db.Exec(`INSERT INTO videos(id, sha256, name, original_name, size, duration_ms, width, height, codec, position, created_at)
		VALUES ('v0a0a0a0a0a', ?, 'x', 'x', ?, 1, 1, 1, 'avc1', 1, 1)`, sum, size); err != nil {
		t.Fatal(err)
	}
	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)
	start := time.Now()
	res := e.do(t, "GET", e.svc.VideoURL("v0a0a0a0a0a", "u1", clock.t), "Range", "bytes=157286400-157286410")
	got, _ := io.ReadAll(res.Body)
	res.Body.Close()
	runtime.ReadMemStats(&after)
	if res.StatusCode != 206 || string(got) != "RANGE-START" {
		t.Fatalf("%d %q", res.StatusCode, got)
	}
	if took := time.Since(start); took > 2*time.Second {
		t.Fatalf("took %v for 11 bytes", took)
	}
	if grew := after.TotalAlloc - before.TotalAlloc; grew > 8<<20 {
		t.Fatalf("allocated %d MiB serving 11 bytes of a 200 MiB file", grew>>20)
	}
}

// A video that was deleted (the row is gone) is 404 even for a URL that has not expired; a signature made for a song is no good here.
func TestVideoRouteAfterDeleteIs404AndASongSignatureIsNotAccepted(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	v := e.addVideo(t, "Beach", sampleMP4(5))
	u := e.svc.VideoURL(v.ID, "u1", clock.t)
	if res := e.do(t, "GET", u); res.StatusCode != 200 {
		t.Fatalf("before the delete: %d", res.StatusCode)
	}
	song := e.svc.Sign("/media/song/00001", "u1", clock.t.Add(2*time.Hour))
	if res := e.do(t, "GET", "/media/video/"+v.ID+song[strings.Index(song, "?"):]); res.StatusCode != http.StatusForbidden {
		t.Fatalf("a song's signature on a video path: %d, want 403", res.StatusCode)
	}
	if _, err := video.New(e.db).Delete(context.Background(), v.ID); err != nil {
		t.Fatal(err)
	}
	if res := e.do(t, "GET", u); res.StatusCode != http.StatusNotFound {
		t.Fatalf("after the delete: %d, want 404", res.StatusCode)
	}
}
