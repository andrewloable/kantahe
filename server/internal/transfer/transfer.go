// Package transfer moves a whole server to another one: Export writes the database, the settings, every song file, the extracted
// MP3s and the background videos into a folder on the server's disk, and (in a later step) an import replaces the data of another
// server with such a folder. docs/PLAN.md section 6 describes the layout and the rules.
package transfer

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// FormatVersion is the layout of an export folder; a Kantahe refuses a folder with a greater number.
const FormatVersion = 1

// ManifestName is the file that says an export is complete; it is written last.
const ManifestName = "kantahe-export.json"

// File is one file of an export, with its path inside the folder (forward slashes).
type File struct {
	Path   string `json:"path"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

// Counts says how much an export holds.
type Counts struct {
	Songs  int `json:"songs"`
	Users  int `json:"users"`
	Videos int `json:"videos"`
}

// Manifest describes an export folder.
type Manifest struct {
	Format         int    `json:"format"`
	KantaheVersion string `json:"kantahe_version"`
	ServerName     string `json:"server_name"`
	CreatedUnix    int64  `json:"created_unix"`
	SchemaVersion  int    `json:"schema_version"`
	Counts         Counts `json:"counts"`
	Files          []File `json:"files"`
}

// Progress is how far a copy has come; the totals can shrink while it runs, when a file turns out to be unreadable.
type Progress struct {
	FilesDone, FilesTotal int
	BytesDone, BytesTotal int64
}

// FolderError is a refusal that is the administrator's to fix; Msg says what to change.
type FolderError struct{ Msg string }

func (e *FolderError) Error() string { return e.Msg }

func folderErr(format string, a ...any) error { return &FolderError{Msg: fmt.Sprintf(format, a...)} }

// ExportOptions are what an export needs to know about the server.
type ExportOptions struct {
	DB         *store.DB
	DataDir    string
	Libraries  []string // the watched folders
	Root       string   // --transfer-root; "" allows any absolute folder
	Version    string
	ServerName string
	Now        func() time.Time
	Logger     *slog.Logger
}

func (o ExportOptions) now() time.Time {
	if o.Now != nil {
		return o.Now()
	}
	return time.Now()
}

func (o ExportOptions) logger() *slog.Logger {
	if o.Logger != nil {
		return o.Logger
	}
	return slog.Default()
}

// canonical is the real place of a path that exists; for one that does not, the cleaned absolute path.
func canonical(p string) string {
	if c, err := fsutil.Canonical(p); err == nil {
		return c
	}
	if a, err := filepath.Abs(p); err == nil {
		return a
	}
	return filepath.Clean(p)
}

// CheckExportFolder says whether folder may receive an export and returns its cleaned form. It must be an absolute path, a folder that
// does not exist yet or an empty one (nothing is ever written into a folder that holds something), whose parent exists, and neither
// it nor its parent may be a link. It must not be inside the data folder or a watched folder, nor contain the data folder, and
// when o.Root is set it must be inside that, but not that folder itself. Every refusal is a *FolderError.
func CheckExportFolder(folder string, o ExportOptions) (string, error) {
	if folder == "" || !filepath.IsAbs(folder) {
		return "", folderErr("the folder must be an absolute path on the server, for example /transfer/export")
	}
	clean := filepath.Clean(folder)
	parent := filepath.Dir(clean)
	if parent == clean {
		return "", folderErr("choose a folder inside a disk, not the disk itself")
	}
	pst, err := os.Lstat(parent)
	switch {
	case os.IsNotExist(err):
		return "", folderErr("the folder %s does not exist: create it first", parent)
	case err != nil:
		return "", folderErr("cannot read the folder %s: %v", parent, err)
	case !pst.IsDir():
		return "", folderErr("%s is not a folder (links are not followed)", parent)
	}
	if st, err := os.Lstat(clean); err == nil {
		if !st.IsDir() {
			return "", folderErr("%s is not an empty folder (it is a file or a link)", clean)
		}
		entries, err := os.ReadDir(clean)
		if err != nil {
			return "", folderErr("cannot read the folder %s: %v", clean, err)
		}
		if len(entries) > 0 {
			return "", folderErr("the folder %s is not empty: choose a new or empty folder", clean)
		}
	} else if !os.IsNotExist(err) {
		return "", folderErr("cannot read the folder %s: %v", clean, err)
	}

	real := filepath.Join(canonical(parent), filepath.Base(clean))
	data := canonical(o.DataDir)
	if fsutil.IsUnder(real, data) {
		return "", folderErr("the folder must not be inside the server's data folder")
	}
	if fsutil.IsUnder(data, real) {
		return "", folderErr("the folder must not contain the server's data folder")
	}
	for _, lib := range o.Libraries {
		l := canonical(lib)
		if fsutil.IsUnder(real, l) {
			return "", folderErr("the folder must not be inside a watched song folder")
		}
		if fsutil.IsUnder(l, real) {
			return "", folderErr("the folder must not contain a watched song folder")
		}
	}
	if o.Root != "" {
		root := canonical(o.Root)
		if !fsutil.IsUnder(real, root) || fsutil.SamePath(real, root) {
			return "", folderErr("the folder must be inside %s", o.Root)
		}
	}
	return clean, nil
}

// IsDiskFull says whether err is the operating system's "no space left on the device".
func IsDiskFull(err error) bool {
	// 112 is ERROR_DISK_FULL, what Windows answers; it is an unrelated number elsewhere, so it is only asked there
	return errors.Is(err, syscall.ENOSPC) || (runtime.GOOS == "windows" && errors.Is(err, syscall.Errno(112)))
}
