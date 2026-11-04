package transfer

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// maxManifestBytes is the biggest manifest that is read: 20 000 songs are about 3 MB.
const maxManifestBytes = 64 << 20

// manifestPath is the only shape of a file name an export may list. Everything else, in particular a path that leaves the folder,
// is refused before any file is opened.
var manifestPath = regexp.MustCompile(`^(?:kantahe\.db|songs/[0-9a-f]{64}\.(?:kar|karmp3)|media/[0-9a-f]{64}(?:\.vocals)?\.mp3|videos/[0-9a-f]{64}\.mp4)$`)

var hexSHA = regexp.MustCompile(`^[0-9a-f]{64}$`)

// ImportOptions are what an import needs to know about the server.
type ImportOptions struct {
	DataDir string
	Root    string // --transfer-root; "" allows any absolute folder
	Logger  *slog.Logger
}

func (o ImportOptions) logger() *slog.Logger {
	if o.Logger != nil {
		return o.Logger
	}
	return slog.Default()
}

// CheckImportFolder says whether folder may be read as an export and returns its cleaned form: an absolute path to a folder that
// exists and is not a link, not the data folder and not inside it (the import works in the data folder), and inside o.Root when that
// is set. Every refusal is a *FolderError.
func CheckImportFolder(folder string, o ImportOptions) (string, error) {
	if folder == "" || !filepath.IsAbs(folder) {
		return "", folderErr("the folder must be an absolute path on the server, for example /transfer/export")
	}
	clean := filepath.Clean(folder)
	if err := checkIsFolder(clean); err != nil {
		return "", err
	}
	real := canonical(clean)
	data := canonical(o.DataDir)
	if fsutil.IsUnder(real, data) || fsutil.IsUnder(data, real) {
		return "", folderErr("the folder must not be the server's data folder, inside it, or a folder that contains it")
	}
	if o.Root != "" && !fsutil.IsUnder(real, canonical(o.Root)) {
		return "", folderErr("the folder must be inside %s", o.Root)
	}
	return clean, nil
}

func checkIsFolder(p string) error {
	st, err := os.Lstat(p)
	switch {
	case os.IsNotExist(err):
		return folderErr("the folder %s does not exist", p)
	case err != nil:
		return folderErr("cannot read the folder %s: %v", p, err)
	case !st.IsDir():
		return folderErr("%s is not a folder (links are not followed)", p)
	}
	return nil
}

// ReadManifest reads and checks the manifest of an export folder, without reading any of the files it lists. The manifest must be a
// regular file of reasonable size with the fields of this program only, of a format and a schema this program knows, and list
// only files of the shapes an export has, each once, with a database among them. Every refusal is a *FolderError.
func ReadManifest(folder string) (Manifest, error) {
	var m Manifest
	if err := checkIsFolder(folder); err != nil {
		return m, err
	}
	p := filepath.Join(folder, ManifestName)
	st, err := os.Lstat(p)
	switch {
	case os.IsNotExist(err):
		return m, folderErr("%s has no %s: it is not an export, or the export did not finish", folder, ManifestName)
	case err != nil:
		return m, folderErr("cannot read %s: %v", ManifestName, err)
	case st.Mode()&os.ModeSymlink != 0:
		return m, folderErr("%s is a link", ManifestName)
	case !st.Mode().IsRegular():
		return m, folderErr("%s is not a file", ManifestName)
	case st.Size() > maxManifestBytes:
		return m, folderErr("%s is too big", ManifestName)
	}
	f, err := os.Open(p)
	if err != nil {
		return m, folderErr("cannot read %s: %v", ManifestName, err)
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, maxManifestBytes+1))
	if err != nil {
		return m, folderErr("cannot read %s: %v", ManifestName, err)
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&m); err != nil {
		return Manifest{}, folderErr("%s cannot be read: %v", ManifestName, err)
	}
	if dec.More() {
		return Manifest{}, folderErr("%s cannot be read: there is more after the manifest", ManifestName)
	}
	switch {
	case m.Format > FormatVersion:
		return Manifest{}, folderErr("this export was made by a newer Kantahe (format %d); upgrade this server first", m.Format)
	case m.Format != FormatVersion:
		return Manifest{}, folderErr("%s is not the manifest of an export", ManifestName)
	case m.SchemaVersion > store.LatestVersion():
		return Manifest{}, folderErr("this export was made by a newer Kantahe; upgrade this server first")
	case m.SchemaVersion < 1:
		return Manifest{}, folderErr("%s is not the manifest of an export", ManifestName)
	}
	seen := map[string]bool{}
	for _, f := range m.Files {
		switch {
		case !manifestPath.MatchString(f.Path):
			return Manifest{}, folderErr("the export lists a file that an export does not hold: %s", f.Path)
		case seen[f.Path]:
			return Manifest{}, folderErr("the export lists %s twice", f.Path)
		case f.Size < 0 || !hexSHA.MatchString(f.SHA256):
			return Manifest{}, folderErr("the export lists %s with a size or a checksum that cannot be right", f.Path)
		}
		seen[f.Path] = true
	}
	if !seen["kantahe.db"] {
		return Manifest{}, folderErr("the export lists no kantahe.db")
	}
	return m, nil
}

// CheckFilesPresent is the quick look: every listed file is there, a regular file, of the listed size. Stage reads them all.
func CheckFilesPresent(folder string, m Manifest) error {
	for _, f := range m.Files {
		st, err := os.Lstat(filepath.Join(folder, filepath.FromSlash(f.Path)))
		if err != nil || !st.Mode().IsRegular() || st.Size() != f.Size {
			return folderErr("%s is missing or is not the file the export lists", f.Path)
		}
	}
	return nil
}

// TotalBytes is the size of everything the manifest lists.
func (m Manifest) TotalBytes() int64 {
	var n int64
	for _, f := range m.Files {
		n += f.Size
	}
	return n
}
