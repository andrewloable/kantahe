package webui

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func getWith(h http.Handler, method, target string, header map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func gunzip(t *testing.T, b []byte) string {
	t.Helper()
	zr, err := gzip.NewReader(strings.NewReader(string(b)))
	if err != nil {
		t.Fatalf("not gzip: %v", err)
	}
	out, err := io.ReadAll(zr)
	if err != nil {
		t.Fatalf("gunzip: %v", err)
	}
	return string(out)
}

// A plain install (no reverse proxy) used to send the web app's ~1 MB of JavaScript uncompressed.
func TestRegression_TextFilesAreGzipped(t *testing.T) {
	h := NewHandler(testFS())
	for p, want := range map[string]string{
		"/main-ABCDEFGH.js":      "console.log(1)",
		"/styles-1A2B3C4D5E.css": "body{}",
		"/library":               "<!doctype html><title>app</title>", // a route of the app: index.html
		"/manifest.webmanifest":  `{"name":"Kantahe"}`,
		"/assets/logo.svg":       "<svg/>",
	} {
		rec := getWith(h, "GET", p, map[string]string{"Accept-Encoding": "br, gzip;q=0.8"})
		if rec.Code != 200 {
			t.Fatalf("%s: status %d", p, rec.Code)
		}
		if ce := rec.Header().Get("Content-Encoding"); ce != "gzip" {
			t.Fatalf("%s: Content-Encoding %q, want gzip", p, ce)
		}
		if got := gunzip(t, rec.Body.Bytes()); got != want {
			t.Errorf("%s: body %q, want %q", p, got, want)
		}
		if cl := rec.Header().Get("Content-Length"); cl != "" && cl != strconv.Itoa(rec.Body.Len()) {
			t.Errorf("%s: Content-Length %s for %d bytes", p, cl, rec.Body.Len())
		}
	}
	// the caching rules and the type stay as they were
	rec := getWith(h, "GET", "/main-ABCDEFGH.js", map[string]string{"Accept-Encoding": "gzip"})
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=31536000, immutable" {
		t.Errorf("Cache-Control %q", cc)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Errorf("Content-Type %q", ct)
	}
}

// A cache between the server and the browser must not hand the gzipped file to a browser that did not ask for it.
func TestCompressibleFilesVaryByAcceptEncoding(t *testing.T) {
	h := NewHandler(testFS())
	for _, ae := range []string{"gzip", ""} {
		rec := getWith(h, "GET", "/main-ABCDEFGH.js", map[string]string{"Accept-Encoding": ae})
		if v := rec.Header().Get("Vary"); !strings.Contains(v, "Accept-Encoding") {
			t.Errorf("Accept-Encoding %q: Vary %q", ae, v)
		}
	}
}

func TestNotGzipped(t *testing.T) {
	h := NewHandler(testFS())
	cases := []struct {
		name, path string
		header     map[string]string
		code       int
		body       string
	}{
		{"no Accept-Encoding", "/main-ABCDEFGH.js", nil, 200, "console.log(1)"},
		{"gzip refused", "/main-ABCDEFGH.js", map[string]string{"Accept-Encoding": "gzip;q=0, br"}, 200, "console.log(1)"},
		{"a range", "/main-ABCDEFGH.js", map[string]string{"Accept-Encoding": "gzip", "Range": "bytes=0-3"}, 206, "cons"},
		{"not text", "/favicon.ico", map[string]string{"Accept-Encoding": "gzip"}, 200, "ico"},
	}
	for _, c := range cases {
		rec := getWith(h, "GET", c.path, c.header)
		if rec.Code != c.code || rec.Body.String() != c.body {
			t.Errorf("%s: status %d body %q, want %d %q", c.name, rec.Code, rec.Body.String(), c.code, c.body)
		}
		if ce := rec.Header().Get("Content-Encoding"); ce != "" {
			t.Errorf("%s: Content-Encoding %q", c.name, ce)
		}
	}
}

func TestHeadOfAGzippedFile(t *testing.T) {
	rec := getWith(NewHandler(testFS()), "HEAD", "/main-ABCDEFGH.js", map[string]string{"Accept-Encoding": "gzip"})
	if rec.Code != 200 || rec.Body.Len() != 0 || rec.Header().Get("Content-Encoding") != "gzip" {
		t.Errorf("HEAD: status %d, %d bytes, Content-Encoding %q", rec.Code, rec.Body.Len(), rec.Header().Get("Content-Encoding"))
	}
}

func TestAcceptsGzip(t *testing.T) {
	for in, want := range map[string]bool{
		"":                     false,
		"gzip":                 true,
		"GZIP":                 true,
		"br, gzip;q=0.5":       true,
		"gzip;q=0":             false,
		"gzip; q=0.0":          false,
		"deflate, br":          false,
		"x-gzip":               false,
		"*":                    true,
		"*;q=0":                false,
		"identity, gzip ; q=1": true,
	} {
		if got := acceptsGzip(in); got != want {
			t.Errorf("acceptsGzip(%q) = %v, want %v", in, got, want)
		}
	}
}
