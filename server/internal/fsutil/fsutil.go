// Package fsutil holds the file operations that must survive Windows: a file that another program has open, even for a moment
// (a virus scanner or an indexer looking at a new file, a player streaming a song), cannot be deleted or replaced there, and the
// failure is brief. Go opens files without FILE_SHARE_DELETE, so the server also blocks itself while it reads a file.
//
// Three rules come from that. A file whose name is the SHA-256 of its content never needs replacing: Place keeps the file that is
// there. Any other replace or delete retries for a short budget while the failure is a sharing or lock violation (IsBusy).
// A derived file that cannot be deleted now is not worth failing the user's action for: RemoveQuietly tries once and the caller
// sweeps it later. On Linux and macOS IsBusy is always false, so nothing here retries or waits.
package fsutil

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"time"
)

// retryStep is the wait before the first retry; the n-th wait is n times as long.
const retryStep = 50 * time.Millisecond

// How long each kind of operation keeps trying while a file is busy.
const (
	// PlaceBudget: moving a finished temporary file to its content-addressed name.
	PlaceBudget = 3 * time.Second
	// ReplaceBudget: replacing a file whose content changes (the default SoundFont).
	ReplaceBudget = 5 * time.Second
	// DeleteBudget: deleting a song's file inside the database write transaction. The transaction holds the write lock, and the
	// other writers wait for it at most store.BusyTimeout (5 s): this must stay well under that, or they fail with "database is locked".
	DeleteBudget = 1500 * time.Millisecond
)

// Hooks replace the operating system in tests; a nil field keeps the real one.
type Hooks struct {
	Remove func(path string) error
	Rename func(oldpath, newpath string) error
	IsBusy func(err error) bool
	Now    func() time.Time
	Sleep  func(ctx context.Context, d time.Duration)
}

var (
	remove = os.Remove
	rename = os.Rename
	busy   = platformIsBusy
	now    = time.Now
	sleep  = func(ctx context.Context, d time.Duration) {
		t := time.NewTimer(d)
		defer t.Stop()
		select {
		case <-ctx.Done():
		case <-t.C:
		}
	}
)

// SetHooksForTest installs hooks and returns the function that puts the real ones back. Tests only; not safe for parallel tests.
func SetHooksForTest(h Hooks) (restore func()) {
	oldRemove, oldRename, oldBusy, oldNow, oldSleep := remove, rename, busy, now, sleep
	if h.Remove != nil {
		remove = h.Remove
	}
	if h.Rename != nil {
		rename = h.Rename
	}
	if h.IsBusy != nil {
		busy = h.IsBusy
	}
	if h.Now != nil {
		now = h.Now
	}
	if h.Sleep != nil {
		sleep = h.Sleep
	}
	return func() { remove, rename, busy, now, sleep = oldRemove, oldRename, oldBusy, oldNow, oldSleep }
}

// IsBusy reports whether err is a brief "file in use" failure that is worth retrying: on Windows a sharing violation, a lock
// violation, or access denied on a file that is not read-only; never anywhere else.
func IsBusy(err error) bool { return err != nil && busy(err) }

// Retry runs op again while it fails with a busy error, waiting 50 ms times the attempt number between tries, until budget has
// passed or ctx is done. It returns nil, the first error that is not busy, or the last busy error.
func Retry(ctx context.Context, budget time.Duration, op func() error) error {
	start := now()
	for attempt := 1; ; attempt++ {
		err := op()
		if err == nil || !IsBusy(err) {
			return err
		}
		left := budget - now().Sub(start)
		if left <= 0 || ctx.Err() != nil {
			return err
		}
		wait := time.Duration(attempt) * retryStep
		if wait > left {
			wait = left
		}
		sleep(ctx, wait)
	}
}

// Remove deletes path, retrying while it is busy for up to budget. A file that is not there is success.
func Remove(ctx context.Context, path string, budget time.Duration) error {
	return Retry(ctx, budget, func() error { return RemoveOnce(path) })
}

// RemoveOnce tries once to delete path. A file that is not there is success; any other error is returned.
func RemoveOnce(path string) error {
	if err := remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}

// RemoveQuietly is RemoveOnce for a caller that only wants to know whether the file is gone. The caller decides what to do with a
// file that is still there; nothing is logged here.
func RemoveQuietly(path string) bool { return RemoveOnce(path) == nil }

// Place moves the finished temporary file tmp to dst, a file named by the SHA-256 of its content. When dst is there already it
// has the same content, so it is kept and tmp is deleted, without touching dst (a player may be reading it, and on Windows
// replacing an open file fails). Otherwise tmp is renamed to dst, retrying a busy failure for up to budget; a rename that fails
// because dst appeared meanwhile is the same case.
func Place(tmp, dst string, budget time.Duration) error {
	if exists(dst) {
		RemoveQuietly(tmp)
		return nil
	}
	err := Retry(context.Background(), budget, func() error { return rename(tmp, dst) })
	if err != nil && exists(dst) {
		RemoveQuietly(tmp)
		return nil
	}
	return err
}

// Replace moves tmp over dst for a file that is not content-addressed (its content may change), retrying a busy failure for up
// to budget.
func Replace(ctx context.Context, tmp, dst string, budget time.Duration) error {
	return Retry(ctx, budget, func() error { return rename(tmp, dst) })
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
