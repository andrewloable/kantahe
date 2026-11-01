// Package config parses the server's runtime configuration from flags and
// KANTAHE_* environment variables (flags beat the environment, which beats
// the defaults).
package config

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Config is the validated runtime configuration.
type Config struct {
	Listen         string
	DataDir        string
	Libraries      []string
	SoundFont      string
	PublicURL      string
	ScoreSeconds   int
	RenderCacheGB  int
	TrustedProxies []netip.Prefix
	// Name is what clients show in a list of servers and what the server is called on the network.
	Name string
	// Discovery turns on the mDNS advertisement.
	Discovery bool
}

// maxNameBytes is the longest DNS-SD instance label.
const maxNameBytes = 63

// hostname is the machine's host name; tests replace it.
var hostname = os.Hostname

// libraries is a repeatable flag; the first use replaces the environment value.
type libraries struct {
	list    []string
	fromCLI bool
}

func (l *libraries) String() string { return strings.Join(l.list, string(filepath.ListSeparator)) }

func (l *libraries) Set(v string) error {
	if !l.fromCLI {
		l.list, l.fromCLI = nil, true
	}
	if v != "" { // an empty path would silently mean the working directory
		l.list = append(l.list, v)
	}
	return nil
}

type values struct {
	listen, data, soundfont, publicURL, score, cache, proxies, name, discovery string
	libs                                                                       libraries
}

func newFlagSet(getenv func(string) string) (*flag.FlagSet, *values) {
	pick := func(key, def string) string {
		if v := getenv(key); v != "" {
			return v
		}
		return def
	}
	v := &values{}
	for _, p := range filepath.SplitList(getenv("KANTAHE_LIBRARY")) {
		if p != "" {
			v.libs.list = append(v.libs.list, p)
		}
	}
	fs := flag.NewFlagSet("kantahe", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	fs.StringVar(&v.listen, "listen", pick("KANTAHE_LISTEN", ":8080"), "address to listen on (KANTAHE_LISTEN)")
	fs.StringVar(&v.data, "data", pick("KANTAHE_DATA", "./data"), "data directory (KANTAHE_DATA)")
	fs.Var(&v.libs, "library", "watched song folder, repeatable (KANTAHE_LIBRARY, list separated by the OS path list separator)")
	fs.StringVar(&v.soundfont, "soundfont", pick("KANTAHE_SOUNDFONT", ""), "SoundFont file replacing the built-in one (KANTAHE_SOUNDFONT)")
	fs.StringVar(&v.publicURL, "public-url", pick("KANTAHE_PUBLIC_URL", ""), "external base URL without trailing slash (KANTAHE_PUBLIC_URL)")
	fs.StringVar(&v.score, "score-seconds", pick("KANTAHE_SCORE_SECONDS", "6"), "seconds the score is shown, 0-60 (KANTAHE_SCORE_SECONDS)")
	fs.StringVar(&v.cache, "render-cache-gb", pick("KANTAHE_RENDER_CACHE_GB", "5"), "size limit of the rendered-audio cache in GB (KANTAHE_RENDER_CACHE_GB)")
	fs.StringVar(&v.proxies, "trusted-proxies", pick("KANTAHE_TRUSTED_PROXIES", ""), "comma-separated CIDRs of reverse proxies (KANTAHE_TRUSTED_PROXIES)")
	fs.StringVar(&v.name, "name", pick("KANTAHE_NAME", ""), "name shown to clients, at most 63 bytes (KANTAHE_NAME, default \"Kantahe on <host name>\")")
	fs.StringVar(&v.discovery, "discovery", pick("KANTAHE_DISCOVERY", "true"), "advertise the server on the local network so apps find it, true or false (KANTAHE_DISCOVERY)")
	return fs, v
}

// Usage returns the help text listing every flag.
func Usage() string {
	fs, _ := newFlagSet(func(string) string { return "" })
	var b strings.Builder
	b.WriteString("Usage: kantahe [flags]\n\n")
	fs.VisitAll(func(f *flag.Flag) {
		fmt.Fprintf(&b, "  --%s  %s", f.Name, f.Usage)
		if f.DefValue != "" {
			fmt.Fprintf(&b, " (default %q)", f.DefValue)
		}
		b.WriteString("\n")
	})
	return b.String()
}

// Parse reads args (without the program name) and the environment.
func Parse(args []string, getenv func(string) string) (Config, error) {
	fs, v := newFlagSet(getenv)
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return Config{}, err
		}
		return Config{}, fmt.Errorf("%w (see --help)", err)
	}
	c := Config{Listen: v.listen, DataDir: v.data, Libraries: v.libs.list, SoundFont: v.soundfont}
	var err error
	if c.ScoreSeconds, err = intIn("score-seconds", v.score, 0, 60); err != nil {
		return Config{}, err
	}
	if c.RenderCacheGB, err = intIn("render-cache-gb", v.cache, 0, 1<<20); err != nil {
		return Config{}, err
	}
	if c.PublicURL, err = publicURL(v.publicURL); err != nil {
		return Config{}, err
	}
	if c.TrustedProxies, err = prefixes(v.proxies); err != nil {
		return Config{}, err
	}
	if c.Discovery, err = strconv.ParseBool(v.discovery); err != nil {
		return Config{}, fmt.Errorf("invalid --discovery %q: want true or false", v.discovery)
	}
	if c.Name, err = serverName(v.name); err != nil {
		return Config{}, err
	}
	return c, nil
}

// serverName is the name given, or "Kantahe on <host name>" (cut to fit: a long machine name must not stop the server).
func serverName(given string) (string, error) {
	if given = strings.TrimSpace(given); given != "" {
		if len(given) > maxNameBytes {
			return "", fmt.Errorf("invalid --name %q: at most %d bytes", given, maxNameBytes)
		}
		return given, nil
	}
	host, err := hostname()
	host = strings.TrimSuffix(strings.TrimSpace(host), ".local")
	if err != nil || host == "" {
		return "Kantahe", nil
	}
	name := "Kantahe on " + host
	for len(name) > maxNameBytes {
		_, size := utf8.DecodeLastRuneInString(name)
		name = name[:len(name)-size]
	}
	return name, nil
}

func intIn(name, s string, min, max int) (int, error) {
	n, err := strconv.Atoi(s)
	if err != nil || n < min || n > max {
		return 0, fmt.Errorf("invalid --%s %q: want an integer from %d to %d", name, s, min, max)
	}
	return n, nil
}

func publicURL(s string) (string, error) {
	if s == "" {
		return "", nil
	}
	u, err := url.Parse(s)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" ||
		strings.HasSuffix(s, "/") || u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("invalid --public-url %q: want an absolute http(s) URL without a trailing slash", s)
	}
	return s, nil
}

func prefixes(s string) ([]netip.Prefix, error) {
	if strings.TrimSpace(s) == "" {
		return nil, nil
	}
	var out []netip.Prefix
	for _, part := range strings.Split(s, ",") {
		p, err := netip.ParsePrefix(strings.TrimSpace(part))
		if err != nil {
			return nil, fmt.Errorf("invalid --trusted-proxies entry %q: %w", part, err)
		}
		out = append(out, p.Masked())
	}
	return out, nil
}
