package library

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
)

// Files the server made for a song (the extracted MP3, the per-song SoundFont, the rendered audio) are worth deleting, but not
// worth failing the user's action for: on Windows a file that a player or a virus scanner has open cannot be deleted for a
// moment. A derived file that cannot be deleted now is remembered, logged once, and removed by SweepOrphans later. SweepOrphans
// also removes what a crash left behind: derived files of songs that are gone, and the temporary files of interrupted writes.

// sweepGrace: a file younger than this is never swept. Files are written before the row that refers to them (an extracted MP3
// before media_path is stored), so a young unreferenced file may be on its way to being referenced.
const sweepGrace = time.Hour

// removalKind says how to tell that a file may go.
type removalKind int

const (
	removeMedia  removalKind = iota + 1 // <data>/media/<sha>.mp3: goes when no live song has it as media_path
	removeCache                         // <data>/cache/sf2 and cache/render: named after a SHA-256; goes when no live song has that content
	removeUpload                        // a stored upload: goes when no live song is stored at that path
	removeTemp                          // the temporary file of an interrupted write
)

func (k removalKind) String() string {
	return [...]string{"", "extracted media", "cache file", "stored upload", "temporary file"}[k]
}

// removeDerived tries once to delete path. When it cannot, the file is remembered for SweepOrphans and a warning is logged the
// first time (not on every pass). It reports whether the file is gone.
func (im *Importer) removeDerived(path string, kind removalKind) bool {
	err := fsutil.RemoveOnce(path)
	im.pmu.Lock()
	defer im.pmu.Unlock()
	if err == nil {
		delete(im.stuck, path)
		return true
	}
	if _, known := im.stuck[path]; !known {
		im.stuck[path] = kind
		im.logger.Warn("cannot remove a file now; it is tried again later", "kind", kind.String(), "err", err)
	}
	return false
}

func (im *Importer) forget(path string) {
	im.pmu.Lock()
	delete(im.stuck, path)
	im.pmu.Unlock()
}

// RemoveIfUnreferenced deletes a stored upload unless a live song is stored at that path (a concurrent upload of the same bytes
// shares the file). It never fails: a file that cannot be deleted now is swept later.
func (im *Importer) RemoveIfUnreferenced(ctx context.Context, path string) {
	if used, err := im.IsReferenced(ctx, path); err != nil || used {
		return
	}
	im.removeDerived(path, removeUpload)
}

// referenced reports whether a live song still needs the file.
func (im *Importer) referenced(ctx context.Context, path string, kind removalKind) (bool, error) {
	var n int
	var err error
	switch kind {
	case removeMedia:
		err = im.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE media_path = ? AND deleted = 0`, path).Scan(&n)
	case removeCache:
		sha, ok := shaOfName(filepath.Base(path))
		if !ok {
			return true, nil // not a file of ours: leave it
		}
		err = im.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE sha256 = ? AND deleted = 0`, sha).Scan(&n)
	case removeUpload:
		return im.IsReferenced(ctx, path)
	}
	return n > 0, err
}

// shaOfName returns the SHA-256 that a cache file's name starts with.
func shaOfName(name string) (string, bool) {
	if len(name) < sha256HexLen {
		return "", false
	}
	for _, c := range name[:sha256HexLen] {
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return "", false
		}
	}
	return name[:sha256HexLen], true
}

// sweepTarget is a folder that SweepOrphans looks through.
type sweepTarget struct {
	dir   string
	kind  removalKind       // of the derived files in it; 0 when it holds none
	owns  func(string) bool // whether a file name is a derived file of that kind
	temps []string          // name prefixes of temporary files of interrupted writes
}

func (im *Importer) sweepTargets() []sweepTarget {
	cache := filepath.Join(im.dataDir, "cache")
	named := func(n string) bool { _, ok := shaOfName(n); return ok }
	return []sweepTarget{
		{dir: im.mediaDir(), kind: removeMedia, owns: func(n string) bool { return strings.HasSuffix(n, ".mp3") }, temps: []string{".extract-"}},
		{dir: filepath.Join(cache, "sf2"), kind: removeCache, owns: named, temps: []string{".build-"}},
		{dir: filepath.Join(cache, "render"), kind: removeCache, owns: named, temps: []string{".render-"}},
		{dir: filepath.Join(im.dataDir, "songs"), temps: []string{".upload-"}},
		{dir: filepath.Join(im.dataDir, "soundfont"), temps: []string{"default.sf2.tmp"}},
	}
}

