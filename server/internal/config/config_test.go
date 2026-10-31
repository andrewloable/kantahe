package config

import (
	"net/netip"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestParseDefaults(t *testing.T) {
	c, err := Parse(nil, env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if c.Listen != ":8080" || c.DataDir != "./data" || c.ScoreSeconds != 6 || c.RenderCacheGB != 5 {
		t.Fatalf("defaults wrong: %+v", c)
	}
	if len(c.Libraries) != 0 || len(c.TrustedProxies) != 0 || c.SoundFont != "" || c.PublicURL != "" {
		t.Fatalf("expected empty optional fields: %+v", c)
	}
}

func TestFlagsOverrideEnv(t *testing.T) {
	e := env(map[string]string{"KANTAHE_LISTEN": ":9000"})
	c, err := Parse([]string{"--listen", ":7000"}, e)
	if err != nil || c.Listen != ":7000" {
		t.Fatalf("flag should win: %q, %v", c.Listen, err)
	}
	c, err = Parse(nil, e)
	if err != nil || c.Listen != ":9000" {
		t.Fatalf("env should beat default: %q, %v", c.Listen, err)
	}
}

func TestEnvAllSettings(t *testing.T) {
	e := env(map[string]string{
		"KANTAHE_DATA":            "/d",
		"KANTAHE_SOUNDFONT":       "/sf.sf2",
		"KANTAHE_PUBLIC_URL":      "https://k.example",
		"KANTAHE_SCORE_SECONDS":   "9",
		"KANTAHE_RENDER_CACHE_GB": "0",
		"KANTAHE_TRUSTED_PROXIES": "10.0.0.0/8",
	})
	c, err := Parse(nil, e)
	if err != nil {
		t.Fatal(err)
	}
	if c.DataDir != "/d" || c.SoundFont != "/sf.sf2" || c.PublicURL != "https://k.example" ||
		c.ScoreSeconds != 9 || c.RenderCacheGB != 0 || len(c.TrustedProxies) != 1 {
		t.Fatalf("env not applied: %+v", c)
	}
}

func TestRepeatableLibrary(t *testing.T) {
	c, err := Parse([]string{"--library", "/a", "--library", "/b"}, env(nil))
	if err != nil || !reflect.DeepEqual(c.Libraries, []string{"/a", "/b"}) {
		t.Fatalf("flags: %v, %v", c.Libraries, err)
	}
	sep := string(filepath.ListSeparator)
	c, err = Parse(nil, env(map[string]string{"KANTAHE_LIBRARY": "/a" + sep + "/b"}))
	if err != nil || !reflect.DeepEqual(c.Libraries, []string{"/a", "/b"}) {
		t.Fatalf("env: %v, %v", c.Libraries, err)
	}
	c, err = Parse([]string{"--library", "/c"}, env(map[string]string{"KANTAHE_LIBRARY": "/a" + sep + "/b"}))
	if err != nil || !reflect.DeepEqual(c.Libraries, []string{"/c"}) {
		t.Fatalf("flag should replace env: %v, %v", c.Libraries, err)
	}
}

func TestInvalidScoreSeconds(t *testing.T) {
	for _, v := range []string{"61", "-1", "abc"} {
		_, err := Parse([]string{"--score-seconds", v}, env(nil))
		if err == nil || !strings.Contains(err.Error(), "score-seconds") {
			t.Errorf("--score-seconds %s: err = %v", v, err)
		}
	}
	for _, v := range []string{"0", "60"} {
		if _, err := Parse([]string{"--score-seconds", v}, env(nil)); err != nil {
			t.Errorf("--score-seconds %s: %v", v, err)
		}
	}
	if _, err := Parse(nil, env(map[string]string{"KANTAHE_SCORE_SECONDS": "99"})); err == nil ||
		!strings.Contains(err.Error(), "score-seconds") {
		t.Errorf("env value should be validated too: %v", err)
	}
}

func TestInvalidRenderCache(t *testing.T) {
	_, err := Parse([]string{"--render-cache-gb", "-1"}, env(nil))
	if err == nil || !strings.Contains(err.Error(), "render-cache-gb") {
		t.Fatalf("err = %v", err)
	}
}

func TestInvalidPublicURL(t *testing.T) {
	for _, v := range []string{"ftp://x", "https://k.example/", "k.example", "https://", "/rel"} {
		_, err := Parse([]string{"--public-url", v}, env(nil))
		if err == nil || !strings.Contains(err.Error(), "public-url") {
			t.Errorf("--public-url %q: err = %v", v, err)
		}
	}
	for _, v := range []string{"http://k.example:8080", "https://k.example"} {
		if _, err := Parse([]string{"--public-url", v}, env(nil)); err != nil {
			t.Errorf("--public-url %q: %v", v, err)
		}
	}
}

func TestTrustedProxies(t *testing.T) {
	c, err := Parse([]string{"--trusted-proxies", "10.0.0.0/8,192.168.1.1/32"}, env(nil))
	if err != nil {
		t.Fatal(err)
	}
	want := []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8"), netip.MustParsePrefix("192.168.1.1/32")}
	if !reflect.DeepEqual(c.TrustedProxies, want) {
		t.Fatalf("got %v want %v", c.TrustedProxies, want)
	}
	_, err = Parse([]string{"--trusted-proxies", "nope"}, env(nil))
	if err == nil || !strings.Contains(err.Error(), "trusted-proxies") {
		t.Fatalf("err = %v", err)
	}
}

func TestUnknownFlagAndHelp(t *testing.T) {
	if _, err := Parse([]string{"--nope"}, env(nil)); err == nil || !strings.Contains(err.Error(), "nope") {
		t.Fatalf("err = %v", err)
	}
	if _, err := Parse([]string{"--help"}, env(nil)); err == nil {
		t.Fatal("--help should return an error so that main can print the usage")
	}
	if !strings.Contains(Usage(), "--listen") {
		t.Fatalf("usage lacks flags: %q", Usage())
	}
}

func TestRegression_EmptyLibraryEntriesDropped(t *testing.T) {
	sep := string(filepath.ListSeparator)
	c, err := Parse(nil, env(map[string]string{"KANTAHE_LIBRARY": "/a" + sep + sep + "/b" + sep}))
	if err != nil || !reflect.DeepEqual(c.Libraries, []string{"/a", "/b"}) {
		t.Fatalf("got %q, %v; an empty entry would mean the working directory", c.Libraries, err)
	}
	c, err = Parse([]string{"--library", ""}, env(nil))
	if err != nil || len(c.Libraries) != 0 {
		t.Fatalf("empty --library should be ignored: %q, %v", c.Libraries, err)
	}
}

func TestEveryFlagBeatsEnv(t *testing.T) {
	e := env(map[string]string{
		"KANTAHE_LISTEN": ":1", "KANTAHE_DATA": "/e", "KANTAHE_SOUNDFONT": "/e.sf2",
		"KANTAHE_PUBLIC_URL": "https://e.example", "KANTAHE_SCORE_SECONDS": "1",
		"KANTAHE_RENDER_CACHE_GB": "1", "KANTAHE_TRUSTED_PROXIES": "10.0.0.0/8",
	})
	c, err := Parse([]string{
		"--listen", ":2", "--data", "/f", "--soundfont", "/f.sf2", "--public-url", "https://f.example",
		"--score-seconds", "2", "--render-cache-gb", "2", "--trusted-proxies", "172.16.0.0/12",
	}, e)
	if err != nil {
		t.Fatal(err)
	}
	want := Config{Listen: ":2", DataDir: "/f", SoundFont: "/f.sf2", PublicURL: "https://f.example",
		ScoreSeconds: 2, RenderCacheGB: 2, TrustedProxies: []netip.Prefix{netip.MustParsePrefix("172.16.0.0/12")}}
	if !reflect.DeepEqual(c, want) {
		t.Fatalf("got %+v\nwant %+v", c, want)
	}
}
