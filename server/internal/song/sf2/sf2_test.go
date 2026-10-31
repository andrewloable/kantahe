package sf2

import (
	"bytes"
	"encoding/binary"
	"errors"
	"os"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func parse(t *testing.T, b []byte) *Bank {
	t.Helper()
	bank, err := Parse(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		t.Fatal(err)
	}
	return bank
}

func sampleBytes(b []byte, bank *Bank, i int) []byte {
	s := bank.Samples[i]
	return b[bank.SmplOffset+int64(s.Start)*2 : bank.SmplOffset+int64(s.End)*2]
}

func names(bank *Bank) []string {
	var out []string
	for _, p := range bank.Presets[:len(bank.Presets)-1] {
		out = append(out, p.Name)
	}
	return out
}

func ramp(n int, base int16) []int16 {
	out := make([]int16, n)
	for i := range out {
		out[i] = base + int16(i)
	}
	return out
}

func threePresetBank() []byte {
	return testfix.SF2([]testfix.Preset{
		{Name: "Piano", Bank: 0, Program: 0, Samples: [][]int16{ramp(300, 100)}},
		{Name: "Guitar", Bank: 0, Program: 24, Samples: [][]int16{ramp(200, 1000)}},
		{Name: "Drums", Bank: 128, Program: 0, Samples: [][]int16{ramp(250, 5000)}},
	})
}

func TestParseFixture(t *testing.T) {
	b := threePresetBank()
	bank := parse(t, b)
	if len(bank.Presets) != 4 || len(bank.Samples) != 4 || len(bank.Insts) != 4 {
		t.Fatalf("presets %d samples %d insts %d, want 4 each (3 + terminal)", len(bank.Presets), len(bank.Samples), len(bank.Insts))
	}
	if bank.Presets[1].Name != "Guitar" || bank.Presets[1].Program != 24 || bank.Presets[2].Bank != 128 || bank.Presets[3].Name != "EOP" {
		t.Fatalf("%+v", bank.Presets)
	}
	if bank.Samples[0].Rate != 22050 || bank.Samples[0].Pitch != 60 || bank.Samples[3].Name != "EOS" {
		t.Fatalf("%+v", bank.Samples)
	}
	if len(bank.Info) < 3 || bank.Info[0].ID != "ifil" {
		t.Fatalf("info chunks: %+v", bank.Info)
	}
	if bank.SmplLen != int64((300+46+200+46+250+46)*2) || bank.Sm24Len != 0 {
		t.Fatalf("smpl %d sm24 %d", bank.SmplLen, bank.Sm24Len)
	}
}

func TestTrimKeepsRequested(t *testing.T) {
	src := threePresetBank()
	bank := parse(t, src)
	out, err := Trim(bank, []PresetKey{{0, 24}, {128, 0}}, bytes.NewReader(src))
	if err != nil {
		t.Fatal(err)
	}
	trimmed := parse(t, out)
	if got := names(trimmed); len(got) != 2 || got[0] != "Guitar" || got[1] != "Drums" {
		t.Fatalf("presets %v", got)
	}
	if len(trimmed.Presets) != 3 || len(trimmed.Insts) != 3 || len(trimmed.Samples) != 3 {
		t.Fatalf("presets %d insts %d samples %d (incl. terminals)", len(trimmed.Presets), len(trimmed.Insts), len(trimmed.Samples))
	}
	if !bytes.Equal(sampleBytes(out, trimmed, 0), sampleBytes(src, bank, 1)) || !bytes.Equal(sampleBytes(out, trimmed, 1), sampleBytes(src, bank, 2)) {
		t.Fatal("sample data differs from the source")
	}
	// every sample is followed by 46 zero points, and the next one starts after them
	if trimmed.Samples[1].Start != trimmed.Samples[0].End+46 {
		t.Fatalf("second sample starts at %d, first ends at %d", trimmed.Samples[1].Start, trimmed.Samples[0].End)
	}
	tail := out[trimmed.SmplOffset+int64(trimmed.Samples[1].End)*2 : trimmed.SmplOffset+trimmed.SmplLen]
	if len(tail) != 92 || !bytes.Equal(tail, make([]byte, 92)) {
		t.Fatalf("padding after the last sample: %d bytes", len(tail))
	}
	if trimmed.SmplLen != int64((200+46+250+46)*2) {
		t.Fatalf("smpl length %d", trimmed.SmplLen)
	}
	if len(out) >= len(src) {
		t.Fatalf("trimmed %d bytes vs source %d", len(out), len(src))
	}
	riffSize := binary.LittleEndian.Uint32(out[4:])
	if int(riffSize) != len(out)-8 || len(out)%2 != 0 {
		t.Fatalf("RIFF size %d for %d bytes", riffSize, len(out))
	}
	// the preset zone still points at the right instrument and the zone at the right sample
	if inst := trimmed.PGens[0]; inst.Oper != genInstrument || inst.U16() != 0 {
		t.Fatalf("first preset gen %+v", inst)
	}
	if inst := trimmed.PGens[1]; inst.Oper != genInstrument || inst.U16() != 1 {
		t.Fatalf("second preset gen %+v", inst)
	}
}

func TestTrimFallbacks(t *testing.T) {
	src := threePresetBank()
	bank := parse(t, src)
	cases := []struct {
		key  PresetKey
		want string
	}{
		{PresetKey{8, 24}, "Guitar"},
		{PresetKey{128, 16}, "Drums"},
		{PresetKey{0, 99}, "Piano"},
		{PresetKey{0, 24}, "Guitar"},
		{PresetKey{5, 99}, "Piano"},
	}
	for _, c := range cases {
		out, err := Trim(bank, []PresetKey{c.key}, bytes.NewReader(src))
		if err != nil {
			t.Fatalf("%+v: %v", c.key, err)
		}
		if got := names(parse(t, out)); len(got) != 1 || got[0] != c.want {
			t.Errorf("%+v -> %v, want %s", c.key, got, c.want)
		}
	}
	// a drum kit that does not exist is skipped, not replaced by a piano
	pianoOnly := testfix.SF2([]testfix.Preset{{Name: "Piano", Samples: [][]int16{ramp(10, 1)}}})
	pb := parse(t, pianoOnly)
	if _, err := Trim(pb, []PresetKey{{128, 0}}, bytes.NewReader(pianoOnly)); !errors.Is(err, ErrNoPresets) {
		t.Fatalf("err = %v, want ErrNoPresets", err)
	}
	out, err := Trim(pb, []PresetKey{{128, 0}, {0, 3}}, bytes.NewReader(pianoOnly))
	if err != nil || len(names(parse(t, out))) != 1 {
		t.Fatalf("unmatched keys are skipped when others match: %v", err)
	}
	if _, err := Trim(bank, nil, bytes.NewReader(src)); !errors.Is(err, ErrNoPresets) {
		t.Fatalf("nothing requested: %v", err)
	}
	// duplicates collapse to one preset
	out, _ = Trim(bank, []PresetKey{{0, 24}, {8, 24}, {0, 24}}, bytes.NewReader(src))
	if got := names(parse(t, out)); len(got) != 1 {
		t.Fatalf("%v", got)
	}
}

// stereoBank: samples are [mono, left (link 2), right (link 1), other mono]; preset
// Pad uses only the left sample, preset Other uses the last mono sample.
func stereoBank() ([]byte, *File) {
	f := &File{
		Info: []Chunk{{"ifil", []byte{2, 0, 1, 0}}, {"isng", []byte("EMU8000\x00")}, {"INAM", []byte("Test\x00\x00")}},
		// Pad: one zone (instrument 0). Other: a global zone (attenuation) and a zone with instrument 1.
		Presets: []Preset{{Name: "Pad", Program: 5, BagIndex: 0}, {Name: "Other", Program: 6, BagIndex: 1}, {Name: "EOP", BagIndex: 3}},
		PBags:   []Bag{{0, 0}, {1, 0}, {2, 0}, {3, 0}},
		PGens:   []Gen{GenU16(genInstrument, 0), GenU16(48, 100), GenU16(genInstrument, 1), {}},
		PMods:   []Mod{{}},
		// PadInst: one zone with the left sample. OtherInst: a global zone (attenuation) and a zone with a key range and sample 3.
		Insts: []Inst{{"PadInst", 0}, {"OtherInst", 1}, {"EOI", 3}},
		IBags: []Bag{{0, 0}, {1, 0}, {2, 0}, {4, 0}},
		IGens: []Gen{GenU16(genSampleID, 1), GenU16(48, 50), GenU16(43, 0x7F00), GenU16(genSampleID, 3), {}},
		IMods: []Mod{{}},
	}
	data := make([]byte, 0)
	var samples []Sample
	pos := uint32(0)
	add := func(name string, n int, typ, link uint16) {
		d := make([]byte, n*2)
		for i := 0; i < n; i++ {
			binary.LittleEndian.PutUint16(d[i*2:], uint16(len(samples)*1000+i))
		}
		data = append(data, d...)
		data = append(data, make([]byte, 92)...)
		samples = append(samples, Sample{Name: name, Start: pos, End: pos + uint32(n), LoopStart: pos + 2, LoopEnd: pos + uint32(n) - 2, Rate: 44100, Pitch: 60, Link: link, Type: typ})
		pos += uint32(n) + 46
	}
	add("Mono", 40, 1, 0)
	add("Left", 60, 4, 2)
	add("Right", 60, 2, 1)
	add("Other", 30, 1, 0)
	samples = append(samples, Sample{Name: "EOS"})
	f.Samples = samples
	f.Smpl = data
	var buf bytes.Buffer
	_ = Write(&buf, f)
	return buf.Bytes(), f
}

func TestTrimStereoLink(t *testing.T) {
	src, _ := stereoBank()
	bank := parse(t, src)
	out, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(src))
	if err != nil {
		t.Fatal(err)
	}
	tr := parse(t, out)
	if len(tr.Samples) != 3 || tr.Samples[0].Name != "Left" || tr.Samples[1].Name != "Right" {
		t.Fatalf("samples: %+v", tr.Samples)
	}
	if tr.Samples[0].Link != 1 || tr.Samples[1].Link != 0 {
		t.Fatalf("links must point to each other's new indices: %d %d", tr.Samples[0].Link, tr.Samples[1].Link)
	}
	if tr.Samples[0].Type != 4 || tr.Samples[1].Type != 2 {
		t.Fatalf("types %d %d", tr.Samples[0].Type, tr.Samples[1].Type)
	}
	if !bytes.Equal(sampleBytes(out, tr, 1), sampleBytes(src, bank, 2)) {
		t.Fatal("the right channel data was not copied")
	}
	// the zone references the left sample at its new index 0
	if tr.IGens[0].Oper != genSampleID || tr.IGens[0].U16() != 0 {
		t.Fatalf("%+v", tr.IGens[0])
	}
	// loop points keep their position inside the sample
	l := tr.Samples[0]
	if l.LoopStart-l.Start != 2 || l.End-l.LoopEnd != 2 {
		t.Fatalf("loop %d-%d in %d-%d", l.LoopStart, l.LoopEnd, l.Start, l.End)
	}
}

