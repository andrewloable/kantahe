// Package store opens the SQLite database (pure Go driver, WAL) and runs the
// embedded migrations. Features add tables with new numbered migration files;
// an existing migration is never edited.
package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"

	_ "modernc.org/sqlite" // registers the "sqlite" driver
)

// DB is the application database.
type DB struct {
	*sql.DB
}

// Open opens (creating if needed) <dataDir>/kantahe.db and migrates it.
func Open(ctx context.Context, dataDir string) (*DB, error) {
	sqlDB, err := openRaw(filepath.Join(dataDir, "kantahe.db"))
	if err != nil {
		return nil, err
	}
	if err := sqlDB.PingContext(ctx); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := migrate(ctx, sqlDB); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	return &DB{sqlDB}, nil
}

// openRaw opens the database file with the pragmas every connection needs.
// _txlock=immediate makes every explicit transaction take the write lock at
// BEGIN, so concurrent writers queue on busy_timeout instead of failing on a
// lock upgrade; plain queries outside a transaction are unaffected.
func openRaw(path string) (*sql.DB, error) {
	q := url.Values{}
	for _, p := range []string{"journal_mode(WAL)", "foreign_keys(1)", "busy_timeout(5000)", "synchronous(NORMAL)"} {
		q.Add("_pragma", p)
	}
	q.Set("_txlock", "immediate")
	u := url.URL{Scheme: "file", Opaque: (&url.URL{Path: filepath.ToSlash(path)}).EscapedPath(), RawQuery: q.Encode()}
	return sql.Open("sqlite", u.String())
}

// WriteTx runs fn in a write transaction and commits it, or rolls back when fn
// returns an error.
func (d *DB) WriteTx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Secret returns the stored secret called name, creating size random bytes on
// first use. Concurrent callers all receive the same value.
func (d *DB) Secret(ctx context.Context, name string, size int) ([]byte, error) {
	if size <= 0 {
		return nil, errors.New("secret size must be positive")
	}
	fresh := make([]byte, size)
	if _, err := rand.Read(fresh); err != nil {
		return nil, err
	}
	var out []byte
	err := d.WriteTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO server_secrets(name, value) VALUES (?, ?)`, name, fresh); err != nil {
			return err
		}
		return tx.QueryRowContext(ctx, `SELECT value FROM server_secrets WHERE name = ?`, name).Scan(&out)
	})
	return out, err
}
