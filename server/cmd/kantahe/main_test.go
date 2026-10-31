package main

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
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
