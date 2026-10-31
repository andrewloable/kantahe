package render

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newCache(t *testing.T, limit int64) (*Cache, *fakeClock) {
	t.Helper()
	clock := &fakeClock{time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)}
	c, err := NewCache(filepath.Join(t.TempDir(), "render"), limit, clock.now)
	if err != nil {
		t.Fatal(err)
	}
	return c, clock
}

func put(t *testing.T, c *Cache, clock *fakeClock, name string, size int) {
	t.Helper()
	clock.advance(time.Minute)
	err := c.Store(name, func(w io.Writer) error {
		_, err := w.Write([]byte(strings.Repeat("x", size)))
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
}

func names(t *testing.T, c *Cache) []string {
	t.Helper()
	es, err := os.ReadDir(c.Dir())
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range es {
		out = append(out, e.Name())
	}
	return out
}

func TestCacheEvictsLRU(t *testing.T) {
	c, clock := newCache(t, 25)
	put(t, c, clock, "a.flac", 10)
	put(t, c, clock, "b.flac", 10)
	clock.advance(time.Minute)
	c.Touch(c.Path("a.flac")) // a was served after b was written: b is now the least recently used
	put(t, c, clock, "c.flac", 10)
	if c.Has("b.flac") {
		t.Error("b.flac, the least recently used file, is still there")
	}
	if !c.Has("a.flac") || !c.Has("c.flac") {
		t.Errorf("files left: %v, want a.flac and c.flac", names(t, c))
	}
}

func TestCacheKeepsTheNewestFileEvenWhenItIsTooBig(t *testing.T) {
	c, clock := newCache(t, 5)
	put(t, c, clock, "old.flac", 3)
	put(t, c, clock, "big.flac", 10)
	if c.Has("old.flac") {
		t.Error("old.flac should have been evicted to make room")
	}
	if !c.Has("big.flac") {
		t.Fatal("the file that was just rendered must stay, it is about to be served")
	}
}

func TestCacheStoreFailureLeavesNothing(t *testing.T) {
	c, _ := newCache(t, 100)
	boom := errors.New("boom")
	err := c.Store("x.flac", func(w io.Writer) error { _, _ = w.Write([]byte("partial")); return boom })
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v", err)
	}
	if left := names(t, c); len(left) != 0 {
		t.Fatalf("files left after a failed render: %v", left)
	}
}

func TestCacheCountsOnlyItsOwnFiles(t *testing.T) {
	c, clock := newCache(t, 15)
	if err := os.WriteFile(filepath.Join(c.Dir(), "notes.txt"), []byte(strings.Repeat("y", 100)), 0o600); err != nil {
		t.Fatal(err)
	}
	put(t, c, clock, "a.flac", 10)
	if !c.Has("a.flac") {
		t.Fatal("a stranger file in the directory made the cache evict its own file")
	}
	if _, err := os.Stat(filepath.Join(c.Dir(), "notes.txt")); err != nil {
		t.Fatal("the cache deleted a file it does not own")
	}
}

func TestCacheCleanupRemovesStaleTemporaryFiles(t *testing.T) {
	c, clock := newCache(t, 100)
	stale := filepath.Join(c.Dir(), ".render-old")
	fresh := filepath.Join(c.Dir(), ".render-new")
	for _, p := range []string{stale, fresh} {
		if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Chtimes(stale, clock.t.Add(-3*time.Hour), clock.t.Add(-3*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(fresh, clock.t, clock.t); err != nil {
		t.Fatal(err)
	}
	c.Cleanup()
	if _, err := os.Stat(stale); !os.IsNotExist(err) {
		t.Error("the stale temporary file is still there")
	}
	if _, err := os.Stat(fresh); err != nil {
		t.Error("a temporary file of a render that may be running was removed")
	}
}

func TestCacheUsage(t *testing.T) {
	c, clock := newCache(t, 100)
	put(t, c, clock, "a.flac", 7)
	put(t, c, clock, "b.flac", 5)
	if got := c.Size(); got != 12 {
		t.Fatalf("Size = %d, want 12", got)
	}
}
