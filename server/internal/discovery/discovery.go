// Package discovery advertises the server on the local network (mDNS / DNS-SD) so that the apps can find it
// without being told its address.
package discovery

import (
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"os"
	"strconv"
	"strings"

	"github.com/libp2p/zeroconf/v2"
)

// Service is the DNS-SD service type the apps browse for.
const Service = "_kantahe._tcp"

const domain = "local"

// txt is the TXT record: the version, for a client that wants to show it before it connects.
func txt(version string) []string { return []string{"version=" + version} }

// target reads the --listen address: the port to announce, the one IP to announce it on (empty: every
// interface), and skip when the server listens on loopback only (nothing else on the network could reach it).
func target(listen string) (port int, ip string, skip bool, err error) {
	host, p, err := net.SplitHostPort(listen)
	if err != nil {
		return 0, "", false, fmt.Errorf("cannot read the listen address %q: %w", listen, err)
	}
	port, err = strconv.Atoi(p)
	if err != nil || port < 1 || port > 65535 {
		return 0, "", false, fmt.Errorf("cannot announce the port of %q: want a number from 1 to 65535", listen)
	}
	if strings.EqualFold(host, "localhost") {
		return port, "", true, nil
	}
	addr, perr := netip.ParseAddr(host)
	switch {
	case perr != nil, addr.IsUnspecified():
		return port, "", false, nil // "" or a host name: every interface
	case addr.IsLoopback():
		return port, "", true, nil
	default:
		return port, addr.String(), false, nil
	}
}

// host is the name of this machine as a fully qualified mDNS host name ("box.local."). The library adds the final
// dot only to a name that does not already end in the domain, and macOS reports "box.local": left to the library
// the SRV record could not be encoded and nothing was announced. Only the first label is kept, cleaned to what a
// DNS label may hold.
func host(machine string) string {
	label, _, _ := strings.Cut(strings.TrimRight(strings.TrimSpace(machine), "."), ".")
	label = strings.Trim(strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' {
			return r
		}
		return '-'
	}, label), "-")
	if len(label) > 63 {
		label = strings.Trim(label[:63], "-")
	}
	if label == "" {
		label = "kantahe"
	}
	return label + "." + domain + "."
}

// announce says whether another machine could use the address.
func announce(a netip.Addr) bool {
	a = a.Unmap()
	return a.IsValid() && !a.IsUnspecified() && !a.IsLoopback() && !a.IsLinkLocalUnicast() && !a.IsMulticast()
}

// hostAddrs are the addresses of the interfaces that can carry multicast.
func hostAddrs() []string {
	ifaces, _ := net.Interfaces()
	var out []string
	for _, ifc := range ifaces {
		if ifc.Flags&net.FlagUp == 0 || ifc.Flags&net.FlagMulticast == 0 || ifc.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := ifc.Addrs()
		for _, a := range addrs {
			if n, ok := a.(*net.IPNet); ok {
				if ip, ok := netip.AddrFromSlice(n.IP); ok && announce(ip) {
					out = append(out, ip.Unmap().String())
				}
			}
		}
	}
	return out
}

// Advertise announces the server as name on port of listen until stop is called. A server that listens on
// loopback only is not announced (stop then does nothing). The caller decides what a failure means.
func Advertise(listen, name, version string, logger *slog.Logger) (stop func(), err error) {
	port, ip, skip, err := target(listen)
	if err != nil {
		return nil, err
	}
	if skip {
		logger.Info("not advertised on the network: the server listens on loopback only")
		return func() {}, nil
	}
	ips := []string{ip}
	if ip == "" {
		if ips = hostAddrs(); len(ips) == 0 {
			return nil, errors.New("cannot advertise on the network: no interface with an address that can carry multicast")
		}
	}
	machine, _ := os.Hostname()
	srv, err := zeroconf.RegisterProxy(name, Service, domain, port, host(machine), ips, txt(version), nil)
	if err != nil {
		return nil, fmt.Errorf("cannot advertise on the network: %w", err)
	}
	logger.Info("advertised on the network", "name", name, "port", port, "host", host(machine), "addresses", ips)
	return srv.Shutdown, nil
}
