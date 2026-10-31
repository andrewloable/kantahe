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
)

// Defaults and the ranges an admin may choose from.
const (
	DefaultMaxUploadBytes int64 = 50 << 20
	MinMaxUploadBytes     int64 = 1 << 20
	MaxMaxUploadBytes     int64 = 1 << 30
	MinScoreSeconds             = 0
	MaxScoreSeconds             = 60
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
	return Settings{MaxUploadBytes: up, ScoreSeconds: sc}, err
}

// Update stores the settings whose pointer is set, after checking their ranges.
// Nothing is written when any value is invalid.
func Update(ctx context.Context, x Execer, maxUploadBytes *int64, scoreSeconds *int) error {
	if maxUploadBytes != nil && (*maxUploadBytes < MinMaxUploadBytes || *maxUploadBytes > MaxMaxUploadBytes) {
		return fmt.Errorf("%w: max_upload_bytes must be %d to %d", ErrInvalid, MinMaxUploadBytes, MaxMaxUploadBytes)
	}
	if scoreSeconds != nil && (*scoreSeconds < MinScoreSeconds || *scoreSeconds > MaxScoreSeconds) {
		return fmt.Errorf("%w: score_seconds must be %d to %d", ErrInvalid, MinScoreSeconds, MaxScoreSeconds)
	}
	put := func(key, value string) error {
		_, err := x.ExecContext(ctx, `INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
		return err
	}
	if maxUploadBytes != nil {
		if err := put(KeyMaxUploadBytes, strconv.FormatInt(*maxUploadBytes, 10)); err != nil {
			return err
		}
	}
	if scoreSeconds != nil {
		return put(KeyScoreSeconds, strconv.Itoa(*scoreSeconds))
	}
	return nil
}