func TestTrimGlobalZone(t *testing.T) {
	src, _ := stereoBank()
	bank := parse(t, src)
	out, err := Trim(bank, []PresetKey{{0, 6}}, bytes.NewReader(src))
	if err != nil {
		t.Fatal(err)
	}
	tr := parse(t, out)
	if names(tr)[0] != "Other" || len(tr.Samples) != 2 || tr.Samples[0].Name != "Other" {
		t.Fatalf("%v %+v", names(tr), tr.Samples)
	}
	// preset zones: global (attenuation) then the instrument zone
	if len(tr.PBags) != 3 || tr.PGens[0].Oper != 48 || tr.PGens[1].Oper != genInstrument || tr.PGens[1].U16() != 0 {
		t.Fatalf("preset zones: bags %d gens %+v", len(tr.PBags), tr.PGens)
	}
	// instrument zones: global (attenuation), then keyRange + sampleID
	if len(tr.IBags) != 3 || tr.IGens[0].Oper != 48 || tr.IGens[1].Oper != 43 || tr.IGens[2].Oper != genSampleID || tr.IGens[2].U16() != 0 {
		t.Fatalf("instrument zones: bags %d gens %+v", len(tr.IBags), tr.IGens)
	}
}

func TestRoundTripUnchanged(t *testing.T) {
	for name, src := range map[string][]byte{"fixture": threePresetBank()} {
		bank := parse(t, src)
		var keys []PresetKey
		for _, p := range bank.Presets[:len(bank.Presets)-1] {
			keys = append(keys, PresetKey{p.Bank, p.Program})
		}
		out, err := Trim(bank, keys, bytes.NewReader(src))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		tr := parse(t, out)
		if got, want := names(tr), names(bank); len(got) != len(want) {
			t.Fatalf("%s: presets %v vs %v", name, got, want)
		}
		for i := range bank.Presets {
			if tr.Presets[i].Name != bank.Presets[i].Name || tr.Presets[i].Program != bank.Presets[i].Program || tr.Presets[i].Bank != bank.Presets[i].Bank {
				t.Errorf("%s: preset %d differs", name, i)
			}
		}
		if len(tr.PGens) != len(bank.PGens) || len(tr.IGens) != len(bank.IGens) || len(tr.Samples) != len(bank.Samples) {
			t.Fatalf("%s: counts differ", name)
		}
		for i := range bank.PGens {
			if tr.PGens[i] != bank.PGens[i] {
				t.Errorf("%s: pgen %d: %+v vs %+v", name, i, tr.PGens[i], bank.PGens[i])
			}
		}
		for i := range bank.IGens {
			if tr.IGens[i] != bank.IGens[i] {
				t.Errorf("%s: igen %d: %+v vs %+v", name, i, tr.IGens[i], bank.IGens[i])
			}
		}
		for i := 0; i < len(bank.Samples)-1; i++ {
			if !bytes.Equal(sampleBytes(out, tr, i), sampleBytes(src, bank, i)) {
				t.Errorf("%s: sample %d data differs", name, i)
			}
			if tr.Samples[i].Name != bank.Samples[i].Name || tr.Samples[i].Rate != bank.Samples[i].Rate || tr.Samples[i].Type != bank.Samples[i].Type {
				t.Errorf("%s: sample %d header differs", name, i)
			}
		}
	}
}

