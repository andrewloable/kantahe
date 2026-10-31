package media

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/library"
)

type fakeRenderer struct {
	mu       sync.Mutex
	avail    bool
	path     string
	err      error
	prepared []string
	touched  []string
}

func (f *fakeRenderer) Available() bool                              { return f.avail }
func (f *fakeRenderer) Ready(context.Context, string) bool           { return f.err == nil }
func (f *fakeRenderer) Failed(context.Context, string) bool          { return errors.Is(f.err, ErrBuildFailed) }
func (f *fakeRenderer) Path(context.Context, string) (string, error) { return f.path, f.err }
func (f *fakeRenderer) Prepare(n string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.prepared = append(f.prepared, n)
}
func (f *fakeRenderer) Touch(p string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.touched = append(f.touched, p)
}

func renderedEnv(t *testing.T, r *fakeRenderer) (*testEnv, *clockBox, string) {
	t.Helper()
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	e.svc.SetRenderer(r)
	return e, clock, e.svc.Sign("/media/rendered/00001", "u1", clock.t.Add(URLLifetime))
}

func TestRenderedRequiresASignature(t *testing.T) {
	r := &fakeRenderer{avail: true, path: filepath.Join(t.TempDir(), "x.flac")}
	e, _, signed := renderedEnv(t, r)
	for name, u := range map[string]string{
		"no query":      "/media/rendered/00001",
		"wrong song":    strings.Replace(signed, "00001", "00002", 1),
		"bad signature": signed[:len(signed)-3] + "xyz",
	} {
		res := e.get(t, u)
		res.Body.Close()
		if res.StatusCode != http.StatusForbidden {
			t.Errorf("%s: status %d, want 403", name, res.StatusCode)
		}
	}
	if len(r.prepared) != 0 || len(r.touched) != 0 {
		t.Error("an unauthorised request reached the renderer")
	}
}

func TestRenderedIsNotFoundWithoutARenderer(t *testing.T) {
	e, clock := newEnv(t, "")
	e.addUser(t, "u1", false)
	signed := e.svc.Sign("/media/rendered/00001", "u1", clock.t.Add(URLLifetime))
	if res := e.get(t, signed); res.StatusCode != http.StatusNotFound {
		t.Errorf("no renderer: status %d, want 404", res.StatusCode)
	}
	e.svc.SetRenderer(&fakeRenderer{avail: false})
	if res := e.get(t, signed); res.StatusCode != http.StatusNotFound {
		t.Errorf("renderer switched off: status %d, want 404", res.StatusCode)
	}
}

func TestRenderedNotReadyIs503AndStartsTheRender(t *testing.T) {
	r := &fakeRenderer{avail: true, err: ErrNotReady}
	e, _, signed := renderedEnv(t, r)
	res := e.get(t, signed)
	res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable || res.Header.Get("Retry-After") != "2" {
		t.Fatalf("status %d Retry-After %q, want 503 and 2", res.StatusCode, res.Header.Get("Retry-After"))
	}
	if len(r.prepared) != 1 || r.prepared[0] != "00001" {
		t.Fatalf("Prepare calls: %v", r.prepared)
	}
}

func TestRenderedServesRanges(t *testing.T) {
	file := filepath.Join(t.TempDir(), "x.flac")
	if err := os.WriteFile(file, []byte("fLaC0123456789"), 0o600); err != nil {
		t.Fatal(err)
	}
	r := &fakeRenderer{avail: true, path: file}
	e, _, signed := renderedEnv(t, r)

	res := e.get(t, signed)
	b := body(t, res)
	if res.StatusCode != 200 || string(b) != "fLaC0123456789" || res.Header.Get("Content-Type") != "audio/flac" || res.Header.Get("Accept-Ranges") != "bytes" {
		t.Fatalf("full: %d %q type %q ranges %q", res.StatusCode, b, res.Header.Get("Content-Type"), res.Header.Get("Accept-Ranges"))
	}
	res = e.get(t, signed, "Range", "bytes=4-7")
	b = body(t, res)
	if res.StatusCode != http.StatusPartialContent || string(b) != "0123" || res.Header.Get("Content-Range") != "bytes 4-7/14" {
		t.Fatalf("range: %d %q %q", res.StatusCode, b, res.Header.Get("Content-Range"))
	}
	if len(r.touched) != 2 || r.touched[0] != file {
		t.Fatalf("Touch calls: %v, want one per request so that the cache keeps what is played", r.touched)
	}
}

func TestRenderedErrors(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		want int
	}{
		"unknown or MP3 song": {library.ErrNotFound, http.StatusNotFound},
		"render failed":       {ErrBuildFailed, http.StatusInternalServerError},
		"something else":      {errors.New("disk on fire"), http.StatusInternalServerError},
	} {
		r := &fakeRenderer{avail: true, err: tc.err}
		e, _, signed := renderedEnv(t, r)
		res := e.get(t, signed)
		res.Body.Close()
		if res.StatusCode != tc.want {
			t.Errorf("%s: status %d, want %d", name, res.StatusCode, tc.want)
		}
		if len(r.prepared) != 0 {
			t.Errorf("%s: a failure must not queue another render", name)
		}
	}
}

// regression: the cache can evict a file (or a person can clear the folder) between the renderer
// saying "here it is" and the file being opened; the client must be told to retry, not that the song is gone.
func TestRegression_RenderedFileVanishedBetweenLookupAndOpen(t *testing.T) {
	r := &fakeRenderer{avail: true, path: filepath.Join(t.TempDir(), "gone.flac")}
	e, _, signed := renderedEnv(t, r)
	res := e.get(t, signed)
	res.Body.Close()
	if res.StatusCode != http.StatusServiceUnavailable || res.Header.Get("Retry-After") != "2" {
		t.Fatalf("status %d Retry-After %q, want 503 and 2", res.StatusCode, res.Header.Get("Retry-After"))
	}
	if len(r.prepared) != 1 {
		t.Fatalf("Prepare calls: %v, want the render to be started again", r.prepared)
	}
}
