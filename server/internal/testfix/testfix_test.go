package testfix

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"io"
	"reflect"
	"sort"
	"strings"
	"testing"
)

func TestVLQ(t *testing.T) {
	cases := map[uint32][]byte{
		0:       {0x00},
		127:     {0x7F},
		128:     {0x81, 0x00},
		16383:   {0xFF, 0x7F},
		16384:   {0x81, 0x80, 0x00},
		0xFFFFF: {0xBF, 0xFF, 0x7F},
	}
	for in, want := range cases {
		if got := vlq(in); !bytes.Equal(got, want) {
			t.Errorf("vlq(%d) = % X, want % X", in, got, want)
		}
	}
}

// chunks splits a MIDI file into its chunks (type, body).
func midiChunks(t *testing.T, b []byte) (header []byte, tracks [][]byte) {
	t.Helper()
	for off := 0; off < len(b); {
		id := string(b[off : off+4])
		n := int(binary.BigEndian.Uint32(b[off+4:]))
		body := b[off+8 : off+8+n]
		switch id {
		case "MThd":
			header = body
		case "MTrk":
			tracks = append(tracks, body)
		default:
			t.Fatalf("unexpected chunk %q", id)
		}
		off += 8 + n
	}
	return
}

func TestMIDIHeader(t *testing.T) {
	m := MIDI{Format: 1, Division: 480, Tracks: []Track{
		{Events: []Event{{0, Tempo(500000)}}},
		{Events: []Event{{0, Program(0, 5)}, {96, NoteOn(0, 60, 100)}, {96, NoteOff(0, 60)}}},
	}}
	b := m.Bytes()
	if !bytes.HasPrefix(b, []byte{'M', 'T', 'h', 'd', 0, 0, 0, 6, 0, 1, 0, 2, 0x01, 0xE0}) {
		t.Fatalf("bad header: % X", b[:14])
	}
	_, tracks := midiChunks(t, b)
	if len(tracks) != 2 {
		t.Fatalf("tracks = %d", len(tracks))
	}
	for i, tr := range tracks {
		if !bytes.HasSuffix(tr, []byte{0x00, 0xFF, 0x2F, 0x00}) {
			t.Errorf("track %d does not end with End of Track", i)
		}
	}
	if !bytes.Contains(tracks[0], []byte{0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20}) {
		t.Errorf("tempo 500000 not encoded: % X", tracks[0])
	}
}

func TestMIDIFormat0(t *testing.T) {
	b := MIDI{Format: 0, Division: 96, Tracks: []Track{{}}}.Bytes()
	if !bytes.HasPrefix(b, []byte{'M', 'T', 'h', 'd', 0, 0, 0, 6, 0, 0, 0, 1, 0, 96}) {
		t.Fatalf("bad header: % X", b[:14])
	}
}

func TestEventEncoders(t *testing.T) {
	check := func(name string, got, want []byte) {
		t.Helper()
		if !bytes.Equal(got, want) {
			t.Errorf("%s = % X, want % X", name, got, want)
		}
	}
	check("Text", Text("ab"), []byte{0xFF, 0x01, 2, 'a', 'b'})
	check("Lyric", Lyric("a"), []byte{0xFF, 0x05, 1, 'a'})
	check("TrackName", TrackName("W"), []byte{0xFF, 0x03, 1, 'W'})
	check("NoteOn", NoteOn(9, 36, 100), []byte{0x99, 36, 100})
	check("NoteOff", NoteOff(0, 60), []byte{0x80, 60, 0})
	check("Program", Program(1, 7), []byte{0xC1, 7})
	check("CC", CC(2, 7, 100), []byte{0xB2, 7, 100})
	long := strings.Repeat("x", 200)
	check("long Text uses a VLQ length", Text(long)[:4], []byte{0xFF, 0x01, 0x81, 0x48})
}

