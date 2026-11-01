//go:build !windows

package fsutil

// platformIsBusy: only Windows refuses to delete or replace a file that is open, so elsewhere nothing is worth retrying.
func platformIsBusy(error) bool { return false }
