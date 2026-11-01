//go:build windows

package library

import (
	"context"
	"os"
	"testing"
)

// On Windows a file that something has open cannot be deleted. Removing the broken songs with their files must count that file as
// failed, take its song off the list all the same, and go on with the others.
func TestRemoveBrokenWithAFileInUseCountsItAsFailedAndGoesOn(t *testing.T) {
	e := newEnv(t)
	open := e.put(t, "a.kar", karBytes("A", "X"))
	free := e.put(t, "b.kar", karBytes("B", "X"))
	e.scan(t)
	e.process(t)
	for _, p := range []string{open, free} {
		if err := os.WriteFile(p, karNoMusic(), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if n, _ := e.check(t); n != 2 {
		t.Fatalf("broken = %d, want 2", n)
	}
	f, err := os.Open(open) // Go opens files without FILE_SHARE_DELETE: this blocks the delete
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	res, err := e.im.RemoveSongsFiles(context.Background(), ScopeBroken, true)
	if err != nil || res.Removed != 2 || res.FilesDeleted != 1 || res.FilesFailed != 1 {
		t.Fatalf("%+v %v", res, err)
	}
	if _, err := os.Stat(open); err != nil {
		t.Fatalf("the file in use stays: %v", err)
	}
	if _, err := os.Stat(free); err == nil {
		t.Fatal("the other file is deleted")
	}
	if e.count(t, "deleted = 0") != 0 {
		t.Fatal("both songs are off the list")
	}
}
