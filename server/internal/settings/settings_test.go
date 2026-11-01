package settings

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/store"
)

func TestMaxUploadBytes(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if DefaultMaxUploadBytes != 52428800 {
		t.Fatal("the default is 50 MB")
	}
	if got, err := MaxUploadBytes(ctx, db); err != nil || got != DefaultMaxUploadBytes {
		t.Fatalf("default: %d %v", got, err)
	}
	if _, err := db.Exec(`INSERT INTO settings(key, value) VALUES (?, '1000')`, KeyMaxUploadBytes); err != nil {
		t.Fatal(err)
	}
	if got, _ := MaxUploadBytes(ctx, db); got != 1000 {
		t.Fatalf("stored value: %d", got)
	}
	for _, bad := range []string{"abc", "-5", "0", ""} {
		if _, err := db.Exec(`UPDATE settings SET value = ? WHERE key = ?`, bad, KeyMaxUploadBytes); err != nil {
			t.Fatal(err)
		}
		if got, err := MaxUploadBytes(ctx, db); err != nil || got != DefaultMaxUploadBytes {
			t.Fatalf("unusable value %q must fall back to the default: %d %v", bad, got, err)
		}
	}
}

func TestUpdateAndLoad(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if s, err := Load(ctx, db, 9); err != nil || s.MaxUploadBytes != DefaultMaxUploadBytes || s.ScoreSeconds != 9 {
		t.Fatalf("defaults: %+v %v", s, err)
	}
	up, sec := int64(5<<20), 12
	if err := Update(ctx, db, Patch{MaxUploadBytes: &up, ScoreSeconds: &sec}); err != nil {
		t.Fatal(err)
	}
	if s, _ := Load(ctx, db, 9); s.MaxUploadBytes != 5<<20 || s.ScoreSeconds != 12 {
		t.Fatalf("stored: %+v", s)
	}
	if err := Update(ctx, db, Patch{}); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []struct {
		up  *int64
		sec *int
	}{{ptr64(1 << 19), nil}, {ptr64(2 << 30), nil}, {nil, ptrInt(-1)}, {nil, ptrInt(61)}} {
		if err := Update(ctx, db, Patch{MaxUploadBytes: bad.up, ScoreSeconds: bad.sec}); !errors.Is(err, ErrInvalid) {
			t.Errorf("%v %v: %v", bad.up, bad.sec, err)
		}
	}
	// unusable stored seconds fall back to the default
	for _, v := range []string{"x", "-3", "99"} {
		_, _ = db.Exec(`UPDATE settings SET value = ? WHERE key = ?`, v, KeyScoreSeconds)
		if got, _ := ScoreSeconds(ctx, db, 6); got != 6 {
			t.Errorf("%q -> %d", v, got)
		}
	}
	if err := Update(ctx, brokenExec{}, Patch{MaxUploadBytes: &up}); err == nil {
		t.Error("a write error must be returned")
	}
}

func ptr64(v int64) *int64 { return &v }
func ptrInt(v int) *int    { return &v }

type brokenExec struct{}

func (brokenExec) ExecContext(context.Context, string, ...any) (sql.Result, error) {
	return nil, errors.New("disk full")
}

func TestMaxVideoBytes(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if DefaultMaxVideoBytes != 500<<20 {
		t.Fatal("the default is 500 MiB")
	}
	if s, err := Load(ctx, db, 6); err != nil || s.MaxVideoBytes != DefaultMaxVideoBytes {
		t.Fatalf("default: %+v %v", s, err)
	}
	for _, ok := range []int64{MinMaxVideoBytes, 700 << 20, MaxMaxVideoBytes} {
		v := ok
		if err := Update(ctx, db, Patch{MaxVideoBytes: &v}); err != nil {
			t.Fatalf("%d: %v", ok, err)
		}
		if s, _ := Load(ctx, db, 6); s.MaxVideoBytes != ok {
			t.Fatalf("stored %d, loaded %d", ok, s.MaxVideoBytes)
		}
	}
	for _, bad := range []int64{0, -1, MinMaxVideoBytes - 1, MaxMaxVideoBytes + 1, 9 << 30} {
		v := bad
		if err := Update(ctx, db, Patch{MaxVideoBytes: &v}); !errors.Is(err, ErrInvalid) {
			t.Errorf("%d: %v", bad, err)
		}
	}
	// the refused values were not written, and an unusable stored value falls back to the default
	if s, _ := Load(ctx, db, 6); s.MaxVideoBytes != MaxMaxVideoBytes {
		t.Fatalf("a refused update changed the setting: %d", s.MaxVideoBytes)
	}
	for _, v := range []string{"x", "0", "-5", "99999999999999"} {
		_, _ = db.Exec(`UPDATE settings SET value = ? WHERE key = ?`, v, KeyMaxVideoBytes)
		if got, _ := MaxVideoBytes(ctx, db); got != DefaultMaxVideoBytes {
			t.Errorf("%q -> %d", v, got)
		}
	}
}

func TestBackgroundSwitches(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if on, _ := BackgroundEnabled(ctx, db); !on {
		t.Fatal("the background is on by default")
	}
	if sh, _ := BackgroundShuffle(ctx, db); sh {
		t.Fatal("shuffle is off by default")
	}
	set := func(key, v string) {
		_, _ = db.Exec(`INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, v)
	}
	set(KeyBackgroundEnabled, "0")
	set(KeyBackgroundShuffle, "1")
	if on, _ := BackgroundEnabled(ctx, db); on {
		t.Fatal("stored 0 means off")
	}
	if sh, _ := BackgroundShuffle(ctx, db); !sh {
		t.Fatal("stored 1 means on")
	}
	// an unusable value falls back to the default
	set(KeyBackgroundEnabled, "maybe")
	set(KeyBackgroundShuffle, "")
	if on, _ := BackgroundEnabled(ctx, db); !on {
		t.Fatal("junk falls back to the default (on)")
	}
	if sh, _ := BackgroundShuffle(ctx, db); sh {
		t.Fatal("junk falls back to the default (off)")
	}
}

func TestUpdateBackgroundSwitches(t *testing.T) {
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	on, off := true, false
	if err := Update(ctx, db, Patch{BackgroundEnabled: &off, BackgroundShuffle: &on}); err != nil {
		t.Fatal(err)
	}
	if s, _ := Load(ctx, db, 6); s.BackgroundEnabled || !s.BackgroundShuffle || s.MaxVideoBytes != DefaultMaxVideoBytes {
		t.Fatalf("%+v", s)
	}
	var stored string
	if err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, KeyBackgroundShuffle).Scan(&stored); err != nil || stored != "1" {
		t.Fatalf("stored %q %v", stored, err)
	}
	// a partial update leaves the other switch alone
	if err := Update(ctx, db, Patch{BackgroundEnabled: &on}); err != nil {
		t.Fatal(err)
	}
	if s, _ := Load(ctx, db, 6); !s.BackgroundEnabled || !s.BackgroundShuffle {
		t.Fatalf("%+v", s)
	}
}