func TestKARContainsMetadata(t *testing.T) {
	b := KAR("Song", "Singer", []Syllable{{0, "Hel"}, {240, "lo "}, {960, "/World"}})
	for _, want := range []string{"@TSong", "@TSinger", "@KMIDI KARAOKE FILE", "@V0100", "Words"} {
		if !bytes.Contains(b, []byte(want)) {
			t.Errorf("KAR lacks %q", want)
		}
	}
	hdr, tracks := midiChunks(t, b)
	if binary.BigEndian.Uint16(hdr[0:]) != 1 || binary.BigEndian.Uint16(hdr[4:]) != 480 {
		t.Errorf("want format 1 division 480, header % X", hdr)
	}
	if !bytes.Contains(tracks[0], []byte{0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20}) {
		t.Error("track 0 should carry tempo 500000")
	}
	if len(tracks) < 4 {
		t.Fatalf("want conductor, soft karaoke, words and melody tracks, got %d", len(tracks))
	}
	// Words track: syllables as FF 01 events with the right deltas (0, 240, 720).
	var words []byte
	for _, tr := range tracks {
		if bytes.Contains(tr, []byte{0xFF, 0x03, 5, 'W', 'o', 'r', 'd', 's'}) {
			words = tr
		}
	}
	if words == nil {
		t.Fatal("no track named Words")
	}
	want := append(append([]byte{}, 0x00), Text("Hel")...)
	want = append(want, append([]byte{0x81, 0x70}, Text("lo ")...)...) // delta 240 = 81 70
	want = append(want, append([]byte{0x85, 0x50}, Text("/World")...)...)
	if !bytes.Contains(words, want) {
		t.Errorf("syllable events/deltas wrong in Words track: % X", words)
	}
	// First syllable has a channel-0 note (key 60, velocity 90); drums use channel 9.
	var melody, drums bool
	for _, tr := range tracks {
		melody = melody || bytes.Contains(tr, []byte{0x00, 0x90, 60, 90})
		drums = drums || bytes.Contains(tr, []byte{0x99, 36, 100})
	}
	if !melody || !drums {
		t.Errorf("melody note on channel 0: %v, drum hit on channel 9: %v", melody, drums)
	}
}

func TestKARSortsSyllables(t *testing.T) {
	a := KAR("T", "A", []Syllable{{480, "b"}, {0, "a"}})
	b := KAR("T", "A", []Syllable{{0, "a"}, {480, "b"}})
	if !bytes.Equal(a, b) {
		t.Error("syllable order in the input must not matter")
	}
}

func TestMP3FrameSize(t *testing.T) {
	b := MP3Frames(10)
	if len(b) != 10*417 {
		t.Fatalf("len = %d, want %d", len(b), 10*417)
	}
	for i := 0; i < 10; i++ {
		if !bytes.HasPrefix(b[i*417:], []byte{0xFF, 0xFB, 0x90, 0x00}) {
			t.Errorf("frame %d header = % X", i, b[i*417:i*417+4])
		}
	}
	if MP3Duration(10).Milliseconds() != 261 { // 10*1152/44100 = 0.26122 s
		t.Errorf("duration = %v", MP3Duration(10))
	}
}

