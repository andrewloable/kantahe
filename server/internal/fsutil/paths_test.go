package fsutil

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestIsUnderTable(t *testing.T) {
	for _, c := range []struct {
		name    string
		p, dir  string
		windows bool
		want    bool
	}{
		// Windows rules, run on every system
		{"other case of the folder", `C:\Music\a.kar`, `c:\music`, true, true},
		{"other case of an element", `C:\MUSIC\Sub\a.kar`, `C:\music\sub`, true, true},
		{"a sibling with a common prefix is not inside", `C:\Music2\a.kar`, `C:\Music`, true, false},
		{"the folder itself", `C:\Music`, `C:\Music`, true, true},
		{"trailing separators", `C:\Music\`, `C:\Music`, true, true},
		{"trailing separator on the folder", `C:\Music\a.kar`, `C:\Music\`, true, true},
		{"dot dot escapes the folder", `C:\Music\..\x.kar`, `C:\Music`, true, false},
		{"dot dot that stays inside", `C:\Music\sub\..\a.kar`, `C:\Music`, true, true},
		{"dot dot at the root stays at the root", `C:\..\x`, `C:\`, true, true},
		{"another drive", `D:\Music\a.kar`, `C:\Music`, true, false},
		{"drive letter in either case", `c:\Music\a.kar`, `C:\Music`, true, true},
		{"forward slashes", `C:/Music/a.kar`, `C:\Music`, true, true},
		{"UNC share", `\\server\share\x\a.kar`, `\\SERVER\Share\x`, true, true},
		{"another share of the same server", `\\server\share2\a.kar`, `\\server\share`, true, false},
		{"another server", `\\other\share\a.kar`, `\\server\share`, true, false},
		{"extended drive path", `\\?\C:\Music\x\a.kar`, `C:\Music`, true, true},
		{"extended UNC path", `\\?\UNC\server\share\x`, `\\server\share`, true, true},
		{"relative path is never inside", `Music\a.kar`, `C:\Music`, true, false},
		{"drive-relative path is never inside", `C:Music\a.kar`, `C:\Music`, true, false},
		{"rooted without a drive is never inside", `\Music\a.kar`, `C:\Music`, true, false},
		{"relative folder contains nothing", `C:\Music\a.kar`, `Music`, true, false},
		{"incomplete UNC", `\\server\a`, `\\server`, true, false},
		// exact rules, run on every system
		{"exact: same case", `/data/media/a`, `/data/media`, false, true},
		{"exact: other case is another place", `/Data/media/a`, `/data/media`, false, false},
		{"exact: common prefix", `/data2/a`, `/data`, false, false},
		{"exact: dot dot", `/data/../x`, `/data`, false, false},
		{"exact: the folder itself", `/data`, `/data`, false, true},
		{"exact: root", `/a/b`, `/`, false, true},
		{"exact: relative", `data/a`, `/data`, false, false},
		{"exact: a Windows path means nothing here", `C:\Music\a.kar`, `C:\Music`, false, false},
	} {
		if got := isUnder(c.p, c.dir, c.windows); got != c.want {
			t.Errorf("%s: isUnder(%q, %q, windows=%v) = %v, want %v", c.name, c.p, c.dir, c.windows, got, c.want)
		}
	}
}

func TestSamePathTable(t *testing.T) {
	for _, c := range []struct {
		name    string
		a, b    string
		windows bool
		want    bool
	}{
		{"case and trailing separator", `C:\Data\media`, `c:\data\MEDIA\`, true, true},
		{"different folders", `C:\Data\media`, `C:\Data\media2`, true, false},
		{"parent is not the same", `C:\Data`, `C:\Data\media`, true, false},
		{"dot elements", `C:\Data\.\media`, `C:\Data\media`, true, true},
		{"extended prefix", `\\?\C:\Data\media`, `C:\Data\media`, true, true},
		{"UNC and its extended form", `\\srv\share\a`, `\\?\UNC\srv\share\a`, true, true},
		{"relative is never the same", `Data\media`, `Data\media`, true, false},
		{"exact: trailing separator and dot", `/data/./media/`, `/data/media`, false, true},
		{"exact: case matters", `/data/media`, `/data/Media`, false, false},
	} {
		if got := samePath(c.a, c.b, c.windows); got != c.want {
			t.Errorf("%s: samePath(%q, %q, windows=%v) = %v, want %v", c.name, c.a, c.b, c.windows, got, c.want)
		}
	}
}

func TestStripExtended(t *testing.T) {
	for in, want := range map[string]string{
		`\\?\C:\x`:            `C:\x`,
		`\\?\UNC\srv\share\x`: `\\srv\share\x`,
		`\\?\unc\srv\share\x`: `\\srv\share\x`,
		`\\.\C:\x`:            `C:\x`,
		`C:\x`:                `C:\x`,
		`\\srv\share\x`:       `\\srv\share\x`,
		`/usr/lib`:            `/usr/lib`,
		``:                    ``,
	} {
		if got := stripExtended(in); got != want {
			t.Errorf("stripExtended(%q) = %q, want %q", in, got, want)
		}
	}
}

// The exported functions follow the system they run on: real paths of this machine, not strings.
func TestExportedFunctionsUseThisSystemsRules(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "sub", "a.kar")
	if !IsUnder(file, dir) || !IsUnder(dir, dir) || IsUnder(dir+"2", dir) || IsUnder(filepath.Join(dir, "..", "x"), dir) {
		t.Fatalf("IsUnder on real paths of this system is wrong (dir %q)", dir)
	}
	if !SamePath(dir, dir+string(filepath.Separator)) || SamePath(dir, filepath.Join(dir, "sub")) {
		t.Fatal("SamePath on real paths of this system is wrong")
	}
	// case: another place outside Windows (exact), the same place on Windows
	upper, lower := filepath.Join(dir, "Sub", "A.kar"), filepath.Join(dir, "sub", "a.kar")
	if got := SamePath(upper, lower); got != (runtime.GOOS == "windows") {
		t.Fatalf("SamePath(%q, %q) = %v on %s", upper, lower, got, runtime.GOOS)
	}
	if got := IsUnder(upper, filepath.Join(dir, "sub")); got != (runtime.GOOS == "windows") {
		t.Fatalf("IsUnder with another case = %v on %s", got, runtime.GOOS)
	}
}

func TestCanonicalResolvesSymlinksAndMakesPathsAbsolute(t *testing.T) {
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	real := filepath.Join(root, "real")
	if err := os.MkdirAll(filepath.Join(real, "sub"), 0o750); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "link")
	if err := os.Symlink(real, link); err != nil {
		t.Skipf("symlinks are not available here: %v", err)
	}
	got, err := Canonical(filepath.Join(link, "sub"))
	if err != nil || !SamePath(got, filepath.Join(real, "sub")) {
		t.Fatalf("Canonical through a symlink = %q, %v; want %q", got, err, filepath.Join(real, "sub"))
	}
	if ok, err := ResolvesElsewhere(link); err != nil || (runtime.GOOS != "windows" && ok) {
		t.Fatalf("ResolvesElsewhere(link) = %v, %v: outside Windows it is always false (a walk never enters a symlinked folder)", ok, err)
	}
}

func TestCanonicalOfAMissingPathIsAnError(t *testing.T) {
	if _, err := Canonical(filepath.Join(t.TempDir(), "nothing", "here")); err == nil {
		t.Fatal("a path that does not exist cannot be canonical: when in doubt it is not managed")
	}
}

func TestCanonicalOfARelativePathIsAbsolute(t *testing.T) {
	dir := t.TempDir()
	old, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Skip(err)
	}
	defer os.Chdir(old) //nolint:errcheck
	if err := os.Mkdir("rel", 0o750); err != nil {
		t.Fatal(err)
	}
	got, err := Canonical("rel")
	if err != nil || !filepath.IsAbs(got) {
		t.Fatalf("Canonical(rel) = %q, %v", got, err)
	}
}

// Both sides of a comparison that decides what may be deleted have been through Canonical, so both carry the real case of every
// element; comparing the elements exactly loses nothing and cannot be fooled by a Windows folder that is case-sensitive (the
// per-directory option), where C:\Music\Sub and C:\Music\sub are two places. Only the volume is compared without case.
func TestIsUnderCanonicalComparesElementsExactly(t *testing.T) {
	for _, c := range []struct {
		name    string
		p, dir  string
		windows bool
		want    bool
	}{
		{"same spelling", `C:\Music\Sub\a.kar`, `C:\Music\Sub`, true, true},
		{"another case of an element is another place", `C:\Music\Sub\a.kar`, `C:\Music\sub`, true, false},
		{"another case of the folder name", `C:\Music\a.kar`, `C:\MUSIC`, true, false},
		{"the drive letter has no case", `c:\Music\a.kar`, `C:\Music`, true, true},
		{"the server and share have no case", `\\SERVER\Share\x\a.kar`, `\\server\share\x`, true, true},
		{"sibling with a common prefix", `C:\Music2\a.kar`, `C:\Music`, true, false},
		{"dot dot", `C:\Music\..\x.kar`, `C:\Music`, true, false},
		{"relative", `Music\a.kar`, `C:\Music`, true, false},
		{"exact rules elsewhere", `/data/media/a`, `/data/media`, false, true},
		{"exact rules elsewhere: another case", `/data/Media/a`, `/data/media`, false, false},
	} {
		if got := isUnderStrict(c.p, c.dir, c.windows); got != c.want {
			t.Errorf("%s: isUnderStrict(%q, %q, windows=%v) = %v, want %v", c.name, c.p, c.dir, c.windows, got, c.want)
		}
	}
}
