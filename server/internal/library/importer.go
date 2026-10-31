package library

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/andrewloable/kantahe/server/internal/store"
)

// Source says where a library entry came from.
type Source int

// Entry sources; the values are stored in songs.source.
const (
	SourceUpload Source = 1
	SourceFolder Source = 2
)

// Status is the outcome of importing one file.
type Status int

// Import outcomes.
const (
	StatusAdded Status = iota + 1
	StatusDuplicate
	StatusUpdated
)

// Result is the outcome of importing one file.
type Result struct {
	Status Status
	Number string
}

// ScanResult counts what one scan did. Failed counts files that could not be read.
type ScanResult struct {
	Added, Updated, Removed, Failed int
}

const (
	scanInterval  = 10 * time.Minute
	batchSize     = 1000
	workerPause   = 10 * time.Millisecond
	workerBackoff = time.Second
)

// Importer fills the songs table from watched folders and uploads and keeps
// the search index and the extracted MP3s current.
type Importer struct {
	db        *store.DB
	dataDir   string
	libraries []string
	logger    *slog.Logger

	wake chan struct{}

	mu       sync.Mutex
	current  *scanCall
	nWaiting int
	skipped  map[string]fileSig // duplicate files seen in folders, so that they are not re-hashed every scan

	hookWalk     func() // tests only
	hookMetadata func() // tests only: runs between reading a file and storing the result
}

type fileSig struct{ size, mtime int64 }

// NewImporter prepares an importer. libraries are the watched folders.
func NewImporter(db *store.DB, dataDir string, libraries []string, logger *slog.Logger) *Importer {
	return &Importer{
		db: db, dataDir: dataDir, libraries: libraries, logger: logger,
		wake: make(chan struct{}, 1), skipped: map[string]fileSig{},
	}
}

func (im *Importer) mediaDir() string { return filepath.Join(im.dataDir, "media") }

func (im *Importer) wakeWorker() {
	select {
	case im.wake <- struct{}{}:
	default:
	}
}

type candidate struct {
	path, original string
	source         Source
	format         Format
	sha            string
	size, mtime    int64
}

func formatOf(name string) (Format, bool) {
	switch strings.ToLower(path.Ext(name)) {
	case ".kar":
		return FormatMIDI, true
	case ".karmp3":
		return FormatMP3, true
	}
	return 0, false
}

type ctxReader struct {
	ctx context.Context
	r   io.Reader
}

func (c ctxReader) Read(p []byte) (int, error) {
	if err := c.ctx.Err(); err != nil {
		return 0, err
	}
	return c.r.Read(p)
}

// hashFile returns the SHA-256, size and modification time (Unix seconds).
func hashFile(ctx context.Context, p string) (sum string, size, mtime int64, err error) {
	f, err := os.Open(p)
	if err != nil {
		return "", 0, 0, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return "", 0, 0, err
	}
	if !st.Mode().IsRegular() {
		return "", 0, 0, fmt.Errorf("%s is not a regular file", filepath.Base(p))
	}
	h := sha256.New()
	n, err := io.Copy(h, ctxReader{ctx, f})
	if err != nil {
		return "", 0, 0, err
	}
	return hex.EncodeToString(h.Sum(nil)), n, st.ModTime().Unix(), nil
}

// ImportFile imports one file already stored at path. Uploads get their metadata
// before this returns; folder files are left to the background worker.
func (im *Importer) ImportFile(ctx context.Context, p string, source Source, originalName string) (Result, error) {
	if _, ok := formatOf(originalName); !ok {
		return Result{}, fmt.Errorf("unsupported file type %q: want .kar or .karmp3", path.Ext(originalName))
	}
	format, ok := formatOf(p)
	if !ok {
		return Result{}, fmt.Errorf("unsupported stored file name %q", filepath.Base(p))
	}
	sum, size, mtime, err := hashFile(ctx, p)
	if err != nil {
		return Result{}, err
	}
	results, err := im.importBatch(ctx, []candidate{{path: p, original: originalName, source: source, format: format, sha: sum, size: size, mtime: mtime}})
	if err != nil {
		return Result{}, err
	}
	res := results[0]
	if res.Status == StatusDuplicate {
		return res, nil
	}
	if source == SourceUpload {
		if err := im.processMetadata(ctx, res.Number); err != nil {
			return res, err
		}
	} else {
		im.wakeWorker()
	}
	return res, nil
}

