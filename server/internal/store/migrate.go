package store

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

var migrationName = regexp.MustCompile(`^(\d{4})_[a-z0-9_]+\.sql$`)

type migration struct {
	version int
	name    string
}

// migrate applies the embedded migrations that are not applied yet.
func migrate(ctx context.Context, db *sql.DB) error {
	sub, err := fs.Sub(migrationFiles, "migrations")
	if err != nil {
		return err
	}
	return migrateFS(ctx, db, sub)
}

// migrateFS applies the *.sql files of fsys in numeric order of their 4-digit
// prefix, each in its own transaction, skipping versions already recorded.
func migrateFS(ctx context.Context, db *sql.DB, fsys fs.FS) error {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return err
	}
	var list []migration
	seen := map[int]string{}
	for _, e := range entries {
		m := migrationName.FindStringSubmatch(e.Name())
		if m == nil {
			return fmt.Errorf("migration %q: name must match NNNN_name.sql", e.Name())
		}
		v, _ := strconv.Atoi(m[1])
		if other, dup := seen[v]; dup {
			return fmt.Errorf("migrations %q and %q have the same version", other, e.Name())
		}
		seen[v] = e.Name()
		list = append(list, migration{v, e.Name()})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].version < list[j].version })

	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		return err
	}
	for _, m := range list {
		if err := applyOne(ctx, db, fsys, m); err != nil {
			return fmt.Errorf("migration %s: %w", m.name, err)
		}
	}
	return nil
}

func applyOne(ctx context.Context, db *sql.DB, fsys fs.FS, m migration) error {
	body, err := fs.ReadFile(fsys, m.name)
	if err != nil {
		return err
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit
	var applied int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, m.version).Scan(&applied); err != nil {
		return err
	}
	if applied > 0 {
		return nil
	}
	if _, err := tx.ExecContext(ctx, string(body)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)`,
		m.version, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	return tx.Commit()
}

// LatestVersion is the highest migration this program knows: a database whose schema_migrations goes beyond it was made by a
// newer Kantahe.
func LatestVersion() int {
	entries, err := fs.ReadDir(migrationFiles, "migrations")
	if err != nil {
		return 0
	}
	latest := 0
	for _, e := range entries {
		if m := migrationName.FindStringSubmatch(e.Name()); m != nil {
			if v, _ := strconv.Atoi(m[1]); v > latest {
				latest = v
			}
		}
	}
	return latest
}

// SchemaOf lists every table, index, trigger and view of the database with its definition, one entry each, in a fixed order and with
// the white space of the definitions folded. Two databases made by the same migrations list the same, so a database that came from
// somewhere else can be compared with a freshly migrated one.
func SchemaOf(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT type, name, tbl_name, COALESCE(sql, '') FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var typ, name, table, def string
		if err := rows.Scan(&typ, &name, &table, &def); err != nil {
			return nil, err
		}
		out = append(out, typ+" "+name+" on "+table+": "+strings.Join(strings.Fields(def), " "))
	}
	return out, rows.Err()
}
