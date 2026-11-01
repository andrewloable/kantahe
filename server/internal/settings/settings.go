// Package settings reads and writes the server settings stored in the settings table.
package settings

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
)

// Keys of the settings table.
const (
	KeyMaxUploadBytes = "max_upload_bytes"
	KeyScoreSeconds   = "score_seconds"
	KeyMaxVideoBytes  = "max_video_bytes"

	// Background videos (docs/PLAN.md section 4.2): whether the players show them, and whether they play in a shuffled order.
	KeyBackgroundEnabled = "background_enabled"
	KeyBackgroundShuffle = "background_shuffle"
)

// Defaults and the ranges an admin may choose from.
const (
	DefaultMaxUploadBytes int64 = 50 << 20
	MinMaxUploadBytes     int64 = 1 << 20
	MaxMaxUploadBytes     int64 = 1 << 30
	MinScoreSeconds             = 0
	MaxScoreSeconds             = 60

	// One background video (docs/PLAN.md section 4.2).
	DefaultMaxVideoBytes int64 = 500 << 20
	MinMaxVideoBytes     int64 = 1 << 20
	MaxMaxVideoBytes     int64 = 8 << 30
)

// ErrInvalid means a value is outside its range.
var ErrInvalid = errors.New("settings: value out of range")

// Querier is satisfied by *sql.DB, *sql.Tx and *store.DB.
type Querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Execer is satisfied by *sql.DB and *sql.Tx.
type Execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// Settings is the whole set.
type Settings struct {
	MaxUploadBytes int64
	ScoreSeconds   int
	MaxVideoBytes  int64

	BackgroundEnabled bool
	BackgroundShuffle bool
}

// Patch is a partial update: the settings whose pointer is set are written.
type Patch struct {
	MaxUploadBytes *int64
	ScoreSeconds   *int
	MaxVideoBytes  *int64

	BackgroundEnabled *bool
	BackgroundShuffle *bool
}

func get(ctx context.Context, q Querier, key string) (string, bool, error) {
	var v string
	err := q.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return v, err == nil, err
}

// MaxUploadBytes is the largest accepted upload; an absent or unusable value gives the default.
func MaxUploadBytes(ctx context.Context, q Querier) (int64, error) {
	v, ok, err := get(ctx, q, KeyMaxUploadBytes)
	if err != nil || !ok {
		return DefaultMaxUploadBytes, err
	}
	if n, perr := strconv.ParseInt(v, 10, 64); perr == nil && n > 0 {
		return n, nil
	}
	return DefaultMaxUploadBytes, nil
}

// MaxVideoBytes is the largest accepted background video; an absent or out-of-range value gives the default.
func MaxVideoBytes(ctx context.Context, q Querier) (int64, error) {
	v, ok, err := get(ctx, q, KeyMaxVideoBytes)
	if err != nil || !ok {
		return DefaultMaxVideoBytes, err
	}
	if n, perr := strconv.ParseInt(v, 10, 64); perr == nil && n >= MinMaxVideoBytes && n <= MaxMaxVideoBytes {
		return n, nil
	}
	return DefaultMaxVideoBytes, nil
}

// flag reads a yes/no setting stored as "1" or "0"; anything else, or nothing, gives def.
func flag(ctx context.Context, q Querier, key string, def bool) (bool, error) {
	v, ok, err := get(ctx, q, key)
	if err != nil || !ok {
		return def, err
	}
	switch v {
	case "1":
		return true, nil
	case "0":
		return false, nil
	}
	return def, nil
}

// BackgroundEnabled says whether the players show the background videos; the default is yes.
func BackgroundEnabled(ctx context.Context, q Querier) (bool, error) {
	return flag(ctx, q, KeyBackgroundEnabled, true)
}

// BackgroundShuffle says whether the players shuffle the videos on every pass; the default is no.
func BackgroundShuffle(ctx context.Context, q Querier) (bool, error) {
	return flag(ctx, q, KeyBackgroundShuffle, false)
}

// ScoreSeconds is how long the score screen shows; def (the --score-seconds flag)
// applies when nothing usable is stored.
func ScoreSeconds(ctx context.Context, q Querier, def int) (int, error) {
	v, ok, err := get(ctx, q, KeyScoreSeconds)
	if err != nil || !ok {
		return def, err
	}
	if n, perr := strconv.Atoi(v); perr == nil && n >= MinScoreSeconds && n <= MaxScoreSeconds {
		return n, nil
	}
	return def, nil
}

// Load reads all settings.
func Load(ctx context.Context, q Querier, defaultScoreSeconds int) (Settings, error) {
	up, err := MaxUploadBytes(ctx, q)
	if err != nil {
		return Settings{}, err
	}
	sc, err := ScoreSeconds(ctx, q, defaultScoreSeconds)
	if err != nil {
		return Settings{}, err
	}
	vb, err := MaxVideoBytes(ctx, q)
	if err != nil {
		return Settings{}, err
	}
	on, err := BackgroundEnabled(ctx, q)
	if err != nil {
		return Settings{}, err
	}
	shuffle, err := BackgroundShuffle(ctx, q)
	return Settings{MaxUploadBytes: up, ScoreSeconds: sc, MaxVideoBytes: vb, BackgroundEnabled: on, BackgroundShuffle: shuffle}, err
}

// Update stores the settings whose pointer is set, after checking their ranges.
// Nothing is written when any value is invalid.
func Update(ctx context.Context, x Execer, p Patch) error {
	if p.MaxUploadBytes != nil && (*p.MaxUploadBytes < MinMaxUploadBytes || *p.MaxUploadBytes > MaxMaxUploadBytes) {
		return fmt.Errorf("%w: max_upload_bytes must be %d to %d", ErrInvalid, MinMaxUploadBytes, MaxMaxUploadBytes)
	}
	if p.ScoreSeconds != nil && (*p.ScoreSeconds < MinScoreSeconds || *p.ScoreSeconds > MaxScoreSeconds) {
		return fmt.Errorf("%w: score_seconds must be %d to %d", ErrInvalid, MinScoreSeconds, MaxScoreSeconds)
	}
	if p.MaxVideoBytes != nil && (*p.MaxVideoBytes < MinMaxVideoBytes || *p.MaxVideoBytes > MaxMaxVideoBytes) {
		return fmt.Errorf("%w: max_video_bytes must be %d to %d", ErrInvalid, MinMaxVideoBytes, MaxMaxVideoBytes)
	}
	put := func(key, value string) error {
		_, err := x.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
		return err
	}
	if p.MaxUploadBytes != nil {
		if err := put(KeyMaxUploadBytes, strconv.FormatInt(*p.MaxUploadBytes, 10)); err != nil {
			return err
		}
	}
	if p.MaxVideoBytes != nil {
		if err := put(KeyMaxVideoBytes, strconv.FormatInt(*p.MaxVideoBytes, 10)); err != nil {
			return err
		}
	}
	for key, v := range map[string]*bool{KeyBackgroundEnabled: p.BackgroundEnabled, KeyBackgroundShuffle: p.BackgroundShuffle} {
		if v == nil {
			continue
		}
		stored := "0"
		if *v {
			stored = "1"
		}
		if err := put(key, stored); err != nil {
			return err
		}
	}
	if p.ScoreSeconds != nil {
		return put(KeyScoreSeconds, strconv.Itoa(*p.ScoreSeconds))
	}
	return nil
}