// importBatch inserts or updates the candidates in one write transaction.
// Results are in the order of cands.
func (im *Importer) importBatch(ctx context.Context, cands []candidate) ([]Result, error) {
	results := make([]Result, len(cands))
	var staleMedia []string
	err := im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		staleMedia = staleMedia[:0]
		existing, err := ExistingNumbers(ctx, tx)
		if err != nil {
			return err
		}
		order := make([]int, len(cands))
		for i := range order {
			order[i] = i
		}
		sort.SliceStable(order, func(a, b int) bool { return cands[order[a]].path < cands[order[b]].path })

		var fresh []int
		firstFresh := map[string]int{} // sha -> index of the first new file with it
		dupOf := map[int]int{}
		for _, i := range order {
			c := cands[i]
			var num, sha string
			var size, mtime int64
			switch err := tx.QueryRowContext(ctx, `SELECT number, sha256, size, mtime FROM songs WHERE path = ? AND deleted = 0`, c.path).Scan(&num, &sha, &size, &mtime); {
			case err == nil && sha == c.sha:
				if size != c.size || mtime != c.mtime {
					if _, err := tx.ExecContext(ctx, `UPDATE songs SET size = ?, mtime = ? WHERE number = ?`, c.size, c.mtime, num); err != nil {
						return err
					}
				}
				results[i] = Result{StatusDuplicate, num}
				continue
			case err == nil:
				old, err := resetSong(ctx, tx, num, c)
				if err != nil {
					return err
				}
				if old != "" {
					staleMedia = append(staleMedia, old)
				}
				results[i] = Result{StatusUpdated, num}
				continue
			case !errors.Is(err, sql.ErrNoRows):
				return err
			}
			switch err := tx.QueryRowContext(ctx, `SELECT number FROM songs WHERE sha256 = ? AND deleted = 0 LIMIT 1`, c.sha).Scan(&num); {
			case err == nil:
				results[i] = Result{StatusDuplicate, num}
				continue
			case !errors.Is(err, sql.ErrNoRows):
				return err
			}
			if j, seen := firstFresh[c.sha]; seen {
				dupOf[i] = j
				continue
			}
			firstFresh[c.sha] = i
			fresh = append(fresh, i)
		}

		files := make([]NewFile, len(fresh))
		for k, i := range fresh {
			files[k] = NewFile{Path: cands[i].path, Format: cands[i].format, Songbook: Songbook(cands[i].original)}
		}
		numbers := Allocate(existing, files)
		now := time.Now().Unix()
		for _, i := range fresh {
			c := cands[i]
			num := numbers[c.path]
			if _, err := tx.ExecContext(ctx, `INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, songbook_number, created_at)
				VALUES (?,?,?,?,?,?,?,?,?,?)`,
				num, int(c.format), int(c.source), c.path, c.sha, c.size, c.mtime, c.original, Songbook(c.original), now); err != nil {
				return fmt.Errorf("insert song: %w", err)
			}
			results[i] = Result{StatusAdded, num}
		}
		for i, j := range dupOf {
			results[i] = Result{StatusDuplicate, results[j].Number}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	for _, m := range staleMedia {
		im.removeMediaIfUnused(ctx, m)
	}
	return results, nil
}

// resetSong points an existing entry at changed content: the number stays, the
// metadata is cleared and processed again, and the search entry is dropped
// until then. It returns the extracted MP3 that is now stale, if any.
func resetSong(ctx context.Context, tx *sql.Tx, number string, c candidate) (staleMedia string, err error) {
	if err := tx.QueryRowContext(ctx, `SELECT media_path FROM songs WHERE number = ?`, number).Scan(&staleMedia); err != nil {
		return "", err
	}
	_, err = tx.ExecContext(ctx, `UPDATE songs SET sha256 = ?, size = ?, mtime = ?, metadata_done = 0, failed = 0, failed_reason = '',
		file_title = '', file_artist = '', duration_ms = 0, media_path = '' WHERE number = ?`, c.sha, c.size, c.mtime, number)
	if err != nil {
		return "", err
	}
	return staleMedia, deleteFTS(ctx, tx, number)
}

// removeMediaIfUnused deletes an extracted MP3 that no live entry references.
func (im *Importer) removeMediaIfUnused(ctx context.Context, mediaPath string) {
	if mediaPath == "" || filepath.Dir(mediaPath) != im.mediaDir() {
		return
	}
	var n int
	if err := im.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE media_path = ? AND deleted = 0`, mediaPath).Scan(&n); err != nil || n > 0 {
		return
	}
	if err := os.Remove(mediaPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		im.logger.Warn("cannot remove extracted media", "err", err)
	}
}

// Run scans at start and every 10 minutes and processes metadata in the
// background until ctx is cancelled.
func (im *Importer) Run(ctx context.Context) {
	var wg sync.WaitGroup
	wg.Add(1)
	go func() { defer wg.Done(); im.worker(ctx) }()
	defer wg.Wait()

	im.scanAndLog(ctx)
	t := time.NewTicker(scanInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			im.scanAndLog(ctx)
		}
	}
}

func (im *Importer) scanAndLog(ctx context.Context) {
	if len(im.libraries) == 0 {
		return
	}
	res, err := im.Scan(ctx)
	if err != nil && ctx.Err() == nil {
		im.logger.Error("library scan failed", "err", err)
		return
	}
	if res != (ScanResult{}) {
		im.logger.Info("library scan", "added", res.Added, "updated", res.Updated, "removed", res.Removed, "failed", res.Failed)
	}
}

func (im *Importer) worker(ctx context.Context) {
	fallback := time.NewTicker(30 * time.Second)
	defer fallback.Stop()
	for {
		if err := im.ProcessPending(ctx); err != nil && ctx.Err() == nil {
			im.logger.Error("metadata pass failed", "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(workerBackoff):
			}
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-im.wake:
		case <-fallback.C:
		}
	}
}

// ProcessPending reads the metadata of every entry that has none yet, one at a
// time in number order, pausing between files so that it stays in the background.
func (im *Importer) ProcessPending(ctx context.Context) error {
	for {
		var number string
		err := im.db.QueryRowContext(ctx, `SELECT number FROM songs WHERE metadata_done = 0 AND deleted = 0 ORDER BY number LIMIT 1`).Scan(&number)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := im.processMetadata(ctx, number); err != nil {
			return err
		}
		runtimeYield()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(workerPause):
		}
	}
}