func zipNames(t *testing.T, b []byte) []string {
	t.Helper()
	r, err := zip.NewReader(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, f := range r.File {
		names = append(names, f.Name)
	}
	return names
}

func TestKARMP3Entries(t *testing.T) {
	mp3 := MP3Frames(2)
	b := KARMP3("x", mp3, "[00:01.00]hi", "title=T")
	got := zipNames(t, b)
	sort.Strings(got)
	if want := []string{"x.lrc", "x.mp3", "x.nfo"}; !reflect.DeepEqual(got, want) {
		t.Errorf("entries = %v, want %v", got, want)
	}
	if got := zipNames(t, KARMP3("x", mp3, "", "")); !reflect.DeepEqual(got, []string{"x.mp3"}) {
		t.Errorf("entries = %v, want only x.mp3", got)
	}
	r, _ := zip.NewReader(bytes.NewReader(b), int64(len(b)))
	for _, f := range r.File {
		if f.Method != zip.Deflate {
			t.Errorf("%s: method %d, want deflate", f.Name, f.Method)
		}
		if y := f.Modified.Year(); y != 1980 {
			t.Errorf("%s: year %d, want 1980", f.Name, y)
		}
		if f.Name == "x.mp3" {
			rc, _ := f.Open()
			body, _ := io.ReadAll(rc)
			rc.Close()
			if !bytes.Equal(body, mp3) {
				t.Error("mp3 content changed")
			}
		}
	}
	if !bytes.Equal(KARMP3("x", mp3, "a", "b"), KARMP3("x", mp3, "a", "b")) {
		t.Error("output must be deterministic")
	}
}

// riff parses a RIFF container into a flat map of "LIST/ID" paths to bodies.
func riff(t *testing.T, b []byte) map[string][]byte {
	t.Helper()
	if string(b[0:4]) != "RIFF" || string(b[8:12]) != "sfbk" {
		t.Fatalf("not an sfbk RIFF: %q %q", b[0:4], b[8:12])
	}
	if got := int(binary.LittleEndian.Uint32(b[4:])); got != len(b)-8 {
		t.Fatalf("RIFF size = %d, want %d", got, len(b)-8)
	}
	out := map[string][]byte{}
	for off := 12; off < len(b); {
		id := string(b[off : off+4])
		n := int(binary.LittleEndian.Uint32(b[off+4:]))
		body := b[off+8 : off+8+n]
		if id != "LIST" {
			t.Fatalf("top-level chunk %q, want LIST", id)
		}
		list := string(body[:4])
		for o := 4; o < len(body); {
			cid := string(body[o : o+4])
			cn := int(binary.LittleEndian.Uint32(body[o+4:]))
			out[list+"/"+cid] = body[o+8 : o+8+cn]
			o += 8 + cn + cn%2
		}
		off += 8 + n + n%2
	}
	return out
}

func TestSF2Structure(t *testing.T) {
	s1 := make([]int16, 100)
	s2 := make([]int16, 31)
	b := SF2([]Preset{
		{Name: "Piano", Bank: 0, Program: 0, Samples: [][]int16{s1}},
		{Name: "Drums", Bank: 128, Program: 0, Samples: [][]int16{s2}},
	})
	c := riff(t, b)
	if n := len(c["pdta/phdr"]); n != 3*38 {
		t.Errorf("phdr = %d bytes, want 3 records", n)
	}
	if n := len(c["pdta/shdr"]); n != 3*46 {
		t.Errorf("shdr = %d bytes, want 3 records", n)
	}
	if n := len(c["sdta/smpl"]); n != ((100+46)+(31+46))*2 {
		t.Errorf("smpl = %d bytes, want %d", n, ((100+46)+(31+46))*2)
	}
	if n := len(c["pdta/inst"]); n != 3*22 {
		t.Errorf("inst = %d bytes, want 3 records", n)
	}
	if n := len(c["pdta/pbag"]) / 4; n != 3 {
		t.Errorf("pbag = %d records, want 3", n)
	}
	if !bytes.Equal(c["INFO/ifil"], []byte{2, 0, 1, 0}) {
		t.Errorf("ifil = % X, want version 2.1", c["INFO/ifil"])
	}
	if !bytes.HasPrefix(c["INFO/INAM"], []byte("Kantahe test")) {
		t.Errorf("INAM = %q", c["INFO/INAM"])
	}
	ph := c["pdta/phdr"]
	if string(bytes.TrimRight(ph[:20], "\x00")) != "Piano" || binary.LittleEndian.Uint16(ph[20:]) != 0 {
		t.Error("first preset header wrong")
	}
	if binary.LittleEndian.Uint16(ph[38+22:]) != 128 {
		t.Errorf("second preset bank = %d, want 128", binary.LittleEndian.Uint16(ph[38+22:]))
	}
	if string(bytes.TrimRight(ph[2*38:2*38+20], "\x00")) != "EOP" {
		t.Error("phdr lacks the EOP terminal record")
	}
	sh := c["pdta/shdr"]
	if string(bytes.TrimRight(sh[2*46:2*46+20], "\x00")) != "EOS" {
		t.Error("shdr lacks the EOS terminal record")
	}
	// second sample starts after the first plus its 46 padding samples
	if start := binary.LittleEndian.Uint32(sh[46+20:]); start != 146 {
		t.Errorf("second sample start = %d, want 146", start)
	}
	if end := binary.LittleEndian.Uint32(sh[46+24:]); end != 146+31 {
		t.Errorf("second sample end = %d, want %d", end, 146+31)
	}
	if rate := binary.LittleEndian.Uint32(sh[46+36:]); rate != 22050 || sh[46+40] != 60 {
		t.Errorf("rate %d original key %d, want 22050 / 60", rate, sh[46+40])
	}
}

func TestSF2MultipleSamplesPerPreset(t *testing.T) {
	b := SF2([]Preset{{Name: "Multi", Samples: [][]int16{make([]int16, 10), make([]int16, 10), make([]int16, 10)}}})
	c := riff(t, b)
	if n := len(c["pdta/shdr"]); n != 4*46 {
		t.Errorf("shdr = %d bytes, want 3 samples + EOS", n)
	}
	if n := len(c["pdta/ibag"]) / 4; n != 4 { // one zone per sample + terminal
		t.Errorf("ibag = %d records, want 4", n)
	}
	if n := len(c["pdta/igen"]) / 4; n != 3*2+1 { // keyRange + sampleID per zone + terminal
		t.Errorf("igen = %d records, want 7", n)
	}
}

func TestSF2PanicsWithoutSamples(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Error("want a panic for a preset without samples")
		}
	}()
	SF2([]Preset{{Name: "Empty"}})
}

