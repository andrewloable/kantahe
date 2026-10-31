package auth

import (
	"net/http"
	"net/netip"
	"testing"
)

func req(remote string, xff ...string) *http.Request {
	r := &http.Request{RemoteAddr: remote, Header: http.Header{}}
	for _, x := range xff {
		r.Header.Add("X-Forwarded-For", x)
	}
	return r
}

var trusted10 = []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")}

func TestClientIPDirect(t *testing.T) {
	if got := ClientIP(req("203.0.113.5:1234"), nil); got != netip.MustParseAddr("203.0.113.5") {
		t.Fatalf("got %v", got)
	}
}

func TestClientIPTrusted(t *testing.T) {
	r := req("10.0.0.2:5000", "198.51.100.7, 10.0.0.3")
	if got := ClientIP(r, trusted10); got != netip.MustParseAddr("198.51.100.7") {
		t.Fatalf("got %v, want 198.51.100.7", got)
	}
}

func TestClientIPUntrustedPeerIgnoresXFF(t *testing.T) {
	r := req("203.0.113.5:1234", "1.2.3.4")
	if got := ClientIP(r, trusted10); got != netip.MustParseAddr("203.0.113.5") {
		t.Fatalf("spoofed XFF accepted: %v", got)
	}
}

func TestClientIPWalksFromTheRight(t *testing.T) {
	// the client sent a fake leftmost entry; only the rightmost untrusted one is real
	r := req("10.0.0.2:5000", "6.6.6.6, 198.51.100.7", "10.0.0.9")
	if got := ClientIP(r, trusted10); got != netip.MustParseAddr("198.51.100.7") {
		t.Fatalf("got %v, want 198.51.100.7 (multiple header lines are joined)", got)
	}
}

func TestClientIPAllTrustedOrMissingFallsBack(t *testing.T) {
	if got := ClientIP(req("10.0.0.2:5000"), trusted10); got != netip.MustParseAddr("10.0.0.2") {
		t.Fatalf("no XFF: %v", got)
	}
	if got := ClientIP(req("10.0.0.2:5000", "10.1.1.1, 10.2.2.2"), trusted10); got != netip.MustParseAddr("10.1.1.1") {
		t.Fatalf("all trusted: %v", got)
	}
}

func TestClientIPGarbageInXFFFallsBackToPeer(t *testing.T) {
	if got := ClientIP(req("10.0.0.2:5000", "1.2.3.4, not-an-ip"), trusted10); got != netip.MustParseAddr("10.0.0.2") {
		t.Fatalf("got %v, want the proxy address", got)
	}
}

func TestClientIPForms(t *testing.T) {
	cases := map[string]string{
		"[::1]:80":           "::1",
		"[2001:db8::1]:443":  "2001:db8::1",
		"[::ffff:1.2.3.4]:9": "1.2.3.4",
		"1.2.3.4":            "1.2.3.4", // no port
	}
	for in, want := range cases {
		if got := ClientIP(req(in), nil); got != netip.MustParseAddr(want) {
			t.Errorf("%s -> %v, want %s", in, got, want)
		}
	}
	if got := ClientIP(req("garbage"), nil); got.IsValid() {
		t.Errorf("garbage RemoteAddr gave %v, want an invalid address", got)
	}
	r := req("10.0.0.2:5000", "[2001:db8::7]:1234")
	if got := ClientIP(r, trusted10); got != netip.MustParseAddr("2001:db8::7") {
		t.Errorf("XFF with port: %v", got)
	}
}

func TestClientIPFromHeaderAndPeerAddr(t *testing.T) {
	h := http.Header{"X-Forwarded-For": {"198.51.100.7"}}
	if got := ClientIPFrom("10.0.0.2:5000", h, trusted10); got != netip.MustParseAddr("198.51.100.7") {
		t.Fatalf("got %v", got)
	}
}
