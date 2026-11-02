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

// nfoOf is the .nfo text of a Maker 1.1 file; an empty name leaves its row out.
func nfoOf(instrumental, vocals string) string {
	s := "Title          : T\nArtist         : A\nDuration       : 0:01\nAudio          : MP3, 44.1 kHz, 128 kbps\n"
	if instrumental != "" {
		s += "Instrumental   : " + instrumental + "\n"
	}
	if vocals != "" {
		s += "Vocals         : " + vocals + "\nVocals audio   : MP3, 44.1 kHz, 64 kbps, mono\n"
	}
	return s + "Lyrics         : timed (.lrc, 1 lines)\n"
}

func extractBoth(t *testing.T, a *Archive) (inst, voc []byte, vocErr error) {
	t.Helper()
	var i, v bytes.Buffer
	if _, err := a.ExtractMP3(&i); err != nil {
		t.Fatal(err)
	}
	_, vocErr = a.ExtractVocals(&v)
	return i.Bytes(), v.Bytes(), vocErr
}

func TestVocalsWithVocals(t *testing.T) {
	inst, voc := testfix.MP3Frames(2), testfix.MP3Frames(3)
	b := makeZip(t, map[string][]byte{
		"00101 - A - T.mp3": inst, "00101 - A - T.lrc": []byte("[00:01.00]hi"),
		"00101 - A - T.nfo": []byte(nfoOf("00101 - A - T.mp3", "00101 - A - T.vocals.mp3")), "00101 - A - T.vocals.mp3": voc,
	}, "00101 - A - T.mp3", "00101 - A - T.lrc", "00101 - A - T.nfo", "00101 - A - T.vocals.mp3")
	a := open(t, b)
	if !a.HasVocals() || a.VocalsProblem() != nil {
		t.Fatalf("HasVocals %v, problem %v", a.HasVocals(), a.VocalsProblem())
	}
	gotInst, gotVoc, err := extractBoth(t, a)
	if err != nil || !bytes.Equal(gotInst, inst) || !bytes.Equal(gotVoc, voc) {
		t.Fatalf("err %v, instrumental ok %v, vocals ok %v", err, bytes.Equal(gotInst, inst), bytes.Equal(gotVoc, voc))
	}
	s, err := Parse(bytes.NewReader(b), int64(len(b)))
	if err != nil || !s.HasVocals || s.Title != "T" || len(s.Lines) != 1 {
		t.Fatalf("Parse: %+v, %v", s, err)
	}
	if d, _ := a.Duration(); d != s.DurationMs || d == 0 {
		t.Errorf("duration %d is not the instrumental's (%d)", d, s.DurationMs)
	}
}

func TestVocalsWithoutVocalsRow(t *testing.T) {
	inst := testfix.MP3Frames(2)
	b := makeZip(t, map[string][]byte{"a.mp3": inst, "a.nfo": []byte(nfoOf("a.mp3", ""))}, "a.mp3", "a.nfo")
	a := open(t, b)
	if a.HasVocals() || a.VocalsProblem() != nil {
		t.Fatalf("HasVocals %v, problem %v", a.HasVocals(), a.VocalsProblem())
	}
	gotInst, _, err := extractBoth(t, a)
	if !errors.Is(err, ErrNoVocals) || !bytes.Equal(gotInst, inst) {
		t.Fatalf("err %v", err)
	}
}

func TestVocalsOldFile10(t *testing.T) {
	b := testfix.KARMP3("x", testfix.MP3Frames(1000), "[00:01.00]<00:01.00>He<00:01.50>llo\n[00:05.00]Next", "Title : NFO title\nArtist : NFO artist")
	a := open(t, b)
	if a.HasVocals() || a.VocalsProblem() != nil {
		t.Fatalf("HasVocals %v, problem %v", a.HasVocals(), a.VocalsProblem())
	}
	s, err := Parse(bytes.NewReader(b), int64(len(b)))
	if err != nil || s.HasVocals || s.Title != "NFO title" || s.Artist != "NFO artist" || len(s.Lines) != 2 || s.DurationMs < 26121 || s.DurationMs > 26123 {
		t.Fatalf("Parse: %+v, %v", s, err)
	}
}

func TestVocalsRowButEntryMissing(t *testing.T) {
	b := makeZip(t, map[string][]byte{"a.mp3": testfix.MP3Frames(2), "a.nfo": []byte(nfoOf("a.mp3", "a.vocals.mp3"))}, "a.mp3", "a.nfo")
	a := open(t, b)
	if a.HasVocals() || !errors.Is(a.VocalsProblem(), ErrVocalsMissing) {
		t.Fatalf("HasVocals %v, problem %v", a.HasVocals(), a.VocalsProblem())
	}
	if s, err := Parse(bytes.NewReader(b), int64(len(b))); err != nil || s.HasVocals {
		t.Fatalf("Parse: %+v, %v", s, err)
	}
}

