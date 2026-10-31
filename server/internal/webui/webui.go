// Package webui serves the Angular app that is embedded in the server binary.
package webui

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"regexp"
	"strings"
)

// dist holds the Angular build. The checked-in placeholder keeps go build working before the web
// app has been built; scripts/build-release.sh fills it for releases.
//
//go:embed all:dist
var embedded embed.FS

// hashedName matches the content-hashed files of the Angular build, which sit in the root
// (main-IZBVB4U4.js, chunk-DZXaOgK1.js, chunk-9n-1avh3.js): the hash may hold "-" and "_".
var hashedName = regexp.MustCompile(`^[^/]+-[A-Za-z0-9_-]{8,}\.(js|css)$`)

// Handler serves the embedded web app.
func Handler() http.Handler {
	sub, err := fs.Sub(embedded, "dist")
	if err != nil {
		panic(err) // the directory is part of the embed pattern
	}
	return NewHandler(sub)
}

// NewHandler serves the files of fsys; a path that is not a file and has no extension is a route
// of the app and gets index.html. Paths of the API are never answered, so a routing mistake
// shows up as a 404 and not as a web page.
func NewHandler(fsys fs.FS) http.Handler {
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
		http.ServeFileFS(w, r, fsys, name)
	})
}

func isAPI(p string) bool {
	return strings.HasPrefix(p, "/kantahe.v1.") || p == "/media" || strings.HasPrefix(p, "/media/") || p == "/healthz"
}
