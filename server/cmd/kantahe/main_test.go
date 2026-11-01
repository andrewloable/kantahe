package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/api"
	"github.com/andrewloable/kantahe/server/internal/app"
	"github.com/andrewloable/kantahe/server/internal/config"
	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
)

func TestVersionFlag(t *testing.T) {
	var out bytes.Buffer
	if code := run([]string{"--version"}, &out); code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
	if got, want := out.String(), "kantahe dev\n"; got != want {
		t.Fatalf("output = %q, want %q", got, want)
	}
}

func TestUnknownFlag(t *testing.T) {
	var out bytes.Buffer
	if code := run([]string{"--nope"}, &out); code != 2 {
		t.Fatalf("exit code = %d, want 2", code)
	}
}

func TestUnknownFlagReportsToWriter(t *testing.T) {
	var out bytes.Buffer
	run([]string{"--nope"}, &out)
	if !strings.Contains(out.String(), "nope") {
		t.Fatalf("flag error not written to the given writer: %q", out.String())
	}
}

func TestConfigErrorExitsWithTwo(t *testing.T) {
	var out bytes.Buffer
	if code := run([]string{"--score-seconds", "99"}, &out); code != 2 {
		t.Fatalf("exit code = %d, want 2", code)
	}
	if !strings.Contains(out.String(), "score-seconds") {
		t.Fatalf("error should name the flag: %q", out.String())
	}
}

func TestHelpPrintsUsage(t *testing.T) {
	var out bytes.Buffer
	if code := run([]string{"--help"}, &out); code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
	if !strings.Contains(out.String(), "--listen") {
		t.Fatalf("usage missing: %q", out.String())
	}
}

func TestDataDirCannotBeCreated(t *testing.T) {
	file := filepath.Join(t.TempDir(), "afile")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	if code := run([]string{"--data", filepath.Join(file, "sub")}, &out); code != 1 {
		t.Fatalf("exit code = %d, want 1 (output %q)", code, out.String())
	}
}

func TestDataDirMode(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX modes only")
	}
	dir := filepath.Join(t.TempDir(), "d")
	// A bad listen address makes run return right after creating the directory.
	var out bytes.Buffer
	if code := run([]string{"--data", dir, "--listen", "256.0.0.1:1"}, &out); code != 1 {
		t.Fatalf("exit code = %d, want 1", code)
	}
	st, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}
	// the umask may only remove bits, never add them
	if st.Mode().Perm()&^0o750 != 0 {
		t.Fatalf("mode = %v, want no more than 0750", st.Mode().Perm())
	}
}

func TestWebAppAndAPIShareOneMux(t *testing.T) {
	dir := t.TempDir()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := store.Open(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	srv := app.New(config.Config{}, logger)
	mounted, err := api.Mount(srv.Handle, api.Deps{DB: db, Version: "t", Now: time.Now, Logger: logger, DataDir: dir, Importer: library.NewImporter(db, dir, nil, logger)})
	if err != nil {
		t.Fatal(err)
	}
	defer mounted.Close()
	mountWebUI(srv)
	ts := httptest.NewServer(srv.Mux())
	defer ts.Close()

	body := func(method, path string) (int, string, string) {
		req, _ := http.NewRequest(method, ts.URL+path, strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(res.Body)
		return res.StatusCode, res.Header.Get("Content-Type"), string(b)
	}
	for _, p := range []string{"/", "/library", "/embed/player"} {
		if code, ct, _ := body("GET", p); code != 200 || !strings.HasPrefix(ct, "text/html") {
			t.Errorf("GET %s: %d %q, want the web app", p, code, ct)
		}
	}
	if code, _, b := body("GET", "/healthz"); code != 200 || b != "ok" {
		t.Errorf("/healthz: %d %q", code, b)
	}
	// the API keeps answering, and a wrong path under it is not turned into a web page
	if code, ct, _ := body("POST", "/kantahe.v1.AuthService/Login"); strings.HasPrefix(ct, "text/html") || code == 404 {
		t.Errorf("Login: %d %q, want the API's answer", code, ct)
	}
	if code, ct, _ := body("GET", "/kantahe.v1.Nope/Nothing"); code != 404 || strings.HasPrefix(ct, "text/html") {
		t.Errorf("unknown RPC: %d %q, want 404", code, ct)
	}
	if code, _, _ := body("GET", "/media/nothing"); code == 200 {
		t.Errorf("media: %d, want the media handler's refusal", code)
	}
}

func TestAPIAndMediaAnswerCORSButTheWebAppDoesNot(t *testing.T) {
	dir := t.TempDir()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	db, err := store.Open(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	srv := app.New(config.Config{}, logger)
	// the same function run() uses to register the services
	mounted, err := mountServices(srv, api.Deps{DB: db, Version: "t", Now: time.Now, Logger: logger, DataDir: dir, Importer: library.NewImporter(db, dir, nil, logger)})
	if err != nil {
		t.Fatal(err)
	}
	defer mounted.Close()
	mountWebUI(srv)
	ts := httptest.NewServer(srv.Mux())
	defer ts.Close()

	preflight := func(path, method, headers string) *http.Response {
		req, _ := http.NewRequest(http.MethodOptions, ts.URL+path, nil)
		req.Header.Set("Origin", "null") // a packaged TV app
		req.Header.Set("Access-Control-Request-Method", method)
		req.Header.Set("Access-Control-Request-Headers", headers)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res
	}
	for _, c := range []struct{ path, method, headers string }{
		{"/kantahe.v1.AuthService/GetServerInfo", "POST", "authorization,connect-protocol-version,content-type"},
		{"/kantahe.v1.SessionService/WatchState", "POST", "authorization,connect-protocol-version,content-type"},
	} {
		res := preflight(c.path, c.method, c.headers)
		if res.StatusCode != http.StatusNoContent || res.Header.Get("Access-Control-Allow-Origin") != "*" {
			t.Errorf("preflight %s: %d, allow-origin %q, want 204 and *", c.path, res.StatusCode, res.Header.Get("Access-Control-Allow-Origin"))
		}
	}
	// media is read with simple GET requests (no preflight, the routes are GET only): the answer, even a refusal, carries
	// the headers that let the page read it
	mreq, _ := http.NewRequest(http.MethodGet, ts.URL+"/media/song/00001", nil)
	mreq.Header.Set("Origin", "null")
	mres, err := http.DefaultClient.Do(mreq)
	if err != nil {
		t.Fatal(err)
	}
	mres.Body.Close()
	if got := mres.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("GET /media: allow-origin %q (status %d), want *", got, mres.StatusCode)
	}
	if got := strings.ToLower(mres.Header.Get("Access-Control-Expose-Headers")); !strings.Contains(got, "content-range") {
		t.Errorf("GET /media: expose-headers %q, want Content-Range", got)
	}
	// the page is served to the browser that asked for the server's address: no cross-origin reading of it
	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/", nil)
	req.Header.Set("Origin", "null")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("the web app answered CORS (%q): only the API and media do", got)
	}
}

// runServer starts runContext on a free loopback port with args, waits until it answers, and returns the stop
// function (cancel the context, wait for the exit code).
func runServer(t *testing.T, extra ...string) (stop func() int) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	ln.Close()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	done := make(chan int, 1)
	args := append([]string{"--data", filepath.Join(t.TempDir(), "data"), "--listen", addr}, extra...)
	go func() { done <- runContext(ctx, args, &bytes.Buffer{}) }()
	deadline := time.Now().Add(10 * time.Second)
	for {
		if res, err := http.Get("http://" + addr + "/healthz"); err == nil {
			res.Body.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the server did not start")
		}
		time.Sleep(20 * time.Millisecond)
	}
	return func() int {
		cancel()
		select {
		case code := <-done:
			return code
		case <-time.After(15 * time.Second):
			t.Fatal("runContext did not return after its context was cancelled")
			return -1
		}
	}
}