// samples that no zone uses (and no linked sample needs) are dropped even when every preset is kept
func TestRoundTripDropsUnusedSamples(t *testing.T) {
	src, _ := stereoBank()
	bank := parse(t, src)
	out, err := Trim(bank, []PresetKey{{0, 5}, {0, 6}}, bytes.NewReader(src))
	if err != nil {
		t.Fatal(err)
	}
	tr := parse(t, out)
	var got []string
	for _, s := range tr.Samples[:len(tr.Samples)-1] {
		got = append(got, s.Name)
	}
	if len(got) != 3 || got[0] != "Left" || got[1] != "Right" || got[2] != "Other" {
		t.Fatalf("samples %v: the unused Mono sample must be gone", got)
	}
	if tr.Samples[0].Link != 1 || tr.Samples[1].Link != 0 {
		t.Fatalf("links %d %d", tr.Samples[0].Link, tr.Samples[1].Link)
	}
}

func TestSm24IsTrimmedToo(t *testing.T) {
	src, f := stereoBank()
	_ = src
	f.Sm24 = make([]byte, len(f.Smpl)/2)
	for i := range f.Sm24 {
		f.Sm24[i] = byte(i)
	}
	var buf bytes.Buffer
	if err := Write(&buf, f); err != nil {
		t.Fatal(err)
	}
	bank := parse(t, buf.Bytes())
	if bank.Sm24Len != int64(len(f.Sm24)) {
		t.Fatalf("sm24 length %d", bank.Sm24Len)
	}
	out, err := Trim(bank, []PresetKey{{0, 6}}, bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	tr := parse(t, out)
	if tr.Sm24Len != tr.SmplLen/2 {
		t.Fatalf("sm24 %d bytes for smpl %d bytes", tr.Sm24Len, tr.SmplLen)
	}
	want := f.Sm24[bank.Samples[3].Start:bank.Samples[3].End]
	got := out[tr.Sm24Offset+int64(tr.Samples[0].Start) : tr.Sm24Offset+int64(tr.Samples[0].End)]
	if !bytes.Equal(got, want) {
		t.Fatal("sm24 bytes of the kept sample differ")
	}
}

func TestTrimRefusesWhatItCannotCopy(t *testing.T) {
	src, f := stereoBank()
	_ = src
	// a ROM sample
	f.Samples[1].Type |= romSample
	var buf bytes.Buffer
	_ = Write(&buf, f)
	bank := parse(t, buf.Bytes())
	if _, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(buf.Bytes())); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("ROM sample: %v", err)
	}
	// a linked modulator
	f.Samples[1].Type &^= romSample
	f.PMods = []Mod{{Src: 1, Dest: 0x8001}, {}}
	f.PBags = []Bag{{0, 0}, {1, 1}, {2, 1}, {3, 1}}
	f.PGens = []Gen{GenU16(genInstrument, 0), GenU16(48, 100), GenU16(genInstrument, 1), {}}
	buf.Reset()
	_ = Write(&buf, f)
	bank = parse(t, buf.Bytes())
	if _, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(buf.Bytes())); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("linked modulator: %v", err)
	}
}

