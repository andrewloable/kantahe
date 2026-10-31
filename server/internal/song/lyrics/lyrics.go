// Package lyrics computes the display timing of lyrics once on the server
// (plan D1): word wipe ends, line spans and the active line. It does no I/O;
// the .kar and .lrc parsers feed it words with start times only.
package lyrics

import (
	"sort"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

const (
	minWipeMs     = 50
	defaultGapMs  = 500
	minLastWipeMs = 300
	maxLastWipeMs = 1200
	leadMs        = 50
)

// Word is one syllable or word; EndMs is where its colour wipe ends.
type Word struct {
	Text    string
	StartMs int64
	EndMs   int64
}

// Line is a displayed line; it starts at its first word and ends when its
// last word's wipe ends.
type Line struct {
	StartMs int64
	EndMs   int64
	Words   []Word
}

// Layout drops empty lines and fills in every word's EndMs and every line's
// span. Input words carry Text and StartMs only; their order is kept.
func Layout(lines [][]Word) []Line {
	var kept [][]Word
	for _, l := range lines {
		if len(l) > 0 {
			kept = append(kept, l)
		}
	}
	out := make([]Line, len(kept))
	for i, in := range kept {
		words := append([]Word(nil), in...)
		for j := 0; j+1 < len(words); j++ {
			words[j].EndMs = max(words[j+1].StartMs, words[j].StartMs+minWipeMs)
		}
		last := &words[len(words)-1]
		wipe := lastWipe(words)
		end := last.StartMs + wipe
		if i+1 < len(kept) {
			end = min(end, max(kept[i+1][0].StartMs, last.StartMs+minWipeMs))
		}
		last.EndMs = end
		out[i] = Line{StartMs: words[0].StartMs, EndMs: end, Words: words}
	}
	return out
}

// lastWipe is the median positive gap between consecutive word starts,
// clamped to 0.3-1.2 s (500 ms when the line has no positive gap).
func lastWipe(words []Word) int64 {
	var gaps []int64
	for j := 0; j+1 < len(words); j++ {
		if g := words[j+1].StartMs - words[j].StartMs; g > 0 {
			gaps = append(gaps, g)
		}
	}
	wipe := int64(defaultGapMs)
	if len(gaps) > 0 {
		sort.Slice(gaps, func(a, b int) bool { return gaps[a] < gaps[b] })
		wipe = gaps[len(gaps)/2]
	}
	return min(max(wipe, minLastWipeMs), maxLastWipeMs)
}

// ActiveLine returns the index of the last line starting at or before tMs plus
// a 50 ms lead, or -1 before the first line. Lines must be ordered by start.
func ActiveLine(lines []Line, tMs int64) int {
	return sort.Search(len(lines), func(i int) bool { return lines[i].StartMs > tMs+leadMs }) - 1
}

// ToProto converts laid-out lines into the Lyrics message.
func ToProto(number, source string, durationMs int64, lines []Line) *kantahev1.Lyrics {
	msg := &kantahev1.Lyrics{Number: number, Source: source, DurationMs: durationMs}
	for _, l := range lines {
		pl := &kantahev1.LyricLine{StartMs: l.StartMs, EndMs: l.EndMs}
		for _, w := range l.Words {
			pl.Words = append(pl.Words, &kantahev1.LyricWord{Text: w.Text, StartMs: w.StartMs, EndMs: w.EndMs})
		}
		msg.Lines = append(msg.Lines, pl)
	}
	return msg
}
