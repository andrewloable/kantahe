package app

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// inner answers like the media handler: a partial body with Content-Range.
func inner(called *bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		*called = true
		w.Header().Set("Content-Range", "bytes 0-3/10")
		w.Header().Set("Accept-Ranges", "bytes")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = io.WriteString(w, "abcd")
	})
}

func TestCORSPreflight(t *testing.T) {
	var called bool
	h := CORS(inner(&called))
	req := httptest.NewRequest(http.MethodOptions, "/kantahe.v1.AuthService/Login", nil)
	// a packaged TV app (file:// or similar) sends Origin: null
	req.Header.Set("Origin", "null")
	req.Header.Set("Access-Control-Request-Method", "POST")
	// browsers send the list lower-case and sorted, as the fetch standard says
	req.Header.Set("Access-Control-Request-Headers", "authorization,connect-protocol-version,content-type,x-user-agent")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("allow-origin = %q, want *", got)
	}
	if got := strings.ToLower(rec.Header().Get("Access-Control-Allow-Headers")); !strings.Contains(got, "authorization") {
		t.Errorf("allow-headers = %q, want it to include Authorization", got)
	}
	if got := rec.Header().Get("Access-Control-Max-Age"); got != "7200" {
		t.Errorf("max-age = %q, want 7200", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("allow-credentials = %q: credentials must never be allowed (tokens travel in a header, not a cookie)", got)
	}
	if called {
		t.Error("the preflight reached the handler")
	}
}

func TestCORSPreflightAllowsRangeForMedia(t *testing.T) {
	var called bool
	req := httptest.NewRequest(http.MethodOptions, "/media/song", nil)
	req.Header.Set("Origin", "null")
	req.Header.Set("Access-Control-Request-Method", "GET")
	req.Header.Set("Access-Control-Request-Headers", "range")
	rec := httptest.NewRecorder()
	CORS(inner(&called)).ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || !strings.Contains(strings.ToLower(rec.Header().Get("Access-Control-Allow-Headers")), "range") {
		t.Fatalf("status %d, allow-headers %q: Range must be allowed", rec.Code, rec.Header().Get("Access-Control-Allow-Headers"))
	}
}

func TestCORSMediaExposesRangeHeaders(t *testing.T) {
	var called bool
	req := httptest.NewRequest(http.MethodGet, "/media/song", nil)
	req.Header.Set("Origin", "null")
	req.Header.Set("Range", "bytes=0-3")
	rec := httptest.NewRecorder()
	CORS(inner(&called)).ServeHTTP(rec, req)

	if !called || rec.Code != http.StatusPartialContent || rec.Body.String() != "abcd" {
		t.Fatalf("the handler's answer was changed: called=%v status=%d body=%q", called, rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("allow-origin = %q, want *", got)
	}
	exposed := strings.ToLower(rec.Header().Get("Access-Control-Expose-Headers"))
	for _, h := range []string{"content-range", "accept-ranges"} {
		if !strings.Contains(exposed, h) {
			t.Errorf("expose-headers = %q, want %s", exposed, h)
		}
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("allow-credentials = %q, want none", got)
	}
}

func TestCORSExposesWhatConnectClientsRead(t *testing.T) {
	var called bool
	req := httptest.NewRequest(http.MethodPost, "/kantahe.v1.AuthService/Login", nil)
	req.Header.Set("Origin", "null")
	rec := httptest.NewRecorder()
	CORS(inner(&called)).ServeHTTP(rec, req)
	exposed := strings.ToLower(rec.Header().Get("Access-Control-Expose-Headers"))
	// a browser client reads the status of a streamed answer from these
	for _, h := range []string{"grpc-status", "grpc-message"} {
		if !strings.Contains(exposed, h) {
			t.Errorf("expose-headers = %q, want %s", exposed, h)
		}
	}
}

func TestCORSLeavesOtherRequestsAlone(t *testing.T) {
	var called bool
	rec := httptest.NewRecorder()
	CORS(inner(&called)).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/media/song", nil))
	if !called || rec.Code != http.StatusPartialContent {
		t.Fatalf("a request without Origin must reach the handler: called=%v status=%d", called, rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("allow-origin = %q without an Origin header", got)
	}
}
