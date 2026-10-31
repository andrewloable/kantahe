package main

import (
	"bytes"
	"encoding/binary"
	"io"
	"math"
	"testing"

	"github.com/mewkiz/flac"
)

// --- fixtures: a tiny SoundFont with one looped sine sample, and a one-note MIDI file ---

type le struct{ bytes.Buffer }

func (b *le) u16(v uint16) { _ = binary.Write(b, binary.LittleEndian, v) }
func (b *le) u32(v uint32) { _ = binary.Write(b, binary.LittleEndian, v) }
func (b *le) name20(s string) {
	var n [20]byte
	copy(n[:19], s)
	b.Write(n[:])
}

func chunk(id string, body []byte) []byte {
	var out le
	out.WriteString(id)
	out.u32(uint32(len(body)))
	out.Write(body)
	if len(body)%2 == 1 {
		out.WriteByte(0)
	}
	return out.Bytes()
}

func list(kind string, parts ...[]byte) []byte {
	return chunk("LIST", append([]byte(kind), bytes.Join(parts, nil)...))
}

func zstr(s string) []byte {
	b := append([]byte(s), 0)
	if len(b)%2 == 1 {
		b = append(b, 0)
	}
	return b
}

// sineSoundFont is a SoundFont 2.01 with preset 0/0 playing a one-second 441 Hz sine (22050 Hz, 441
// cycles) that loops between sample 50 and 22000, so a note sustains for as long as it is held.
func sineSoundFont() []byte {
	const rate, n, pad = 22050, 22050, 46
	var smpl le
	for i := 0; i < n; i++ {
		smpl.u16(uint16(int16(20000 * math.Sin(2*math.Pi*441*float64(i)/rate))))
	}
	smpl.Write(make([]byte, 2*pad))

	var phdr, pbag, pgen, inst, ibag, igen, shdr le
	phdr.name20("Sine")
	phdr.u16(0) // program
	phdr.u16(0) // bank
	phdr.u16(0) // preset bag index
	phdr.Write(make([]byte, 12))
	phdr.name20("EOP")
	phdr.u16(0)
	phdr.u16(0)
	phdr.u16(1)
	phdr.Write(make([]byte, 12))
	pbag.u16(0) // preset zone: gen index 0, mod index 0
	pbag.u16(0)
	pbag.u16(1)
	pbag.u16(0)
	pgen.u16(41) // instrument
	pgen.u16(0)
	pgen.u16(0)
	pgen.u16(0)
	inst.name20("Sine")
	inst.u16(0)
	inst.name20("EOI")
	inst.u16(1)
	ibag.u16(0)
	ibag.u16(0)
	ibag.u16(2) // two generators in the zone
	ibag.u16(0)
	igen.u16(54) // sampleModes: loop continuously
	igen.u16(1)
	igen.u16(53) // sampleID
	igen.u16(0)
	igen.u16(0)
	igen.u16(0)
	shdr.name20("Sine")
	shdr.u32(0)
	shdr.u32(n)
	shdr.u32(50)    // loop start
	shdr.u32(22000) // loop end
	shdr.u32(rate)
	shdr.WriteByte(60)
	shdr.WriteByte(0)
	shdr.u16(0)
	shdr.u16(1) // mono
	shdr.name20("EOS")
	shdr.Write(make([]byte, 26))
	zeroMod := make([]byte, 10)

	info := list("INFO", chunk("ifil", []byte{2, 0, 1, 0}), chunk("isng", zstr("EMU8000")), chunk("INAM", zstr("sine")))
	sdta := list("sdta", chunk("smpl", smpl.Bytes()))
	pdta := list("pdta",
		chunk("phdr", phdr.Bytes()), chunk("pbag", pbag.Bytes()), chunk("pmod", zeroMod), chunk("pgen", pgen.Bytes()),
		chunk("inst", inst.Bytes()), chunk("ibag", ibag.Bytes()), chunk("imod", zeroMod), chunk("igen", igen.Bytes()),
		chunk("shdr", shdr.Bytes()),
	)
	return chunk("RIFF", append([]byte("sfbk"), bytes.Join([][]byte{info, sdta, pdta}, nil)...))
}

func vlq(v uint32) []byte {
	out := []byte{byte(v & 0x7f)}
	for v >>= 7; v > 0; v >>= 7 {
		out = append([]byte{byte(v&0x7f) | 0x80}, out...)
	}
	return out
}

// oneNoteMIDI is a format 0 file at 120 bpm, 480 ticks per quarter note, with middle C held for
// `quarters` quarter notes (two quarters make one second).
func oneNoteMIDI(quarters int) []byte {
	var tr bytes.Buffer
	tr.Write([]byte{0, 0xFF, 0x51, 3, 0x07, 0xA1, 0x20}) // tempo 500000 us per quarter note
	tr.Write([]byte{0, 0x90, 60, 100})
	tr.Write(vlq(uint32(480 * quarters)))
	tr.Write([]byte{0x80, 60, 0})
	tr.Write([]byte{0, 0xFF, 0x2F, 0})
	var out bytes.Buffer
	out.WriteString("MThd")
	binary.Write(&out, binary.BigEndian, uint32(6))
	binary.Write(&out, binary.BigEndian, []uint16{0, 1, 480})
	out.WriteString("MTrk")
	binary.Write(&out, binary.BigEndian, uint32(tr.Len()))
	out.Write(tr.Bytes())
	return out.Bytes()
}

