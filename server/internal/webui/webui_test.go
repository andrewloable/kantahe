package webui

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func testFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":                   {Data: []byte("<!doctype html><title>app</title>")},
		"main-ABCDEFGH.js":             {Data: []byte("console.log(1)")},
		"styles-1A2B3C4D5E.css":        {Data: []byte("body{}")},
		"assets/spessasynth/proc.js":   {Data: []byte("registerProcessor()")},
		"chunk-SHORT.js":               {Data: []byte("x")},
		"chunk-DZXaOgK1.js":            {Data: []byte("lazy")},
		"chunk-9n-1avh3.js":            {Data: []byte("lazy")},
		"assets/long-name-ABCDEFGH.js": {Data: []byte("unhashed asset in a folder")},
		"favicon.ico":                  {Data: []byte("ico")},
		"assets/logo.svg":              {Data: []byte("<svg/>")},
		"assets/sub/deep/file.txt":     {Data: []byte("deep")},
		"assets/sub/deep/index.html":   {Data: []byte("not the app")},
		"assets/sub/deep/other-0.css":  {Data: []byte("a{}")},
	}
}

func get(h http.Handler, method, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func TestSPAFallback(t *testing.T) {
	h := NewHandler(testFS())
	for _, p := range []string{"/", "/library", "/library/", "/me/password", "/admin/users", "/embed/player", "/a/b/c/d", "/index.html"} {
		rec := get(h, "GET", p)
		if p == "/index.html" {
			// the file itself: net/http redirects it to the directory form
			if rec.Code != http.StatusMovedPermanently && rec.Code != http.StatusOK {
				t.Errorf("%s: status %d", p, rec.Code)
			}
			continue
		}
		if rec.Code != 200 || !strings.Contains(rec.Body.String(), "<title>app</title>") {
			t.Errorf("%s: status %d body %q, want index.html", p, rec.Code, rec.Body.String())
		}
		if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
			t.Errorf("%s: Cache-Control %q, want no-cache", p, cc)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
			t.Errorf("%s: Content-Type %q", p, ct)
		}
	}
}

func TestHashedAssetsAreImmutable(t *testing.T) {
	h := NewHandler(testFS())
	for _, p := range []string{"/main-ABCDEFGH.js", "/styles-1A2B3C4D5E.css"} {
		rec := get(h, "GET", p)
		if rec.Code != 200 {
			t.Fatalf("%s: status %d", p, rec.Code)
		}
		if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=31536000, immutable" {
			t.Errorf("%s: Cache-Control %q", p, cc)
		}
	}
	if ct := get(h, "GET", "/main-ABCDEFGH.js").Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Errorf("js Content-Type %q", ct)
	}
}

func TestOtherFilesMustBeRevalidated(t *testing.T) {
	h := NewHandler(testFS())
	// too short to be a content hash, or not hashed at all
	for _, p := range []string{"/chunk-SHORT.js", "/favicon.ico", "/assets/logo.svg", "/assets/spessasynth/proc.js", "/assets/sub/deep/other-0.css"} {
		rec := get(h, "GET", p)
		if rec.Code != 200 {
			t.Fatalf("%s: status %d", p, rec.Code)
		}
		if cc := rec.Header().Get("Cache-Control"); cc != "no-cache" {
			t.Errorf("%s: Cache-Control %q, want no-cache", p, cc)
		}
	}
	if body := get(h, "GET", "/assets/sub/deep/file.txt").Body.String(); body != "deep" {
		t.Errorf("nested file body %q", body)
	}
}

func TestNeverAnswersForTheAPI(t *testing.T) {
	h := NewHandler(testFS())
	for _, p := range []string{"/kantahe.v1.AuthService/Login", "/kantahe.v1.SessionService/WatchState", "/media/x", "/media/", "/media", "/healthz"} {
		rec := get(h, "GET", p)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404 so that nothing hides a routing mistake", p, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "<title>app</title>") {
			t.Errorf("%s: served the app", p)
		}
	}
	// a route of the app whose name only starts like an API path
	if rec := get(h, "GET", "/mediathek"); rec.Code != 200 {
		t.Errorf("/mediathek: status %d", rec.Code)
	}
}

func TestMissingFileWithExtensionIs404(t *testing.T) {
	h := NewHandler(testFS())
	// a stale page asking for an old hashed file must not get HTML back as JavaScript
	for _, p := range []string{"/main-OLDOLDOLD.js", "/assets/missing.png", "/robots.txt"} {
		if rec := get(h, "GET", p); rec.Code != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404", p, rec.Code)
		}
	}
}

func TestMethods(t *testing.T) {
	h := NewHandler(testFS())
	rec := get(h, "HEAD", "/library")
	if rec.Code != 200 || rec.Body.Len() != 0 {
		t.Errorf("HEAD: status %d body %d bytes", rec.Code, rec.Body.Len())
	}
	if rec := get(h, "HEAD", "/main-ABCDEFGH.js"); rec.Code != 200 || rec.Header().Get("Cache-Control") == "" {
		t.Errorf("HEAD asset: status %d", rec.Code)
	}
	for _, m := range []string{"POST", "PUT", "DELETE", "PATCH"} {
		rec := get(h, m, "/library")
		if rec.Code != http.StatusMethodNotAllowed || rec.Header().Get("Allow") != "GET, HEAD" {
			t.Errorf("%s: status %d Allow %q", m, rec.Code, rec.Header().Get("Allow"))
		}
	}
}

func TestPathTricks(t *testing.T) {
	h := NewHandler(testFS())
	for _, p := range []string{"/../etc/passwd", "/assets/../../x", "/%2e%2e/%2e%2e/etc/passwd", "//assets//logo.svg"} {
		rec := get(h, "GET", p)
		if rec.Code >= 500 {
			t.Errorf("%s: status %d", p, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "root:") {
			t.Errorf("%s: leaked", p)
		}
	}
}

func TestEmbeddedBuildAlwaysServesAPage(t *testing.T) {
	// Whatever is embedded (the placeholder or a real build), the root is an HTML page.
	rec := get(Handler(), "GET", "/")
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("status %d type %q", rec.Code, rec.Header().Get("Content-Type"))
	}
}

// The Angular build names lazy chunks with mixed-case hashes that may contain "-" and "_"
// (chunk-DZXaOgK1.js, chunk-9n-1avh3.js); they are as immutable as main-IZBVB4U4.js.
func TestRegression_MixedCaseChunkHashesAreImmutable(t *testing.T) {
	h := NewHandler(testFS())
	for _, p := range []string{"/chunk-DZXaOgK1.js", "/chunk-9n-1avh3.js"} {
		if cc := get(h, "GET", p).Header().Get("Cache-Control"); cc != "public, max-age=31536000, immutable" {
			t.Errorf("%s: Cache-Control %q", p, cc)
		}
	}
	// only the root-level build output is hashed; a file in a folder keeps being revalidated
	if cc := get(h, "GET", "/assets/long-name-ABCDEFGH.js").Header().Get("Cache-Control"); cc != "no-cache" {
		t.Errorf("assets file: Cache-Control %q, want no-cache", cc)
	}
}
