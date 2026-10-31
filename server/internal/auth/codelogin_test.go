package auth

import (
	"context"
	"errors"
	"net/netip"
	"strings"
	"sync"
	"testing"
	"time"
)

// lockedClock is a fake clock that is safe to advance while a Wait is polling it.
type lockedClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *lockedClock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *lockedClock) advance(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

func newCodes() (*CodeLogins, *lockedClock) {
	c := &lockedClock{t: newClock().t}
	cl := NewCodeLogins(c.now)
	cl.Poll = 2 * time.Millisecond
	return cl, c
}

var ip1 = netip.MustParseAddr("192.0.2.1")

func TestCodeAlphabet(t *testing.T) {
	if len(CodeAlphabet) != 32 {
		t.Fatalf("the generator masks a byte with 31, the alphabet needs exactly 32 symbols, has %d", len(CodeAlphabet))
	}
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		cl, _ := newCodes()
		_, code, _, err := cl.Start("TV", 1, ip1)
		if err != nil {
			t.Fatal(err)
		}
		if len(code) != 6 || strings.Trim(code, CodeAlphabet) != "" || strings.ContainsAny(code, "0O1I") {
			t.Fatalf("bad code %q", code)
		}
		seen[code] = true
	}
	if len(seen) < 900 {
		t.Fatalf("codes are not random: %d distinct of 1000", len(seen))
	}
}

func TestCodesAreUniqueAmongPending(t *testing.T) {
	cl, _ := newCodes()
	codes := map[string]bool{}
	for i := 0; i < 500; i++ {
		_, code, _, err := cl.Start("TV", 1, netip.AddrFrom4([4]byte{10, 0, byte(i / 250), byte(i % 250)}))
		if err != nil {
			t.Fatal(err)
		}
		if codes[code] {
			t.Fatalf("duplicate pending code %q", code)
		}
		codes[code] = true
	}
}

func TestApproveFlow(t *testing.T) {
	cl, _ := newCodes()
	id, code, exp, err := cl.Start("Living room", 7, ip1)
	if err != nil {
		t.Fatal(err)
	}
	if want := newClock().t.Add(5 * time.Minute); !exp.Equal(want) {
		t.Fatalf("expires %v, want %v", exp, want)
	}
	if len(id) < 20 {
		t.Fatalf("login id too short: %q", id)
	}
	type res struct {
		a   Approval
		err error
	}
	out := make(chan res, 1)
	go func() { a, err := cl.Wait(context.Background(), id); out <- res{a, err} }()
	time.Sleep(20 * time.Millisecond)
	name, err := cl.Approve(code, "user-1")
	if err != nil || name != "Living room" {
		t.Fatalf("Approve = %q, %v", name, err)
	}
	r := <-out
	if r.err != nil || r.a.UserID != "user-1" || r.a.DeviceName != "Living room" || r.a.DeviceType != 7 {
		t.Fatalf("Wait = %+v, %v", r.a, r.err)
	}
}

func TestApproveBeforeWait(t *testing.T) {
	cl, _ := newCodes()
	id, code, _, _ := cl.Start("TV", 1, ip1)
	if _, err := cl.Approve(code, "u"); err != nil {
		t.Fatal(err)
	}
	a, err := cl.Wait(context.Background(), id)
	if err != nil || a.UserID != "u" {
		t.Fatalf("%+v %v", a, err)
	}
}

func TestExpiry(t *testing.T) {
	cl, c := newCodes()
	id, code, _, _ := cl.Start("TV", 1, ip1)
	c.advance(5*time.Minute + time.Second)
	if _, err := cl.Wait(context.Background(), id); !errors.Is(err, ErrCodeExpired) {
		t.Fatalf("Wait after expiry: %v", err)
	}
	if _, err := cl.Wait(context.Background(), id); !errors.Is(err, ErrCodeNotFound) {
		t.Fatalf("second Wait: %v", err)
	}
	id2, code2, _, _ := cl.Start("TV", 1, ip1)
	c.advance(5*time.Minute + time.Second)
	if _, err := cl.Approve(code2, "u"); !errors.Is(err, ErrCodeNotFound) {
		t.Fatalf("Approve after expiry: %v", err)
	}
	_ = code
	_ = id2
}

