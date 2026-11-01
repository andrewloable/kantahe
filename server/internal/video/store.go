package video

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/andrewloable/kantahe/server/internal/store"
)

// Errors of the Store.
var (
	ErrNotFound       = errors.New("video: not found")
	ErrInvalidName    = errors.New("video: the name must be 1 to 200 characters")
	ErrNotPermutation = errors.New("video: the ids must be exactly the existing videos, each once")
)

// FilesMu orders the two operations that tie a row to its file: finishing an upload (put the file in place, then add the row) and deleting
// a video (the row, and the file before the commit). Without it a delete of a video that falls between the two steps of an upload of
// the same content leaves the new row without a file.
var FilesMu sync.Mutex

// RemoveError means the file of a video could not be deleted, so the video was kept.
type RemoveError struct{ Err error }

func (e *RemoveError) Error() string { return e.Err.Error() }
func (e *RemoveError) Unwrap() error { return e.Err }

// ErrDuplicate is returned by Add when a video with the same content exists; Existing is that video.
type ErrDuplicate struct{ Existing Video }

func (e ErrDuplicate) Error() string {
	return "video: this video is already there as " + e.Existing.Name
}

// Video is one row of the videos table. Position counts from 1 in loop order.
type Video struct {
	ID           string
	SHA256       string
	Name         string
	OriginalName string
	Size         int64
	DurationMs   int64
	Width        int
	Height       int
	Codec        string
	HasAudio     bool
	FastStart    bool
	Enabled      bool
	Position     int
	CreatedAt    int64 // unix seconds
}

// NewVideo is a video to add: its content hash and size, the name shown, the name of the uploaded file, and what Inspect found.
type NewVideo struct {
	SHA256       string
	Size         int64
	Name         string
	OriginalName string
	Info         Info
}

// Store is the access to the videos table.
type Store struct{ db *store.DB }

// New returns the Store of db.
func New(db *store.DB) *Store { return &Store{db: db} }

const columns = `id, sha256, name, original_name, size, duration_ms, width, height, codec, has_audio, faststart, enabled, position, created_at`

type scanner interface{ Scan(dest ...any) error }

func scan(s scanner) (Video, error) {
	var v Video
	err := s.Scan(&v.ID, &v.SHA256, &v.Name, &v.OriginalName, &v.Size, &v.DurationMs, &v.Width, &v.Height, &v.Codec, &v.HasAudio, &v.FastStart, &v.Enabled, &v.Position, &v.CreatedAt)
	return v, err
}

type queryer interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func list(ctx context.Context, q queryer) ([]Video, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+columns+` FROM videos ORDER BY position, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Video
	for rows.Next() {
		v, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func get(ctx context.Context, q queryer, id string) (Video, error) {
	v, err := scan(q.QueryRowContext(ctx, `SELECT `+columns+` FROM videos WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return v, ErrNotFound
	}
	return v, err
}

// checkName trims name and refuses an empty one or one over 200 characters.
func checkName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if n := utf8.RuneCountInString(name); n < 1 || n > 200 {
		return "", ErrInvalidName
	}
	return name, nil
}

// newID is "v" and 10 random lowercase hex characters.
func newID() (string, error) {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "v" + hex.EncodeToString(b), nil
}

