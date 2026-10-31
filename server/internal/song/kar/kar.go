package kar

import (
	"sort"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"

	"github.com/andrewloable/kantahe/server/internal/song/lyrics"
)

// A note is heard when it is at least this loud and this high. The karaoke cards keep lyric timing (key 14 at
// velocity 1, key 0) and a pitch guide (velocity 1) on channel 16: a file with only those plays as silence.
const (
	MinAudibleVelocity = 8
	MinAudibleKey      = 12
)

// Song is everything the library needs from a .kar file.
type Song struct {
	Title, Artist string
	DurationMs    int64
	HasMusic      bool // at least one audible note-on (see MinAudibleVelocity, MinAudibleKey)
	Lines         []lyrics.Line
	Presets       []Preset
}

func audible(e Event) bool {
	return e.Status&0xF0 == 0x90 && e.Status < 0xF0 && len(e.Data) == 2 && e.Data[1] >= MinAudibleVelocity && e.Data[0] >= MinAudibleKey
}

func hasAudible(smf *SMF) bool {
	for _, tr := range smf.Tracks {
		for _, e := range tr {
			if audible(e) {
				return true
			}
		}
	}
	return false
}

// HasAudibleNotes reports whether a .kar has at least one audible note, as Song.HasMusic does, without
// reading its lyrics, title or tempo: it is cheap enough to ask of every file of a large library.
func HasAudibleNotes(b []byte) (bool, error) {
	smf, err := ParseSMF(b)
	if err != nil {
		return false, err
	}
	return hasAudible(smf), nil
}

// Parse reads a .kar file. A file with no lyrics is not an error.
func Parse(b []byte) (*Song, error) {
	smf, err := ParseSMF(b)
	if err != nil {
		return nil, err
	}
	tm := newTempoMap(smf)
	s := &Song{Presets: usedPresets(smf)}

	var last uint64
	for _, tr := range smf.Tracks {
		for _, e := range tr {
			last = max(last, e.Tick)
		}
	}
	s.HasMusic = hasAudible(smf)
	s.DurationMs = tm.TickToMs(last)
	s.Title, s.Artist = metadata(smf)
	s.Lines = lyrics.Layout(syllables(smf, tm))
	return s, nil
}

// decode returns valid UTF-8 as is and otherwise reads the bytes as Windows-1252.
func decode(b []byte) string {
	if utf8.Valid(b) {
		return string(b)
	}
	out, err := charmap.Windows1252.NewDecoder().Bytes(b)
	if err != nil {
		return strings.ToValidUTF8(string(b), "?")
	}
	return string(out)
}

type textEvent struct {
	tick  uint64
	track int
	text  string
}

// metaTexts returns the decoded payloads of meta events of one type, ordered by time.
func metaTexts(smf *SMF, metaType byte) []textEvent {
	var out []textEvent
	for ti, tr := range smf.Tracks {
		for _, e := range tr {
			if e.Status == 0xFF && e.MetaType == metaType {
				out = append(out, textEvent{e.Tick, ti, decode(e.Data)})
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].tick < out[j].tick })
	return out
}

func clean(s string) string { return strings.TrimSpace(strings.Trim(s, "\x00")) }

// metadata reads the first two @T lines (title, artist), else the first track
// name of track 0 or 1 that is not "Words" or "Soft Karaoke".
func metadata(smf *SMF) (title, artist string) {
	var ts []string
	for _, e := range metaTexts(smf, 0x01) {
		if strings.HasPrefix(e.text, "@T") {
			ts = append(ts, clean(strings.TrimPrefix(e.text, "@T")))
		}
	}
	if len(ts) > 0 {
		title = ts[0]
	}
	if len(ts) > 1 {
		artist = ts[1]
	}
	if title != "" {
		return title, artist
	}
	for _, e := range metaTexts(smf, 0x03) {
		if e.track > 1 {
			continue
		}
		name := clean(e.text)
		if lower := strings.ToLower(name); name != "" && lower != "words" && lower != "soft karaoke" {
			return name, artist
		}
	}
	return "", artist
}

// syllables turns lyric (FF 05) or, failing that, text (FF 01) events into words
// grouped by line, with start times in milliseconds.
func syllables(smf *SMF, tm *tempoMap) [][]lyrics.Word {
	pick := func(metaType byte) []textEvent {
		var out []textEvent
		for _, e := range metaTexts(smf, metaType) {
			if !strings.HasPrefix(e.text, "@") {
				out = append(out, e)
			}
		}
		return out
	}
	evs := pick(0x05)
	if len(evs) == 0 {
		evs = pick(0x01)
	}

	var lines [][]lyrics.Word
	var cur []lyrics.Word
	pending := false
	emit := func(text string, tick uint64) {
		if text == "" {
			return
		}
		if pending && len(cur) > 0 {
			lines = append(lines, cur)
			cur = nil
		}
		pending = false
		cur = append(cur, lyrics.Word{Text: text, StartMs: tm.TickToMs(tick)})
	}
	for _, e := range evs {
		text := e.text
		if text != "" && (text[0] == '/' || text[0] == '\\') {
			pending = true
			text = text[1:]
		}
		// \r and \n end the line after the text before them
		start := 0
		for i := 0; i < len(text); i++ {
			if text[i] == '\r' || text[i] == '\n' {
				emit(text[start:i], e.tick)
				pending = true
				start = i + 1
			}
		}
		emit(text[start:], e.tick)
	}
	if len(cur) > 0 {
		lines = append(lines, cur)
	}
	return lines
}
