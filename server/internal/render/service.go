package render

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/media"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// ErrUnavailable means rendering is switched off (no SoundFont, or --render-cache-gb 0).
var ErrUnavailable = errors.New("render: rendering is not available")

const (
	queueSize       = 64
	failureMemory   = 10 * time.Minute // a failed song is not tried again for this long
	cleanupInterval = 24 * time.Hour
	fontWait        = 30 * time.Second // how long a render waits for the song's trimmed SoundFont
	fontPoll        = 100 * time.Millisecond
)

// Fonts are the per-song trimmed SoundFonts (media.SoundFonts); a render uses one when it is built
// and the full bank when it cannot be.
type Fonts interface {
	Path(ctx context.Context, number string) (string, error)
	Prepare(number string)
}

// Config holds the dependencies of a Service.
type Config struct {
	DB      *store.DB
	DataDir string // renders are cached under <DataDir>/cache/render
	Fonts   Fonts  // may be nil: renders use the full bank
	// FullBank is the path of the full SoundFont, "" when none is configured (no rendering).
	FullBank string
	// Tag identifies the bank in the cache file names, so another bank re-renders.
	Tag string
	// LimitBytes is the size limit of the cache; 0 switches rendering off.
	LimitBytes int64
	Logger     *slog.Logger
	Now        func() time.Time
}

// Service renders MIDI songs to audio in the background, one at a time, and keeps the results.
type Service struct {
	db     *store.DB
	fonts  Fonts
	bank   string
	tag    string
	logger *slog.Logger
	now    func() time.Time
	cache  *Cache // nil when rendering is not available

	queue chan job

	mu       sync.Mutex
	inflight map[string]bool    // song sha -> queued or rendering
	failed   map[string]failure // song sha -> when the last render failed

	renders   atomic.Int64 // tests count renders and the most that ran at once
	active    atomic.Int32
	maxActive atomic.Int32
}

type job struct{ number, sha, path string }

type failure struct{ at time.Time }

// New prepares the service and, when rendering is available, its cache directory.
func New(c Config) (*Service, error) {
	s := &Service{
		db: c.DB, fonts: c.Fonts, bank: c.FullBank, tag: c.Tag, logger: c.Logger, now: c.Now,
		queue: make(chan job, queueSize), inflight: map[string]bool{}, failed: map[string]failure{},
	}
	if s.now == nil {
		s.now = time.Now
	}
	if s.logger == nil {
		s.logger = slog.Default()
	}
	if c.LimitBytes > 0 && c.FullBank != "" {
		cache, err := NewCache(filepath.Join(c.DataDir, "cache", "render"), c.LimitBytes, s.now)
		if err != nil {
			return nil, err
		}
		s.cache = cache
	}
	return s, nil
}

// Available reports whether the server can render: a SoundFont and a non-zero cache limit.
func (s *Service) Available() bool { return s.cache != nil }

func (s *Service) cacheName(sha string) string { return sha + "-" + s.tag + Ext }

// lookup finds a visible MIDI song by (possibly non-canonical) number.
func (s *Service) lookup(ctx context.Context, number string) (job, error) {
	n, ok := library.CanonicalNumber(strings.TrimSpace(number))
	if !ok {
		return job{}, library.ErrNotFound
	}
	var j job
	var format int
	err := s.db.QueryRowContext(ctx, `SELECT number, sha256, path, format FROM songs WHERE number = ? AND deleted = 0 AND failed = 0 AND metadata_done = 1`, n).
		Scan(&j.number, &j.sha, &j.path, &format)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && library.Format(format) != library.FormatMIDI) {
		return job{}, library.ErrNotFound
	}
	return j, err
}

// hasFailed reports a remembered failure; callers hold s.mu.
func (s *Service) hasFailed(sha string) bool {
	f, ok := s.failed[sha]
	if ok && s.now().Sub(f.at) > failureMemory {
		delete(s.failed, sha)
		return false
	}
	return ok
}

