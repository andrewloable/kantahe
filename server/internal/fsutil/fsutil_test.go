package fsutil

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

var errBusy = errors.New("test: file in use")

// clock is a fake time: Sleep moves it, nothing waits.
type clock struct {
	t      time.Time
	slept  []time.Duration
	onWait func()
}

func (c *clock) hooks(h Hooks) Hooks {
	h.Now = func() time.Time { return c.t }
	h.Sleep = func(_ context.Context, d time.Duration) {
		c.slept = append(c.slept, d)
		c.t = c.t.Add(d)
		if c.onWait != nil {
			c.onWait()
		}
	}
	return h
}

func busyIs(target error) func(error) bool {
	return func(err error) bool { return errors.Is(err, target) }
}

func use(t *testing.T, h Hooks) {
	t.Helper()
	t.Cleanup(SetHooksForTest(h))
}

func newClock() *clock { return &clock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)} }

func TestRetryBusyThreeTimesThenFine(t *testing.T) {
	c := newClock()
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy)}))
	calls := 0
	err := Retry(context.Background(), time.Second, func() error {
		calls++
		if calls <= 3 {
			return errBusy
		}
		return nil
	})
	if err != nil || calls != 4 {
		t.Fatalf("err=%v calls=%d, want nil after 3 retries (4 calls)", err, calls)
	}
	// 50 ms times the attempt number
	want := []time.Duration{50 * time.Millisecond, 100 * time.Millisecond, 150 * time.Millisecond}
	if len(c.slept) != 3 || c.slept[0] != want[0] || c.slept[1] != want[1] || c.slept[2] != want[2] {
		t.Fatalf("waits = %v, want %v", c.slept, want)
	}
}

func TestRetryBusyForeverStopsAtTheBudget(t *testing.T) {
	c := newClock()
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy)}))
	start := c.t
	err := Retry(context.Background(), 300*time.Millisecond, func() error { return errBusy })
	if !errors.Is(err, errBusy) {
		t.Fatalf("err = %v, want the busy error", err)
	}
	if spent := c.t.Sub(start); spent != 300*time.Millisecond {
		t.Fatalf("waited %v, want the budget of 300ms and not a step more", spent)
	}
}

func TestRetryLastWaitIsCutToWhatIsLeft(t *testing.T) {
	c := newClock()
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy)}))
	_ = Retry(context.Background(), 200*time.Millisecond, func() error { return errBusy })
	var total time.Duration
	for _, d := range c.slept {
		total += d
	}
	if total != 200*time.Millisecond || c.slept[len(c.slept)-1] != 50*time.Millisecond {
		t.Fatalf("waits %v: the last one must be cut to what is left of the budget", c.slept)
	}
}

func TestRetryDoesNotRetryOtherErrors(t *testing.T) {
	c := newClock()
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy)}))
	other := errors.New("permission denied")
	calls := 0
	err := Retry(context.Background(), time.Second, func() error { calls++; return other })
	if !errors.Is(err, other) || calls != 1 || len(c.slept) != 0 {
		t.Fatalf("err=%v calls=%d waits=%v, want the error at once", err, calls, c.slept)
	}
}

func TestRetryStopsWhenTheContextIsCancelled(t *testing.T) {
	c := newClock()
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy)}))
	ctx, cancel := context.WithCancel(context.Background())
	c.onWait = cancel
	calls := 0
	err := Retry(ctx, 10*time.Second, func() error { calls++; return errBusy })
	if !errors.Is(err, errBusy) || calls != 2 {
		t.Fatalf("err=%v calls=%d, want the busy error after the call that follows the cancel", err, calls)
	}
}

func TestRetryWithoutBudgetTriesOnce(t *testing.T) {
	c := newClock()
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy)}))
	calls := 0
	_ = Retry(context.Background(), 0, func() error { calls++; return errBusy })
	if calls != 1 || len(c.slept) != 0 {
		t.Fatalf("calls=%d waits=%v", calls, c.slept)
	}
}

func TestRemove(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "x")
	if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := Remove(context.Background(), p, time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(p); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("the file is still there")
	}
	if err := Remove(context.Background(), p, time.Second); err != nil {
		t.Fatalf("a file that is not there is success, got %v", err)
	}
}

func TestRemoveRetriesWhileBusy(t *testing.T) {
	c := newClock()
	busyFor := 3
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy), Remove: func(string) error {
		if busyFor > 0 {
			busyFor--
			return &fs.PathError{Op: "remove", Path: "p", Err: errBusy}
		}
		return nil
	}}))
	if err := Remove(context.Background(), "p", time.Second); err != nil {
		t.Fatal(err)
	}
}

func TestRemoveGivesTheBusyErrorBackAfterTheBudget(t *testing.T) {
	c := newClock()
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy), Remove: func(string) error { return errBusy }}))
	err := Remove(context.Background(), "p", 300*time.Millisecond)
	if !errors.Is(err, errBusy) || !IsBusy(err) {
		t.Fatalf("err = %v", err)
	}
}

func TestRemoveQuietly(t *testing.T) {
	p := filepath.Join(t.TempDir(), "x")
	if err := os.WriteFile(p, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if !RemoveQuietly(p) {
		t.Fatal("a file that was deleted is gone")
	}
	if !RemoveQuietly(p) {
		t.Fatal("a file that was not there is gone too")
	}
	c := newClock()
	calls := 0
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy), Remove: func(string) error { calls++; return errBusy }}))
	if RemoveQuietly(p) || calls != 1 || len(c.slept) != 0 {
		t.Fatalf("a busy file is reported as still there after one try (calls=%d waits=%v)", calls, c.slept)
	}
}

