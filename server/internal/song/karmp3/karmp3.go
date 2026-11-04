// Package karmp3 reads .karmp3 files: a ZIP with NAME.mp3, NAME.lrc and
// NAME.nfo, and, since Kantahe Maker 1.1, an optional NAME.vocals.mp3 with the
// singer's voice alone. The entries are found by the names the .nfo gives
// (rows Instrumental and Vocals), never by building a name. Uploads come from
// users, so every size is limited and enforced while reading, not only as
// declared in the ZIP.
package karmp3

import (
	"archive/zip"
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"path"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"

	"github.com/andrewloable/kantahe/server/internal/song/lyrics"
)

// Errors for rejected archives.
var (
	ErrTooManyEntries = errors.New("karmp3: too many entries in the archive")
	ErrNoMP3          = errors.New("karmp3: the archive has no .mp3 entry")
	ErrMP3Count       = errors.New("karmp3: the archive has more than one .mp3 entry")
	ErrNoInstrumental = errors.New("karmp3: the instrumental named in the .nfo is not in the archive")
	ErrVocalsMissing  = errors.New("karmp3: the vocals named in the .nfo are not in the archive")
	ErrNoVocals       = errors.New("karmp3: the archive has no vocals")
	ErrTooLarge       = errors.New("karmp3: entry too large")
	ErrEncrypted      = errors.New("karmp3: encrypted entries are not supported")
)

const (
	maxEntries          = 16
	maxTextSize         = 1 << 20 // .lrc and .nfo
	DefaultMaxEntrySize = 150 << 20
)

// Archive is an opened .karmp3.
type Archive struct {
	mp3, lrc, nfo *zip.File
	vocals        *zip.File // nil when the file has none or the track cannot be used
	vocalsProblem error     // why a track named in the .nfo was dropped
	fields        map[string]string
	maxEntry      int64
}

// Option changes how Open limits an archive.
type Option func(*Archive)

// WithMaxEntrySize overrides the 150 MB limit on the MP3 entry (used by tests).
func WithMaxEntrySize(n int64) Option { return func(a *Archive) { a.maxEntry = n } }

// Open validates the archive structure. It reads the .nfo (at most 1 MB) to find the entries the song is made of, and no other
// entry contents. A vocals track that is named but cannot be used never fails Open: the song has no vocals (see VocalsProblem).
func Open(r io.ReaderAt, size int64, opts ...Option) (*Archive, error) {
	a := &Archive{maxEntry: DefaultMaxEntrySize}
	for _, o := range opts {
		o(a)
	}
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("karmp3: not a zip archive: %w", err)
	}
	if len(zr.File) > maxEntries {
		return nil, ErrTooManyEntries
	}
	byName := map[string]*zip.File{}
	var mp3s []*zip.File
	for _, f := range zr.File {
		if strings.HasSuffix(f.Name, "/") || isJunk(f.Name) {
			continue
		}
		if _, dup := byName[f.Name]; !dup {
			byName[f.Name] = f
		}
		switch strings.ToLower(path.Ext(f.Name)) {
		case ".mp3":
			mp3s = append(mp3s, f)
		case ".lrc":
			if a.lrc == nil {
				a.lrc = f
			}
		case ".nfo":
			if a.nfo == nil {
				a.nfo = f
			}
		}
	}
	if a.nfo != nil {
		if a.nfo.Flags&0x1 != 0 {
			return nil, ErrEncrypted
		}
		text, err := a.text(a.nfo)
		if err != nil {
			return nil, err
		}
		a.fields = ParseNFO(text)
	}
	// the instrumental is the entry the .nfo names; a file of Maker 1.0.x has no such row and holds one .mp3
	instrumental := lookup(a.fields, "Instrumental")
	switch {
	case instrumental != "":
		if a.mp3 = byName[instrumental]; a.mp3 == nil {
			return nil, ErrNoInstrumental
		}
	case len(mp3s) == 0:
		return nil, ErrNoMP3
	case len(mp3s) > 1:
		return nil, ErrMP3Count
	default:
		a.mp3 = mp3s[0]
	}
	for _, f := range []*zip.File{a.mp3, a.lrc} {
		if f != nil && f.Flags&0x1 != 0 {
			return nil, ErrEncrypted
		}
	}
	if a.mp3.UncompressedSize64 > uint64(a.maxEntry) {
		return nil, ErrTooLarge
	}
	a.pickVocals(byName, instrumental)
	return a, nil
}

// pickVocals finds the vocals track the .nfo names. Whatever is wrong with it leaves the song without vocals.
func (a *Archive) pickVocals(byName map[string]*zip.File, instrumental string) {
	name := lookup(a.fields, "Vocals")
	if name == "" || name == instrumental {
		return
	}
	f := byName[name]
	switch {
	case f == nil:
		a.vocalsProblem = ErrVocalsMissing
	case f.Flags&0x1 != 0:
		a.vocalsProblem = ErrEncrypted
	case f.UncompressedSize64 > uint64(a.maxEntry):
		a.vocalsProblem = ErrTooLarge
	default:
		a.vocals = f
	}
}

// HasVocals reports whether the file has a vocals track that can be extracted.
func (a *Archive) HasVocals() bool { return a.vocals != nil }

