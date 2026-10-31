package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"regexp"
	"testing"
)

func TestTokenUniqueAndHash(t *testing.T) {
	a, ha := NewToken()
	b, hb := NewToken()
	if a == b || ha == hb {
		t.Fatal("tokens must be unique")
	}
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(ha) {
		t.Fatalf("hash is not 64 lowercase hex chars: %s", ha)
	}
	sum := sha256.Sum256([]byte(a))
	if ha != hex.EncodeToString(sum[:]) || ha != HashToken(a) {
		t.Fatal("hash must be the hex SHA-256 of the token string")
	}
	raw, err := base64.RawURLEncoding.DecodeString(a)
	if err != nil || len(raw) != 32 {
		t.Fatalf("token must be 32 random bytes in unpadded base64url: len %d err %v", len(raw), err)
	}
}
