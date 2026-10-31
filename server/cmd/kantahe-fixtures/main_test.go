package main

import (
	"bytes"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/song/kar"
	"github.com/andrewloable/kantahe/server/internal/song/karmp3"
	"github.com/andrewloable/kantahe/server/internal/song/sf2"
)

func TestFixturesGenerated(t *testing.T) {
	dir := t.TempDir()
	font := filepath.Join(dir, "test.sf2")
	files, err := Generate(dir, 1, 3, 4, font)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 7 {
		t.Fatalf("files = %d, want 7: %v", len(files), files)
	}
	entries, _ := os.ReadDir(dir)
	var songs []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".kar") || strings.HasSuffix(e.Name(), ".karmp3") {
			songs = append(songs, e.Name())
		}
	}
	if len(songs) != 7 {
		t.Fatalf("song files on disk = %d: %v", len(songs), songs)
	}
	name := regexp.MustCompile(`^(\d{5}) - Artist (\d+) - Title (\d+)\.(kar|karmp3)$`)
	byNumber := map[string][]string{}
	for _, s := range songs {
		m := name.FindStringSubmatch(s)
		if m == nil {
			t.Fatalf("unexpected name %q", s)
		}
		byNumber[m[1]] = append(byNumber[m[1]], m[4])
		data, err := os.ReadFile(filepath.Join(dir, s))
		if err != nil {
			t.Fatal(err)
		}
		switch m[4] {
		case "kar":
			k, err := kar.Parse(data)
			if err != nil {
				t.Fatalf("%s: %v", s, err)
			}
			checkSong(t, s, k.Title, k.Artist, k.DurationMs, len(k.Lines))
			if !k.HasMusic {
				t.Errorf("%s has no notes", s)
			}
			if len(k.Presets) < 2 {
				t.Errorf("%s uses %d presets, want the piano and the drums", s, len(k.Presets))
			}
		case "karmp3":
			k, err := karmp3.Parse(bytes.NewReader(data), int64(len(data)))
			if err != nil {
				t.Fatalf("%s: %v", s, err)
			}
			checkSong(t, s, k.Title, k.Artist, k.DurationMs, len(k.Lines))
		}
	}
	shared := 0
	for number, kinds := range byNumber {
		sort.Strings(kinds)
		if strings.Join(kinds, ",") == "kar,karmp3" {
			shared++
			if number != "00001" {
				t.Errorf("the song in both formats is %s, want 00001", number)
			}
		}
		if len(kinds) > 2 {
			t.Errorf("number %s is used by %v", number, kinds)
		}
	}
	if shared != 1 {
		t.Errorf("%d numbers are used by both formats, want 1", shared)
	}
}

func checkSong(t *testing.T, file, title, artist string, durationMs int64, lines int) {
	t.Helper()
	m := regexp.MustCompile(`Artist (\d+) - Title (\d+)`).FindStringSubmatch(file)
	if title != "Title "+m[2] || artist != "Artist "+m[1] {
		t.Errorf("%s: title %q artist %q", file, title, artist)
	}
	if durationMs < 2000 || durationMs > 4000 {
		t.Errorf("%s lasts %d ms, want 2 to 4 s so that tests are quick", file, durationMs)
	}
	if lines != 2 {
		t.Errorf("%s has %d lyric lines, want 2", file, lines)
	}
}

func TestSoundFontHasTheUsedPresets(t *testing.T) {
	dir := t.TempDir()
	font := filepath.Join(dir, "test.sf2")
	if _, err := Generate(dir, 1, 1, 1, font); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(font)
	if err != nil {
		t.Fatal(err)
	}
	bank, err := sf2.Parse(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	have := map[[2]int]bool{}
	for _, p := range bank.Presets {
		have[[2]int{int(p.Bank), int(p.Program)}] = true
	}
	if !have[[2]int{0, 0}] || !have[[2]int{128, 0}] {
		t.Errorf("presets %v: want the piano (0/0) and the drum kit (128/0)", have)
	}
}

func TestEveryRunMakesTheSameFiles(t *testing.T) {
	a, b := t.TempDir(), t.TempDir()
	if _, err := Generate(a, 1, 2, 2, filepath.Join(a, "t.sf2")); err != nil {
		t.Fatal(err)
	}
	if _, err := Generate(b, 1, 2, 2, filepath.Join(b, "t.sf2")); err != nil {
		t.Fatal(err)
	}
	ea, _ := os.ReadDir(a)
	for _, e := range ea {
		x, _ := os.ReadFile(filepath.Join(a, e.Name()))
		y, err := os.ReadFile(filepath.Join(b, e.Name()))
		if err != nil || !bytes.Equal(x, y) {
			t.Errorf("%s differs between runs", e.Name())
		}
	}
}

func TestOnlyMP3OrOnlyMIDI(t *testing.T) {
	dir := t.TempDir()
	if files, err := Generate(dir, 1, 2, 0, filepath.Join(dir, "t.sf2")); err != nil || len(files) != 2 {
		t.Fatalf("%v %v", files, err)
	}
	dir2 := t.TempDir()
	if files, err := Generate(dir2, 1, 0, 3, filepath.Join(dir2, "t.sf2")); err != nil || len(files) != 3 {
		t.Fatalf("%v %v", files, err)
	}
}

func TestRefusesNegativeCounts(t *testing.T) {
	if _, err := Generate(t.TempDir(), 1, -1, 0, ""); err == nil {
		t.Error("a negative count is accepted")
	}
}

func TestFirstShiftsAllNumbers(t *testing.T) {
	dir := t.TempDir()
	files, err := Generate(dir, 20, 1, 2, "")
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, f := range files {
		names = append(names, filepath.Base(f))
	}
	sort.Strings(names)
	want := []string{"00020 - Artist 20 - Title 20.kar", "00020 - Artist 20 - Title 20.karmp3", "00021 - Artist 21 - Title 21.kar"}
	if strings.Join(names, "|") != strings.Join(want, "|") {
		t.Errorf("names = %v, want %v", names, want)
	}
	if _, err := Generate(dir, 0, 1, 1, ""); err == nil {
		t.Error("-first 0 is accepted")
	}
}