func rms(x []float32) float64 {
	var s float64
	for _, v := range x {
		s += float64(v) * float64(v)
	}
	return math.Sqrt(s / float64(len(x)))
}

// --- tests ---

func TestRenderSineFixture(t *testing.T) {
	left, right, err := render(oneNoteMIDI(4), sineSoundFont(), 44100) // 4 quarters = 2 s
	if err != nil {
		t.Fatal(err)
	}
	if len(left) != len(right) {
		t.Fatalf("channels differ in length: %d and %d", len(left), len(right))
	}
	if d := len(left) - 88200; d < -4410 || d > 4410 {
		t.Fatalf("rendered %d samples, want 88200 +- 4410 (2 s at 44100 Hz)", len(left))
	}
	if r := rms(left); r <= 0.01 {
		t.Fatalf("left channel is silent: rms %v", r)
	}
	if r := rms(right); r <= 0.01 {
		t.Fatalf("right channel is silent: rms %v", r)
	}
}

func TestRenderRejectsBadInput(t *testing.T) {
	if _, _, err := render([]byte("not a midi file"), sineSoundFont(), 44100); err == nil {
		t.Error("garbage MIDI was accepted")
	}
	if _, _, err := render(oneNoteMIDI(2), []byte("not a soundfont"), 44100); err == nil {
		t.Error("garbage SoundFont was accepted")
	}
	if _, _, err := render(oneNoteMIDI(2), sineSoundFont(), 10); err == nil {
		t.Error("an absurd sample rate was accepted")
	}
}

func TestPCM16ClipsAndRounds(t *testing.T) {
	got := pcm16([]float32{0, 1, -1, 2, -2, 0.5}, []float32{0.25, 0, 0, 0, 0, 0})
	want := []int16{0, 8192, 32767, 0, -32768, 0, 32767, 0, -32768, 0, 16384, 0}
	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("sample %d = %d, want %d", i, got[i], want[i])
		}
	}
}

func TestEncodeWAVHeader(t *testing.T) {
	silence := make([]float32, 44100)
	b := encodeWAV(silence, silence, 44100)
	if len(b) != 44+176400 {
		t.Fatalf("len = %d, want %d", len(b), 44+176400)
	}
	if string(b[0:4]) != "RIFF" || string(b[8:12]) != "WAVE" || string(b[12:16]) != "fmt " || string(b[36:40]) != "data" {
		t.Fatalf("bad tags: %q %q %q %q", b[0:4], b[8:12], b[12:16], b[36:40])
	}
	u32 := func(o int) uint32 { return binary.LittleEndian.Uint32(b[o:]) }
	u16 := func(o int) uint16 { return binary.LittleEndian.Uint16(b[o:]) }
	if got := u32(40); got != 176400 {
		t.Errorf("data size = %d, want 176400", got)
	}
	if got := u32(4); got != 36+176400 {
		t.Errorf("RIFF size = %d, want %d", got, 36+176400)
	}
	if u32(16) != 16 || u16(20) != 1 || u16(22) != 2 || u32(24) != 44100 || u32(28) != 176400 || u16(32) != 4 || u16(34) != 16 {
		t.Errorf("fmt chunk wrong: size %d format %d channels %d rate %d byterate %d align %d bits %d",
			u32(16), u16(20), u16(22), u32(24), u32(28), u16(32), u16(34))
	}
}

func TestEncodeFLACRoundTrip(t *testing.T) {
	left, right, err := render(oneNoteMIDI(4), sineSoundFont(), 44100)
	if err != nil {
		t.Fatal(err)
	}
	b, err := encodeFLAC(left, right, 44100)
	if err != nil {
		t.Fatal(err)
	}
	if wav := encodeWAV(left, right, 44100); len(b) >= len(wav) {
		t.Errorf("FLAC (%d bytes) is not smaller than WAV (%d bytes)", len(b), len(wav))
	}

	st, err := flac.New(bytes.NewReader(b))
	if err != nil {
		t.Fatalf("decoder rejects the stream: %v", err)
	}
	if st.Info.SampleRate != 44100 || st.Info.NChannels != 2 || st.Info.BitsPerSample != 16 {
		t.Fatalf("stream info = %+v", st.Info)
	}
	if st.Info.NSamples != uint64(len(left)) {
		t.Errorf("stream info says %d samples, rendered %d", st.Info.NSamples, len(left))
	}
	// A fixed-block stream with a shorter last block must still say "min block size = max block size":
	// the reference decoder (flac -t) otherwise reports frame numbers that do not increase correctly.
	if len(left)%flacBlock == 0 {
		t.Fatal("fixture length is a whole number of blocks; the test needs a short last block")
	}
	if st.Info.BlockSizeMin != flacBlock || st.Info.BlockSizeMax != flacBlock {
		t.Errorf("block sizes in the stream info = %d..%d, want %d..%d", st.Info.BlockSizeMin, st.Info.BlockSizeMax, flacBlock, flacBlock)
	}
	want := pcm16(left, right)
	var got []int32
	for {
		fr, err := st.ParseNext()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		for i := 0; i < int(fr.BlockSize); i++ {
			got = append(got, fr.Subframes[0].Samples[i], fr.Subframes[1].Samples[i])
		}
	}
	if len(got) != len(want) {
		t.Fatalf("decoded %d values, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != int32(want[i]) {
			t.Fatalf("value %d decodes to %d, want %d (FLAC must be lossless)", i, got[i], want[i])
		}
	}
}
