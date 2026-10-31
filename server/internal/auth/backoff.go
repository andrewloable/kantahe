package auth

import (
	"sync"
	"time"
)

const (
	backoffFreeFailures = 4
	backoffMax          = 900 * time.Second
	backoffExpiry       = 24 * time.Hour
	backoffSweepEvery   = time.Minute
)

type backoffEntry struct {
	failures int
	last     time.Time
}

// Backoff slows repeated sign-in failures per key (an email or an IP): after
// the 5th consecutive failure the wait is 2^(n-5) seconds, at most 900 s.
type Backoff struct {
	now       func() time.Time
	mu        sync.Mutex
	entries   map[string]*backoffEntry
	lastSweep time.Time
}

// NewBackoff builds a Backoff; now defaults to time.Now.
func NewBackoff(now func() time.Time) *Backoff {
	if now == nil {
		now = time.Now
	}
	return &Backoff{now: now, entries: map[string]*backoffEntry{}, lastSweep: now()}
}

func (b *Backoff) sweep(now time.Time) {
	if now.Sub(b.lastSweep) < backoffSweepEvery {
		return
	}
	b.lastSweep = now
	for k, e := range b.entries {
		if now.Sub(e.last) > backoffExpiry {
			delete(b.entries, k)
		}
	}
}

func waitFor(failures int) time.Duration {
	if failures <= backoffFreeFailures {
		return 0
	}
	if shift := failures - backoffFreeFailures - 1; shift < 10 { // 2^10 s already exceeds the cap
		return min(time.Duration(1<<shift)*time.Second, backoffMax)
	}
	return backoffMax
}

// Check returns how long the caller must still wait: the longest wait of any key.
func (b *Backoff) Check(keys ...string) time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	b.sweep(now)
	var longest time.Duration
	for _, k := range keys {
		e, ok := b.entries[k]
		if !ok || now.Sub(e.last) > backoffExpiry {
			continue
		}
		longest = max(longest, e.last.Add(waitFor(e.failures)).Sub(now))
	}
	return max(longest, 0)
}

// Fail records a failed attempt for every key.
func (b *Backoff) Fail(keys ...string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	b.sweep(now)
	for _, k := range keys {
		e := b.entries[k]
		if e == nil {
			e = &backoffEntry{}
			b.entries[k] = e
		}
		if e.failures < 1<<20 { // no overflow however long an attacker keeps trying
			e.failures++
		}
		e.last = now
	}
}

// Succeed forgets the failures of every key.
func (b *Backoff) Succeed(keys ...string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, k := range keys {
		delete(b.entries, k)
	}
}

// KeyBytes is the total size of all keys held (used to check that callers do not
// store unbounded attacker-chosen strings).
func (b *Backoff) KeyBytes() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	n := 0
	for k := range b.entries {
		n += len(k)
	}
	return n
}
