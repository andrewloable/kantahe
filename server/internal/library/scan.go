package library

import (
	"context"
	"database/sql"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type scanCall struct {
	done chan struct{}
	res  ScanResult
	err  error
}

// waiting reports how many Scan calls wait for a scan that is already running.
func (im *Importer) waiting() int {
	im.mu.Lock()
	defer im.mu.Unlock()
	return im.nWaiting
}

// Scan walks every watched folder and brings the library in line with it. Only
// one scan runs at a time: a call made meanwhile waits and returns that scan's result.
func (im *Importer) Scan(ctx context.Context) (ScanResult, error) {
	im.mu.Lock()
	if c := im.current; c != nil {
		im.nWaiting++
		im.mu.Unlock()
		defer func() { im.mu.Lock(); im.nWaiting--; im.mu.Unlock() }()
		select {
		case <-c.done:
			return c.res, c.err
		case <-ctx.Done():
			return ScanResult{}, ctx.Err()
		}
	}
	c := &scanCall{done: make(chan struct{})}
	im.current = c
	im.mu.Unlock()

	c.res, c.err = im.scanOnce(ctx)

	im.mu.Lock()
	im.current = nil
	im.mu.Unlock()
	close(c.done)
	return c.res, c.err
}

type knownFile struct {
	number, sha string
	format      Format
	size, mtime int64
}

// root is a watched folder that was walked.
type root struct {
	path       string
	incomplete []string // directories that could not be read: their songs are not judged missing
}

func (im *Importer) scanOnce(ctx context.Context) (ScanResult, error) {
	var res ScanResult
	if im.hookWalk != nil {
		im.hookWalk()
	}
	known, err := im.knownFolderFiles(ctx)
	if err != nil {
		return res, err
	}
	seen := map[string]bool{}
	var walked []*root
	var cands []candidate
	var suppressed []suppressedFile

	for _, lib := range im.libraries {
		resolved, err := filepath.EvalSymlinks(lib)
		if err == nil {
			resolved, err = filepath.Abs(resolved)
		}
		if st, serr := os.Stat(resolved); err != nil || serr != nil || !st.IsDir() {
			im.logger.Warn("watched folder is not available, its songs are kept", "folder", lib)
			continue
		}
		r := &root{path: resolved}
		walked = append(walked, r)
		err = filepath.WalkDir(resolved, func(p string, d fs.DirEntry, werr error) error {
			if cerr := ctx.Err(); cerr != nil {
				return cerr
			}
			if werr != nil {
				im.logger.Warn("cannot read part of a watched folder", "path", p, "err", werr)
				if d != nil && d.IsDir() {
					r.incomplete = append(r.incomplete, p)
					return fs.SkipDir
				}
				r.incomplete = append(r.incomplete, filepath.Dir(p))
				return nil
			}
			if d.Type()&fs.ModeSymlink != 0 || d.IsDir() {
				return nil // symlinks are never followed
			}
			format, ok := formatOf(p)
			if !ok || !d.Type().IsRegular() {
				return nil
			}
			seen[p] = true // before anything can fail: a file we cannot read still exists
			info, err := d.Info()
			if err != nil {
				res.Failed++
				return nil
			}
			size, mtime := info.Size(), info.ModTime().Unix()
			if k, isKnown := known[p]; isKnown && k.size == size && k.mtime == mtime {
				return nil
			}
			if sig, dup := im.skippedSig(p); dup && sig == (fileSig{size, mtime}) {
				suppressed = append(suppressed, suppressedFile{p, format})
				return nil
			}
			sum, hsize, hmtime, err := hashFile(ctx, p)
			if err != nil {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				im.logger.Warn("cannot read song file", "path", p, "err", err)
				res.Failed++
				return nil
			}
			cands = append(cands, candidate{path: p, original: filepath.Base(p), source: SourceFolder, format: format, sha: sum, size: hsize, mtime: hmtime})
			return nil
		})
		if err != nil {
			return res, err
		}
	}

	gone := missingPaths(known, seen, walked)
	if len(gone) > 0 {
		// something disappeared: a duplicate we skipped before may now be the only copy, or a rename
		for _, f := range suppressed {
			sum, size, mtime, err := hashFile(ctx, f.path)
			if err != nil {
				if ctx.Err() != nil {
					return res, ctx.Err()
				}
				res.Failed++
				continue
			}
			im.forgetSkipped(f.path)
			cands = append(cands, candidate{path: f.path, original: filepath.Base(f.path), source: SourceFolder, format: f.format, sha: sum, size: size, mtime: mtime})
		}
	}

	// MP3 files first, then MIDI, each by path: batches in this order number exactly like one big batch
	sort.SliceStable(cands, func(i, j int) bool {
		if (cands[i].format == FormatMP3) != (cands[j].format == FormatMP3) {
			return cands[i].format == FormatMP3
		}
		return cands[i].path < cands[j].path
	})

	// a file that vanished from one place and appeared in another with the same
	// content was moved or renamed: the entry follows it and keeps its number
	var moves []move
	cands, gone, moves = pairMoves(known, cands, gone)
	if err := im.applyMoves(ctx, moves); err != nil {
		return res, err
	}
	res.Updated += len(moves)

	for start := 0; start < len(cands); start += batchSize {
		chunk := cands[start:min(start+batchSize, len(cands))]
		results, err := im.importBatch(ctx, chunk)
		if err != nil {
			return res, err
		}
		for i, r := range results {
			switch r.Status {
			case StatusAdded:
				res.Added++
			case StatusUpdated:
				res.Updated++
			case StatusDuplicate:
				if _, isKnown := known[chunk[i].path]; !isKnown {
					im.rememberSkipped(chunk[i].path, fileSig{chunk[i].size, chunk[i].mtime})
				}
			}
		}
	}

	removed, err := im.removeMissing(ctx, known, gone)
	res.Removed = removed
	if err != nil {
		return res, err
	}
	im.wakeWorker()
	return res, nil
}

func (im *Importer) skippedSig(p string) (fileSig, bool) {
	im.mu.Lock()
	defer im.mu.Unlock()
	s, ok := im.skipped[p]
	return s, ok
}

func (im *Importer) forgetSkipped(p string) {
	im.mu.Lock()
	defer im.mu.Unlock()
	delete(im.skipped, p)
}

func (im *Importer) rememberSkipped(p string, s fileSig) {
	im.mu.Lock()
	defer im.mu.Unlock()
	im.skipped[p] = s
}

func (im *Importer) knownFolderFiles(ctx context.Context) (map[string]knownFile, error) {
	rows, err := im.db.QueryContext(ctx, `SELECT path, number, sha256, format, size, mtime FROM songs WHERE source = ? AND deleted = 0`, int(SourceFolder))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]knownFile{}
	for rows.Next() {
		var p string
		var k knownFile
		if err := rows.Scan(&p, &k.number, &k.sha, &k.format, &k.size, &k.mtime); err != nil {
			return nil, err
		}
		out[p] = k
	}
	return out, rows.Err()
}

