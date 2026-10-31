package kar

import (
	"errors"
	"reflect"
	"testing"
	"unicode/utf8"

	"github.com/andrewloable/kantahe/server/internal/song/lyrics"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func wordsOf(l lyrics.Line) (texts []string, starts []int64) {
	for _, w := range l.Words {
		texts = append(texts, w.Text)
		starts = append(starts, w.StartMs)
	}
	return
}

func TestLyricsFromText(t *testing.T) {
	b := testfix.KAR("Song", "Singer", []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}, {Tick: 480, Text: "world"}, {Tick: 960, Text: "/Next"}})
	s, err := Parse(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Lines) != 2 {
		t.Fatalf("lines = %d, want 2", len(s.Lines))
	}
	texts, starts := wordsOf(s.Lines[0])
	if !reflect.DeepEqual(texts, []string{"Hel", "lo ", "world"}) || !reflect.DeepEqual(starts, []int64{0, 250, 500}) {
		t.Errorf("line 0: %q %v", texts, starts)
	}
	texts, starts = wordsOf(s.Lines[1])
	if !reflect.DeepEqual(texts, []string{"Next"}) || !reflect.DeepEqual(starts, []int64{1000}) {
		t.Errorf("line 1: %q %v", texts, starts)
	}
	if s.Lines[0].Words[0].EndMs != 250 {
		t.Errorf("Layout was not applied: %+v", s.Lines[0].Words[0])
	}
}

func TestParagraphMarker(t *testing.T) {
	b := testfix.KAR("T", "A", []testfix.Syllable{{Tick: 0, Text: "One"}, {Tick: 480, Text: `\Again`}})
	s, err := Parse(b)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Lines) != 2 || s.Lines[1].Words[0].Text != "Again" {
		t.Fatalf("lines: %+v", s.Lines)
	}
}

func TestMarkerOnlyEventKeepsPendingBreak(t *testing.T) {
	b := testfix.KAR("T", "A", []testfix.Syllable{{Tick: 0, Text: "One"}, {Tick: 480, Text: "/"}, {Tick: 960, Text: "Two"}})
	s, _ := Parse(b)
	if len(s.Lines) != 2 || s.Lines[1].Words[0].Text != "Two" || s.Lines[1].Words[0].StartMs != 1000 {
		t.Fatalf("lines: %+v", s.Lines)
	}
}

func TestNewlineCharactersBreakLines(t *testing.T) {
	b := testfix.KAR("T", "A", []testfix.Syllable{{Tick: 0, Text: "One\r"}, {Tick: 480, Text: "Two\n"}, {Tick: 960, Text: "Three"}, {Tick: 1200, Text: "a\r\nb"}})
	s, _ := Parse(b)
	var got [][]string
	for _, l := range s.Lines {
		texts, _ := wordsOf(l)
		got = append(got, texts)
	}
	want := [][]string{{"One"}, {"Two"}, {"Three", "a"}, {"b"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("lines = %q, want %q", got, want)
	}
}

func TestLyricEventsPreferred(t *testing.T) {
	m := testfix.MIDI{Format: 1, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Tempo(500000)},
		{Delta: 0, Data: testfix.Text("from text")},
		{Delta: 0, Data: testfix.Lyric("from lyric")},
		{Delta: 480, Data: testfix.NoteOn(0, 60, 90)},
	}}}}
	s, err := Parse(m.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Lines) != 1 || s.Lines[0].Words[0].Text != "from lyric" {
		t.Fatalf("lines: %+v", s.Lines)
	}
}

func TestLyricEventsWithOnlyMetadataFallBackToText(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Lyric("@LENGL")},
		{Delta: 0, Data: testfix.Text("shown")},
	}}}}
	s, _ := Parse(m.Bytes())
	if len(s.Lines) != 1 || s.Lines[0].Words[0].Text != "shown" {
		t.Fatalf("lines: %+v", s.Lines)
	}
}

func TestMetadata(t *testing.T) {
	s, err := Parse(testfix.KAR("  Song ", "Singer", []testfix.Syllable{{Tick: 0, Text: "a"}}))
	if err != nil {
		t.Fatal(err)
	}
	if s.Title != "Song" || s.Artist != "Singer" {
		t.Errorf("title %q artist %q", s.Title, s.Artist)
	}
}