func TestExpiresWhileWaiting(t *testing.T) {
	cl, c := newCodes()
	id, _, _, _ := cl.Start("TV", 1, ip1)
	out := make(chan error, 1)
	go func() { _, err := cl.Wait(context.Background(), id); out <- err }()
	time.Sleep(20 * time.Millisecond)
	c.advance(5*time.Minute + time.Second)
	select {
	case err := <-out:
		if !errors.Is(err, ErrCodeExpired) {
			t.Fatalf("%v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Wait did not notice the expiry")
	}
}

func TestSingleUse(t *testing.T) {
	cl, _ := newCodes()
	id, code, _, _ := cl.Start("TV", 1, ip1)
	if _, err := cl.Approve(code, "u"); err != nil {
		t.Fatal(err)
	}
	if _, err := cl.Approve(code, "other"); !errors.Is(err, ErrCodeNotFound) {
		t.Fatalf("second Approve: %v", err)
	}
	if a, err := cl.Wait(context.Background(), id); err != nil || a.UserID != "u" {
		t.Fatalf("%+v %v", a, err)
	}
	if _, err := cl.Wait(context.Background(), id); !errors.Is(err, ErrCodeNotFound) {
		t.Fatalf("second Wait: %v", err)
	}
	if _, err := cl.Approve(code, "u"); !errors.Is(err, ErrCodeNotFound) {
		t.Fatalf("Approve after the TV took the token: %v", err)
	}
}

func TestCaseInsensitive(t *testing.T) {
	cl, _ := newCodes()
	_, code, _, _ := cl.Start("TV", 1, ip1)
	if _, err := cl.Approve(" "+strings.ToLower(code)+" ", "u"); err != nil {
		t.Fatalf("lowercase with spaces: %v", err)
	}
}

func TestUnknownCodes(t *testing.T) {
	cl, _ := newCodes()
	for _, c := range []string{"", "ABC", "ABCDEFG", "AAAAAA", "00OO11"} {
		if _, err := cl.Approve(c, "u"); !errors.Is(err, ErrCodeNotFound) {
			t.Errorf("%q: %v", c, err)
		}
	}
	if _, err := cl.Wait(context.Background(), "nope"); !errors.Is(err, ErrCodeNotFound) {
		t.Errorf("unknown login id: %v", err)
	}
}

func TestPerIPLimit(t *testing.T) {
	cl, c := newCodes()
	for i := 0; i < 10; i++ {
		if _, _, _, err := cl.Start("TV", 1, ip1); err != nil {
			t.Fatalf("start %d: %v", i+1, err)
		}
	}
	if _, _, _, err := cl.Start("TV", 1, ip1); !errors.Is(err, ErrTooManyCodes) {
		t.Fatalf("11th: %v", err)
	}
	if _, _, _, err := cl.Start("TV", 1, netip.MustParseAddr("192.0.2.2")); err != nil {
		t.Fatalf("another IP: %v", err)
	}
	c.advance(5*time.Minute + time.Second)
	if _, _, _, err := cl.Start("TV", 1, ip1); err != nil {
		t.Fatalf("after expiry the slots are free: %v", err)
	}
}

func TestPerIPLimitGroupsIPv6By64(t *testing.T) {
	cl, _ := newCodes()
	for i := 0; i < 10; i++ {
		ip := netip.MustParseAddr("2001:db8:1:2::1").As16()
		ip[15] = byte(i + 1)
		ip[8] = byte(i) // varies inside the /64
		if _, _, _, err := cl.Start("TV", 1, netip.AddrFrom16(ip)); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, _, err := cl.Start("TV", 1, netip.MustParseAddr("2001:db8:1:2:ffff::9")); !errors.Is(err, ErrTooManyCodes) {
		t.Fatalf("same /64: %v", err)
	}
	if _, _, _, err := cl.Start("TV", 1, netip.MustParseAddr("2001:db8:1:3::1")); err != nil {
		t.Fatalf("other /64: %v", err)
	}
}

func TestGlobalLimit(t *testing.T) {
	cl, _ := newCodes()
	cl.MaxPending = 5
	for i := 0; i < 5; i++ {
		if _, _, _, err := cl.Start("TV", 1, netip.AddrFrom4([4]byte{10, 0, 0, byte(i)})); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, _, err := cl.Start("TV", 1, netip.MustParseAddr("10.9.9.9")); !errors.Is(err, ErrTooManyCodes) {
		t.Fatalf("%v", err)
	}
}

func TestOneWaiterAtATime(t *testing.T) {
	cl, _ := newCodes()
	id, code, _, _ := cl.Start("TV", 1, ip1)
	ctx, cancel := context.WithCancel(context.Background())
	first := make(chan error, 1)
	go func() { _, err := cl.Wait(ctx, id); first <- err }()
	time.Sleep(20 * time.Millisecond)
	if _, err := cl.Wait(context.Background(), id); !errors.Is(err, ErrCodeBusy) {
		t.Fatalf("second concurrent Wait: %v", err)
	}
	cancel()
	if err := <-first; !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled Wait: %v", err)
	}
	// the entry survives a dropped stream: the TV can reconnect
	if _, err := cl.Approve(code, "u"); err != nil {
		t.Fatalf("approve after a dropped stream: %v", err)
	}
	if a, err := cl.Wait(context.Background(), id); err != nil || a.UserID != "u" {
		t.Fatalf("reconnect: %+v %v", a, err)
	}
}

func TestPruneDropsExpiredEntries(t *testing.T) {
	cl, c := newCodes()
	for i := 0; i < 3; i++ {
		cl.Start("TV", 1, netip.AddrFrom4([4]byte{10, 0, 0, byte(i)}))
	}
	if n := cl.Len(); n != 3 {
		t.Fatalf("len %d", n)
	}
	c.advance(5*time.Minute + time.Second)
	cl.Prune()
	if n := cl.Len(); n != 0 {
		t.Fatalf("after prune: %d", n)
	}
}

func TestPruneKeepsApprovedUntilTaken(t *testing.T) {
	cl, c := newCodes()
	id, code, _, _ := cl.Start("TV", 1, ip1)
	cl.Approve(code, "u")
	c.advance(time.Minute)
	cl.Prune()
	if a, err := cl.Wait(context.Background(), id); err != nil || a.UserID != "u" {
		t.Fatalf("%+v %v", a, err)
	}
}

func TestRunPrunes(t *testing.T) {
	cl, c := newCodes()
	cl.Start("TV", 1, ip1)
	c.advance(10 * time.Minute)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	cl.PruneEvery = 5 * time.Millisecond
	go func() { cl.Run(ctx); close(done) }()
	deadline := time.Now().Add(2 * time.Second)
	for cl.Len() != 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	<-done
	if cl.Len() != 0 {
		t.Fatal("the ticker did not prune")
	}
}

func TestConcurrentUse(t *testing.T) {
	cl, _ := newCodes()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			id, code, _, err := cl.Start("TV", 1, netip.AddrFrom4([4]byte{10, 1, 0, byte(i)}))
			if err != nil {
				t.Error(err)
				return
			}
			go cl.Approve(code, "u")
			if _, err := cl.Wait(context.Background(), id); err != nil {
				t.Error(err)
			}
		}(i)
	}
	wg.Wait()
}

