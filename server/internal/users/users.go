// Package users holds the queries for accounts and their devices.
package users

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"errors"
	"strings"
)

// Errors returned by the queries.
var (
	ErrNotFound   = errors.New("users: not found")
	ErrEmailTaken = errors.New("users: email already in use")
)

// Querier is satisfied by *sql.DB, *sql.Tx and *store.DB.
type Querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// User is an account row. Times are Unix seconds.
type User struct {
	ID, Email, DisplayName, PasswordHash string
	Admin, Uploader                      bool
	MustChangePassword, Disabled         bool
	CreatedAt                            int64
}

// Device is a signed-in device row; the token itself is never stored.
type Device struct {
	ID, UserID, Name, TokenHash string
	Type, MidiMode, MemoryMB    int
	BackgroundMode              int
	MicAvailable, Revoked       bool
	CreatedAt, LastSeen         int64
}

var idEncoding = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewID returns a random 16-byte identifier in lowercase base32 without padding.
func NewID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("users: no randomness available: " + err.Error())
	}
	return strings.ToLower(idEncoding.EncodeToString(b))
}

const userColumns = `id, email, display_name, password_hash, admin <> 0, uploader <> 0, must_change_password <> 0, disabled <> 0, created_at`

func scanUser(row *sql.Row) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.DisplayName, &u.PasswordHash, &u.Admin, &u.Uploader, &u.MustChangePassword, &u.Disabled, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

