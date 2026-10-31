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
	if err := Update(ctx, db, &up, &sec); err != nil {
		t.Fatal(err)
	}
	if s, _ := Load(ctx, db, 9); s.MaxUploadBytes != 5<<20 || s.ScoreSeconds != 12 {
		t.Fatalf("stored: %+v", s)
	}
	if err := Update(ctx, db, nil, nil); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []struct {
		up  *int64
		sec *int
	}{{ptr64(1 << 19), nil}, {ptr64(2 << 30), nil}, {nil, ptrInt(-1)}, {nil, ptrInt(61)}} {
		if err := Update(ctx, db, bad.up, bad.sec); !errors.Is(err, ErrInvalid) {
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
	if err := Update(ctx, brokenExec{}, &up, nil); err == nil {
		t.Error("a write error must be returned")
	}
}

func ptr64(v int64) *int64 { return &v }
func ptrInt(v int) *int    { return &v }

type brokenExec struct{}

func (brokenExec) ExecContext(context.Context, string, ...any) (sql.Result, error) {
	return nil, errors.New("disk full")
}