func under(p, dir string) bool {
	return p == dir || strings.HasPrefix(p, dir+string(filepath.Separator))
}

// missingPaths lists known folder files that are no longer on disk, judged only
// for folders that were walked completely.
func missingPaths(known map[string]knownFile, seen map[string]bool, walked []*root) []string {
	var gone []string
	for p := range known {
		if seen[p] {
			continue
		}
		judged := false
		for _, r := range walked {
			if !under(p, r.path) {
				continue
			}
			judged = true
			for _, bad := range r.incomplete {
				if under(p, bad) {
					judged = false
				}
			}
		}
		if judged {
			gone = append(gone, p)
		}
	}
	sort.Strings(gone)
	return gone
}

// removeMissing marks entries deleted whose file vanished. The row stays (so the
// number is never reused) and its path is made unique so that the same path can
// be imported again.
func (im *Importer) removeMissing(ctx context.Context, known map[string]knownFile, gone []string) (int, error) {
	var stale []string
	err := im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		stale = stale[:0]
		for _, p := range gone {
			num := known[p].number
			var media string
			if err := tx.QueryRowContext(ctx, `SELECT media_path FROM songs WHERE number = ?`, num).Scan(&media); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `UPDATE songs SET deleted = 1, path = path || '#deleted-' || number, media_path = '' WHERE number = ?`, num); err != nil {
				return err
			}
			if err := deleteFTS(ctx, tx, num); err != nil {
				return err
			}
			if media != "" {
				stale = append(stale, media)
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	for _, m := range stale {
		im.removeMediaIfUnused(ctx, m)
	}
	return len(gone), nil
}

type suppressedFile struct {
	path   string
	format Format
}

type move struct {
	number string
	to     candidate
}

// pairMoves matches new files to vanished entries with identical content and
// format. It returns the remaining new files, the paths that are really gone, and the moves.
func pairMoves(known map[string]knownFile, cands []candidate, gone []string) ([]candidate, []string, []move) {
	bySha := map[string][]string{}
	for _, p := range gone {
		bySha[known[p].sha] = append(bySha[known[p].sha], p)
	}
	claimed := map[string]bool{}
	var moves []move
	var rest []candidate
	claim := func(c candidate) (string, bool) {
		if _, isKnown := known[c.path]; isKnown {
			return "", false
		}
		for _, p := range bySha[c.sha] {
			if !claimed[p] && known[p].format == c.format {
				claimed[p] = true
				return p, true
			}
		}
		return "", false
	}
	for _, c := range cands {
		if p, ok := claim(c); ok {
			moves = append(moves, move{known[p].number, c})
			continue
		}
		rest = append(rest, c)
	}
	var stillGone []string
	for _, p := range gone {
		if !claimed[p] {
			stillGone = append(stillGone, p)
		}
	}
	return rest, stillGone, moves
}

func (im *Importer) applyMoves(ctx context.Context, moves []move) error {
	if len(moves) == 0 {
		return nil
	}
	return im.db.WriteTx(ctx, func(tx *sql.Tx) error {
		for _, m := range moves {
			if _, err := tx.ExecContext(ctx, `UPDATE songs SET path = ?, size = ?, mtime = ?, original_name = ? WHERE number = ? AND deleted = 0`,
				m.to.path, m.to.size, m.to.mtime, m.to.original, m.number); err != nil {
				return err
			}
			if err := syncSong(ctx, tx, m.number); err != nil {
				return err
			}
		}
		return nil
	})
}