// Ready reports whether the song's render is cached.
func (s *Service) Ready(ctx context.Context, number string) bool {
	if s.cache == nil {
		return false
	}
	j, err := s.lookup(ctx, number)
	return err == nil && s.cache.Has(s.cacheName(j.sha))
}

// Failed reports whether rendering the song failed recently, so that callers can fall back to
// playing the MIDI on the device.
func (s *Service) Failed(ctx context.Context, number string) bool {
	if s.cache == nil {
		return false
	}
	j, err := s.lookup(ctx, number)
	if err != nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hasFailed(j.sha)
}

// Path returns the cached render, or library.ErrNotFound (no such MIDI song), media.ErrNotReady
// or media.ErrBuildFailed.
func (s *Service) Path(ctx context.Context, number string) (string, error) {
	if s.cache == nil {
		return "", ErrUnavailable
	}
	j, err := s.lookup(ctx, number)
	if err != nil {
		return "", err
	}
	name := s.cacheName(j.sha)
	if s.cache.Has(name) {
		return s.cache.Path(name), nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.hasFailed(j.sha) {
		return "", media.ErrBuildFailed
	}
	return "", media.ErrNotReady
}

// Touch marks a served file as recently used.
func (s *Service) Touch(path string) {
	if s.cache != nil {
		s.cache.Touch(path)
	}
}

// Prepare queues a render unless the song is cached, queued, rendering or recently failed.
// It never blocks; a full queue drops the request (the next request asks again).
func (s *Service) Prepare(number string) {
	if s.cache == nil {
		return
	}
	j, err := s.lookup(context.Background(), number)
	if err != nil || s.cache.Has(s.cacheName(j.sha)) {
		return
	}
	s.mu.Lock()
	if s.inflight[j.sha] || s.hasFailed(j.sha) {
		s.mu.Unlock()
		return
	}
	s.inflight[j.sha] = true
	s.mu.Unlock()
	select {
	case s.queue <- j:
	default:
		s.mu.Lock()
		delete(s.inflight, j.sha)
		s.mu.Unlock()
	}
}

// Run renders queued songs one at a time until ctx is cancelled, and removes leftovers of
// interrupted renders at start and then daily.
func (s *Service) Run(ctx context.Context) {
	if s.cache == nil {
		return
	}
	s.cache.Cleanup()
	t := time.NewTicker(cleanupInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.cache.Cleanup()
		case j := <-s.queue:
			err := s.render(ctx, j)
			s.mu.Lock()
			delete(s.inflight, j.sha)
			if err != nil && ctx.Err() == nil {
				s.failed[j.sha] = failure{s.now()}
				s.logger.Warn("cannot render a song", "song", j.number, "err", err)
			}
			s.mu.Unlock()
		}
	}
}

func (s *Service) render(ctx context.Context, j job) error {
	s.renders.Add(1)
	n := s.active.Add(1)
	defer s.active.Add(-1)
	for {
		m := s.maxActive.Load()
		if n <= m || s.maxActive.CompareAndSwap(m, n) {
			break
		}
	}
	midi, err := os.ReadFile(j.path)
	if err != nil {
		return err
	}
	bank, err := s.openBank(ctx, j.number)
	if err != nil {
		return err
	}
	defer bank.Close()
	return s.cache.Store(s.cacheName(j.sha), func(w io.Writer) error {
		return RenderWithTail(ctx, midi, bank, w, Tail)
	})
}

// openBank opens the song's trimmed SoundFont, waiting for it to be built, or the full bank when
// it cannot be had.
func (s *Service) openBank(ctx context.Context, number string) (*os.File, error) {
	if s.fonts != nil {
		deadline := time.Now().Add(fontWait)
		for {
			p, err := s.fonts.Path(ctx, number)
			if err == nil {
				if f, err := os.Open(p); err == nil {
					return f, nil
				}
				break
			}
			if !errors.Is(err, media.ErrNotReady) || time.Now().After(deadline) {
				break
			}
			s.fonts.Prepare(number)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(fontPoll):
			}
		}
	}
	return os.Open(s.bank)
}