func TestMetadataFallsBackToTrackName(t *testing.T) {
	m := testfix.MIDI{Format: 1, Division: 480, Tracks: []testfix.Track{
		{Events: []testfix.Event{{Delta: 0, Data: testfix.TrackName("Words")}}},
		{Events: []testfix.Event{{Delta: 0, Data: testfix.TrackName("Soft Karaoke")}}},
		{Events: []testfix.Event{{Delta: 0, Data: testfix.TrackName("My Title")}}},
	}}
	s, _ := Parse(m.Bytes())
	if s.Title != "" {
		t.Errorf("only tracks 0 and 1 are considered, got %q", s.Title)
	}
	m.Tracks[0] = testfix.Track{Events: []testfix.Event{{Delta: 0, Data: testfix.TrackName("My Title")}}}
	if s, _ = Parse(m.Bytes()); s.Title != "My Title" || s.Artist != "" {
		t.Errorf("title %q artist %q", s.Title, s.Artist)
	}
	m.Tracks[0] = testfix.Track{Events: []testfix.Event{{Delta: 0, Data: testfix.TrackName("words")}}}
	m.Tracks[1] = testfix.Track{Events: []testfix.Event{{Delta: 0, Data: testfix.TrackName("Real Name")}}}
	if s, _ = Parse(m.Bytes()); s.Title != "Real Name" {
		t.Errorf("got %q", s.Title)
	}
}

func TestOnlyOneTitleLine(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Text("@TOnly")},
	}}}}
	s, _ := Parse(m.Bytes())
	if s.Title != "Only" || s.Artist != "" {
		t.Errorf("title %q artist %q", s.Title, s.Artist)
	}
}

func TestWindows1252(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Text("@Tcaf\xe9")},
		{Delta: 0, Data: testfix.Text("\xe9t\xe9")},
	}}}}
	s, _ := Parse(m.Bytes())
	if s.Title != "café" || s.Lines[0].Words[0].Text != "été" {
		t.Errorf("title %q lyric %q", s.Title, s.Lines[0].Words[0].Text)
	}
	m.Tracks[0].Events[1].Data = testfix.Text("été") // valid UTF-8 stays as is
	if s, _ = Parse(m.Bytes()); s.Lines[0].Words[0].Text != "été" {
		t.Errorf("utf-8 changed: %q", s.Lines[0].Words[0].Text)
	}
}

func TestNoMusic(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Text("la")},
		{Delta: 0, Data: testfix.NoteOn(0, 60, 0)}, // velocity 0 is a note-off
	}}}}
	s, err := Parse(m.Bytes())
	if err != nil || s.HasMusic {
		t.Fatalf("HasMusic = %v, err %v; want false", s.HasMusic, err)
	}
	if s, _ = Parse(testfix.KAR("T", "A", []testfix.Syllable{{Tick: 0, Text: "a"}})); !s.HasMusic {
		t.Error("KAR fixture has notes, HasMusic should be true")
	}
}

// onlyNotes is a one-track file with the given note-ons (channel, key, velocity) and no program changes.
func onlyNotes(notes ...[3]byte) []byte {
	ev := []testfix.Event{{Delta: 0, Data: testfix.Text("la")}}
	for _, n := range notes {
		ev = append(ev, testfix.Event{Delta: 10, Data: testfix.NoteOn(n[0], n[1], n[2])})
	}
	return testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: ev}}}.Bytes()
}

// The karaoke cards carry lyric timing on channel 16 (key 14 at velocity 1, key 0) and a pitch guide at velocity 1:
// a file with only those has no instrument, and plays as silence.
func TestGuideNotesAreNotMusic(t *testing.T) {
	cases := []struct {
		name  string
		notes [][3]byte
		want  bool
	}{
		{"lyric cues and a pitch guide only", [][3]byte{{15, 0, 64}, {15, 14, 1}, {15, 14, 1}, {15, 74, 1}, {15, 71, 1}}, false},
		{"velocity 7 is too quiet", [][3]byte{{0, 60, 7}}, false},
		{"velocity 8 is heard", [][3]byte{{0, 60, 8}}, true},
		{"key 11 is below the audible range", [][3]byte{{0, 11, 100}}, false},
		{"key 12 is the lowest heard", [][3]byte{{0, 12, 100}}, true},
		{"one real note among the cues is music", [][3]byte{{15, 14, 1}, {0, 60, 90}, {15, 14, 1}}, true},
		{"drums count", [][3]byte{{9, 36, 100}}, true},
	}
	for _, c := range cases {
		s, err := Parse(onlyNotes(c.notes...))
		if err != nil || s.HasMusic != c.want {
			t.Errorf("%s: HasMusic = %v, err %v; want %v", c.name, s != nil && s.HasMusic, err, c.want)
		}
	}
}

