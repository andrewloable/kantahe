package media

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/song/kar"
	"github.com/andrewloable/kantahe/server/internal/song/sf2"
	"github.com/andrewloable/kantahe/server/internal/store"
)

// Errors of the per-song SoundFont cache.
var (
	ErrNotReady    = errors.New("media: the SoundFont is not built yet")
	ErrBuildFailed = errors.New("media: the SoundFont could not be built")
)

const (
	cacheMaxAge     = 30 * 24 * time.Hour
	cleanupInterval = 24 * time.Hour
	queueSize       = 64
	staleTempAge    = time.Hour
	// a failed build is not retried for this long, then the song gets another chance
	failureMemory = 10 * time.Minute
)

// Preparer starts building a song's SoundFont ahead of time. It never blocks.
type Preparer interface {
	Prepare(number string)
}

// SoundFonts builds, caches and reports per-song trimmed SoundFonts: only the
// presets a song uses, taken from the full bank. At most one build runs at a time.
type SoundFonts struct {
	db      *store.DB
	dir     string // <data>/cache/sf2
	bank    *sf2.Bank
	bankSrc *os.File
	tag     string // first 16 hex digits of the full bank's SHA-256
	logger  *slog.Logger
	now     func() time.Time

	queue chan job

	mu       sync.Mutex
	inflight map[string]bool    // song sha -> queued or building
	failed   map[string]failure // song sha -> why and when the last build failed

	builds atomic.Int64 // tests count builds
}

type job struct{ number, sha, path string }

type failure struct {
	err error
	at  time.Time
}

// hasFailed reports a remembered failure; callers hold s.mu.
func (s *SoundFonts) hasFailed(sha string) bool {
	f, ok := s.failed[sha]
	if ok && s.now().Sub(f.at) > failureMemory {
		delete(s.failed, sha)
		return false
	}
	return ok
}

// NewSoundFonts parses the full bank once and prepares the cache directory.
func NewSoundFonts(db *store.DB, dataDir, bankPath, tag string, logger *slog.Logger, now func() time.Time) (*SoundFonts, error) {
	f, err := os.Open(bankPath)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	bank, err := sf2.Parse(f, st.Size())
	if err != nil {
		f.Close()
		return nil, fmt.Errorf("parse the SoundFont: %w", err)
	}
	s := &SoundFonts{
		db: db, dir: filepath.Join(dataDir, "cache", "sf2"), bank: bank, bankSrc: f, tag: tag, logger: logger, now: now,
		queue: make(chan job, queueSize), inflight: map[string]bool{}, failed: map[string]failure{},
	}
	if err := os.MkdirAll(s.dir, 0o750); err != nil {
		f.Close()
		return nil, err
	}
	return s, nil
}

// Close releases the bank file.
func (s *SoundFonts) Close() error { return s.bankSrc.Close() }

// Tag identifies the full bank: the first 16 hex digits of its SHA-256.
func (s *SoundFonts) Tag() string { return s.tag }

func (s *SoundFonts) cachePath(sha string) string {
	return filepath.Join(s.dir, sha+"-"+s.tag+".sf2")
}

// lookup finds a visible MIDI song by (possibly non-canonical) number.
func (s *SoundFonts) lookup(ctx context.Context, number string) (job, error) {
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

// Ready reports whether the song's SoundFont is built.
func (s *SoundFonts) Ready(ctx context.Context, number string) bool {
	j, err := s.lookup(ctx, number)
	if err != nil {
		return false
	}
	_, err = os.Stat(s.cachePath(j.sha))
	return err == nil
}

// Failed reports whether building the song's SoundFont failed, so that callers
// can fall back to the full bank.
func (s *SoundFonts) Failed(ctx context.Context, number string) bool {
	j, err := s.lookup(ctx, number)
	if err != nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hasFailed(j.sha)
}

// Path returns the built file, or ErrNotReady / ErrBuildFailed.
func (s *SoundFonts) Path(ctx context.Context, number string) (string, error) {
	j, err := s.lookup(ctx, number)
	if err != nil {
		return "", err
	}
	p := s.cachePath(j.sha)
	if _, err := os.Stat(p); err == nil {
		return p, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.hasFailed(j.sha) {
		return "", ErrBuildFailed
	}
	return "", ErrNotReady
}

// Prepare queues a build unless the file exists or the song is already queued.
// It never blocks; a full queue drops the request (the next request asks again).
func (s *SoundFonts) Prepare(number string) {
	j, err := s.lookup(context.Background(), number)
	if err != nil {
		return
	}
	if _, err := os.Stat(s.cachePath(j.sha)); err == nil {
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

// Run builds queued SoundFonts one at a time and removes cache files that were
// not used for 30 days, at start and then daily, until ctx is cancelled.
func (s *SoundFonts) Run(ctx context.Context) {
	s.Cleanup()
	t := time.NewTicker(cleanupInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.Cleanup()
		case j := <-s.queue:
			err := s.build(j)
			s.mu.Lock()
			delete(s.inflight, j.sha)
			if err != nil {
				s.failed[j.sha] = failure{err, s.now()}
				s.logger.Warn("cannot build a per-song SoundFont", "song", j.number, "err", err)
			}
			s.mu.Unlock()
		}
	}
}

// build trims the full bank to the presets the song uses and writes the cache file.
func (s *SoundFonts) build(j job) error {
	s.builds.Add(1)
	body, err := os.ReadFile(j.path)
	if err != nil {
		return err
	}
	song, err := kar.Parse(body)
	if err != nil {
		return err
	}
	keys := make([]sf2.PresetKey, 0, len(song.Presets)+1)
	for _, p := range song.Presets {
		keys = append(keys, sf2.PresetKey{Bank: p.Bank, Program: p.Program})
	}
	keys = append(keys, sf2.PresetKey{}) // a song without notes still gets a playable bank
	out, err := sf2.Trim(s.bank, keys, s.bankSrc)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(s.dir, ".build-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) // no-op after the rename
	if _, err := tmp.Write(out); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp.Name(), 0o640); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), s.cachePath(j.sha))
}

// Touch marks the file as used now, which housekeeping looks at.
func (s *SoundFonts) Touch(path string) {
	now := s.now()
	_ = os.Chtimes(path, now, now)
}

// Cleanup removes cache files unused for 30 days and stale temporary files.
func (s *SoundFonts) Cleanup() {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return
	}
	now := s.now()
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		age := now.Sub(info.ModTime())
		old := strings.HasSuffix(e.Name(), ".sf2") && age > cacheMaxAge
		stale := strings.HasPrefix(e.Name(), ".build-") && age > staleTempAge
		if old || stale {
			if err := os.Remove(filepath.Join(s.dir, e.Name())); err != nil && !errors.Is(err, os.ErrNotExist) {
				s.logger.Warn("cannot remove an old SoundFont", "err", err)
			}
		}
	}
}
