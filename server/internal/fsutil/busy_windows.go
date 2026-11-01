//go:build windows

package fsutil

import (
	"errors"
	"io/fs"
	"os"
	"syscall"
)

func platformIsBusy(err error) bool {
	var errno syscall.Errno
	if !errors.As(err, &errno) {
		return false
	}
	return windowsBusy(uintptr(errno), func() bool { return targetReadOnly(err) })
}

// targetReadOnly reports whether the file the failed operation was about (the destination of a rename) is read-only. A file that
// cannot be looked at is taken as read-only: an unknown cause is not worth a wait.
func targetReadOnly(err error) bool {
	path := ""
	var pe *fs.PathError
	var le *os.LinkError
	switch {
	case errors.As(err, &le):
		path = le.New
	case errors.As(err, &pe):
		path = pe.Path
	}
	if path == "" {
		return true
	}
	info, statErr := os.Stat(path)
	if statErr != nil {
		return true
	}
	return info.Mode().Perm()&0o200 == 0
}
