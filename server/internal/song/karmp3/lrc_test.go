package karmp3

import (
	"reflect"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/song/lyrics"
)

type wd = lyrics.Word

func TestParseLRC(t *testing.T) {
	tags, lines := ParseLRC("[ti:T]\n[00:01.00]<00:01.00>He<00:01.50>llo <00:02.00>you\n[00:05.00]<00:05.00>Next")
	if tags["ti"] != "T" {
		t.Errorf("tags = %v", tags)
	}
	want := [][]wd{
		{{Text: "He", StartMs: 1000}, {Text: "llo ", StartMs: 1500}, {Text: "you", StartMs: 2000}},
		{{Text: "Next", StartMs: 5000}},
	}
	if !reflect.DeepEqual(lines, want) {
		t.Fatalf("lines = %+v, want %+v", lines, want)
	}
}

func TestLRCLineWithoutWordMarks(t *testing.T) {
	_, lines := ParseLRC("[00:03.5]Hello")
	if want := [][]wd{{{Text: "Hello", StartMs: 3500}}}; !reflect.DeepEqual(lines, want) {
		t.Fatalf("lines = %+v, want %+v", lines, want)
	}
}

func TestLRCFractions(t *testing.T) {
	cases := map[string]int64{"[00:01]a": 1000, "[00:01.5]a": 1500, "[00:01.50]a": 1500, "[00:01.500]a": 1500, "[00:01.05]a": 1050, "[00:01.005]a": 1005, "[01:02.03]a": 62030, "[100:00.00]a": 6000000}
	for in, want := range cases {
		_, lines := ParseLRC(in)
		if len(lines) != 1 || lines[0][0].StartMs != want {
			t.Errorf("%s: %+v, want start %d", in, lines, want)
		}
	}
}

func TestLRCTextBeforeFirstWordMarkBelongsToLineMark(t *testing.T) {
	_, lines := ParseLRC("[00:01.00]Intro <00:02.00>word")
	want := [][]wd{{{Text: "Intro ", StartMs: 1000}, {Text: "word", StartMs: 2000}}}
	if !reflect.DeepEqual(lines, want) {
		t.Fatalf("lines = %+v", lines)
	}
}

func TestLRCDropsLinesWithoutTextAndHandlesCRLF(t *testing.T) {
	tags, lines := ParseLRC("\ufeff[ar:A]\r\n[00:01.00]\r\n[00:02.00]  \r\n\r\n[00:03.00]Hi  \r\nplain text line\r\n")
	if tags["ar"] != "A" {
		t.Errorf("BOM or CRLF broke the tag: %v", tags)
	}
	want := [][]wd{{{Text: "Hi", StartMs: 3000}}}
	if !reflect.DeepEqual(lines, want) {
		t.Fatalf("lines = %+v", lines)
	}
}

func TestLRCMultipleLineStampsAndSorting(t *testing.T) {
	_, lines := ParseLRC("[00:10.00][00:20.00]Chorus\n[00:05.00]Verse")
	if len(lines) != 3 || lines[0][0].Text != "Verse" || lines[1][0].StartMs != 10000 || lines[2][0].StartMs != 20000 {
		t.Fatalf("lines = %+v", lines)
	}
}

func TestLRCTagsNotTimes(t *testing.T) {
	tags, lines := ParseLRC("[ti: Title ]\n[al:Album]\n[by:me]\n[offset:+250]\n[length: 03:20]")
	if tags["ti"] != "Title" || tags["al"] != "Album" || tags["offset"] != "+250" || tags["length"] != "03:20" || len(lines) != 0 {
		t.Fatalf("tags = %v lines = %v", tags, lines)
	}
}

func TestLRCMalformedMarksAreText(t *testing.T) {
	_, lines := ParseLRC("[00:01.00]a <b> [c] <00:xx>d <00:02.00")
	if len(lines) != 1 || lines[0][0].Text != "a <b> [c] <00:xx>d <00:02.00" {
		t.Fatalf("lines = %+v", lines)
	}
}

func TestLRCHugeNumbersDoNotOverflow(t *testing.T) {
	_, lines := ParseLRC("[99999999999999999999:00.00]x\n[00:99999999999999999999]y")
	for _, l := range lines {
		if l[0].StartMs < 0 {
			t.Fatalf("negative time %d", l[0].StartMs)
		}
	}
}

func FuzzParseLRC(f *testing.F) {
	f.Add("[ti:T]\n[00:01.00]<00:01.00>He<00:01.50>llo")
	f.Add("[00:01.5]a[00:02]b<")
	f.Add("<<<>>>[[[]]]")
	f.Fuzz(func(t *testing.T, s string) {
		_, lines := ParseLRC(s)
		for _, l := range lines {
			if len(l) == 0 {
				t.Fatal("empty line returned")
			}
		}
	})
}
