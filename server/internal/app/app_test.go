package app

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/config"
)

func newApp(listen string) *App {
	return New(config.Config{Listen: listen}, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func TestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	newApp("127.0.0.1:0").Mux().ServeHTTP(rec, httptest.NewRequest("GET", "/healthz", nil))
	if rec.Code != 200 || rec.Body.String() != "ok" {
		t.Fatalf("got %d %q", rec.Code, rec.Body.String())
	}
	rec = httptest.NewRecorder()
	newApp("127.0.0.1:0").Mux().ServeHTTP(rec, httptest.NewRequest("POST", "/healthz", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST /healthz = %d, want 405", rec.Code)
	}
}

func TestHandleRegistersRoutes(t *testing.T) {
	a := newApp("127.0.0.1:0")
	a.Handle("GET /hello", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = io.WriteString(w, "hi") }))
	rec := httptest.NewRecorder()
	a.Mux().ServeHTTP(rec, httptest.NewRequest("GET", "/hello", nil))
	if rec.Body.String() != "hi" {
		t.Fatalf("body = %q", rec.Body.String())
	}
}

func TestRunStopsOnCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- newApp("127.0.0.1:0").Run(ctx) }()
	time.Sleep(100 * time.Millisecond)
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run returned %v, want nil", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return within 2s of cancel")
	}
}

func TestRunServesRequests(t *testing.T) {
	a := newApp("127.0.0.1:0")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = a.Run(ctx) }()
	var addr string
	for i := 0; i < 100 && addr == ""; i++ {
		addr = a.Addr()
		time.Sleep(10 * time.Millisecond)
	}
	if addr == "" {
		t.Fatal("server did not start listening")
	}
	resp, err := http.Get("http://" + addr + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if b, _ := io.ReadAll(resp.Body); resp.StatusCode != 200 || string(b) != "ok" {
		t.Fatalf("got %d %q", resp.StatusCode, b)
	}
}

func TestRunListenError(t *testing.T) {
	if err := newApp("256.0.0.1:99999").Run(context.Background()); err == nil {
		t.Fatal("want an error for an unusable listen address")
	}
}

func TestRunReleasesThePort(t *testing.T) {
	a := newApp("127.0.0.1:0")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- a.Run(ctx) }()
	var addr string
	for i := 0; i < 100 && addr == ""; i++ {
		addr = a.Addr()
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		t.Fatalf("port still held after Run returned: %v", err)
	}
	_ = ln.Close()
}