// Regression: a Wait whose entry was pruned meanwhile used to delete by key when it woke up,
// which removed a newer entry that had been given the same code.
func TestRegression_WaitDoesNotDropANewerEntryWithTheSameCode(t *testing.T) {
	cl, c := newCodes()
	cl.Poll = 10 * time.Millisecond
	id, code, _, _ := cl.Start("TV", 1, ip1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	gone := make(chan error, 1)
	go func() { _, err := cl.Wait(ctx, id); gone <- err }()
	time.Sleep(30 * time.Millisecond)
	// under one lock: the first entry expires and is pruned, and a new one takes its code
	cl.mu.Lock()
	c.advance(5*time.Minute + time.Second)
	cl.pruneLocked()
	fresh := &codeEntry{loginID: "other", code: code, name: "New TV", expires: c.now().Add(codeLifetime), approved: make(chan struct{})}
	cl.byID[fresh.loginID], cl.byCd[code] = fresh, fresh
	cl.mu.Unlock()
	if err := <-gone; !errors.Is(err, ErrCodeExpired) {
		t.Fatalf("first Wait: %v", err)
	}
	if name, err := cl.Approve(code, "u"); err != nil || name != "New TV" {
		t.Fatalf("the newer entry was dropped by the old Wait: %q %v", name, err)
	}
}
