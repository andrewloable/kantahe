//go:build windows

package library

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// These run only in the go-windows job of ci.yml, on a real Windows file system.

func junction(t *testing.T, link, target string) {
	t.Helper()
	if out, err := exec.Command("cmd", "/c", "mklink", "/J", link, target).CombinedOutput(); err != nil {
		t.Fatalf("mklink /J %s %s: %v\n%s", link, target, err, out)
	}
}

func TestWindowsAJunctionInsideAWatchedFolderIsNotImportedAndNotDeletable(t *testing.T) {
	e := newEnv(t)
	logs := logTo(e.im)
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "x.kar"), karBytes("Outside", "X"), 0o644); err != nil {
		t.Fatal(err)
	}
	e.put(t, "own/a.kar", karBytes("Alpha", "A"))
	junction(t, filepath.Join(e.lib, "jump"), outside)

	e.scan(t)
	e.process(t)
	if n := e.count(t, "deleted = 0"); n != 1 {
		t.Fatalf("%d songs listed, want only the one that is really in the folder", n)
	}
	if got := e.ftsNumbers(t, "Outside"); len(got) != 0 {
		t.Fatalf("a song behind a junction must not be listed: %v", got)
	}
	if !strings.Contains(logs.String(), "is a link") {
		t.Fatalf("the junction should have been reported:\n%s", logs)
	}
	if e.im.managed(filepath.Join(e.lib, "jump", "x.kar")) {
		t.Fatal("a file behind a junction is outside the managed folders")
	}
	if !e.im.managed(filepath.Join(e.lib, "own", "a.kar")) {
		t.Fatal("a file in the folder is managed")
	}
}

func TestWindowsAJunctionToAProtectedPlaceIsNeverManaged(t *testing.T) {
	e := newEnv(t)
	junction(t, filepath.Join(e.lib, "system"), os.Getenv("SystemRoot"))
	for _, name := range []string{"notepad.exe", filepath.Join("System32", "drivers", "etc", "hosts")} {
		if e.im.managed(filepath.Join(e.lib, "system", name)) {
			t.Fatalf("%s behind the junction must not be deletable", name)
		}
	}
}

func TestWindowsLibraryAndDataFolderGivenInAnotherCaseAreStillManaged(t *testing.T) {
	e := newEnv(t)
	im := NewImporter(e.db, strings.ToUpper(e.data), []string{strings.ToLower(e.lib)}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	p := e.put(t, "a.kar", karBytes("Alpha", "A"))
	if _, err := im.Scan(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := im.ProcessPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	number := e.numberOfPath(t, p) // the stored path has the real case, whatever the folder was called on the command line
	if !im.managed(p) {
		t.Fatal("a song in a folder given in another case is managed")
	}
	if err := os.MkdirAll(filepath.Join(e.data, "songs"), 0o750); err != nil {
		t.Fatal(err)
	}
	if !im.managed(filepath.Join(e.data, "songs", "x.kar")) {
		t.Fatal("a file in the data folder given in another case is managed")
	}
	if err := im.DeleteSong(context.Background(), number); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := os.Stat(p); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("the file must be gone")
	}
}

func TestWindowsMediaIsRemovedWhenTheDataFolderIsGivenInAnotherCase(t *testing.T) {
	e := newEnv(t)
	media := filepath.Join(e.data, "media", "x.mp3")
	if err := os.MkdirAll(filepath.Dir(media), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(media, []byte("x"), 0o640); err != nil {
		t.Fatal(err)
	}
	im := NewImporter(e.db, strings.ToUpper(e.data), nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	im.removeMediaIfUnused(context.Background(), media) // stored by an earlier run with the folder spelled differently
	if _, err := os.Stat(media); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("the media file of a data folder in another case must be removed")
	}
}
