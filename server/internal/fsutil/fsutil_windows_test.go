//go:build windows

package fsutil

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// These run only in the go-windows job of ci.yml: they need the behaviour of Windows itself.

func fileAt(t *testing.T, name, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestWindowsAFileThatIsOpenCannotBeRemovedAndIsBusy(t *testing.T) {
	p := fileAt(t, "open", "x")
	f, err := os.Open(p)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	err = os.Remove(p)
	if err == nil {
		t.Fatal("Windows must refuse to delete a file that Go has open")
	}
	if !IsBusy(err) {
		t.Fatalf("%v must be busy", err)
	}
}

func TestWindowsRemoveSucceedsWhenTheHandleIsClosedMeanwhile(t *testing.T) {
	p := fileAt(t, "open", "x")
	f, err := os.Open(p)
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		time.Sleep(300 * time.Millisecond)
		f.Close()
	}()
	if err := Remove(context.Background(), p, 2*time.Second); err != nil {
		t.Fatalf("Remove with a 2 s budget: %v", err)
	}
	if _, err := os.Stat(p); err == nil {
		t.Fatal("the file is still there")
	}
}

func TestWindowsRemoveGivesUpAfterTheBudgetWhileTheFileStaysOpen(t *testing.T) {
	p := fileAt(t, "open", "x")
	f, err := os.Open(p)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	start := time.Now()
	err = Remove(context.Background(), p, 400*time.Millisecond)
	if err == nil || !IsBusy(err) {
		t.Fatalf("err = %v, want the busy error", err)
	}
	if took := time.Since(start); took < 350*time.Millisecond || took > 3*time.Second {
		t.Fatalf("took %v for a budget of 400ms", took)
	}
}

func TestWindowsPlaceOverAnOpenTargetKeepsItAndSucceeds(t *testing.T) {
	dir := t.TempDir()
	dst := filepath.Join(dir, "abc.kar")
	tmp := filepath.Join(dir, ".upload-1")
	for p, c := range map[string]string{dst: "same", tmp: "same"} {
		if err := os.WriteFile(p, []byte(c), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	f, err := os.Open(dst)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := Place(tmp, dst, time.Second); err != nil {
		t.Fatalf("Place over an open file: %v", err)
	}
	if _, err := os.Stat(tmp); err == nil {
		t.Fatal("the temporary file must be deleted")
	}
}

func TestWindowsAReadOnlyFileIsNotBusy(t *testing.T) {
	p := fileAt(t, "ro", "x")
	if err := os.Chmod(p, 0o444); err != nil {
		t.Fatal(err)
	}
	err := os.Remove(p)
	if err == nil {
		t.Skip("this Windows lets a read-only file be deleted")
	}
	if IsBusy(err) {
		t.Fatalf("%v: a permission is not worth a wait", err)
	}
	_ = os.Chmod(p, 0o666)
}