// HasAudibleNotes answers the same question as Parse, without laying out the lyrics: the library asks it of
// thousands of files at once.
func TestHasAudibleNotesAgreesWithParse(t *testing.T) {
	for _, notes := range [][][3]byte{{{15, 14, 1}, {15, 74, 1}}, {{0, 60, 90}}, {{0, 60, 7}}, nil} {
		body := onlyNotes(notes...)
		s, err := Parse(body)
		got, gerr := HasAudibleNotes(body)
		if err != nil || gerr != nil || got != s.HasMusic {
			t.Errorf("%v: HasAudibleNotes = %v (%v), Parse says %v (%v)", notes, got, gerr, s.HasMusic, err)
		}
	}
	if _, err := HasAudibleNotes([]byte("not midi")); err == nil {
		t.Error("a file that is not MIDI is an error")
	}
}

func TestDuration(t *testing.T) {
	m := testfix.MIDI{Format: 1, Division: 480, Tracks: []testfix.Track{
		{Events: []testfix.Event{{Delta: 0, Data: testfix.Tempo(500000)}}},
		{Events: []testfix.Event{{Delta: 1920, Data: testfix.NoteOff(0, 60)}}},
	}}
	s, _ := Parse(m.Bytes())
	if s.DurationMs != 2000 {
		t.Errorf("duration = %d, want 2000", s.DurationMs)
	}
}

func TestParseErrors(t *testing.T) {
	if _, err := Parse([]byte("not midi")); !errors.Is(err, ErrMalformed) {
		t.Errorf("err = %v", err)
	}
}

func TestNoLyricsIsNotAnError(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Delta: 0, Data: testfix.NoteOn(0, 60, 90)}}}}}
	s, err := Parse(m.Bytes())
	if err != nil || len(s.Lines) != 0 || !s.HasMusic {
		t.Fatalf("%+v %v", s, err)
	}
}

func FuzzParse(f *testing.F) {
	f.Add(testfix.KAR("Song", "Singer", []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}}))
	f.Add(testfix.MIDI{Format: 0, Division: 96, Tracks: []testfix.Track{{Events: []testfix.Event{{Delta: 0, Data: testfix.Tempo(400000)}, {Delta: 5, Data: testfix.Lyric("x")}}}}}.Bytes())
	f.Add(rawSMF(1, 480, []byte{0x00, 0x90, 0x3C, 0x40, 0x10, 0x3E, 0x40}))
	f.Add([]byte("MThd"))
	f.Fuzz(func(t *testing.T, b []byte) {
		_, _ = Parse(b)
	})
}

func TestDecodeAlwaysProducesValidUTF8(t *testing.T) {
	all := make([]byte, 0, 256)
	for i := 0; i < 256; i++ {
		all = append(all, byte(i))
	}
	for name, in := range map[string][]byte{"all bytes": all, "high bytes": all[0x80:], "truncated utf-8": []byte("caf\xc3"), "lone continuation": {0x80}} {
		if got := decode(in); !utf8.ValidString(got) {
			t.Errorf("%s: decode produced invalid UTF-8 %q", name, got)
		}
	}
	s, err := Parse(testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Text("@T\x81\x8d\xff")}, {Delta: 0, Data: testfix.Text("\x90\x9d")},
	}}}}.Bytes())
	if err != nil || !utf8.ValidString(s.Title) || !utf8.ValidString(s.Lines[0].Words[0].Text) {
		t.Fatalf("invalid UTF-8 in song: %q %q %v", s.Title, s.Lines, err)
	}
}
