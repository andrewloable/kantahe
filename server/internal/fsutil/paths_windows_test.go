//go:build windows

package fsutil

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

// These run only in the go-windows job of ci.yml, on a real Windows file system.

// junction makes link a directory junction to target; junctions need no privilege, unlike symlinks.
func junction(t *testing.T, link, target string) {
	t.Helper()
	if out, err := exec.Command("cmd", "/c", "mklink", "/J", link, target).CombinedOutput(); err != nil {
		t.Fatalf("mklink /J %s %s: %v\n%s", link, target, err, out)
	}
}

func realDir(t *testing.T, elems ...string) string {
	t.Helper()
	base, err := Canonical(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(append([]string{base}, elems...)...)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestWindowsCanonicalIsTheSameForEveryNameOfAPlace(t *testing.T) {
	dir := realDir(t, "Long Folder Name", "Sub")
	want, err := Canonical(dir)
	if err != nil || want != dir {
		t.Fatalf("Canonical(%q) = %q, %v; want the real spelling back", dir, want, err)
	}
	for name, p := range map[string]string{
		"upper case":         strings.ToUpper(dir),
		"lower case":         strings.ToLower(dir),
		"trailing separator": dir + `\`,
		"extended prefix":    `\\?\` + dir,
		"dot dot":            filepath.Join(dir, "..", "Sub"),
		"forward slashes":    strings.ReplaceAll(dir, `\`, `/`),
	} {
		got, err := Canonical(p)
		if err != nil || got != want {
			t.Errorf("%s: Canonical(%q) = %q, %v; want %q", name, p, got, err, want)
		}
	}
}

func TestWindowsCanonicalWritesOutAShortName(t *testing.T) {
	dir := realDir(t, "A Long Folder Name For The Short Name Test")
	long, _ := windows.UTF16PtrFromString(dir)
	buf := make([]uint16, windows.MAX_PATH)
	n, err := windows.GetShortPathName(long, &buf[0], uint32(len(buf)))
	if err != nil || n == 0 {
		t.Skipf("no short name for the folder: %v", err)
	}
	short := windows.UTF16ToString(buf[:n])
	if strings.EqualFold(short, dir) {
		t.Skip("8.3 short names are switched off on this volume")
	}
	got, err := Canonical(short)
	if err != nil || got != dir {
		t.Fatalf("Canonical(%q) = %q, %v; want %q", short, got, err, dir)
	}
	if !IsUnder(filepath.Join(got, "x.kar"), dir) {
		t.Fatal("a file below the short name is below the long name")
	}
}

func TestWindowsAJunctionIsFollowedAndRecognised(t *testing.T) {
	target := realDir(t, "target", "sub")
	link := filepath.Join(filepath.Dir(filepath.Dir(target)), "link")
	junction(t, link, filepath.Dir(target))

	through := filepath.Join(link, "sub")
	got, err := Canonical(through)
	if err != nil || got != target {
		t.Fatalf("Canonical through the junction = %q, %v; want %q", got, err, target)
	}
	if elsewhere, err := ResolvesElsewhere(link); err != nil || !elsewhere {
		t.Fatalf("ResolvesElsewhere(junction) = %v, %v; want true", elsewhere, err)
	}
	if elsewhere, err := ResolvesElsewhere(through); err != nil || !elsewhere {
		t.Fatalf("ResolvesElsewhere(a folder below the junction) = %v, %v; want true", elsewhere, err)
	}
	if elsewhere, err := ResolvesElsewhere(target); err != nil || elsewhere {
		t.Fatalf("ResolvesElsewhere(the real folder) = %v, %v; want false", elsewhere, err)
	}
	// what Go's own EvalSymlinks does with it is the reason this package exists: it is recorded, not asserted
	ev, evErr := filepath.EvalSymlinks(link)
	t.Logf("filepath.EvalSymlinks(junction) = %q, %v (Canonical: %q)", ev, evErr, got)
}

func TestWindowsAMissingPathIsAnError(t *testing.T) {
	if _, err := Canonical(filepath.Join(realDir(t, "x"), "nothing")); err == nil {
		t.Fatal("a path that does not exist is not canonical")
	}
}
