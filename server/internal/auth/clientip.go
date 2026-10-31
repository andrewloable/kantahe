package auth

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// ClientIP returns the address of the client behind any trusted reverse
// proxies. X-Forwarded-For is only read when the direct peer is itself in a
// trusted prefix. The result is invalid (IsValid false) when the peer address
// cannot be parsed.
func ClientIP(r *http.Request, trusted []netip.Prefix) netip.Addr {
	return ClientIPFrom(r.RemoteAddr, r.Header, trusted)
}

// ClientIPFrom is ClientIP for callers that only have the peer address and the
// headers (ConnectRPC exposes them separately).
func ClientIPFrom(peerAddr string, header http.Header, trusted []netip.Prefix) netip.Addr {
	peer := parseAddr(peerAddr)
	if !peer.IsValid() || !inPrefixes(peer, trusted) {
		return peer
	}
	var chain []string
	for _, line := range header.Values("X-Forwarded-For") {
		chain = append(chain, strings.Split(line, ",")...)
	}
	var leftmost netip.Addr
	for i := len(chain) - 1; i >= 0; i-- {
		a := parseAddr(strings.TrimSpace(chain[i]))
		if !a.IsValid() {
			return peer // cannot trust a chain with garbage in it
		}
		if !inPrefixes(a, trusted) {
			return a
		}
		leftmost = a
	}
	if leftmost.IsValid() {
		return leftmost
	}
	return peer
}

// parseAddr accepts "ip", "ip:port" and "[ip]:port" and unmaps IPv4-in-IPv6.
func parseAddr(s string) netip.Addr {
	if host, _, err := net.SplitHostPort(s); err == nil {
		s = host
	}
	a, err := netip.ParseAddr(strings.Trim(s, "[]"))
	if err != nil {
		return netip.Addr{}
	}
	return a.WithZone("").Unmap()
}

func inPrefixes(a netip.Addr, prefixes []netip.Prefix) bool {
	for _, p := range prefixes {
		if p.Contains(a) {
			return true
		}
	}
	return false
}
