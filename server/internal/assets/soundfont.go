package assets

import (
	"embed"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// soundfonts holds the default SoundFont. The file is not in the repository: scripts/build-release.sh
// downloads it, checks its SHA-256 and puts it here, so a plain go build has none.
//
//go:embed all:soundfont
var soundfonts embed.FS

// DefaultSoundFont opens the SoundFont embedded in this build, false when there is none.
func DefaultSoundFont() (fs.File, bool) { return defaultSoundFont(soundfonts) }

func defaultSoundFont(fsys fs.FS) (fs.File, bool) {
	entries, err := fs.ReadDir(fsys, "soundfont")
	if err != nil {
		return nil, false
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sf2") {
			continue
		}
		f, err := fsys.Open(path.Join("soundfont", e.Name()))
		if err != nil {
			continue
		}
		return f, true
	}
	return nil, false
}

// SoundFontPath returns the SoundFont file to use: explicit (the --soundfont flag) when set, else the
// embedded default written to <dataDir>/soundfont/default.sf2, or "" when this build has none.
func SoundFontPath(explicit, dataDir string) (string, error) {
	return soundFontPath(soundfonts, explicit, dataDir)
}

func soundFontPath(fsys fs.FS, explicit, dataDir string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}
	src, ok := defaultSoundFont(fsys)
	if !ok {
		return "", nil
	}
	defer src.Close()
	info, err := src.Stat()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(dataDir, "soundfont")
	dst := filepath.Join(dir, "default.sf2")
	// ponytail: the size is the only check, a new release of the bank with the same size is not noticed
	if st, err := os.Stat(dst); err == nil && st.Size() == info.Size() {
		return dst, nil
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(dir, "default.sf2.tmp*")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	if _, err := io.Copy(tmp, src); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tmp.Name(), dst); err != nil {
		return "", err
	}
	return dst, nil
}
