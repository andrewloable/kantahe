package users

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/store"
)

func open(t *testing.T) *store.DB {
	t.Helper()
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestNewID(t *testing.T) {
	a, b := NewID(), NewID()
	if a == b || !regexp.MustCompile(`^[a-z2-7]{26}$`).MatchString(a) {
		t.Fatalf("ids: %q %q", a, b)
	}
}

func TestCreateAndFind(t *testing.T) {
	db := open(t)
	ctx := context.Background()
	u := User{ID: NewID(), Email: "a@b.c", DisplayName: "A", PasswordHash: "h", Admin: true, Uploader: true, CreatedAt: 5}
	if err := db.WriteTx(ctx, func(tx *sql.Tx) error { return Create(ctx, tx, u) }); err != nil {
		t.Fatal(err)
	}
	got, err := ByEmail(ctx, db, "A@B.C")
	if err != nil || got != u {
		t.Fatalf("%+v %v", got, err)
	}
	got, err = ByID(ctx, db, u.ID)
	if err != nil || got != u {
		t.Fatalf("%+v %v", got, err)
	}
	if _, err := ByEmail(ctx, db, "x@y.z"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
	if _, err := ByID(ctx, db, "nope"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
	if n, err := Count(ctx, db); err != nil || n != 1 {
		t.Fatalf("count %d %v", n, err)
	}
	u2 := u
	u2.ID = NewID()
	u2.Email = "a@B.c"
	if err := db.WriteTx(ctx, func(tx *sql.Tx) error { return Create(ctx, tx, u2) }); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("duplicate email: %v", err)
	}
}

func TestDevices(t *testing.T) {
	db := open(t)
	ctx := context.Background()
	u := User{ID: NewID(), Email: "a@b.c", DisplayName: "A", PasswordHash: "h"}
	_ = db.WriteTx(ctx, func(tx *sql.Tx) error { return Create(ctx, tx, u) })
	d1 := Device{ID: NewID(), UserID: u.ID, Name: "TV", Type: 4, TokenHash: "t1", CreatedAt: 1, LastSeen: 1, MidiMode: 1}
	d2 := Device{ID: NewID(), UserID: u.ID, Name: "Phone", Type: 2, TokenHash: "t2", CreatedAt: 2, LastSeen: 2, MidiMode: 1}
	_ = db.WriteTx(ctx, func(tx *sql.Tx) error {
		if err := CreateDevice(ctx, tx, d1); err != nil {
			return err
		}
		return CreateDevice(ctx, tx, d2)
	})
	list, err := ListDevices(ctx, db, u.ID)
	if err != nil || len(list) != 2 || list[0].ID != d1.ID {
		t.Fatalf("%+v %v", list, err)
	}
	ok, err := RevokeDevice(ctx, db, u.ID, d1.ID)
	if err != nil || !ok {
		t.Fatalf("%v %v", ok, err)
	}
	if ok, _ = RevokeDevice(ctx, db, u.ID, d1.ID); ok {
		t.Fatal("already revoked")
	}
	if ok, _ = RevokeDevice(ctx, db, "someone-else", d2.ID); ok {
		t.Fatal("another user's device must not be revoked")
	}
	list, _ = ListDevices(ctx, db, u.ID)
	if len(list) != 1 || list[0].ID != d2.ID {
		t.Fatalf("%+v", list)
	}
	d3 := Device{ID: NewID(), UserID: u.ID, Name: "X", Type: 1, TokenHash: "t3", MidiMode: 1}
	_ = db.WriteTx(ctx, func(tx *sql.Tx) error { return CreateDevice(ctx, tx, d3) })
	n, err := RevokeOthers(ctx, db, u.ID, d3.ID)
	if err != nil || n != 1 {
		t.Fatalf("revoked %d %v", n, err)
	}
	list, _ = ListDevices(ctx, db, u.ID)
	if len(list) != 1 || list[0].ID != d3.ID {
		t.Fatalf("%+v", list)
	}
}

func TestSetPassword(t *testing.T) {
	db := open(t)
	ctx := context.Background()
	u := User{ID: NewID(), Email: "a@b.c", DisplayName: "A", PasswordHash: "old", MustChangePassword: true}
	_ = db.WriteTx(ctx, func(tx *sql.Tx) error { return Create(ctx, tx, u) })
	if err := db.WriteTx(ctx, func(tx *sql.Tx) error { return SetPassword(ctx, tx, u.ID, "new", false) }); err != nil {
		t.Fatal(err)
	}
	got, _ := ByID(ctx, db, u.ID)
	if got.PasswordHash != "new" || got.MustChangePassword {
		t.Fatalf("%+v", got)
	}
}

func TestListUpdateDeleteAndAdminCount(t *testing.T) {
	db := open(t)
	ctx := context.Background()
	mk := func(email string, admin, disabled bool) User {
		u := User{ID: NewID(), Email: email, DisplayName: email, PasswordHash: "h", Admin: admin, Disabled: disabled}
		if err := db.WriteTx(ctx, func(tx *sql.Tx) error { return Create(ctx, tx, u) }); err != nil {
			t.Fatal(err)
		}
		return u
	}
	b := mk("b@x.y", true, false)
	a := mk("A@x.y", true, true)
	c := mk("c@x.y", false, false)
	list, err := List(ctx, db)
	if err != nil || len(list) != 3 || list[0].ID != a.ID || list[1].ID != b.ID || list[2].ID != c.ID {
		t.Fatalf("order is by email, ignoring case: %+v %v", list, err)
	}
	if n, _ := CountEnabledAdmins(ctx, db); n != 1 {
		t.Fatalf("enabled admins = %d, want 1 (a is disabled)", n)
	}
	c.DisplayName, c.Uploader, c.Admin = "Cee", true, true
	if err := Update(ctx, db, c); err != nil {
		t.Fatal(err)
	}
	got, _ := ByID(ctx, db, c.ID)
	if got.DisplayName != "Cee" || !got.Uploader || !got.Admin || got.Email != "c@x.y" || got.PasswordHash != "h" {
		t.Fatalf("%+v", got)
	}
	if err := Update(ctx, db, User{ID: "nope"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("update unknown: %v", err)
	}
	if err := Delete(ctx, db, c.ID); err != nil {
		t.Fatal(err)
	}
	if err := Delete(ctx, db, c.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("delete twice: %v", err)
	}
	if err := SetPassword(ctx, db, "nope", "x", false); !errors.Is(err, ErrNotFound) {
		t.Fatalf("set password unknown: %v", err)
	}
	d := Device{ID: NewID(), UserID: b.ID, Name: "x", Type: 1, TokenHash: "t", MidiMode: 1}
	_ = db.WriteTx(ctx, func(tx *sql.Tx) error { return CreateDevice(ctx, tx, d) })
	if n, err := RevokeAll(ctx, db, b.ID); err != nil || n != 1 {
		t.Fatalf("%d %v", n, err)
	}
}
