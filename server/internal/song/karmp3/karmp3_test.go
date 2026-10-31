package karmp3

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func open(t *testing.T, b []byte, opts ...Option) *Archive {
	t.Helper()
	a, err := Open(bytes.NewReader(b), int64(len(b)), opts...)
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func makeZip(t *testing.T, entries map[string][]byte, order ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, name := range order {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write(entries[name])
	}
	_ = zw.Close()
	return buf.Bytes()
}

func TestOpenValid(t *testing.T) {
	mp3 := testfix.MP3Frames(100)
	a := open(t, testfix.KARMP3("x", mp3, "[00:01.00]hi", "Title : T"))
	var out bytes.Buffer
	n, err := a.ExtractMP3(&out)
	if err != nil || n != int64(len(mp3)) || !bytes.Equal(out.Bytes(), mp3) {
		t.Fatalf("n=%d err=%v equal=%v", n, err, bytes.Equal(out.Bytes(), mp3))
	}
}

func TestNoMP3(t *testing.T) {
	b := makeZip(t, map[string][]byte{"x.lrc": []byte("[00:01.00]a")}, "x.lrc")
	if _, err := Open(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrNoMP3) {
		t.Fatalf("err = %v, want ErrNoMP3", err)
	}
}

func TestTwoMP3(t *testing.T) {
	mp3 := testfix.MP3Frames(2)
	b := makeZip(t, map[string][]byte{"a.mp3": mp3, "b.MP3": mp3}, "a.mp3", "b.MP3")
	if _, err := Open(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrMP3Count) {
		t.Fatalf("err = %v, want ErrMP3Count", err)
	}
}

func TestMP3ExtensionCaseInsensitive(t *testing.T) {
	b := makeZip(t, map[string][]byte{"SONG.MP3": testfix.MP3Frames(2)}, "SONG.MP3")
	open(t, b)
}

func TestTooManyEntries(t *testing.T) {
	entries := map[string][]byte{"x.mp3": testfix.MP3Frames(2)}
	order := []string{"x.mp3"}
	for i := 0; i < 16; i++ {
		name := fmt.Sprintf("f%d.txt", i)
		entries[name] = []byte("a")
		order = append(order, name)
	}
	b := makeZip(t, entries, order...) // 17 entries
	if _, err := Open(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrTooManyEntries) {
		t.Fatalf("err = %v, want ErrTooManyEntries", err)
	}
	// exactly 16 is fine
	order = order[:16]
	open(t, makeZip(t, entries, order...))
}

func TestDeclaredSizeOverLimit(t *testing.T) {
	b := testfix.KARMP3("x", testfix.MP3Frames(100), "", "")
	if _, err := Open(bytes.NewReader(b), int64(len(b)), WithMaxEntrySize(1000)); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
}

// patchDeclaredSize rewrites the uncompressed size in the central directory.
func patchDeclaredSize(b []byte, size uint32) []byte {
	out := append([]byte(nil), b...)
	i := bytes.Index(out, []byte("PK\x01\x02"))
	binary.LittleEndian.PutUint32(out[i+24:], size)
	return out
}

func TestLyingSize(t *testing.T) {
	big := testfix.MP3Frames(2500) // about 1 MB
	b := patchDeclaredSize(testfix.KARMP3("x", big, "", ""), 10)
	a := open(t, b, WithMaxEntrySize(11))
	var out bytes.Buffer
	_, err := a.ExtractMP3(&out)
	if err == nil {
		t.Fatal("a declared size of 10 bytes with 1 MB of content must fail")
	}
	if out.Len() > 11 {
		t.Fatalf("wrote %d bytes, the limit is 11", out.Len())
	}
}

func TestExtractStopsAtTheLimit(t *testing.T) {
	// the declared size is honest but the cap is smaller than the real content
	big := testfix.MP3Frames(100)
	a := open(t, testfix.KARMP3("x", big, "", ""), WithMaxEntrySize(int64(len(big))))
	var out bytes.Buffer
	if _, err := a.ExtractMP3(&out); err != nil {
		t.Fatalf("content exactly at the limit must pass: %v", err)
	}
	a.maxEntry = int64(len(big)) - 1
	out.Reset()
	if _, err := a.ExtractMP3(&out); !errors.Is(err, ErrTooLarge) || int64(out.Len()) > a.maxEntry {
		t.Fatalf("err = %v, wrote %d", err, out.Len())
	}
}

func TestNotMP3(t *testing.T) {
	junk := bytes.Repeat([]byte{0x12, 0x34, 0x56}, 2000)
	a := open(t, makeZip(t, map[string][]byte{"x.mp3": junk}, "x.mp3"))
	var out bytes.Buffer
	if _, err := a.ExtractMP3(&out); !errors.Is(err, ErrNotMP3) {
		t.Fatalf("err = %v, want ErrNotMP3", err)
	}
	if out.Len() != 0 {
		t.Errorf("nothing should be written for a non-MP3, wrote %d", out.Len())
	}
	if _, err := a.Duration(); !errors.Is(err, ErrNotMP3) {
		t.Errorf("Duration err = %v, want ErrNotMP3", err)
	}
}

func id3v2(decodedSize int, footer bool) []byte {
	h := []byte{'I', 'D', '3', 4, 0, 0, byte(decodedSize >> 21 & 0x7F), byte(decodedSize >> 14 & 0x7F), byte(decodedSize >> 7 & 0x7F), byte(decodedSize & 0x7F)}
	if footer {
		h[5] = 0x10
	}
	h = append(h, make([]byte, decodedSize)...)
	if footer {
		h = append(h, []byte{'3', 'D', 'I', 4, 0, 0x10, 0, 0, 0, 0}...)
	}
	return h
}

func TestID3Skip(t *testing.T) {
	for _, footer := range []bool{false, true} {
		mp3 := append(id3v2(0xA0A, footer), testfix.MP3Frames(10)...)
		a := open(t, makeZip(t, map[string][]byte{"x.mp3": mp3}, "x.mp3"))
		var out bytes.Buffer
		if _, err := a.ExtractMP3(&out); err != nil || !bytes.Equal(out.Bytes(), mp3) {
			t.Fatalf("footer=%v: %v", footer, err)
		}
	}
}

func TestID3WithoutFramesAfterIt(t *testing.T) {
	mp3 := append(id3v2(100, false), bytes.Repeat([]byte{0}, 50)...)
	a := open(t, makeZip(t, map[string][]byte{"x.mp3": mp3}, "x.mp3"))
	if _, err := a.ExtractMP3(&bytes.Buffer{}); !errors.Is(err, ErrNotMP3) {
		t.Fatalf("err = %v, want ErrNotMP3", err)
	}
}

func TestEmptyAndTinyMP3(t *testing.T) {
	for _, body := range [][]byte{{}, {0xFF}, {0xFF, 0xFB}} {
		a := open(t, makeZip(t, map[string][]byte{"x.mp3": body}, "x.mp3"))
		if _, err := a.ExtractMP3(&bytes.Buffer{}); !errors.Is(err, ErrNotMP3) {
			t.Errorf("% X: err = %v, want ErrNotMP3", body, err)
		}
	}
}

func TestEncryptedEntryRejected(t *testing.T) {
	b := makeZip(t, map[string][]byte{"x.mp3": testfix.MP3Frames(2)}, "x.mp3")
	for _, sig := range []string{"PK\x01\x02", "PK\x03\x04"} {
		i := bytes.Index(b, []byte(sig))
		off := 8
		if sig == "PK\x01\x02" {
			off = 8
		}
		b[i+off] |= 0x01 // general purpose flag bit 0: encrypted
	}
	if _, err := Open(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrEncrypted) {
		t.Fatalf("err = %v, want ErrEncrypted", err)
	}
}

func TestNotAZip(t *testing.T) {
	if _, err := Open(bytes.NewReader([]byte("hello")), 5); err == nil {
		t.Fatal("want an error")
	}
}

func TestParse(t *testing.T) {
	lrc := "[ti:LRC title]\n[ar:LRC artist]\n[00:01.00]<00:01.00>He<00:01.50>llo\n[00:05.00]Next"
	b := testfix.KARMP3("x", testfix.MP3Frames(1000), lrc, "Title : NFO title\nArtist : NFO artist")
	s, err := Parse(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		t.Fatal(err)
	}
	if s.Title != "NFO title" || s.Artist != "NFO artist" {
		t.Errorf("title %q artist %q; NFO must win", s.Title, s.Artist)
	}
	if s.DurationMs < 26121 || s.DurationMs > 26123 {
		t.Errorf("duration = %d, want about 26122", s.DurationMs)
	}
	if len(s.Lines) != 2 || s.Lines[0].Words[1].StartMs != 1500 || s.Lines[1].Words[0].Text != "Next" {
		t.Errorf("lines: %+v", s.Lines)
	}
}

func TestTitlePrecedence(t *testing.T) {
	lrc := "[ti:LRC title]\n[ar:LRC artist]\n[00:01.00]a"
	// NFO has only an artist: title falls back to LRC, artist from NFO
	s, err := parseBytes(testfix.KARMP3("x", testfix.MP3Frames(5), lrc, "Artist : NFO artist"))
	if err != nil || s.Title != "LRC title" || s.Artist != "NFO artist" {
		t.Fatalf("%+v %v", s, err)
	}
	// no NFO at all: both from LRC
	s, _ = parseBytes(testfix.KARMP3("x", testfix.MP3Frames(5), lrc, ""))
	if s.Title != "LRC title" || s.Artist != "LRC artist" {
		t.Fatalf("%+v", s)
	}
	// nothing: empty
	s, _ = parseBytes(testfix.KARMP3("x", testfix.MP3Frames(5), "", ""))
	if s.Title != "" || s.Artist != "" || len(s.Lines) != 0 {
		t.Fatalf("%+v", s)
	}
}

func parseBytes(b []byte) (*Song, error) { return Parse(bytes.NewReader(b), int64(len(b))) }

func TestParseDecodesLegacyEncodingAndBOM(t *testing.T) {
	b := testfix.KARMP3("x", testfix.MP3Frames(5), "\xef\xbb\xbf[00:01.00]caf\xe9", "Title : caf\xe9")
	s, err := parseBytes(b)
	if err != nil || s.Title != "café" || s.Lines[0].Words[0].Text != "café" {
		t.Fatalf("%+v %v", s, err)
	}
}

func TestParseRejectsOversizedLRC(t *testing.T) {
	b := testfix.KARMP3("x", testfix.MP3Frames(5), "[00:01.00]"+string(bytes.Repeat([]byte("a"), 2<<20)), "")
	if _, err := parseBytes(b); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
}

func TestParseNotAnMP3(t *testing.T) {
	b := makeZip(t, map[string][]byte{"x.mp3": bytes.Repeat([]byte{1}, 3000)}, "x.mp3")
	if _, err := parseBytes(b); !errors.Is(err, ErrNotMP3) {
		t.Fatalf("err = %v, want ErrNotMP3", err)
	}
}

func TestRegression_MacOSResourceForksIgnored(t *testing.T) {
	mp3 := testfix.MP3Frames(2)
	b := makeZip(t, map[string][]byte{
		"x.mp3": mp3, "__MACOSX/._x.mp3": []byte("fork"), "._x.lrc": []byte("fork"), "x.lrc": []byte("[00:01.00]real"),
	}, "x.mp3", "__MACOSX/._x.mp3", "._x.lrc", "x.lrc")
	s, err := parseBytes(b)
	if err != nil {
		t.Fatalf("a .karmp3 zipped on macOS must open: %v", err)
	}
	if len(s.Lines) != 1 || s.Lines[0].Words[0].Text != "real" {
		t.Fatalf("lyrics came from the wrong entry: %+v", s.Lines)
	}
}

func TestLyingSizeOnTextEntry(t *testing.T) {
	b := testfix.KARMP3("x", testfix.MP3Frames(5), "[00:01.00]"+string(bytes.Repeat([]byte("a"), 3<<20)), "")
	// the .lrc entry is the second central directory record: declare 10 bytes
	first := bytes.Index(b, []byte("PK\x01\x02"))
	second := first + 1 + bytes.Index(b[first+1:], []byte("PK\x01\x02"))
	binary.LittleEndian.PutUint32(b[second+24:], 10)
	if _, err := parseBytes(b); err == nil {
		t.Fatal("a 3 MB .lrc declared as 10 bytes must be rejected")
	}
}

func TestEntryPathsAreNeverUsedOnDisk(t *testing.T) {
	b := makeZip(t, map[string][]byte{"../../evil.mp3": testfix.MP3Frames(2)}, "../../evil.mp3")
	a := open(t, b)
	var out bytes.Buffer
	if _, err := a.ExtractMP3(&out); err != nil {
		t.Fatal(err) // the name is irrelevant: bytes go to the caller's writer only
	}
}