func TestTrimRejectsBrokenReferences(t *testing.T) {
	_, f := stereoBank()
	f.PGens[0] = GenU16(genInstrument, 99)
	var buf bytes.Buffer
	_ = Write(&buf, f)
	bank := parse(t, buf.Bytes())
	if _, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(buf.Bytes())); !errors.Is(err, ErrCorrupt) {
		t.Fatalf("instrument out of range: %v", err)
	}
	_, f = stereoBank()
	f.IGens[0] = GenU16(genSampleID, 99)
	buf.Reset()
	_ = Write(&buf, f)
	bank = parse(t, buf.Bytes())
	if _, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(buf.Bytes())); !errors.Is(err, ErrCorrupt) {
		t.Fatalf("sample out of range: %v", err)
	}
	// a truncated source: the sample data cannot be read
	src, _ := stereoBank()
	bank = parse(t, src)
	if _, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(src[:bank.SmplOffset+100])); err == nil {
		t.Fatal("reading beyond the source must fail")
	}
}

func TestRejectCorrupt(t *testing.T) {
	good := threePresetBank()
	chunkAt := func(id string) int { return bytes.Index(good, []byte(id)) }
	patch := func(f func(b []byte)) []byte {
		b := append([]byte(nil), good...)
		f(b)
		return b
	}
	cases := map[string][]byte{
		"empty":            nil,
		"not riff":         []byte("RIFX0000sfbk"),
		"not sfbk":         patch(func(b []byte) { copy(b[8:], "WAVE") }),
		"truncated":        good[:len(good)-300],
		"truncated pdta":   good[:chunkAt("shdr")+20],
		"riff size lies":   patch(func(b []byte) { binary.LittleEndian.PutUint32(b[4:], uint32(len(b)+1000)) }),
		"wrong phdr size":  patch(func(b []byte) { binary.LittleEndian.PutUint32(b[chunkAt("phdr")+4:], 38*4+1) }),
		"missing EOP":      patch(func(b []byte) { copy(b[chunkAt("phdr")+8+38*3:], "Nope") }),
		"missing EOS":      patch(func(b []byte) { i := chunkAt("shdr") + 8 + 46*3; copy(b[i:], "XXX") }),
		"bag out of range": patch(func(b []byte) { binary.LittleEndian.PutUint16(b[chunkAt("phdr")+8+24:], 999) }),
		"chunk past end":   patch(func(b []byte) { binary.LittleEndian.PutUint32(b[chunkAt("smpl")+4:], 1<<30) }),
	}
	for name, b := range cases {
		if _, err := Parse(bytes.NewReader(b), int64(len(b))); err == nil || !errors.Is(err, ErrCorrupt) {
			t.Errorf("%s: err = %v, want ErrCorrupt", name, err)
		}
	}
}