func write(t *testing.T, p, content string) {
	t.Helper()
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestPlaceMovesTheFileWhenThereIsNoneYet(t *testing.T) {
	dir := t.TempDir()
	tmp, dst := filepath.Join(dir, ".upload-1"), filepath.Join(dir, "abc.kar")
	write(t, tmp, "content")
	if err := Place(tmp, dst, time.Second); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(dst); string(b) != "content" {
		t.Fatalf("dst = %q", b)
	}
	if _, err := os.Stat(tmp); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("the temporary file must be gone")
	}
}

func TestPlaceKeepsTheFileThatIsThereAndDoesNotTouchIt(t *testing.T) {
	dir := t.TempDir()
	tmp, dst := filepath.Join(dir, ".upload-1"), filepath.Join(dir, "abc.kar")
	write(t, dst, "old but identical")
	write(t, tmp, "new copy")
	old := time.Date(2020, 1, 2, 3, 4, 5, 0, time.UTC)
	if err := os.Chtimes(dst, old, old); err != nil {
		t.Fatal(err)
	}
	renames := 0
	use(t, Hooks{Rename: func(a, b string) error { renames++; return os.Rename(a, b) }})
	if err := Place(tmp, dst, time.Second); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(dst)
	if b, _ := os.ReadFile(dst); string(b) != "old but identical" || !info.ModTime().Equal(old) || renames != 0 {
		t.Fatalf("dst was touched: content=%q mtime=%v renames=%d", b, info.ModTime(), renames)
	}
	if _, err := os.Stat(tmp); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("the temporary file must be deleted")
	}
}

func TestPlaceTreatsARenameThatFailsBecauseTheTargetAppearedAsPresent(t *testing.T) {
	dir := t.TempDir()
	tmp, dst := filepath.Join(dir, ".upload-1"), filepath.Join(dir, "abc.kar")
	write(t, tmp, "x")
	use(t, Hooks{Rename: func(a, b string) error {
		write(t, b, "x") // someone else placed the same file meanwhile
		return &os.LinkError{Op: "rename", Old: a, New: b, Err: fs.ErrExist}
	}})
	if err := Place(tmp, dst, time.Second); err != nil {
		t.Fatalf("got %v, want the existing file kept", err)
	}
	if _, err := os.Stat(tmp); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("the temporary file must be deleted")
	}
}

func TestPlaceReturnsAnErrorThatIsNotAboutAPresentTarget(t *testing.T) {
	dir := t.TempDir()
	tmp, dst := filepath.Join(dir, ".upload-1"), filepath.Join(dir, "abc.kar")
	write(t, tmp, "x")
	boom := errors.New("disk full")
	use(t, Hooks{Rename: func(string, string) error { return boom }})
	if err := Place(tmp, dst, time.Second); !errors.Is(err, boom) {
		t.Fatalf("err = %v", err)
	}
	if _, err := os.Stat(tmp); err != nil {
		t.Fatal("the temporary file is left for the caller's cleanup")
	}
}

func TestPlaceRetriesABusyRename(t *testing.T) {
	dir := t.TempDir()
	tmp, dst := filepath.Join(dir, ".upload-1"), filepath.Join(dir, "abc.kar")
	write(t, tmp, "x")
	c := newClock()
	busyFor := 2
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy), Rename: func(a, b string) error {
		if busyFor > 0 {
			busyFor--
			return errBusy
		}
		return os.Rename(a, b)
	}}))
	if err := Place(tmp, dst, time.Second); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(dst); err != nil {
		t.Fatal("dst must exist")
	}
}

func TestReplaceReplacesAndRetries(t *testing.T) {
	dir := t.TempDir()
	tmp, dst := filepath.Join(dir, "default.sf2.tmp1"), filepath.Join(dir, "default.sf2")
	write(t, dst, "old")
	write(t, tmp, "new")
	c := newClock()
	busyFor := 2
	use(t, c.hooks(Hooks{IsBusy: busyIs(errBusy), Rename: func(a, b string) error {
		if busyFor > 0 {
			busyFor--
			return errBusy
		}
		return os.Rename(a, b)
	}}))
	if err := Replace(context.Background(), tmp, dst, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(dst); string(b) != "new" {
		t.Fatalf("dst = %q", b)
	}
}

func TestWindowsCodesAreClassified(t *testing.T) {
	never := func() bool { t.Fatal("read-only must not be asked"); return false }
	for _, c := range []struct {
		code     uintptr
		readOnly bool
		asked    bool
		want     bool
	}{
		{32, false, false, true}, // sharing violation
		{33, false, false, true}, // lock violation
		{5, false, true, true},   // access denied on a file that is not read-only: a scanner has it
		{5, true, true, false},   // access denied on a read-only file: a permission, not a wait
		{2, false, false, false}, // file not found
		{3, false, false, false}, // path not found
		{0, false, false, false},
	} {
		ro := func() bool { return c.readOnly }
		if !c.asked {
			ro = never
		}
		if got := windowsBusy(c.code, ro); got != c.want {
			t.Errorf("code %d (read-only %v): %v, want %v", c.code, c.readOnly, got, c.want)
		}
	}
}

func TestAWindowsCodeMeansNothingOnOtherSystems(t *testing.T) {
	if os.PathSeparator == '\\' {
		t.Skip("this is Windows")
	}
	// 32 is EPIPE here, 33 is EDOM and 5 is EIO: none is "in use"
	for _, errno := range []syscall.Errno{32, 33, 5} {
		err := &os.PathError{Op: "remove", Path: "x", Err: errno}
		if IsBusy(err) {
			t.Errorf("errno %d must not be busy outside Windows", errno)
		}
	}
}

func TestIsBusyOfNilIsFalse(t *testing.T) {
	use(t, Hooks{IsBusy: func(error) bool { return true }})
	if IsBusy(nil) {
		t.Fatal("no error is not busy")
	}
}
