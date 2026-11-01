package discovery

import (
	"io"
	"log/slog"
	"net/netip"
	"testing"
)

func TestTarget(t *testing.T) {
	cases := []struct {
		listen string
		port   int
		ip     string
		skip   bool
		bad    bool
	}{
		{listen: ":8080", port: 8080},
		{listen: "0.0.0.0:9000", port: 9000},
		{listen: "[::]:8080", port: 8080},
		{listen: "127.0.0.1:9000", port: 9000, skip: true},
		{listen: "[::1]:8080", port: 8080, skip: true},
		{listen: "localhost:8080", port: 8080, skip: true},
		{listen: "192.168.1.5:9000", port: 9000, ip: "192.168.1.5"},
		{listen: "myhost.lan:8080", port: 8080}, // a host name: all interfaces
		{listen: "8080", bad: true},
		{listen: ":0", bad: true},
		{listen: ":70000", bad: true},
		{listen: ":http", bad: true},
		{listen: "", bad: true},
	}
	for _, c := range cases {
		port, ip, skip, err := target(c.listen)
		if c.bad {
			if err == nil {
				t.Errorf("%q: want an error, got port %d ip %q skip %v", c.listen, port, ip, skip)
			}
			continue
		}
		if err != nil || port != c.port || ip != c.ip || skip != c.skip {
			t.Errorf("%q: got port %d ip %q skip %v err %v; want port %d ip %q skip %v", c.listen, port, ip, skip, err, c.port, c.ip, c.skip)
		}
	}
}

func TestLoopbackIsNotAdvertised(t *testing.T) {
	stop, err := Advertise("127.0.0.1:8080", "Test", "1.0", slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	stop() // a no-op that must be safe to call
	stop()
}

func TestBadListenIsAnError(t *testing.T) {
	if _, err := Advertise("nonsense", "Test", "1.0", slog.New(slog.NewTextHandler(io.Discard, nil))); err == nil {
		t.Fatal("want an error for a listen address with no port")
	}
}

func TestTextHoldsTheVersion(t *testing.T) {
	if got := txt("1.2.3"); len(got) != 1 || got[0] != "version=1.2.3" {
		t.Fatalf("got %v", got)
	}
}

// regression: the library sends nothing when the host name of the SRV record is not fully qualified, and macOS
// reports its host name as "box.local" (which the library does not recognise as needing a final dot)
func TestHostIsFullyQualified(t *testing.T) {
	cases := map[string]string{
		"box":             "box.local.",
		"box.local":       "box.local.",
		"box.local.":      "box.local.",
		"box.example.com": "box.local.", // only the first label is the machine's own name
		"mylocal":         "mylocal.local.",
		"my box_2":        "my-box-2.local.",
		"":                "kantahe.local.",
		".local":          "kantahe.local.",
		"d41d8cd98f00":    "d41d8cd98f00.local.",
		"Living-Room-Mac": "Living-Room-Mac.local.",
		"-weird-":         "weird.local.",
		"\u00e9t\u00e9":   "t.local.", // letters outside a-z become dashes
	}
	for in, want := range cases {
		if got := host(in); got != want {
			t.Errorf("host(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestOnlyReachableAddressesAreAnnounced(t *testing.T) {
	for addr, want := range map[string]bool{
		"192.168.1.5":   true,
		"10.0.0.2":      true,
		"2001:db8::1":   true,
		"127.0.0.1":     false,
		"::1":           false,
		"169.254.10.10": false, // link-local: no use to another machine
		"fe80::1":       false,
		"0.0.0.0":       false,
		"224.0.0.251":   false, // multicast
	} {
		if got := announce(netip.MustParseAddr(addr)); got != want {
			t.Errorf("announce(%s) = %v, want %v", addr, got, want)
		}
	}
}
