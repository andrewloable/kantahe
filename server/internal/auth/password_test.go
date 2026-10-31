package auth

import (
	"regexp"
	"strings"
	"testing"
)

func TestHashVerify(t *testing.T) {
	h, err := Hash("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if ok, err := Verify(h, "correct horse"); !ok || err != nil {
		t.Fatalf("correct password: %v %v", ok, err)
	}
	if ok, err := Verify(h, "wrong"); ok || err != nil {
		t.Fatalf("wrong password: %v %v", ok, err)
	}
	h2, _ := Hash("correct horse")
	if h == h2 {
		t.Error("two hashes of one password must differ (random salt)")
	}
}

func TestHashFormat(t *testing.T) {
	h, _ := Hash("password1")
	re := regexp.MustCompile(`^\$argon2id\$v=19\$m=65536,t=3,p=2\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$`)
	if !re.MatchString(h) {
		t.Fatalf("format wrong: %s", h)
	}
}

func TestVerifyTamperedNeverPanics(t *testing.T) {
	h, _ := Hash("password1")
	parts := strings.Split(h, "$")
	cases := map[string]string{
		"empty":            "",
		"garbage":          "not a hash",
		"other algorithm":  strings.Replace(h, "argon2id", "argon2i", 1),
		"bad version":      strings.Replace(h, "v=19", "v=16", 1),
		"missing field":    strings.Join(parts[:5], "$"),
		"bad params":       strings.Replace(h, "m=65536,t=3,p=2", "m=x,t=3,p=2", 1),
		"huge memory":      strings.Replace(h, "m=65536", "m=4294967295", 1),
		"huge time":        strings.Replace(h, "t=3", "t=4000000000", 1),
		"zero parallelism": strings.Replace(h, "p=2", "p=0", 1),
		"bad salt base64":  strings.Replace(h, parts[4], "!!!!", 1),
		"bad hash base64":  strings.Replace(h, parts[5], "!!!!", 1),
		"empty hash":       strings.Join(append(append([]string{}, parts[:5]...), ""), "$"),
	}
	for name, enc := range cases {
		if ok, _ := Verify(enc, "password1"); ok {
			t.Errorf("%s: tampered hash verified", name)
		}
	}
	// a flipped hash byte must not verify
	flipped := h[:len(h)-2] + "AA"
	if h[len(h)-2:] != "AA" {
		if ok, _ := Verify(flipped, "password1"); ok {
			t.Error("modified hash verified")
		}
	}
}

func TestVerifyMalformedReturnsError(t *testing.T) {
	if _, err := Verify("not a hash", "x"); err == nil {
		t.Error("malformed encoding should return an error")
	}
}

func TestValidatePassword(t *testing.T) {
	cases := map[int]bool{0: false, 7: false, 8: true, 256: true, 257: false}
	for n, ok := range cases {
		err := ValidatePassword(strings.Repeat("a", n))
		if (err == nil) != ok {
			t.Errorf("%d bytes: err = %v, want ok=%v", n, err, ok)
		}
	}
	if err := ValidatePassword("é" + strings.Repeat("a", 6)); err != nil { // 8 bytes, 7 characters
		t.Errorf("limits count bytes: %v", err)
	}
}

func TestCheapCostHashesVerifyAndMix(t *testing.T) {
	h, err := HashWithCost("password1", CheapCost)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(h, "m=64,t=1,p=1") {
		t.Fatalf("cost not applied: %s", h)
	}
	if ok, err := Verify(h, "password1"); !ok || err != nil {
		t.Fatalf("%v %v", ok, err)
	}
	if ok, _ := Verify(h, "other-password"); ok {
		t.Fatal("wrong password verified")
	}
}