func TestSF2PanicsWithTooManySamples(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Error("want a panic when samples cannot each get a key")
		}
	}()
	SF2([]Preset{{Name: "Big", Samples: make([][]int16, 129)}})
}

func TestSF2RecordSizesAndGeneratorOrder(t *testing.T) {
	c := riff(t, SF2([]Preset{{Name: "P", Samples: [][]int16{make([]int16, 5), make([]int16, 5)}}}))
	for id, size := range map[string]int{"pbag": 4, "pmod": 10, "pgen": 4, "inst": 22, "ibag": 4, "imod": 10, "igen": 4, "phdr": 38, "shdr": 46} {
		if len(c["pdta/"+id])%size != 0 {
			t.Errorf("%s length %d is not a multiple of %d", id, len(c["pdta/"+id]), size)
		}
	}
	if len(c["pdta/pmod"]) != 10 || len(c["pdta/imod"]) != 10 {
		t.Error("pmod and imod must hold exactly the terminal record")
	}
	igen := c["pdta/igen"]
	for z := 0; z < 2; z++ { // keyRange first, sampleID last, in every zone
		if op := binary.LittleEndian.Uint16(igen[z*8:]); op != 43 {
			t.Errorf("zone %d first generator = %d, want keyRange (43)", z, op)
		}
		if op := binary.LittleEndian.Uint16(igen[z*8+4:]); op != 53 {
			t.Errorf("zone %d last generator = %d, want sampleID (53)", z, op)
		}
		if id := binary.LittleEndian.Uint16(igen[z*8+6:]); int(id) != z {
			t.Errorf("zone %d sampleID = %d", z, id)
		}
	}
	// key ranges are disjoint and cover 0..127
	if lo, hi := igen[2], igen[3]; lo != 0 || hi != 63 {
		t.Errorf("zone 0 range = %d-%d, want 0-63", lo, hi)
	}
	if lo, hi := igen[10], igen[11]; lo != 64 || hi != 127 {
		t.Errorf("zone 1 range = %d-%d, want 64-127", lo, hi)
	}
	pgen := c["pdta/pgen"]
	if binary.LittleEndian.Uint16(pgen) != 41 {
		t.Error("preset zone must end with the instrument generator (41)")
	}
}

func TestMP3FrameSizeFollowsTheFormula(t *testing.T) {
	// 144 * bitrate / sampleRate + padding, integer division, no padding
	if got := 144*128000/44100 + 0; got != mp3FrameSize {
		t.Errorf("formula gives %d, constant is %d", got, mp3FrameSize)
	}
}