func TestParseKeepsUnknownTopLevelChunks(t *testing.T) {
	good := threePresetBank()
	extra := append([]byte("JUNK"), 4, 0, 0, 0, 1, 2, 3, 4)
	b := append(append([]byte(nil), good...), extra...)
	binary.LittleEndian.PutUint32(b[4:], uint32(len(b)-8))
	if _, err := Parse(bytes.NewReader(b), int64(len(b))); err != nil {
		t.Fatalf("unknown top-level chunks are skipped: %v", err)
	}
}

func TestRealBank(t *testing.T) {
	path := os.Getenv("KANTAHE_TEST_SOUNDFONT")
	if path == "" {
		t.Skip("set KANTAHE_TEST_SOUNDFONT to a real bank (for example GeneralUser GS) to run this test")
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	st, _ := f.Stat()
	bank, err := Parse(f, st.Size())
	if err != nil {
		t.Fatal(err)
	}
	out, err := Trim(bank, []PresetKey{{0, 0}, {0, 24}, {128, 0}}, f)
	if err != nil {
		t.Fatal(err)
	}
	tr := parse(t, out)
	t.Logf("source %d bytes, trimmed %d bytes, %d presets", st.Size(), len(out), len(tr.Presets)-1)
	if len(out) > 5<<20 {
		t.Fatalf("trimmed bank is %d bytes, want under 5 MB", len(out))
	}
}

func FuzzParse(f *testing.F) {
	f.Add(threePresetBank())
	b, _ := stereoBank()
	f.Add(b)
	f.Add([]byte("RIFF\x04\x00\x00\x00sfbk"))
	f.Fuzz(func(t *testing.T, data []byte) {
		bank, err := Parse(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			return
		}
		var keys []PresetKey
		for _, p := range bank.Presets[:len(bank.Presets)-1] {
			keys = append(keys, PresetKey{p.Bank, p.Program})
		}
		_, _ = Trim(bank, keys, bytes.NewReader(data))
	})
}

func TestRegression_TwentyCharacterNamesSurvive(t *testing.T) {
	_, f := stereoBank()
	f.Presets[0].Name = "12345678901234567890" // all 20 bytes used, no terminating NUL
	f.Insts[0].Name = "abcdefghijklmnopqrst"
	f.Samples[1].Name = "ABCDEFGHIJKLMNOPQRST"
	var buf bytes.Buffer
	_ = Write(&buf, f)
	bank := parse(t, buf.Bytes())
	out, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	tr := parse(t, out)
	if tr.Presets[0].Name != "12345678901234567890" || tr.Insts[0].Name != "abcdefghijklmnopqrst" || tr.Samples[0].Name != "ABCDEFGHIJKLMNOPQRST" {
		t.Fatalf("names were cut: %q %q %q", tr.Presets[0].Name, tr.Insts[0].Name, tr.Samples[0].Name)
	}
}

func TestRegression_Sm24OfTheWrongLengthIsIgnored(t *testing.T) {
	_, f := stereoBank()
	f.Sm24 = make([]byte, 10) // must be half the length of smpl
	var buf bytes.Buffer
	_ = Write(&buf, f)
	bank := parse(t, buf.Bytes())
	if bank.Sm24Len != 0 {
		t.Fatalf("an sm24 chunk of the wrong size must be ignored, got %d bytes", bank.Sm24Len)
	}
	out, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if tr := parse(t, out); tr.Sm24Len != 0 {
		t.Fatalf("sm24 in the output: %d", tr.Sm24Len)
	}
}

func TestRegression_LinkToAMissingSampleBecomesMono(t *testing.T) {
	_, f := stereoBank()
	f.Samples[1].Link = 99 // a left channel whose partner does not exist
	var buf bytes.Buffer
	_ = Write(&buf, f)
	bank := parse(t, buf.Bytes())
	out, err := Trim(bank, []PresetKey{{0, 5}}, bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	tr := parse(t, out)
	if len(tr.Samples) != 2 || tr.Samples[0].Type != 1 || tr.Samples[0].Link != 0 {
		t.Fatalf("a sample whose partner is missing must become mono, not point at an unrelated sample: %+v", tr.Samples[0])
	}
}
