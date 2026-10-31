package auth

import (
	"sync"
	"testing"
	"time"
)

type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newClock() *clock { return &clock{time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)} }

func TestBackoff(t *testing.T) {
	c := newClock()
	b := NewBackoff(c.now)
	for i := 1; i <= 4; i++ {
		b.Fail("k")
		if w := b.Check("k"); w != 0 {
			t.Fatalf("after %d failures wait = %v, want 0", i, w)
		}
	}
	b.Fail("k")
	if w := b.Check("k"); w != time.Second {
		t.Fatalf("5th failure: %v, want 1s", w)
	}
	c.advance(time.Second)
	if w := b.Check("k"); w != 0 {
		t.Fatalf("after 1s: %v, want 0", w)
	}
	b.Fail("k")
	if w := b.Check("k"); w != 2*time.Second {
		t.Fatalf("6th failure: %v, want 2s", w)
	}
	c.advance(1500 * time.Millisecond)
	if w := b.Check("k"); w != 500*time.Millisecond {
		t.Fatalf("remaining wait = %v, want 500ms", w)
	}
	c.advance(500 * time.Millisecond)
	if w := b.Check("k"); w != 0 {
		t.Fatalf("after 2s: %v, want 0", w)
	}
}

func TestBackoffCap(t *testing.T) {
	b := NewBackoff(newClock().now)
	for i := 0; i < 20; i++ {
		b.Fail("k")
	}
	if w := b.Check("k"); w != 900*time.Second {
		t.Fatalf("wait = %v, want the 900s cap", w)
	}
	for i := 0; i < 5000; i++ {
		b.Fail("k")
	}
	if w := b.Check("k"); w != 900*time.Second {
		t.Fatalf("wait after 5000 failures = %v, want 900s", w)
	}
}

func TestBackoffSucceedResets(t *testing.T) {
	b := NewBackoff(newClock().now)
	for i := 0; i < 8; i++ {
		b.Fail("k")
	}
	b.Succeed("k")
	if w := b.Check("k"); w != 0 {
		t.Fatalf("wait = %v after Succeed", w)
	}
	b.Fail("k")
	b.Fail("k")
	if w := b.Check("k"); w != 0 {
		t.Fatalf("counter should restart at zero: %v", w)
	}
}

func TestBackoffLongestKey(t *testing.T) {
	c := newClock()
	b := NewBackoff(c.now)
	for i := 0; i < 8; i++ { // 8 failures: 2^3 = 8 s
		b.Fail("email:a")
	}
	c.advance(4 * time.Second)
	for i := 0; i < 5; i++ { // 1 s
		b.Fail("ip:1")
	}
	if w := b.Check("email:a", "ip:1"); w != 4*time.Second {
		t.Fatalf("Check = %v, want the longest (4s)", w)
	}
	if w := b.Check("unknown"); w != 0 {
		t.Fatalf("unknown key = %v", w)
	}
}

func TestBackoffFailAndSucceedTakeSeveralKeys(t *testing.T) {
	b := NewBackoff(newClock().now)
	for i := 0; i < 5; i++ {
		b.Fail("email:a", "ip:1")
	}
	if b.Check("email:a") == 0 || b.Check("ip:1") == 0 {
		t.Fatal("both keys should be slowed")
	}
	b.Succeed("email:a", "ip:1")
	if b.Check("email:a", "ip:1") != 0 {
		t.Fatal("both keys should be reset")
	}
}

func TestBackoffPrunesOldEntries(t *testing.T) {
	c := newClock()
	b := NewBackoff(c.now)
	for i := 0; i < 5; i++ {
		b.Fail("old")
	}
	c.advance(25 * time.Hour)
	b.Fail("new")
	b.mu.Lock()
	_, stillThere := b.entries["old"]
	b.mu.Unlock()
	if stillThere {
		t.Fatal("entries older than 24h must be pruned on access")
	}
	if w := b.Check("old"); w != 0 {
		t.Fatalf("pruned key wait = %v", w)
	}
}

func TestBackoffNilClockUsesTime(t *testing.T) {
	b := NewBackoff(nil)
	b.Fail("k")
	if b.Check("k") != 0 {
		t.Fatal("one failure must not slow")
	}
}

func TestBackoffConcurrent(t *testing.T) {
	b := NewBackoff(newClock().now) // a frozen clock: the wait is exactly the cap
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				b.Fail("email:a", "ip:1")
				b.Check("email:a", "ip:1")
				if i%50 == 0 {
					b.Succeed("ip:1")
				}
			}
		}()
	}
	wg.Wait()
	if b.Check("email:a") != 900*time.Second {
		t.Fatalf("1600 failures should hit the cap, got %v", b.Check("email:a"))
	}
}
