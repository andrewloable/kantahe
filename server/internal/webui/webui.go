// Package webui serves the Angular app that is embedded in the server binary.
package webui

import (
	"bytes"
	"compress/gzip"
	"embed"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

func init() {
	// Go has no built-in type for the web app manifest, and a container without a MIME table would send it as text/plain
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
}

// dist holds the Angular build. The checked-in placeholder keeps go build working before the web
// app has been built; scripts/build-release.sh fills it for releases.
//
//go:embed all:dist
var embedded embed.FS

// distLegacy holds the legacy build of the web app (web/dist/web-legacy: the same app converted for Chromium 74 and newer), served under
// /legacy/ to engines that cannot read the modern build. It is empty (a .gitkeep) in a plain go build; scripts/build-release.sh fills it.
//
//go:embed all:dist-legacy
var embeddedLegacy embed.FS

// ModernMinChromium is the oldest Chromium that reads the modern build (docs/PLAN.md, "Minimum engine"; web/src/index.html names the same
// number for its page). The player page of an older one is given the legacy build.
const ModernMinChromium = 85

var chromeToken = regexp.MustCompile(`Chrome/(\d+)`)

// chromeMajor reads the major version of Chromium from a user agent ("... Chrome/74.0.3729.186 ..."); false when there is none.
func chromeMajor(userAgent string) (int, bool) {
	m := chromeToken.FindStringSubmatch(userAgent)
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	return n, err == nil
}

// hashedName matches the content-hashed files of the Angular build, which sit in the root
// (main-IZBVB4U4.js, chunk-DZXaOgK1.js, chunk-9n-1avh3.js): the hash may hold "-" and "_".
var hashedName = regexp.MustCompile(`^[^/]+-[A-Za-z0-9_-]{8,}\.(js|css)$`)

// Handler serves the embedded web app.
func Handler() http.Handler {
	sub, err := fs.Sub(embedded, "dist")
	if err != nil {
		panic(err) // the directory is part of the embed pattern
	}
	legacy, err := fs.Sub(embeddedLegacy, "dist-legacy")
	if err != nil {
		panic(err) // the directory is part of the embed pattern
	}
	return NewHandlerWithLegacy(sub, legacy)
}

// NewHandlerWithLegacy serves the web app like NewHandler and, when legacy holds a build (it has an index.html), also the legacy build
// under /legacy/: a Chromium older than ModernMinChromium that asks for the player page (/embed/player, the page inside the Android and
// Android TV app) is sent to /legacy/embed/player. Every other path, and every other browser, gets the modern build. With no legacy build
// nothing is redirected and /legacy/ is not served.
func NewHandlerWithLegacy(modern, legacy fs.FS) http.Handler {
	if legacy != nil {
		if _, err := fs.Stat(legacy, "index.html"); err != nil {
			legacy = nil
		}
	}
	modernHandler := NewHandler(modern)
	if legacy == nil {
		return modernHandler
	}
	legacyHandler := NewHandler(legacy)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		if p == "/embed/player" {
			w.Header().Add("Vary", "User-Agent") // the answer depends on the browser: a cache must keep them apart
			if r.Method == http.MethodGet || r.Method == http.MethodHead {
				if major, ok := chromeMajor(r.UserAgent()); ok && major < ModernMinChromium {
					w.Header().Set("Cache-Control", "no-store")
					target := "/legacy/embed/player"
					if r.URL.RawQuery != "" {
						target += "?" + r.URL.RawQuery
					}
					http.Redirect(w, r, target, http.StatusFound)
					return
				}
			}
		}
		if p == "/legacy" || strings.HasPrefix(p, "/legacy/") {
			inner := r.Clone(r.Context())
			inner.URL.Path = strings.TrimPrefix(p, "/legacy")
			legacyHandler.ServeHTTP(w, inner)
			return
		}
		modernHandler.ServeHTTP(w, r)
	})
}

// NewHandler serves the files of fsys; a path that is not a file and has no extension is a route
// of the app and gets index.html. Paths of the API are never answered, so a routing mistake
// shows up as a 404 and not as a web page.
func NewHandler(fsys fs.FS) http.Handler {
	var gzipped sync.Map // name -> []byte: the files never change, so each is compressed once
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p := path.Clean("/" + r.URL.Path)
		if isAPI(p) {
			http.NotFound(w, r)
			return
		}
		name := strings.TrimPrefix(p, "/")
		if name == "" {
			name = "index.html"
		}
		if info, err := fs.Stat(fsys, name); err != nil || info.IsDir() {
			if strings.Contains(path.Base(name), ".") {
				// a stale page asking for an old file must not get HTML back as a script
				http.NotFound(w, r)
				return
			}
			name = "index.html"
		}
		cc := "no-cache"
		if hashedName.MatchString(name) {
			cc = "public, max-age=31536000, immutable"
		}
		w.Header().Set("Cache-Control", cc)
		// Text is sent gzipped to a browser that takes it (a plain install has no proxy to do it). A range is a part of the file
		// itself, so it is never compressed. Behind a proxy that compresses, the proxy sees the gzip and leaves it alone.
		if ext := path.Ext(name); compressible[ext] {
			w.Header().Add("Vary", "Accept-Encoding")
			if r.Header.Get("Range") == "" && acceptsGzip(r.Header.Get("Accept-Encoding")) {
				if z, err := gzipFile(&gzipped, fsys, name); err == nil {
					w.Header().Set("Content-Encoding", "gzip")
					w.Header().Set("Content-Type", mime.TypeByExtension(ext)) // never sniffed from the gzipped bytes
					http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(z))
					return
				}
			}
		}
		http.ServeFileFS(w, r, fsys, name)
	})
}

// compressible are the extensions of the text files of the web app.
var compressible = map[string]bool{".html": true, ".js": true, ".css": true, ".json": true, ".svg": true, ".webmanifest": true}

// gzipFile gives the gzipped content of a file, compressing it on the first request only.
func gzipFile(cache *sync.Map, fsys fs.FS, name string) ([]byte, error) {
	if z, ok := cache.Load(name); ok {
		return z.([]byte), nil
	}
	data, err := fs.ReadFile(fsys, name)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	zw, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression) // the level is valid
	_, _ = zw.Write(data)                                    // a bytes.Buffer does not fail
	if err := zw.Close(); err != nil {
		return nil, err
	}
	cache.Store(name, buf.Bytes())
	return buf.Bytes(), nil
}

// acceptsGzip reads an Accept-Encoding header: gzip, or *, with a q-value above 0. An explicit gzip;q=0 wins over *.
func acceptsGzip(header string) bool {
	gzipQ, anyQ := -1.0, -1.0
	for _, part := range strings.Split(header, ",") {
		token, params, _ := strings.Cut(part, ";")
		q := 1.0
		for _, p := range strings.Split(params, ";") {
			if k, v, ok := strings.Cut(strings.TrimSpace(p), "="); ok && strings.EqualFold(strings.TrimSpace(k), "q") {
				if f, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
					q = f
				}
			}
		}
		switch strings.ToLower(strings.TrimSpace(token)) {
		case "gzip":
			gzipQ = q
		case "*":
			anyQ = q
		}
	}
	if gzipQ >= 0 {
		return gzipQ > 0
	}
	return anyQ > 0
}

func isAPI(p string) bool {
	return strings.HasPrefix(p, "/kantahe.v1.") || p == "/media" || strings.HasPrefix(p, "/media/") || p == "/healthz"
}
