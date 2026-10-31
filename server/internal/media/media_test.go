package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/assets"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

type testEnv struct {
	db   *store.DB
	svc  *Service
	srv  *httptest.Server
	now  time.Time
	data string
}

type clockBox struct{ t time.Time }

func newEnv(t *testing.T, soundfont string) (*testEnv, *clockBox) {
	t.Helper()
	data := t.TempDir()
	db, err := store.Open(context.Background(), data)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	clock := &clockBox{time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)}
	svc, err := New(context.Background(), Config{
		DB: db, SoundFont: soundfont, DataDir: data, Now: func() time.Time { return clock.t },
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	svc.Routes(mux.Handle)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &testEnv{db, svc, srv, clock.t, data}, clock
}

func (e *testEnv) addUser(t *testing.T, id string, disabled bool) {
	t.Helper()
	d := 0
	if disabled {
		d = 1
	}
	if _, err := e.db.Exec(`INSERT INTO users(id, email, display_name, password_hash, disabled, created_at) VALUES (?, ?, 'U', 'h', ?, 1)`, id, id+"@x.y", d); err != nil {
		t.Fatal(err)
	}
}

func (e *testEnv) addSong(t *testing.T, number string, format int, path, media string, failed, deleted bool) {
	t.Helper()
	b := func(v bool) int {
		if v {
			return 1
		}
		return 0
	}
	if _, err := e.db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, media_path, failed, deleted, metadata_done, created_at)
		VALUES (?, ?, 1, ?, ?, 1, 1, 'x', ?, ?, ?, 1, 1)`, number, format, path, "sha"+number, media, b(failed), b(deleted)); err != nil {
		t.Fatal(err)
	}
}

func (e *testEnv) get(t *testing.T, rawURL string, headers ...string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest("GET", e.srv.URL+rawURL, nil)
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := e.srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func body(t *testing.T, res *http.Response) []byte {
	t.Helper()
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return b
}

func TestSignVerify(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	signed := e.svc.Sign("/media/song/00001", "u1", clock.t.Add(URLLifetime))
	if !strings.HasPrefix(signed, "/media/song/00001?u=u1&exp=") || !strings.Contains(signed, "&sig=") {
		t.Fatalf("format: %s", signed)
	}
	verify := func(raw string) (string, bool) {
		r := httptest.NewRequest("GET", raw, nil)
		return e.svc.Verify(r)
	}
	if uid, ok := verify(signed); !ok || uid != "u1" {
		t.Fatalf("a fresh URL must verify: %q %v", uid, ok)
	}
	u, _ := url.Parse(signed)
	q := u.Query()
	mutate := func(key, val string) string {
		c := url.Values{}
		for k, v := range q {
			c[k] = v
		}
		c.Set(key, val)
		return u.Path + "?" + c.Encode()
	}
	for name, raw := range map[string]string{
		"other user":  mutate("u", "u2"),
		"other exp":   mutate("exp", strconv.FormatInt(clock.t.Add(URLLifetime+time.Hour).Unix(), 10)),
		"other sig":   mutate("sig", "AAAA"),
		"empty sig":   mutate("sig", ""),
		"other path":  "/media/song/00002?" + u.RawQuery,
		"no query":    u.Path,
		"bad exp":     mutate("exp", "soon"),
		"empty user":  mutate("u", ""),
		"bad sig b64": mutate("sig", "!!!"),
	} {
		if _, ok := verify(raw); ok {
			t.Errorf("%s: must not verify", name)
		}
	}
	// expiry
	clock.t = clock.t.Add(URLLifetime + time.Second)
	if _, ok := verify(signed); ok {
		t.Error("an expired URL must not verify")
	}
	clock.t = clock.t.Add(-URLLifetime - time.Second)
	// too far ahead: a URL valid for 8 hours is refused even with a correct signature
	long := e.svc.Sign("/media/song/00001", "u1", clock.t.Add(8*time.Hour))
	if _, ok := verify(long); ok {
		t.Error("an expiry more than 7 hours ahead must be refused")
	}
	edge := e.svc.Sign("/media/song/00001", "u1", clock.t.Add(MaxLifetime))
	if _, ok := verify(edge); !ok {
		t.Error("exactly 7 hours ahead is allowed")
	}
	// disabled and unknown users
	e.addUser(t, "u3", true)
	if _, ok := verify(e.svc.Sign("/media/song/00001", "u3", clock.t.Add(time.Hour))); ok {
		t.Error("a disabled user's URL must not verify")
	}
	if _, ok := verify(e.svc.Sign("/media/song/00001", "ghost", clock.t.Add(time.Hour))); ok {
		t.Error("a deleted user's URL must not verify")
	}
}

func TestSignatureDependsOnTheSecret(t *testing.T) {
	e1, c1 := newEnv(t, "")
	e2, _ := newEnv(t, "")
	e1.addUser(t, "u1", false)
	e2.addUser(t, "u1", false)
	signed := e1.svc.Sign("/media/song/00001", "u1", c1.t.Add(time.Hour))
	if _, ok := e2.svc.Verify(httptest.NewRequest("GET", signed, nil)); ok {
		t.Fatal("a URL signed by another server must not verify")
	}
	// the secret is stable across restarts of the same database
	svc2, err := New(context.Background(), Config{DB: e1.db, Now: func() time.Time { return c1.t }, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := svc2.Verify(httptest.NewRequest("GET", signed, nil)); !ok {
		t.Fatal("URLs must survive a restart")
	}
}

func TestSongRange(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	mp3 := testfix.MP3Frames(200)
	p := filepath.Join(e.data, "m.mp3")
	_ = os.WriteFile(p, mp3, 0o640)
	e.addSong(t, "00001", 1, "/zip/path", p, false, false)
	signed := e.svc.Sign("/media/song/00001", "u1", clock.t.Add(time.Hour))
	res := e.get(t, signed, "Range", "bytes=0-99")
	b := body(t, res)
	if res.StatusCode != 206 || !bytes.Equal(b, mp3[:100]) || res.Header.Get("Content-Type") != "audio/mpeg" {
		t.Fatalf("status %d type %q len %d", res.StatusCode, res.Header.Get("Content-Type"), len(b))
	}
	if cr := res.Header.Get("Content-Range"); cr != "bytes 0-99/"+strconv.Itoa(len(mp3)) {
		t.Errorf("Content-Range = %q", cr)
	}
	if cc := res.Header.Get("Cache-Control"); cc != "private, max-age=3600" {
		t.Errorf("Cache-Control = %q", cc)
	}
	if res.Header.Get("Accept-Ranges") != "bytes" {
		t.Error("Accept-Ranges missing")
	}
	// a middle range and a full read
	res = e.get(t, signed, "Range", "bytes=100-199")
	if b := body(t, res); res.StatusCode != 206 || !bytes.Equal(b, mp3[100:200]) {
		t.Fatalf("middle range: %d", res.StatusCode)
	}
	res = e.get(t, signed)
	if b := body(t, res); res.StatusCode != 200 || !bytes.Equal(b, mp3) {
		t.Fatalf("full read: %d", res.StatusCode)
	}
	req, _ := http.NewRequest("HEAD", e.srv.URL+signed, nil)
	hres, _ := e.srv.Client().Do(req)
	hres.Body.Close()
	if hres.StatusCode != 200 || hres.Header.Get("Content-Length") != strconv.Itoa(len(mp3)) {
		t.Fatalf("HEAD: %d %s", hres.StatusCode, hres.Header.Get("Content-Length"))
	}
}

func TestSongMIDI(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	kar := testfix.KAR("S", "A", []testfix.Syllable{{Tick: 0, Text: "hi"}})
	p := filepath.Join(e.data, "s.kar")
	_ = os.WriteFile(p, kar, 0o640)
	e.addSong(t, "00002", 2, p, "", false, false)
	res := e.get(t, e.svc.Sign("/media/song/00002", "u1", clock.t.Add(time.Hour)))
	if b := body(t, res); res.StatusCode != 200 || res.Header.Get("Content-Type") != "audio/midi" || !bytes.Equal(b, kar) {
		t.Fatalf("status %d type %q", res.StatusCode, res.Header.Get("Content-Type"))
	}
}

func TestSongNotServed(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	p := filepath.Join(e.data, "m.mp3")
	_ = os.WriteFile(p, testfix.MP3Frames(5), 0o640)
	e.addSong(t, "00001", 1, "/z", p, false, true)    // deleted
	e.addSong(t, "00002", 1, "/z2", p, true, false)   // failed
	e.addSong(t, "00003", 1, "/z3", "", false, false) // MP3 whose media was not extracted
	e.addSong(t, "00004", 1, "/z4", filepath.Join(e.data, "missing.mp3"), false, false)
	for _, n := range []string{"00001", "00002", "00003", "00004", "99999", "abc"} {
		res := e.get(t, e.svc.Sign("/media/song/"+n, "u1", clock.t.Add(time.Hour)))
		res.Body.Close()
		if res.StatusCode != 404 {
			t.Errorf("%s: status %d, want 404", n, res.StatusCode)
		}
	}
	// the signature is checked before the song is looked up: no oracle for unsigned callers
	res := e.get(t, "/media/song/99999")
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Errorf("unsigned request for a missing song: %d, want 403", res.StatusCode)
	}
	res = e.get(t, "/media/song/00001")
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Errorf("unsigned: %d", res.StatusCode)
	}
}

func TestSongForbidden(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	signed := e.svc.Sign("/media/song/00001", "u1", clock.t.Add(time.Hour))
	for name, raw := range map[string]string{
		"tampered":  strings.Replace(signed, "u=u1", "u=u2", 1),
		"no params": "/media/song/00001",
	} {
		res := e.get(t, raw)
		res.Body.Close()
		if res.StatusCode != 403 {
			t.Errorf("%s: %d", name, res.StatusCode)
		}
	}
	clock.t = clock.t.Add(2 * time.Hour)
	res := e.get(t, signed)
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Errorf("expired: %d", res.StatusCode)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	for _, path := range []string{e.svc.Sign("/media/song/00001", "u1", clock.t.Add(time.Hour)), "/media/soundfont.sf2", "/media/fanfare/1.mp3"} {
		req, _ := http.NewRequest("POST", e.srv.URL+path, strings.NewReader("x"))
		res, err := e.srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusMethodNotAllowed {
			t.Errorf("POST %s: %d", path, res.StatusCode)
		}
	}
}

func TestSoundFontETag(t *testing.T) {
	sf := testfix.SF2([]testfix.Preset{{Name: "P", Samples: [][]int16{make([]int16, 100)}}})
	p := filepath.Join(t.TempDir(), "bank.sf2")
	_ = os.WriteFile(p, sf, 0o644)
	e, _ := newEnv(t, p)
	res := e.get(t, "/media/soundfont.sf2")
	b := body(t, res)
	sum := sha256.Sum256(sf)
	wantTag := `"` + hex.EncodeToString(sum[:])[:16] + `"`
	if res.StatusCode != 200 || !bytes.Equal(b, sf) || res.Header.Get("ETag") != wantTag || res.Header.Get("Cache-Control") != "public, max-age=86400" {
		t.Fatalf("status %d etag %q cc %q", res.StatusCode, res.Header.Get("ETag"), res.Header.Get("Cache-Control"))
	}
	res = e.get(t, "/media/soundfont.sf2", "If-None-Match", wantTag)
	res.Body.Close()
	if res.StatusCode != 304 {
		t.Fatalf("conditional request: %d, want 304", res.StatusCode)
	}
	res = e.get(t, "/media/soundfont.sf2", "Range", "bytes=0-3")
	if b := body(t, res); res.StatusCode != 206 || string(b) != "RIFF" {
		t.Fatalf("range: %d %q", res.StatusCode, b)
	}
	if !e.svc.HasSoundFont() {
		t.Fatal("HasSoundFont")
	}
	// not configured
	e2, _ := newEnv(t, "")
	res = e2.get(t, "/media/soundfont.sf2")
	res.Body.Close()
	if res.StatusCode != 404 || e2.svc.HasSoundFont() {
		t.Fatalf("unconfigured: %d", res.StatusCode)
	}
}

func TestSoundFontUnreadableAtStart(t *testing.T) {
	if _, err := New(context.Background(), Config{DB: nil, SoundFont: filepath.Join(t.TempDir(), "missing.sf2"), Now: time.Now, Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}); err == nil {
		t.Fatal("a configured SoundFont that cannot be read must be an error at start")
	}
}

func TestFanfare(t *testing.T) {
	e, _ := newEnv(t, "")
	want, _ := assets.Fanfare(2)
	res := e.get(t, "/media/fanfare/2.mp3")
	if b := body(t, res); res.StatusCode != 200 || !bytes.Equal(b, want) || res.Header.Get("Content-Type") != "audio/mpeg" || res.Header.Get("Cache-Control") != "public, max-age=86400" {
		t.Fatalf("status %d type %q cc %q", res.StatusCode, res.Header.Get("Content-Type"), res.Header.Get("Cache-Control"))
	}
	for _, name := range []string{"4.mp3", "0.mp3", "x.mp3", "2", "2.wav", "02.mp3", "../2.mp3"} {
		res := e.get(t, "/media/fanfare/"+name)
		res.Body.Close()
		if res.StatusCode != 404 {
			t.Errorf("%s: %d, want 404", name, res.StatusCode)
		}
	}
}

// The signed text joins path, user and expiry with newlines. If a path or user id
// could contain a newline, two different (path, user) pairs would sign alike.
func TestVerifyRefusesNewlinesSoFieldsCannotBeShifted(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "X", false)
	exp := strconv.FormatInt(clock.t.Add(time.Hour).Unix(), 10)
	// a signature over (path, "abc\nX", exp) ...
	sig := base64.RawURLEncoding.EncodeToString(e.svc.mac("/media/song/00001", "abc\nX", exp))
	// ... presented for path "/media/song/00001\nabc" and user "X" has the same signed text
	r := httptest.NewRequest("GET", "/media/song/00001?u=X&exp="+exp+"&sig="+sig, nil)
	r.URL.Path = "/media/song/00001\nabc"
	if _, ok := e.svc.Verify(r); ok {
		t.Fatal("a path containing a newline must never verify")
	}
	r = httptest.NewRequest("GET", "/media/song/00001?u=abc%0AX&exp="+exp+"&sig="+sig, nil)
	if _, ok := e.svc.Verify(r); ok {
		t.Fatal("a user id containing a newline must never verify")
	}
}

func TestSongResponsesCarryLastModifiedAndHonourConditionalRequests(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	p := filepath.Join(e.data, "m.mp3")
	_ = os.WriteFile(p, testfix.MP3Frames(20), 0o640)
	e.addSong(t, "00001", 1, "/z", p, false, false)
	signed := e.svc.Sign("/media/song/00001", "u1", clock.t.Add(time.Hour))
	res := e.get(t, signed)
	res.Body.Close()
	lm := res.Header.Get("Last-Modified")
	if lm == "" {
		t.Fatal("Last-Modified missing")
	}
	res = e.get(t, signed, "If-Modified-Since", lm)
	res.Body.Close()
	if res.StatusCode != http.StatusNotModified {
		t.Fatalf("conditional request: %d", res.StatusCode)
	}
}
