//go:build windows

package fsutil

import (
	"os"

	"golang.org/x/sys/windows"
)

// The flags of GetFinalPathNameByHandle; both are zero, which x/sys/windows does not name.
const (
	fileNameNormalized = 0x0 // FILE_NAME_NORMALIZED: the long name, not a short one
	volumeNameDOS      = 0x0 // VOLUME_NAME_DOS: a drive letter (or \\?\UNC\), not a volume GUID
)

// resolve asks Windows for the final path of an absolute path: every symlink and junction followed, 8.3 short names written out,
// every element in its real case. Go 1.23 stopped filepath.EvalSymlinks from following junctions (mount points), so it is not used
// here; the tests that run on Windows check that this function does (paths_windows_test.go).
func resolve(abs string) (string, error) {
	name, err := windows.UTF16PtrFromString(abs)
	if err != nil {
		return "", err
	}
	// access 0: the handle is only asked where it points; BACKUP_SEMANTICS is what allows opening a directory
	h, err := windows.CreateFile(name, 0, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil,
		windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		return "", &os.PathError{Op: "open", Path: abs, Err: err}
	}
	defer windows.CloseHandle(h) //nolint:errcheck // nothing to do about a handle that cannot be closed
	buf := make([]uint16, windows.MAX_PATH)
	for {
		n, err := windows.GetFinalPathNameByHandle(h, &buf[0], uint32(len(buf)), fileNameNormalized|volumeNameDOS)
		if err != nil {
			return "", &os.PathError{Op: "finalpath", Path: abs, Err: err}
		}
		if int(n) < len(buf) {
			return stripExtended(windows.UTF16ToString(buf[:n])), nil
		}
		buf = make([]uint16, n+1) // too small: n is the size needed
	}
}