// SweepOrphans deletes what is left over and reports how many files it removed: the files that could not be deleted before, and,
// older than an hour, derived files that no live song needs and temporary files of interrupted writes. It never touches a song
// file, and never fails because one file cannot be deleted (that file is tried again next time).
func (im *Importer) SweepOrphans(ctx context.Context) (int, error) {
	live, media, err := im.liveSets(ctx)
	if err != nil {
		return 0, err
	}
	removed := 0

	// the files that failed before are known leftovers: tried again whatever their age, but never when a song needs them now
	im.pmu.Lock()
	stuck := make(map[string]removalKind, len(im.stuck))
	for p, k := range im.stuck {
		stuck[p] = k
	}
	im.pmu.Unlock()
	for path, kind := range stuck {
		if ctx.Err() != nil {
			return removed, ctx.Err()
		}
		info, statErr := os.Stat(path)
		if errors.Is(statErr, fs.ErrNotExist) {
			im.forget(path) // gone by itself
			continue
		}
		if kind != removeTemp {
			if used, err := im.referenced(ctx, path, kind); err != nil {
				return removed, err
			} else if used {
				im.forget(path) // a song needs it again
				continue
			}
		}
		if statErr == nil && time.Since(info.ModTime()) < sweepGrace {
			continue // changed within the grace period: it may be reused right now (extractMP3 renews the age of a file it reuses)
		}
		if im.removeDerived(path, kind) {
			removed++
		}
	}

	for _, t := range im.sweepTargets() {
		entries, err := os.ReadDir(t.dir)
		if err != nil {
			continue // no such folder yet
		}
		for _, e := range entries {
			if ctx.Err() != nil {
				return removed, ctx.Err()
			}
			if e.IsDir() {
				continue
			}
			info, err := e.Info()
			if err != nil || time.Since(info.ModTime()) < sweepGrace {
				continue
			}
			path := filepath.Join(t.dir, e.Name())
			switch {
			case hasAnyPrefix(e.Name(), t.temps):
				if im.removeDerived(path, removeTemp) {
					removed++
				}
			case t.owns != nil && t.owns(e.Name()) && !im.knownToBeNeeded(t.kind, path, live, media):
				// the sets were read a moment ago: ask the database again just before deleting
				if used, err := im.referenced(ctx, path, t.kind); err != nil {
					return removed, err
				} else if !used && im.removeDerived(path, t.kind) {
					removed++
				}
			}
		}
	}
	return removed, nil
}

func (im *Importer) knownToBeNeeded(kind removalKind, path string, live, media map[string]bool) bool {
	if kind == removeMedia {
		return media[path]
	}
	sha, ok := shaOfName(filepath.Base(path))
	return !ok || live[sha]
}

func hasAnyPrefix(name string, prefixes []string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

// liveSets reads which SHA-256 values and which extracted MP3 files the live songs use.
func (im *Importer) liveSets(ctx context.Context) (live, media map[string]bool, err error) {
	live, media = map[string]bool{}, map[string]bool{}
	rows, err := im.db.QueryContext(ctx, `SELECT sha256, media_path FROM songs WHERE deleted = 0`)
	if err != nil {
		return nil, nil, fmt.Errorf("sweep: list songs: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var sha, mp sql.NullString
		if err := rows.Scan(&sha, &mp); err != nil {
			return nil, nil, fmt.Errorf("sweep: list songs: %w", err)
		}
		if sha.String != "" {
			live[sha.String] = true
		}
		if mp.String != "" {
			media[mp.String] = true
		}
	}
	return live, media, rows.Err()
}

func (im *Importer) sweepAndLog(ctx context.Context) {
	n, err := im.SweepOrphans(ctx)
	switch {
	case err != nil && ctx.Err() == nil:
		im.logger.Warn("sweep of leftover files failed", "err", err)
	case n > 0:
		im.logger.Info("removed leftover files", "files", n)
	}
}