// fakeAdvertiser stands in for the network announcement.
type fakeAdvertiser struct {
	mu       sync.Mutex
	calls    []string // "listen|name"
	stopped  int
	failWith error
}

func (f *fakeAdvertiser) advertise(listen, name, _ string, _ *slog.Logger) (func(), error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, listen+"|"+name)
	if f.failWith != nil {
		return nil, f.failWith
	}
	return func() { f.mu.Lock(); f.stopped++; f.mu.Unlock() }, nil
}

func (f *fakeAdvertiser) snapshot() (calls []string, stopped int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.calls...), f.stopped
}

// waitForCall waits until the server has tried to advertise (it does so a moment after it starts listening).
func (f *fakeAdvertiser) waitForCall(t *testing.T) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for calls, _ := f.snapshot(); len(calls) == 0; calls, _ = f.snapshot() {
		if time.Now().After(deadline) {
			t.Fatal("the server never tried to advertise")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func useFakeAdvertiser(t *testing.T, f *fakeAdvertiser) {
	t.Helper()
	old := advertiseOnLAN
	advertiseOnLAN = f.advertise
	t.Cleanup(func() { advertiseOnLAN = old })
}

func TestAdvertisesTheBoundAddressAndWithdrawsOnShutdown(t *testing.T) {
	f := &fakeAdvertiser{}
	useFakeAdvertiser(t, f)
	stop := runServer(t, "--name", "Den")
	f.waitForCall(t)
	if code := stop(); code != 0 {
		t.Fatalf("exit code = %d", code)
	}
	calls, stopped := f.snapshot()
	if len(calls) != 1 || !strings.HasSuffix(calls[0], "|Den") || !strings.HasPrefix(calls[0], "127.0.0.1:") {
		t.Fatalf("advertised %v, want one announcement of the bound address as Den", calls)
	}
	if stopped != 1 {
		t.Fatalf("the announcement was withdrawn %d times, want once on shutdown", stopped)
	}
}

func TestAServerThatCannotAdvertiseStillServes(t *testing.T) {
	f := &fakeAdvertiser{failWith: errors.New("no interface can carry multicast")}
	useFakeAdvertiser(t, f)
	stop := runServer(t) // runServer fails the test unless /healthz answers
	f.waitForCall(t)
	if code := stop(); code != 0 {
		t.Fatalf("exit code = %d, want 0", code)
	}
	if calls, _ := f.snapshot(); len(calls) != 1 {
		t.Fatalf("advertising was tried %d times, want once", len(calls))
	}
}

func TestDiscoveryOffAnnouncesNothing(t *testing.T) {
	f := &fakeAdvertiser{}
	useFakeAdvertiser(t, f)
	stop := runServer(t, "--discovery=false")
	if code := stop(); code != 0 {
		t.Fatalf("exit code = %d", code)
	}
	if calls, _ := f.snapshot(); len(calls) != 0 {
		t.Fatalf("announced %v with --discovery=false", calls)
	}
}
