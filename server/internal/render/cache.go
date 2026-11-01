package render

import (
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
)

// Ext is the extension of cached renders; only such files count towards the limit.
const Ext = ".flac"

const (
	tempPrefix   = ".render-"
	staleTempAge = time.Hour
)

// Cache keeps rendered files in one directory under a total size limit. The least recently
// used file (by modification time, which Touch refreshes whenever a file is served) is removed first.
type Cache struct {
	dir   string
	limit int64
	now   func() time.Time

	mu sync.Mutex // one Store or eviction at a time
}

// NewCache creates the directory. now is the clock for the file times.
func NewCache(dir string, limit int64, now func() time.Time) (*Cache, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}
	if now == nil {
		now = time.Now
	}
	return &Cache{dir: dir, limit: limit, now: now}, nil
}

// Dir is the cache directory.
func (c *Cache) Dir() string { return c.dir }

// Path is where the named file is (or would be) kept.
func (c *Cache) Path(name string) string { return filepath.Join(c.dir, name) }

// Has reports whether the named file exists.
func (c *Cache) Has(name string) bool {
	st, err := os.Stat(c.Path(name))
	return err == nil && st.Mode().IsRegular()
}

// Touch marks the file as used now.
func (c *Cache) Touch(path string) {
	now := c.now()
	_ = os.Chtimes(path, now, now)
}

// Size is the total size of the cached renders.
func (c *Cache) Size() int64 {
	var total int64
	for _, f := range c.files() {
		total += f.size
	}
	return total
}

type cached struct {
	name string
	size int64
	used time.Time
}

func (c *Cache) files() []cached {
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return nil
	}
	var out []cached
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), Ext) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, cached{e.Name(), info.Size(), info.ModTime()})
	}
	return out
}

// Store writes the named file with fill (through a temporary file that is renamed when fill
// succeeds, so readers never see a partial file), then evicts old files until the cache is
// within its limit. The new file is never evicted, however big it is: it is about to be served.
func (c *Cache) Store(name string, fill func(w io.Writer) error) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	tmp, err := os.CreateTemp(c.dir, tempPrefix+"*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) // a no-op after the rename
	if err := fill(tmp); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp.Name(), 0o640); err != nil {
		return err
	}
	// the name is the song's SHA-256 and the render settings: a file that is there already is the same audio and stays
	if err := fsutil.Place(tmp.Name(), c.Path(name), fsutil.PlaceBudget); err != nil {
		return err
	}
	c.Touch(c.Path(name))
	c.evict(name)
	return nil
}

func (c *Cache) evict(keep string) {
	files := c.files()
	var total int64
	for _, f := range files {
		total += f.size
	}
	sort.Slice(files, func(i, j int) bool { return files[i].used.Before(files[j].used) })
	for _, f := range files {
		if total <= c.limit {
			return
		}
		if f.name == keep {
			continue
		}
		if !fsutil.RemoveQuietly(c.Path(f.name)) {
			continue // e.g. still open on Windows: the next eviction tries again
		}
		total -= f.size
	}
}

// Cleanup removes temporary files that an interrupted render left behind.
func (c *Cache) Cleanup() {
	entries, err := os.ReadDir(c.dir)
	if err != nil {
		return
	}
	now := c.now()
	for _, e := range entries {
		if e.IsDir() || !strings.HasPrefix(e.Name(), tempPrefix) {
			continue
		}
		if info, err := e.Info(); err == nil && now.Sub(info.ModTime()) > staleTempAge {
			_ = fsutil.RemoveQuietly(c.Path(e.Name()))
		}
	}
}
