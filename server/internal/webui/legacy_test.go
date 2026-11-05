package webui

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

// Real user agents of a WebView: Chromium 74 is the Android 10 WebView, 113 the one of Android 14.
const (
	ua74      = "Mozilla/5.0 (Linux; Android 10; TV Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.186 Safari/537.36"
	ua84      = "Mozilla/5.0 (Linux; Android 11; TV; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/84.0.4147.89 Safari/537.36"
	ua85      = "Mozilla/5.0 (Linux; Android 11; TV; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/85.0.4183.83 Safari/537.36"
	ua113     = "Mozilla/5.0 (Linux; Android 14; TV; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/113.0.5672.136 Safari/537.36"
	uaFirefox = "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0"
	uaSafari  = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
	uaBot74   = "Mozilla/5.0 (compatible; Googlebot/2.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36"
)

func legacyFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":        {Data: []byte("<!doctype html><title>legacy</title>")},
		"main-LEGACY01.js":  {Data: []byte("console.log('legacy main')")},
		"chunk-LEGACY02.js": {Data: []byte("console.log('legacy chunk')")},
		"legacy.css":        {Data: []byte("html.legacy{}")},
	}
}

func getUA(h http.Handler, method, target, ua string, header ...string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	}
	for i := 0; i+1 < len(header); i += 2 {
		req.Header.Set(header[i], header[i+1])
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestChromeMajor(t *testing.T) {
	for _, c := range []struct {
		ua    string
		major int
		ok    bool
	}{
		{ua74, 74, true}, {ua84, 84, true}, {ua85, 85, true}, {ua113, 113, true}, {uaBot74, 74, true},
		{uaFirefox, 0, false}, {uaSafari, 0, false}, {"", 0, false}, {"Chrome/", 0, false}, {"Chrome/abc", 0, false},
	} {
		major, ok := chromeMajor(c.ua)
		if major != c.major || ok != c.ok {
			t.Errorf("chromeMajor(%q) = %d, %v; want %d, %v", c.ua, major, ok, c.major, c.ok)
		}
	}
}

func TestTheModernMinimumIsChromium85(t *testing.T) {
	// the oldest engine that reads the modern build (docs/PLAN.md, "Minimum engine"; web/src/index.html says the same for its page)
	if ModernMinChromium != 85 {
		t.Fatalf("ModernMinChromium = %d, want 85", ModernMinChromium)
	}
}

func TestOldEnginesGetTheLegacyPlayer(t *testing.T) {
	h := NewHandlerWithLegacy(testFS(), legacyFS())
	for _, c := range []struct {
		name, ua string
		redirect bool
	}{
		{"Chromium 74", ua74, true},
		{"Chromium 84, the last that needs it", ua84, true},
		{"Chromium 85, the first that does not", ua85, false},
		{"Chromium 113", ua113, false},
		{"Firefox", uaFirefox, false},
		{"Safari", uaSafari, false},
		{"no user agent", "", false},
		{"a crawler that says Chrome 74 is treated like Chrome 74", uaBot74, true},
	} {
		for _, method := range []string{"GET", "HEAD"} {
			rec := getUA(h, method, "/embed/player", c.ua)
			if c.redirect {
				if rec.Code != http.StatusFound || rec.Header().Get("Location") != "/legacy/embed/player" {
					t.Errorf("%s %s: %d %q, want a 302 to /legacy/embed/player", c.name, method, rec.Code, rec.Header().Get("Location"))
				}
				if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
					t.Errorf("%s: Cache-Control %q, want no-store (the answer depends on the browser)", c.name, cc)
				}
			} else if rec.Code != 200 || (method == "GET" && !strings.Contains(rec.Body.String(), "<title>app</title>")) {
				t.Errorf("%s %s: %d %q, want the modern page", c.name, method, rec.Code, rec.Body.String())
			}
			if v := rec.Header().Values("Vary"); !strings.Contains(strings.Join(v, ","), "User-Agent") {
				t.Errorf("%s %s: Vary %v, want User-Agent: a cache must not give one browser the page of another", c.name, method, v)
			}
		}
	}
}

func TestTheQueryAndTheTrailingSlashSurviveTheRedirect(t *testing.T) {
	h := NewHandlerWithLegacy(testFS(), legacyFS())
	if loc := getUA(h, "GET", "/embed/player?x=1&y=2", ua74).Header().Get("Location"); loc != "/legacy/embed/player?x=1&y=2" {
		t.Errorf("Location %q, want the query kept", loc)
	}
	if rec := getUA(h, "GET", "/embed/player/", ua74); rec.Code != http.StatusFound {
		t.Errorf("/embed/player/: %d, want the same redirect as without the slash", rec.Code)
	}
}

func TestNothingElseIsRedirected(t *testing.T) {
	h := NewHandlerWithLegacy(testFS(), legacyFS())
	for _, p := range []string{"/", "/library", "/embed/playerx", "/embed", "/embed/player/more", "/admin/users", "/main-ABCDEFGH.js", "/kantahe.v1.AuthService/GetServerInfo", "/media/x", "/healthz"} {
		if rec := getUA(h, "GET", p, ua74); rec.Code == http.StatusFound {
			t.Errorf("%s was redirected to %q", p, rec.Header().Get("Location"))
		}
	}
	if rec := getUA(h, "POST", "/embed/player", ua74); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST /embed/player: %d, want 405 and no redirect", rec.Code)
	}
}

