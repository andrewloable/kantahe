package karmp3

import (
	"sort"
	"strings"

	"github.com/andrewloable/kantahe/server/internal/song/lyrics"
)

// ParseLRC reads an LRC file: tags like [ti:Title], line stamps [mm:ss.xx] and
// word stamps <mm:ss.xx>. Text after a stamp belongs to that stamp. A line
// without word stamps is one word at the line time. Lines without text are
// dropped and the lines come back ordered by start time.
func ParseLRC(text string) (map[string]string, [][]lyrics.Word) {
	tags := map[string]string{}
	var lines [][]lyrics.Word
	for _, raw := range strings.Split(strings.TrimPrefix(text, "\xef\xbb\xbf"), "\n") {
		line := strings.TrimRight(raw, "\r")
		var stamps []int64
		for strings.HasPrefix(line, "[") {
			end := strings.IndexByte(line, ']')
			if end < 0 {
				break
			}
			inside := line[1:end]
			if ms, ok := parseStamp(inside); ok {
				stamps = append(stamps, ms)
				line = line[end+1:]
				continue
			}
			if k, v, ok := parseTag(inside); ok && len(stamps) == 0 {
				tags[k] = v
				line = ""
			}
			break
		}
		for _, ms := range stamps {
			if words := lineWords(line, ms, ms-stamps[0]); len(words) > 0 {
				lines = append(lines, words)
			}
		}
	}
	sort.SliceStable(lines, func(i, j int) bool { return lines[i][0].StartMs < lines[j][0].StartMs })
	return tags, lines
}

// lineWords splits the text after a line stamp at its <mm:ss.xx> word stamps.
// shift moves the word stamps of a repeated line (several stamps on one line).
func lineWords(rest string, lineMs, shift int64) []lyrics.Word {
	type seg struct {
		ms   int64
		text string
	}
	segs := []seg{{ms: lineMs}}
	for {
		open := strings.IndexByte(rest, '<')
		if open < 0 {
			break
		}
		closeAt := strings.IndexByte(rest[open:], '>')
		if closeAt < 0 {
			break
		}
		ms, ok := parseStamp(rest[open+1 : open+closeAt])
		if !ok { // not a stamp: the '<' is text
			segs[len(segs)-1].text += rest[:open+1]
			rest = rest[open+1:]
			continue
		}
		segs[len(segs)-1].text += rest[:open]
		segs = append(segs, seg{ms: ms + shift})
		rest = rest[open+closeAt+1:]
	}
	segs[len(segs)-1].text += rest

	if len(segs) == 1 {
		if t := strings.TrimSpace(segs[0].text); t != "" {
			return []lyrics.Word{{Text: t, StartMs: lineMs}}
		}
		return nil
	}
	var words []lyrics.Word
	for _, s := range segs {
		switch {
		case strings.TrimSpace(s.text) != "":
			words = append(words, lyrics.Word{Text: s.text, StartMs: s.ms})
		case s.text != "" && len(words) > 0: // keep a lone space between words
			words[len(words)-1].Text += s.text
		}
	}
	return words
}

// parseStamp reads mm:ss, mm:ss.f, mm:ss.ff or mm:ss.fff (":" also works as
// the fraction separator) into milliseconds.
func parseStamp(s string) (int64, bool) {
	min, rest, ok := strings.Cut(s, ":")
	if !ok {
		return 0, false
	}
	sec, frac := rest, ""
	if i := strings.IndexAny(rest, ".:"); i >= 0 {
		sec, frac = rest[:i], rest[i+1:]
		if frac == "" || len(frac) > 3 {
			return 0, false
		}
	}
	m, ok1 := digits(min, 5)
	sc, ok2 := digits(sec, 5)
	if !ok1 || !ok2 {
		return 0, false
	}
	var f int64
	if frac != "" {
		v, ok := digits(frac, 3)
		if !ok {
			return 0, false
		}
		f = v
		for i := len(frac); i < 3; i++ { // ".5" is 500 ms, not 5 ms
			f *= 10
		}
	}
	return (m*60+sc)*1000 + f, true
}

// digits parses 1 to max ASCII digits.
func digits(s string, max int) (int64, bool) {
	if s == "" || len(s) > max {
		return 0, false
	}
	var v int64
	for _, c := range []byte(s) {
		if c < '0' || c > '9' {
			return 0, false
		}
		v = v*10 + int64(c-'0')
	}
	return v, true
}

// parseTag reads "key:value" where the key is a word like ti, ar, al, by, offset.
func parseTag(s string) (key, value string, ok bool) {
	k, v, found := strings.Cut(s, ":")
	if !found || k == "" {
		return "", "", false
	}
	for i, c := range []byte(k) {
		letter := c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
		if !letter && (i == 0 || c < '0' || c > '9') && c != '_' && c != '#' {
			return "", "", false
		}
	}
	return strings.ToLower(k), strings.TrimSpace(v), true
}