// Add stores a video at the end of the loop, enabled. ErrDuplicate when the content is already there, ErrInvalidName for a bad name.
func (s *Store) Add(ctx context.Context, n NewVideo) (Video, error) {
	name, err := checkName(n.Name)
	if err != nil {
		return Video{}, err
	}
	id, err := newID()
	if err != nil {
		return Video{}, err
	}
	var out Video
	err = s.db.WriteTx(ctx, func(tx *sql.Tx) error {
		var existing string
		switch err := tx.QueryRowContext(ctx, `SELECT id FROM videos WHERE sha256 = ?`, n.SHA256).Scan(&existing); {
		case err == nil:
			v, err := get(ctx, tx, existing)
			if err != nil {
				return err
			}
			return ErrDuplicate{Existing: v}
		case !errors.Is(err, sql.ErrNoRows):
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO videos(`+columns+`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, (SELECT COALESCE(MAX(position), 0) + 1 FROM videos), ?)`,
			id, n.SHA256, name, n.OriginalName, n.Size, n.Info.DurationMs, n.Info.Width, n.Info.Height, n.Info.Codec, n.Info.HasAudio, n.Info.FastStart, time.Now().Unix()); err != nil {
			return err
		}
		out, err = get(ctx, tx, id)
		return err
	})
	return out, err
}

// List returns every video in loop order.
func (s *Store) List(ctx context.Context) ([]Video, error) { return list(ctx, s.db) }

// Get returns one video, or ErrNotFound.
func (s *Store) Get(ctx context.Context, id string) (Video, error) { return get(ctx, s.db, id) }

// SetEnabled switches a video on or off in the loop.
func (s *Store) SetEnabled(ctx context.Context, id string, enabled bool) (Video, error) {
	return s.update(ctx, id, `UPDATE videos SET enabled = ? WHERE id = ?`, enabled, id)
}

// Rename trims name; ErrInvalidName when it is empty or over 200 characters.
func (s *Store) Rename(ctx context.Context, id, name string) (Video, error) {
	name, err := checkName(name)
	if err != nil {
		return Video{}, err
	}
	return s.update(ctx, id, `UPDATE videos SET name = ? WHERE id = ?`, name, id)
}

// Update changes the name and/or the enabled flag in one transaction: a bad name changes nothing. A nil argument leaves the field alone.
func (s *Store) Update(ctx context.Context, id string, name *string, enabled *bool) (Video, error) {
	var newName string
	if name != nil {
		var err error
		if newName, err = checkName(*name); err != nil {
			return Video{}, err
		}
	}
	var out Video
	err := s.db.WriteTx(ctx, func(tx *sql.Tx) error {
		if _, err := get(ctx, tx, id); err != nil {
			return err
		}
		if name != nil {
			if _, err := tx.ExecContext(ctx, `UPDATE videos SET name = ? WHERE id = ?`, newName, id); err != nil {
				return err
			}
		}
		if enabled != nil {
			if _, err := tx.ExecContext(ctx, `UPDATE videos SET enabled = ? WHERE id = ?`, *enabled, id); err != nil {
				return err
			}
		}
		var err error
		out, err = get(ctx, tx, id)
		return err
	})
	return out, err
}

func (s *Store) update(ctx context.Context, id, query string, args ...any) (Video, error) {
	var out Video
	err := s.db.WriteTx(ctx, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, query, args...)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return ErrNotFound
		}
		out, err = get(ctx, tx, id)
		return err
	})
	return out, err
}

// Reorder sets the loop order. ids must be exactly the existing ids, each once (ErrNotPermutation otherwise, and nothing changes).
func (s *Store) Reorder(ctx context.Context, ids []string) ([]Video, error) {
	var out []Video
	err := s.db.WriteTx(ctx, func(tx *sql.Tx) error {
		current, err := list(ctx, tx)
		if err != nil {
			return err
		}
		have := make(map[string]bool, len(current))
		for _, v := range current {
			have[v.ID] = true
		}
		if len(ids) != len(current) {
			return ErrNotPermutation
		}
		seen := make(map[string]bool, len(ids))
		for _, id := range ids {
			if !have[id] || seen[id] {
				return ErrNotPermutation
			}
			seen[id] = true
		}
		for i, id := range ids {
			if _, err := tx.ExecContext(ctx, `UPDATE videos SET position = ? WHERE id = ?`, i+1, id); err != nil {
				return err
			}
		}
		out, err = list(ctx, tx)
		return err
	})
	return out, err
}

// Delete removes the row and returns the content hash, so that the caller removes the file <data>/videos/<sha256>.mp4. The videos
// behind it move up: positions stay 1..n.
func (s *Store) Delete(ctx context.Context, id string) (string, error) {
	var sha string
	err := s.remove(ctx, id, func(h string) error { sha = h; return nil })
	return sha, err
}

// DeleteWithFile removes the row and, before the change is committed, calls dropFile with the content hash to delete the file. When
// dropFile fails the whole change is rolled back and a *RemoveError is returned: a video is never left without its file, nor the
// file without its row (unless the file was already missing, which dropFile should not call an error).
func (s *Store) DeleteWithFile(ctx context.Context, id string, dropFile func(sha256 string) error) error {
	return s.remove(ctx, id, dropFile)
}

func (s *Store) remove(ctx context.Context, id string, dropFile func(sha256 string) error) error {
	return s.db.WriteTx(ctx, func(tx *sql.Tx) error {
		var sha string
		if err := tx.QueryRowContext(ctx, `SELECT sha256 FROM videos WHERE id = ?`, id).Scan(&sha); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM videos WHERE id = ?`, id); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE videos SET position = (SELECT COUNT(*) FROM videos v WHERE v.position < videos.position) + 1`); err != nil {
			return err
		}
		if err := dropFile(sha); err != nil {
			return &RemoveError{Err: err}
		}
		return nil
	})
}

// Path is the file of a video: <dataDir>/videos/<sha256>.mp4. It is empty for anything that is not a lowercase SHA-256, so that a
// value that did not come from this package can never name a file outside the folder.
func Path(dataDir, sha256 string) string {
	if len(sha256) != 64 || strings.Trim(sha256, "0123456789abcdef") != "" {
		return ""
	}
	return filepath.Join(dataDir, "videos", sha256+".mp4")
}

// Warnings are the short pieces of advice the admin list shows for a video. Sound is not one: the player mutes every video.
func Warnings(v Video) []string {
	var w []string
	if v.Width > 1920 {
		w = append(w, "wider than 1920 px: may stutter on a TV")
	}
	if !v.FastStart {
		w = append(w, "not optimised for streaming (moov after mdat)")
	}
	return w
}