// setCentralFlag sets bit 0 (encrypted) of the n-th entry in the central directory.
func setCentralFlag(b []byte, n int) {
	from := 0
	for i := 0; ; i++ {
		at := bytes.Index(b[from:], []byte("PK\x01\x02"))
		if at < 0 {
			panic("no such entry")
		}
		at += from
		if i == n {
			b[at+8] |= 0x01
			return
		}
		from = at + 1
	}
}

func TestVocalsEntryEncryptedOrTooLarge(t *testing.T) {
	inst, voc := testfix.MP3Frames(2), testfix.MP3Frames(100)
	entries := map[string][]byte{"a.mp3": inst, "a.nfo": []byte(nfoOf("a.mp3", "a.vocals.mp3")), "a.vocals.mp3": voc}
	order := []string{"a.mp3", "a.nfo", "a.vocals.mp3"}
	b := makeZip(t, entries, order...)
	setCentralFlag(b, 2)
	if a := open(t, b); a.HasVocals() || !errors.Is(a.VocalsProblem(), ErrEncrypted) {
		t.Fatalf("encrypted: HasVocals %v, problem %v", a.HasVocals(), a.VocalsProblem())
	}
	b = makeZip(t, entries, order...)
	if a := open(t, b, WithMaxEntrySize(int64(len(inst)))); a.HasVocals() || !errors.Is(a.VocalsProblem(), ErrTooLarge) {
		t.Fatalf("too large: HasVocals %v, problem %v", a.HasVocals(), a.VocalsProblem())
	}
}

func TestVocalsEntryNotAnMP3(t *testing.T) {
	inst := testfix.MP3Frames(2)
	junk := bytes.Repeat([]byte{0x12, 0x34, 0x56}, 2000)
	b := makeZip(t, map[string][]byte{"a.mp3": inst, "a.nfo": []byte(nfoOf("a.mp3", "a.vocals.mp3")), "a.vocals.mp3": junk}, "a.mp3", "a.nfo", "a.vocals.mp3")
	a := open(t, b)
	gotInst, _, err := extractBoth(t, a)
	if !errors.Is(err, ErrNotMP3) || !bytes.Equal(gotInst, inst) {
		t.Fatalf("err %v", err)
	}
}

func TestVocalsNamesComeFromTheNFO(t *testing.T) {
	inst, voc, decoy := testfix.MP3Frames(2), testfix.MP3Frames(3), testfix.MP3Frames(5)
	const base = "00101 - Ñiño – Café"
	const instName, vocName = "Inst – Ñiño – Café (mix).mp3", "Voz – Ñiño – Café.vocals.mp3"
	b := makeZip(t, map[string][]byte{
		base + ".mp3": decoy, base + ".lrc": []byte("[00:01.00]hi"), base + ".nfo": []byte(nfoOf(instName, vocName)),
		instName: inst, vocName: voc,
	}, base+".mp3", base+".lrc", base+".nfo", instName, vocName)
	a := open(t, b)
	gotInst, gotVoc, err := extractBoth(t, a)
	if err != nil || !bytes.Equal(gotInst, inst) || !bytes.Equal(gotVoc, voc) {
		t.Fatalf("err %v, instrumental ok %v, vocals ok %v", err, bytes.Equal(gotInst, inst), bytes.Equal(gotVoc, voc))
	}
}

func TestVocalsUnknownEntriesIgnored(t *testing.T) {
	inst, voc := testfix.MP3Frames(2), testfix.MP3Frames(3)
	b := makeZip(t, map[string][]byte{
		"a.mp3": inst, "a.nfo": []byte(nfoOf("a.mp3", "a.vocals.mp3")), "a.vocals.mp3": voc,
		"cover.jpg": []byte("img"), "notes.txt": []byte("n"), "extra.mp3": testfix.MP3Frames(7),
	}, "a.mp3", "cover.jpg", "a.nfo", "notes.txt", "extra.mp3", "a.vocals.mp3")
	a := open(t, b)
	gotInst, gotVoc, err := extractBoth(t, a)
	if err != nil || !bytes.Equal(gotInst, inst) || !bytes.Equal(gotVoc, voc) {
		t.Fatalf("err %v", err)
	}
}

func TestVocalsInstrumentalRowNamesMissingEntry(t *testing.T) {
	b := makeZip(t, map[string][]byte{"a.mp3": testfix.MP3Frames(2), "a.nfo": []byte(nfoOf("gone.mp3", ""))}, "a.mp3", "a.nfo")
	if _, err := Open(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrNoInstrumental) {
		t.Fatalf("err = %v, want ErrNoInstrumental", err)
	}
}

func TestVocalsSameNameAsInstrumental(t *testing.T) {
	b := makeZip(t, map[string][]byte{"a.mp3": testfix.MP3Frames(2), "a.nfo": []byte(nfoOf("a.mp3", "a.mp3"))}, "a.mp3", "a.nfo")
	if a := open(t, b); a.HasVocals() || a.VocalsProblem() != nil {
		t.Fatalf("HasVocals %v, problem %v", a.HasVocals(), a.VocalsProblem())
	}
}