// VocalsProblem says why a vocals track named in the .nfo is not offered; nil when none was named or it is usable.
func (a *Archive) VocalsProblem() error { return a.vocalsProblem }

// copyLimited copies at most limit bytes and fails with ErrTooLarge when the
// stream holds more, without writing past the limit.
func copyLimited(w io.Writer, r io.Reader, limit int64) (int64, error) {
	n, err := io.Copy(w, io.LimitReader(r, limit))
	if err != nil {
		return n, err
	}
	var one [1]byte
	if m, _ := r.Read(one[:]); m > 0 {
		return n, ErrTooLarge
	}
	return n, nil
}

// ExtractMP3 writes the MP3 to w after checking that it starts with an MPEG
// frame (after an optional ID3v2 tag). Nothing is written for a non-MP3.
func (a *Archive) ExtractMP3(w io.Writer) (int64, error) { return a.extract(a.mp3, w) }

// ExtractVocals is ExtractMP3 for the vocals track; ErrNoVocals when the file has none.
func (a *Archive) ExtractVocals(w io.Writer) (int64, error) {
	if a.vocals == nil {
		return 0, ErrNoVocals
	}
	return a.extract(a.vocals, w)
}

func (a *Archive) extract(f *zip.File, w io.Writer) (int64, error) {
	rc, err := f.Open()
	if err != nil {
		return 0, err
	}
	_, err = syncToFrame(bufio.NewReaderSize(io.LimitReader(rc, a.maxEntry), peekSize))
	rc.Close()
	if err != nil {
		return 0, err
	}
	rc, err = f.Open()
	if err != nil {
		return 0, err
	}
	defer rc.Close()
	return copyLimited(w, rc, a.maxEntry)
}

// Duration returns the MP3's playing time in milliseconds without extracting it.
func (a *Archive) Duration() (int64, error) {
	rc, err := a.mp3.Open()
	if err != nil {
		return 0, err
	}
	defer rc.Close()
	return streamDuration(io.LimitReader(rc, a.maxEntry))
}

// text reads a small entry fully (capped at 1 MB) and decodes it.
func (a *Archive) text(f *zip.File) (string, error) {
	if f == nil {
		return "", nil
	}
	if f.UncompressedSize64 > maxTextSize {
		return "", ErrTooLarge
	}
	rc, err := f.Open()
	if err != nil {
		return "", err
	}
	defer rc.Close()
	var buf bytes.Buffer
	if _, err := copyLimited(&buf, rc, maxTextSize); err != nil {
		return "", err
	}
	return decodeText(buf.Bytes()), nil
}

// decodeText returns valid UTF-8 as is (minus a BOM), else reads Windows-1252.
func decodeText(b []byte) string {
	b = bytes.TrimPrefix(b, []byte("\xef\xbb\xbf"))
	if utf8.Valid(b) {
		return string(b)
	}
	out, err := charmap.Windows1252.NewDecoder().Bytes(b)
	if err != nil {
		return strings.ToValidUTF8(string(b), "?")
	}
	return string(out)
}

// Song is what the library needs from a .karmp3.
type Song struct {
	Title, Artist string
	DurationMs    int64
	Lines         []lyrics.Line
	Timing        lyrics.Timing // how the lyrics are timed: the .nfo row "Timing by" (Kantahe Maker 1.2.6 and later), else what the .lrc has
	HasVocals     bool          // a vocals track the player can offer
}

// Parse validates the archive and reads its metadata, duration and lyrics. It
// fails with ErrNotMP3 when the recording has no MPEG frames.
func Parse(r io.ReaderAt, size int64) (*Song, error) {
	a, err := Open(r, size)
	if err != nil {
		return nil, err
	}
	dur, err := a.Duration()
	if err != nil {
		return nil, err
	}
	lrcText, err := a.text(a.lrc)
	if err != nil {
		return nil, err
	}
	nfo := a.fields
	tags, words := ParseLRC(lrcText)
	first := func(vals ...string) string {
		for _, v := range vals {
			if v != "" {
				return v
			}
		}
		return ""
	}
	lines := lyrics.Layout(words)
	return &Song{
		Title:      first(lookup(nfo, "Title"), tags["ti"]),
		Artist:     first(lookup(nfo, "Artist"), tags["ar"]),
		DurationMs: dur,
		Lines:      lines,
		Timing:     timingFromRow(lookup(nfo, "Timing by"), lines),
		HasVocals:  a.HasVocals(),
	}, nil
}

// timingFromRow is what the "Timing by" row says (word or line, any case), and for a missing or unknown value what the lyrics themselves show.
func timingFromRow(row string, lines []lyrics.Line) lyrics.Timing {
	switch strings.ToLower(strings.TrimSpace(row)) {
	case "word":
		return lyrics.TimingWord
	case "line":
		return lyrics.TimingLine
	}
	return lyrics.TimingOf(lines)
}

// isJunk reports archiver metadata, such as the "__MACOSX/._NAME.mp3" resource
// forks that macOS adds, which must not count as the song's files.
func isJunk(name string) bool {
	return strings.HasPrefix(name, "__MACOSX/") || strings.HasPrefix(path.Base(name), ".")
}