// Count returns the number of accounts.
func Count(ctx context.Context, q Querier) (int, error) {
	var n int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

// ByEmail finds an account; the comparison ignores case.
func ByEmail(ctx context.Context, q Querier, email string) (User, error) {
	return scanUser(q.QueryRowContext(ctx, `SELECT `+userColumns+` FROM users WHERE email = ?`, email))
}

// ByID finds an account.
func ByID(ctx context.Context, q Querier, id string) (User, error) {
	return scanUser(q.QueryRowContext(ctx, `SELECT `+userColumns+` FROM users WHERE id = ?`, id))
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// Create inserts an account; a duplicate email gives ErrEmailTaken.
func Create(ctx context.Context, q Querier, u User) error {
	_, err := q.ExecContext(ctx, `INSERT INTO users(`+strings.ReplaceAll(userColumns, " <> 0", "")+`) VALUES (?,?,?,?,?,?,?,?,?)`,
		u.ID, u.Email, u.DisplayName, u.PasswordHash, b2i(u.Admin), b2i(u.Uploader), b2i(u.MustChangePassword), b2i(u.Disabled), u.CreatedAt)
	if err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") {
		return ErrEmailTaken
	}
	return err
}

// SetPassword stores a new hash and sets or clears must_change_password.
func SetPassword(ctx context.Context, q Querier, userID, hash string, mustChange bool) error {
	res, err := q.ExecContext(ctx, `UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?`, hash, b2i(mustChange), userID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// CreateDevice inserts a device.
func CreateDevice(ctx context.Context, q Querier, d Device) error {
	_, err := q.ExecContext(ctx, `INSERT INTO devices(id, user_id, name, type, token_hash, created_at, last_seen, revoked, midi_mode, memory_mb, mic_available)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
		d.ID, d.UserID, d.Name, d.Type, d.TokenHash, d.CreatedAt, d.LastSeen, b2i(d.Revoked), d.MidiMode, d.MemoryMB, b2i(d.MicAvailable))
	return err
}

// ListDevices returns the user's devices that are not revoked, oldest first.
func ListDevices(ctx context.Context, q Querier, userID string) ([]Device, error) {
	rows, err := q.QueryContext(ctx, `SELECT id, user_id, name, type, token_hash, created_at, last_seen, revoked <> 0, midi_mode, memory_mb, mic_available <> 0, background_mode
		FROM devices WHERE user_id = ? AND revoked = 0 ORDER BY created_at, id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Type, &d.TokenHash, &d.CreatedAt, &d.LastSeen, &d.Revoked, &d.MidiMode, &d.MemoryMB, &d.MicAvailable, &d.BackgroundMode); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// RevokeDevice revokes one of the user's devices; false when it does not exist,
// belongs to someone else, or is already revoked.
func RevokeDevice(ctx context.Context, q Querier, userID, deviceID string) (bool, error) {
	res, err := q.ExecContext(ctx, `UPDATE devices SET revoked = 1 WHERE id = ? AND user_id = ? AND revoked = 0`, deviceID, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// RevokeOthers revokes every device of the user except keepDeviceID and returns how many.
func RevokeOthers(ctx context.Context, q Querier, userID, keepDeviceID string) (int, error) {
	res, err := q.ExecContext(ctx, `UPDATE devices SET revoked = 1 WHERE user_id = ? AND id <> ? AND revoked = 0`, userID, keepDeviceID)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// List returns every account ordered by email.
func List(ctx context.Context, q Querier) ([]User, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+userColumns+` FROM users ORDER BY email COLLATE NOCASE, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.PasswordHash, &u.Admin, &u.Uploader, &u.MustChangePassword, &u.Disabled, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// Update writes the display name, roles and disabled flag of an existing account.
func Update(ctx context.Context, q Querier, u User) error {
	res, err := q.ExecContext(ctx, `UPDATE users SET display_name = ?, admin = ?, uploader = ?, disabled = ? WHERE id = ?`,
		u.DisplayName, b2i(u.Admin), b2i(u.Uploader), b2i(u.Disabled), u.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// Delete removes an account; its devices (and later per-user data) cascade.
func Delete(ctx context.Context, q Querier, id string) error {
	res, err := q.ExecContext(ctx, `DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// RevokeAll revokes every device of the user and returns how many were active.
func RevokeAll(ctx context.Context, q Querier, userID string) (int, error) {
	res, err := q.ExecContext(ctx, `UPDATE devices SET revoked = 1 WHERE user_id = ? AND revoked = 0`, userID)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// CountEnabledAdmins counts admins that are not disabled.
func CountEnabledAdmins(ctx context.Context, q Querier) (int, error) {
	var n int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE admin <> 0 AND disabled = 0`).Scan(&n)
	return n, err
}

// SetDeviceMic records whether the device has a usable microphone; false when the
// device does not exist, belongs to someone else or is revoked.
func SetDeviceMic(ctx context.Context, q Querier, userID, deviceID string, available bool) (bool, error) {
	res, err := q.ExecContext(ctx, `UPDATE devices SET mic_available = ? WHERE id = ? AND user_id = ? AND revoked = 0`, b2i(available), deviceID, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// DeviceActive reports whether the device exists, is the user's and is not revoked.
func DeviceActive(ctx context.Context, q Querier, userID, deviceID string) (bool, error) {
	var n int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM devices WHERE id = ? AND user_id = ? AND revoked = 0`, deviceID, userID).Scan(&n)
	return n > 0, err
}

// DeviceByID finds one of the user's devices that is not revoked.
func DeviceByID(ctx context.Context, q Querier, userID, deviceID string) (Device, error) {
	var d Device
	err := q.QueryRowContext(ctx, `SELECT id, user_id, name, type, token_hash, created_at, last_seen, revoked <> 0, midi_mode, memory_mb, mic_available <> 0, background_mode
		FROM devices WHERE id = ? AND user_id = ? AND revoked = 0`, deviceID, userID).
		Scan(&d.ID, &d.UserID, &d.Name, &d.Type, &d.TokenHash, &d.CreatedAt, &d.LastSeen, &d.Revoked, &d.MidiMode, &d.MemoryMB, &d.MicAvailable, &d.BackgroundMode)
	if errors.Is(err, sql.ErrNoRows) {
		return Device{}, ErrNotFound
	}
	return d, err
}

// SetDeviceMemory stores the memory a device reported (0 means unknown).
func SetDeviceMemory(ctx context.Context, q Querier, userID, deviceID string, memoryMB int) (bool, error) {
	res, err := q.ExecContext(ctx, `UPDATE devices SET memory_mb = ? WHERE id = ? AND user_id = ? AND revoked = 0`, memoryMB, deviceID, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// SetDeviceBackgroundMode stores the user's background video choice for one of their devices; false when it is not theirs.
func SetDeviceBackgroundMode(ctx context.Context, q Querier, userID, deviceID string, mode int) (bool, error) {
	res, err := q.ExecContext(ctx, `UPDATE devices SET background_mode = ? WHERE id = ? AND user_id = ? AND revoked = 0`, mode, deviceID, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// SetDeviceMidiMode stores the user's MIDI mode choice for one of their devices.
func SetDeviceMidiMode(ctx context.Context, q Querier, userID, deviceID string, mode int) (bool, error) {
	res, err := q.ExecContext(ctx, `UPDATE devices SET midi_mode = ? WHERE id = ? AND user_id = ? AND revoked = 0`, mode, deviceID, userID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
