// Package auth holds the reusable pieces of sign-in: argon2id password hashes,
// device tokens, sign-in back-off, client IP detection behind proxies and the
// ConnectRPC authentication interceptor.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonMemory  = 64 * 1024 // KiB
	argonTime    = 3
	argonThreads = 2
	argonKeyLen  = 32
	saltLen      = 16

	minPasswordBytes = 8
	maxPasswordBytes = 256

	// limits applied to parameters read from a stored hash, so that a corrupted
	// or hostile value cannot make Verify allocate gigabytes
	maxVerifyMemory  = 256 * 1024
	maxVerifyTime    = 10
	maxVerifyThreads = 16
)

var b64 = base64.RawStdEncoding

var errBadHash = errors.New("auth: malformed password hash")

// ValidatePassword enforces 8 to 256 bytes.
func ValidatePassword(pw string) error {
	if len(pw) < minPasswordBytes || len(pw) > maxPasswordBytes {
		return fmt.Errorf("password must be %d to %d bytes", minPasswordBytes, maxPasswordBytes)
	}
	return nil
}

// Cost is the argon2id work factor of a new hash.
type Cost struct {
	MemoryKiB, Time uint32
	Threads         uint8
}

// DefaultCost is what production uses; CheapCost exists so that tests which sign
// in many times stay fast. Verify reads the cost from the stored hash, so both mix freely.
var (
	DefaultCost = Cost{argonMemory, argonTime, argonThreads}
	CheapCost   = Cost{MemoryKiB: 64, Time: 1, Threads: 1}
)

// Hash returns a PHC string: $argon2id$v=19$m=65536,t=3,p=2$<salt>$<hash>.
func Hash(pw string) (string, error) { return HashWithCost(pw, DefaultCost) }

// HashWithCost is Hash with an explicit work factor.
func HashWithCost(pw string, c Cost) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(pw), salt, c.Time, c.MemoryKiB, c.Threads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, c.MemoryKiB, c.Time, c.Threads, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// Verify checks pw against a stored hash with a constant-time comparison. The
// parameters come from the stored string. A malformed hash is an error, never a match.
func Verify(encoded, pw string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" || parts[2] != "v=19" {
		return false, errBadHash
	}
	var m, t, p uint64
	for _, kv := range strings.Split(parts[3], ",") {
		k, v, ok := strings.Cut(kv, "=")
		n, err := strconv.ParseUint(v, 10, 32)
		if !ok || err != nil {
			return false, errBadHash
		}
		switch k {
		case "m":
			m = n
		case "t":
			t = n
		case "p":
			p = n
		default:
			return false, errBadHash
		}
	}
	if m == 0 || m > maxVerifyMemory || t == 0 || t > maxVerifyTime || p == 0 || p > maxVerifyThreads {
		return false, errBadHash
	}
	salt, err1 := b64.DecodeString(parts[4])
	want, err2 := b64.DecodeString(parts[5])
	if err1 != nil || err2 != nil || len(salt) < 8 || len(want) < 16 || len(want) > 64 {
		return false, errBadHash
	}
	got := argon2.IDKey([]byte(pw), salt, uint32(t), uint32(m), uint8(p), uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}
