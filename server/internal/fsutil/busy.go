package fsutil

// Windows error codes (winerror.h). The numbers mean something else elsewhere (32 is EPIPE on Linux), so only the Windows file
// turns an operating system error into one of them; this classification is plain arithmetic and is tested on every system.
const (
	errorAccessDenied     = 5  // ERROR_ACCESS_DENIED: also what a read-only file or a missing permission reports
	errorSharingViolation = 32 // ERROR_SHARING_VIOLATION: another handle is open without the sharing this needs
	errorLockViolation    = 33 // ERROR_LOCK_VIOLATION: part of the file is locked
)

// windowsBusy says whether a Windows error code is a brief "in use" failure. Access denied counts only when readOnly (asked only
// then) says the target is not read-only: that is a virus scanner or indexer holding a new file, not a permission.
func windowsBusy(code uintptr, readOnly func() bool) bool {
	switch code {
	case errorSharingViolation, errorLockViolation:
		return true
	case errorAccessDenied:
		return !readOnly()
	}
	return false
}
