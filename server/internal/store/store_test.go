package store

import (
	"bytes"
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"testing/fstest"
)

func openTemp(t *testing.T) *DB {
	t.Helper()
	db, err := Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func pragma(t *testing.T, db *DB, name string) string {
	t.Helper()
	var v string
	if err := db.QueryRow("PRAGMA " + name).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestOpenCreatesFileAndWAL(t *testing.T) {
	dir := t.TempDir()
	db, err := Open(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := os.Stat(filepath.Join(dir, "kantahe.db")); err != nil {
		t.Fatal(err)
	}
	if got := pragma(t, db, "journal_mode"); got != "wal" {
		t.Errorf("journal_mode = %q, want wal", got)
	}
	if got := pragma(t, db, "foreign_keys"); got != "1" {
		t.Errorf("foreign_keys = %q, want 1", got)
	}
}

func TestOpenReportsBadDir(t *testing.T) {
	file := filepath.Join(t.TempDir(), "afile")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Open(context.Background(), filepath.Join(file, "sub")); err == nil {
		t.Fatal("want an error when the data directory is unusable")
	}
}

func countMigrations(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestMigrationsIdempotent(t *testing.T) {
	dir := t.TempDir()
	db, err := Open(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	files, _ := migrationFiles.ReadDir("migrations")
	if got := countMigrations(t, db.DB); got != len(files) {
		t.Fatalf("rows = %d, want %d", got, len(files))
	}
	_ = db.Close()
	db, err = Open(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if got := countMigrations(t, db.DB); got != len(files) {
		t.Fatalf("after reopen rows = %d, want %d", got, len(files))
	}
}

func rawDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := openRaw(filepath.Join(t.TempDir(), "raw.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestMigrationOrder(t *testing.T) {
	db := rawDB(t)
	fsys := fstest.MapFS{
		"0002_b.sql": {Data: []byte("INSERT INTO log(n) VALUES (2);")},
		"0001_a.sql": {Data: []byte("CREATE TABLE log(id INTEGER PRIMARY KEY AUTOINCREMENT, n INTEGER); INSERT INTO log(n) VALUES (1);")},
	}
	if err := migrateFS(context.Background(), db, fsys); err != nil {
		t.Fatal(err)
	}
	rows, err := db.Query("SELECT n FROM log ORDER BY id")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var got []int
	for rows.Next() {
		var n int
		_ = rows.Scan(&n)
		got = append(got, n)
	}
	if len(got) != 2 || got[0] != 1 || got[1] != 2 {
		t.Fatalf("applied order = %v, want [1 2]", got)
	}
}

func TestBadMigrationName(t *testing.T) {
	for _, name := range []string{"1_x.sql", "0001_X.sql", "0001-x.sql", "0001_x.txt", "0001.sql"} {
		err := migrateFS(context.Background(), rawDB(t), fstest.MapFS{name: {Data: []byte("SELECT 1;")}})
		if err == nil {
			t.Errorf("%s: want an error", name)
		}
	}
}

func TestDuplicateMigrationVersion(t *testing.T) {
	fsys := fstest.MapFS{"0001_a.sql": {Data: []byte("SELECT 1;")}, "0001_b.sql": {Data: []byte("SELECT 1;")}}
	if err := migrateFS(context.Background(), rawDB(t), fsys); err == nil {
		t.Fatal("want an error for two files with the same version")
	}
}

func TestFailedMigrationRollsBack(t *testing.T) {
	db := rawDB(t)
	fsys := fstest.MapFS{
		"0001_ok.sql":  {Data: []byte("CREATE TABLE ok(id INTEGER);")},
		"0002_bad.sql": {Data: []byte("CREATE TABLE half(id INTEGER); THIS IS NOT SQL;")},
	}
	err := migrateFS(context.Background(), db, fsys)
	if err == nil || !strings.Contains(err.Error(), "0002") {
		t.Fatalf("err = %v, want one naming migration 0002", err)
	}
	if got := countMigrations(t, db); got != 1 {
		t.Errorf("recorded versions = %d, want 1 (earlier kept, failed one not recorded)", got)
	}
	if _, err := db.Exec("SELECT 1 FROM half"); err == nil {
		t.Error("table from the failed migration should have been rolled back")
	}
	if _, err := db.Exec("SELECT 1 FROM ok"); err != nil {
		t.Errorf("earlier migration should be kept: %v", err)
	}
}

func TestForeignKeyCascade(t *testing.T) {
	db := openTemp(t)
	ctx := context.Background()
	mustExec := func(q string, args ...any) {
		t.Helper()
		if _, err := db.ExecContext(ctx, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	mustExec(`INSERT INTO users(id,email,display_name,password_hash,created_at) VALUES ('u1','a@b.c','A','h',1)`)
	mustExec(`INSERT INTO devices(id,user_id,name,type,token_hash,created_at,last_seen) VALUES ('d1','u1','TV',1,'t',1,1)`)
	mustExec(`DELETE FROM users WHERE id='u1'`)
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM devices`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("devices left = %d, %v", n, err)
	}
}

func TestEmailUniqueCaseInsensitive(t *testing.T) {
	db := openTemp(t)
	ins := `INSERT INTO users(id,email,display_name,password_hash,created_at) VALUES (?, ?, 'A','h',1)`
	if _, err := db.Exec(ins, "u1", "Alice@Example.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ins, "u2", "alice@example.COM"); err == nil {
		t.Fatal("want a unique violation for an email differing only in case")
	}
}

func TestSecretStable(t *testing.T) {
	db := openTemp(t)
	ctx := context.Background()
	a1, err := db.Secret(ctx, "media", 32)
	if err != nil || len(a1) != 32 {
		t.Fatalf("len %d, %v", len(a1), err)
	}
	a2, _ := db.Secret(ctx, "media", 32)
	if !bytes.Equal(a1, a2) {
		t.Fatal("same name must return the same secret")
	}
	b, _ := db.Secret(ctx, "other", 32)
	if bytes.Equal(a1, b) {
		t.Fatal("different names must return different secrets")
	}
	if _, err := db.Secret(ctx, "zero", 0); err == nil {
		t.Fatal("want an error for size 0")
	}
}

func TestSecretConcurrentAgree(t *testing.T) {
	db := openTemp(t)
	var wg sync.WaitGroup
	res := make([][]byte, 10)
	for i := range res {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res[i], _ = db.Secret(context.Background(), "race", 32)
		}()
	}
	wg.Wait()
	for i := range res {
		if len(res[i]) != 32 || !bytes.Equal(res[i], res[0]) {
			t.Fatalf("goroutine %d got a different secret", i)
		}
	}
}

func TestWriteTxConcurrent(t *testing.T) {
	db := openTemp(t)
	ctx := context.Background()
	if _, err := db.Exec(`INSERT INTO settings(key,value) VALUES ('counter','0')`); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- db.WriteTx(ctx, func(tx *sql.Tx) error {
				var v int
				if err := tx.QueryRow(`SELECT CAST(value AS INTEGER) FROM settings WHERE key='counter'`).Scan(&v); err != nil {
					return err
				}
				_, err := tx.Exec(`UPDATE settings SET value=? WHERE key='counter'`, v+1)
				return err
			})
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var final int
	_ = db.QueryRow(`SELECT CAST(value AS INTEGER) FROM settings WHERE key='counter'`).Scan(&final)
	if final != 20 {
		t.Fatalf("counter = %d, want 20", final)
	}
}

func TestWriteTxRollsBackOnError(t *testing.T) {
	db := openTemp(t)
	err := db.WriteTx(context.Background(), func(tx *sql.Tx) error {
		if _, err := tx.Exec(`INSERT INTO settings(key,value) VALUES ('k','v')`); err != nil {
			return err
		}
		return sql.ErrNoRows
	})
	if err != sql.ErrNoRows {
		t.Fatalf("err = %v, want the callback's error", err)
	}
	var n int
	_ = db.QueryRow(`SELECT COUNT(*) FROM settings WHERE key='k'`).Scan(&n)
	if n != 0 {
		t.Fatal("insert should have been rolled back")
	}
}

func TestCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Open(ctx, t.TempDir()); err == nil {
		t.Error("Open with a cancelled context should fail")
	}
	db := openTemp(t)
	if err := db.WriteTx(ctx, func(*sql.Tx) error { return nil }); err == nil {
		t.Error("WriteTx with a cancelled context should fail")
	}
	if _, err := db.Secret(ctx, "x", 8); err == nil {
		t.Error("Secret with a cancelled context should fail")
	}
	if err := migrateFS(ctx, rawDB(t), fstest.MapFS{"0001_a.sql": {Data: []byte("SELECT 1;")}}); err == nil {
		t.Error("migrateFS with a cancelled context should fail")
	}
}

func TestPragmasApplyToEveryConnection(t *testing.T) {
	db := openTemp(t)
	ctx := context.Background()
	var conns []*sql.Conn
	for i := 0; i < 4; i++ {
		c, err := db.Conn(ctx)
		if err != nil {
			t.Fatal(err)
		}
		conns = append(conns, c)
	}
	for i, c := range conns {
		var fk, bt string
		if err := c.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&fk); err != nil || fk != "1" {
			t.Errorf("conn %d foreign_keys = %q, %v", i, fk, err)
		}
		if err := c.QueryRowContext(ctx, "PRAGMA busy_timeout").Scan(&bt); err != nil || bt != "5000" {
			t.Errorf("conn %d busy_timeout = %q, %v", i, bt, err)
		}
		_ = c.Close()
	}
}

// WriteTx must hold the write lock from BEGIN on (not from its first write),
// otherwise two writers that both read first fail with SQLITE_BUSY on upgrade.
func TestWriteTxTakesWriteLockAtBegin(t *testing.T) {
	db := openTemp(t)
	ctx := context.Background()
	err := db.WriteTx(ctx, func(*sql.Tx) error {
		c, err := db.Conn(ctx)
		if err != nil {
			return err
		}
		defer c.Close()
		if _, err := c.ExecContext(ctx, "PRAGMA busy_timeout = 50"); err != nil {
			return err
		}
		if _, err := c.ExecContext(ctx, "BEGIN IMMEDIATE"); err == nil {
			_, _ = c.ExecContext(ctx, "ROLLBACK")
			t.Error("second writer got the lock while WriteTx was open without having written")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