func TestTheLegacyFilesAreServedUnderLegacy(t *testing.T) {
	h := NewHandlerWithLegacy(testFS(), legacyFS())
	for _, c := range []struct{ path, body, cache string }{
		{"/legacy/main-LEGACY01.js", "legacy main", "public, max-age=31536000, immutable"},
		{"/legacy/chunk-LEGACY02.js", "legacy chunk", "public, max-age=31536000, immutable"},
		{"/legacy/legacy.css", "html.legacy", "no-cache"},
		{"/legacy/embed/player", "<title>legacy</title>", "no-cache"},
		{"/legacy/", "<title>legacy</title>", "no-cache"},
		{"/legacy", "<title>legacy</title>", "no-cache"},
	} {
		rec := getUA(h, "GET", c.path, ua74)
		if rec.Code != 200 || !strings.Contains(rec.Body.String(), c.body) {
			t.Errorf("%s: %d %q, want the legacy file with %q", c.path, rec.Code, rec.Body.String(), c.body)
		}
		if cc := rec.Header().Get("Cache-Control"); cc != c.cache {
			t.Errorf("%s: Cache-Control %q, want %q", c.path, cc, c.cache)
		}
	}
}

func TestLegacyTextFilesAreGzipped(t *testing.T) {
	h := NewHandlerWithLegacy(testFS(), legacyFS())
	rec := getUA(h, "GET", "/legacy/main-LEGACY01.js", ua74, "Accept-Encoding", "gzip")
	if rec.Header().Get("Content-Encoding") != "gzip" {
		t.Errorf("Content-Encoding %q, want gzip", rec.Header().Get("Content-Encoding"))
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Errorf("Content-Type %q, want JavaScript", ct)
	}
}

func TestModernFilesAreNotServedUnderLegacyAndTheOtherWayRound(t *testing.T) {
	h := NewHandlerWithLegacy(testFS(), legacyFS())
	if rec := getUA(h, "GET", "/legacy/main-ABCDEFGH.js", ua74); rec.Code != 404 {
		t.Errorf("a modern file under /legacy: %d, want 404", rec.Code)
	}
	if rec := getUA(h, "GET", "/main-LEGACY01.js", ua74); rec.Code != 404 {
		t.Errorf("a legacy file in the modern root: %d, want 404", rec.Code)
	}
	if rec := getUA(h, "GET", "/legacy/kantahe.v1.AuthService/GetServerInfo", ua74); rec.Code != 404 {
		t.Errorf("an API path under /legacy: %d, want 404", rec.Code)
	}
	// a path that climbs out of /legacy is refused by the file server (400) or cleaned to a modern file; it is never a legacy file or a leak
	for _, p := range []string{"/legacy/../main-ABCDEFGH.js", "/legacy/../../etc/passwd", "/legacy/%2e%2e/main-ABCDEFGH.js"} {
		rec := getUA(h, "GET", p, ua74)
		if rec.Code >= 500 || strings.Contains(rec.Body.String(), "legacy main") || strings.Contains(rec.Body.String(), "root:") {
			t.Errorf("%s: %d %q", p, rec.Code, rec.Body.String())
		}
	}
	if rec := getUA(h, "GET", "/legacyx/a", ua74); rec.Code != 200 || !strings.Contains(rec.Body.String(), "<title>app</title>") {
		t.Errorf("/legacyx/a: %d %q, want the modern page (only /legacy and /legacy/... are the legacy build)", rec.Code, rec.Body.String())
	}
}

func TestWithoutALegacyBuildNothingIsRedirected(t *testing.T) {
	for name, legacy := range map[string]fs.FS{
		"no folder":       nil,
		"only a .gitkeep": fstest.MapFS{".gitkeep": {Data: nil}},
		"no index.html":   fstest.MapFS{"main-LEGACY01.js": {Data: []byte("x")}},
	} {
		h := NewHandlerWithLegacy(testFS(), legacy)
		rec := getUA(h, "GET", "/embed/player", ua74)
		if rec.Code != 200 || !strings.Contains(rec.Body.String(), "<title>app</title>") {
			t.Errorf("%s: %d %q, want the modern page for Chromium 74", name, rec.Code, rec.Body.String())
		}
		if rec := getUA(h, "GET", "/legacy/main-LEGACY01.js", ua74); rec.Code == 200 {
			t.Errorf("%s: /legacy/main-LEGACY01.js answered 200 without a legacy build", name)
		}
	}
}

func TestTheEmbeddedHandlerIsSafeWithoutALegacyBuild(t *testing.T) {
	if _, err := fs.Stat(embeddedLegacy, "dist-legacy/index.html"); err == nil {
		t.Skip("this binary carries a legacy build")
	}
	rec := getUA(Handler(), "GET", "/embed/player", ua74)
	if rec.Code != 200 {
		t.Errorf("/embed/player for Chromium 74 with no legacy build: %d, want the page", rec.Code)
	}
}
