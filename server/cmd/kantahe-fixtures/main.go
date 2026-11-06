// Command kantahe-fixtures writes a small synthetic song library and a tiny
// SoundFont, for the end-to-end tests. Nothing it writes is a real song.
//
//	kantahe-fixtures -out DIR -mp3 3 -midi 4 -sf2 DIR/test.sf2 [-first 1] [-guide 90]
//
// Files are named "00001 - Artist 1 - Title 1.karmp3" (or .kar). The first song
// exists in both formats under the same number; the other MIDI songs follow the
// MP3 numbers. -first sets the number of that first song, so that two sets can
// live in one library without being the same songs. Every song lasts 2 to 4 seconds and has two lines of lyrics.
// -guide N adds one more song, number N: it has a vocals track and four lines of lyrics (the third starts at 3 s) and lasts 9 s, for
// checking amateur singer mode.
package main

import (
	"flag"
	"fmt"
	"math"
	"os"
	"path/filepath"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func main() {
	out := flag.String("out", "", "directory to write the songs into (created if missing)")
	mp3 := flag.Int("mp3", 3, "number of .karmp3 songs")
	midi := flag.Int("midi", 4, "number of .kar songs (the first is the same song as the first .karmp3)")
	font := flag.String("sf2", "", "where to write the test SoundFont (not written when empty)")
	first := flag.Int("first", 1, "the number of the first song")
	guide := flag.Int("guide", 0, "the number of one more song with a vocals track and four lyric lines (0: none)")
	flag.Parse()
	if *out == "" {
		fmt.Fprintln(os.Stderr, "kantahe-fixtures: -out is required")
		os.Exit(2)
	}
	files, err := Generate(*out, *first, *mp3, *midi, *font)
	if err != nil {
		fmt.Fprintln(os.Stderr, "kantahe-fixtures:", err)
		os.Exit(1)
	}
	if *guide != 0 {
		f, err := GenerateGuideSong(*out, *guide)
		if err != nil {
			fmt.Fprintln(os.Stderr, "kantahe-fixtures:", err)
			os.Exit(1)
		}
		files = append(files, f)
	}
	for _, f := range files {
		fmt.Println(f)
	}
}

// GenerateGuideSong writes one .karmp3 of 9 s into dir that has a vocals track and four lines of lyrics, at 1, 2, 3 and 4 s, so that the guide of
// amateur singer mode (until the start of the third line, 3 s) can be seen on a device. It returns the path.
func GenerateGuideSong(dir string, n int) (string, error) {
	if n < 1 || n > 99999 {
		return "", fmt.Errorf("the guide song's number must be from 1 to 99999, not %d", n)
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	title, artist := fmt.Sprintf("Title %d", n), fmt.Sprintf("Artist %d", n)
	base := fmt.Sprintf("%05d - %s - %s", n, artist, title)
	lrc := fmt.Sprintf("[ti:%s]\n[ar:%s]\n"+
		"[00:01.00]<00:01.00>First <00:01.50>line\n"+
		"[00:02.00]<00:02.00>Second <00:02.50>line\n"+
		"[00:03.00]<00:03.00>Third <00:03.50>line\n"+
		"[00:04.00]<00:04.00>Fourth <00:04.50>line\n", title, artist)
	nfo := fmt.Sprintf("Title : %s\nArtist : %s\nInstrumental : %s.mp3\nVocals : %s.vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\nTiming by : word\n", title, artist, base, base)
	data := testfix.KARMP3WithVocals(base, testfix.MP3Frames(350), testfix.MP3Frames(330), lrc, nfo)
	path := filepath.Join(dir, fileName(n, "karmp3"))
	return path, os.WriteFile(path, data, 0o644)
}

// Generate writes the songs into dir and the SoundFont to fontPath (when not
// empty) and returns the paths of the song files. The songs are numbered from
// first. The output is the same on every run.
func Generate(dir string, first, mp3, midi int, fontPath string) ([]string, error) {
	if mp3 < 0 || midi < 0 {
		return nil, fmt.Errorf("the counts cannot be negative (-mp3 %d, -midi %d)", mp3, midi)
	}
	if first < 1 || first > 99990 {
		return nil, fmt.Errorf("-first must be from 1 to 99990, not %d", first)
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	var files []string
	write := func(name string, data []byte) error {
		path := filepath.Join(dir, name)
		files = append(files, path)
		return os.WriteFile(path, data, 0o644)
	}
	for n := first; n < first+mp3; n++ {
		if err := write(fileName(n, "karmp3"), makeKARMP3(n)); err != nil {
			return nil, err
		}
	}
	for j := 1; j <= midi; j++ {
		// the first MIDI song is song 1 again; the others continue after the MP3 songs
		n := first
		if j > 1 {
			n = first + max(mp3, 1) + (j - 2)
		}
		if err := write(fileName(n, "kar"), makeKAR(n)); err != nil {
			return nil, err
		}
	}
	if fontPath != "" {
		if err := os.MkdirAll(filepath.Dir(fontPath), 0o755); err != nil {
			return nil, err
		}
		if err := os.WriteFile(fontPath, soundFont(), 0o644); err != nil {
			return nil, err
		}
	}
	return files, nil
}

func fileName(n int, ext string) string {
	return fmt.Sprintf("%05d - Artist %d - Title %d.%s", n, n, n, ext)
}

// makeKAR is a song of about 3.5 s: two lines, a piano melody and a drum beat.
func makeKAR(n int) []byte {
	return testfix.KAR(fmt.Sprintf("Title %d", n), fmt.Sprintf("Artist %d", n), []testfix.Syllable{
		{Tick: 0, Text: "/Sing "},
		{Tick: 480, Text: "along "},
		{Tick: 960, Text: "to "},
		{Tick: 1200, Text: "song "},
		{Tick: 1920, Text: "/Number "},
		{Tick: 2400, Text: fmt.Sprintf("%d ", n)},
		{Tick: 2640, Text: "now"},
	})
}

// makeKARMP3 is silence of 3.1 s with the same lyrics as the kar, as an LRC file.
func makeKARMP3(n int) []byte {
	title, artist := fmt.Sprintf("Title %d", n), fmt.Sprintf("Artist %d", n)
	lrc := fmt.Sprintf("[ti:%s]\n[ar:%s]\n"+
		"[00:00.00]<00:00.00>Sing <00:00.50>along <00:01.00>to <00:01.30>song\n"+
		"[00:02.00]<00:02.00>Number <00:02.50>%d <00:02.80>now\n", title, artist, n)
	nfo := fmt.Sprintf("Title : %s\nArtist : %s\n", title, artist)
	return testfix.KARMP3(fmt.Sprintf("%05d - %s - %s", n, artist, title), testfix.MP3Frames(120), lrc, nfo)
}

// soundFont has a piano (bank 0, program 0) and a drum kit (bank 128, program 0),
// the two presets the songs use, each with one short sine sample.
func soundFont() []byte {
	tone := func(hz float64, samples int) []int16 {
		out := make([]int16, samples)
		for i := range out {
			out[i] = int16(8000 * math.Sin(2*math.Pi*hz*float64(i)/22050))
		}
		return out
	}
	return testfix.SF2([]testfix.Preset{
		{Name: "Piano", Bank: 0, Program: 0, Samples: [][]int16{tone(262, 11025)}},
		{Name: "Drums", Bank: 128, Program: 0, Samples: [][]int16{tone(80, 4410)}},
	})
}
