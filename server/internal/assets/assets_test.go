package assets

import (
	"bytes"
	"crypto/sha256"
	"io"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
	"time"
)

func TestFanfares(t *testing.T) {
	seen := map[[32]byte]bool{}
	for n := 1; n <= 3; n++ {
		b, ok := Fanfare(n)
		if !ok || len(b) < 1000 || !(bytes.HasPrefix(b, []byte("ID3")) || (b[0] == 0xFF && b[1]&0xE0 == 0xE0)) {
			t.Fatalf("fanfare %d: ok=%v len=%d", n, ok, len(b))
		}
		seen[sha256.Sum256(b)] = true
	}
	if len(seen) != 3 {
		t.Fatal("the three fanfares must be different files")
	}
	for _, n := range []int{0, 4, -1} {
		if _, ok := Fanfare(n); ok {
			t.Errorf("fanfare %d should not exist", n)
		}
	}
}

func fontFS(data string) fstest.MapFS {
	return fstest.MapFS{
		"soundfont/.gitkeep":  {},
		"soundfont/Other.txt": {Data: []byte("not a font")},
		"soundfont/Bank.sf2":  {Data: []byte(data)},
		"soundfont/sub/x.sf2": {Data: []byte("nested, ignored")},
	}
}

func TestDefaultSoundFontOpensTheEmbeddedFile(t *testing.T) {
	f, ok := defaultSoundFont(fontFS("RIFFsfbk"))
	if !ok {
		t.Fatal("no default SoundFont found")
	}
	defer f.Close()
	b, _ := io.ReadAll(f)
	if string(b) != "RIFFsfbk" {
		t.Fatalf("read %q", b)
	}
	if _, ok := defaultSoundFont(fstest.MapFS{"soundfont/.gitkeep": {}}); ok {
		t.Fatal("a build without a SoundFont must report none")
	}
	// the real build has none unless scripts/build-release.sh put one there; the call must not panic
	if f, ok := DefaultSoundFont(); ok {
		f.Close()
	}
}

func TestDefaultSoundFontExtractedOnce(t *testing.T) {
	data := t.TempDir()
	fsys := fontFS("RIFFsfbk-one")
	path, err := soundFontPath(fsys, "", data)
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(data, "soundfont", "default.sf2"); path != want {
		t.Fatalf("path = %q, want %q", path, want)
	}
	if b, _ := os.ReadFile(path); string(b) != "RIFFsfbk-one" {
		t.Fatalf("content %q", b)
	}
	old := time.Now().Add(-48 * time.Hour).Truncate(time.Second)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
	if _, err := soundFontPath(fsys, "", data); err != nil {
		t.Fatal(err)
	}
	st, _ := os.Stat(path)
	if !st.ModTime().Equal(old) {
		t.Fatalf("second start rewrote the file (mtime %v, want %v)", st.ModTime(), old)
	}
}

func TestDefaultSoundFontReplacedWhenTheSizeDiffers(t *testing.T) {
	data := t.TempDir()
	if _, err := soundFontPath(fontFS("short"), "", data); err != nil {
		t.Fatal(err)
	}
	path, err := soundFontPath(fontFS("a longer new bank"), "", data)
	if err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(path); string(b) != "a longer new bank" {
		t.Fatalf("after an upgrade the file holds %q", b)
	}
	if left, _ := filepath.Glob(filepath.Join(data, "soundfont", "*.tmp*")); len(left) != 0 {
		t.Fatalf("temporary files left behind: %v", left)
	}
}

func TestExplicitSoundFontWins(t *testing.T) {
	data := t.TempDir()
	path, err := soundFontPath(fontFS("RIFFsfbk"), "/my/own.sf2", data)
	if err != nil || path != "/my/own.sf2" {
		t.Fatalf("path = %q, err = %v", path, err)
	}
	if _, err := os.Stat(filepath.Join(data, "soundfont")); !os.IsNotExist(err) {
		t.Fatalf("the embedded default was written although --soundfont was set (err %v)", err)
	}
}

func TestNoSoundFontEmbeddedGivesNoPath(t *testing.T) {
	path, err := soundFontPath(fstest.MapFS{"soundfont/.gitkeep": {}}, "", t.TempDir())
	if err != nil || path != "" {
		t.Fatalf("path = %q, err = %v, want none", path, err)
	}
}

func TestSoundFontCannotBeWritten(t *testing.T) {
	data := t.TempDir()
	blocker := filepath.Join(data, "soundfont")
	if err := os.WriteFile(blocker, []byte("a file where the directory should be"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := soundFontPath(fontFS("RIFFsfbk"), "", data); err == nil {
		t.Fatal("want an error when the data directory cannot hold the SoundFont")
	}
}

func TestSoundFontTargetBlocked(t *testing.T) {
	data := t.TempDir()
	target := filepath.Join(data, "soundfont", "default.sf2")
	if err := os.MkdirAll(filepath.Join(target, "inside"), 0o750); err != nil {
		t.Fatal(err)
	}
	if _, err := soundFontPath(fontFS("RIFFsfbk"), "", data); err == nil {
		t.Fatal("want an error when the target is a directory")
	}
	if left, _ := filepath.Glob(filepath.Join(data, "soundfont", "*.tmp*")); len(left) != 0 {
		t.Fatalf("temporary files left behind: %v", left)
	}
}
