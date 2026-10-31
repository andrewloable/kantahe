package main

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
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
