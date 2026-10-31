// Package sf2 reads, writes and trims SoundFont 2 files: the RIFF container
// with its INFO, sample and hydra (preset/instrument/sample) lists. Trim builds
// a small bank holding only the presets a song uses.
package sf2

import (
	"encoding/binary"
	"errors"
)

// Errors returned by the reader and the trimmer.
var (
	ErrCorrupt     = errors.New("sf2: corrupt SoundFont")
	ErrUnsupported = errors.New("sf2: unsupported SoundFont feature")
)

// Record sizes of the hydra chunks (SoundFont 2.04 spec, section 7).
const (
	presetSize = 38
	bagSize    = 4
	modSize    = 10
	genSize    = 4
	instSize   = 22
	sampleSize = 46
)

// Generator operators that link the hydra lists together.
const (
	genInstrument = 41
	genSampleID   = 53
)

// Sample types: bit 15 marks a ROM sample, which cannot be copied.
const romSample = 0x8000

// Padding after every sample: 46 zero-valued points (spec section 6.1).
const samplePadding = 46

// Chunk is a raw RIFF chunk (an INFO sub-chunk).
type Chunk struct {
	ID   string
	Data []byte
}

// Preset is a phdr record.
type Preset struct {
	Name                       string
	Program, Bank              uint16
	BagIndex                   uint16
	Library, Genre, Morphology uint32
}

// Bag is a pbag or ibag record: where a zone's generators and modulators start.
type Bag struct{ GenIndex, ModIndex uint16 }

// Mod is a pmod or imod record.
type Mod struct {
	Src, Dest uint16
	Amount    int16
	AmtSrc    uint16
	Trans     uint16
}

// Gen is a pgen or igen record; Amount holds the two raw bytes.
type Gen struct {
	Oper   uint16
	Amount [2]byte
}

// U16 is the amount as an unsigned 16-bit value (instrument and sample indices).
func (g Gen) U16() uint16 { return binary.LittleEndian.Uint16(g.Amount[:]) }

// GenU16 builds a generator whose amount is an unsigned 16-bit value.
func GenU16(oper, amount uint16) Gen {
	g := Gen{Oper: oper}
	binary.LittleEndian.PutUint16(g.Amount[:], amount)
	return g
}

// Inst is an inst record.
type Inst struct {
	Name     string
	BagIndex uint16
}

// Sample is an shdr record. Start, End and the loop points are in sample points
// from the start of the smpl chunk.
type Sample struct {
	Name                                 string
	Start, End, LoopStart, LoopEnd, Rate uint32
	Pitch                                uint8
	Correction                           int8
	Link, Type                           uint16
}

func name20(b []byte) string {
	for i, c := range b {
		if c == 0 {
			return string(b[:i])
		}
	}
	return string(b)
}

func putName20(b []byte, s string) {
	for i := range b {
		b[i] = 0
	}
	copy(b, s) // up to all 20 bytes: real banks fill the field without a terminating NUL
}

func decodePresets(b []byte) []Preset {
	out := make([]Preset, len(b)/presetSize)
	for i := range out {
		r := b[i*presetSize:]
		out[i] = Preset{
			Name: name20(r[:20]), Program: binary.LittleEndian.Uint16(r[20:]), Bank: binary.LittleEndian.Uint16(r[22:]),
			BagIndex: binary.LittleEndian.Uint16(r[24:]), Library: binary.LittleEndian.Uint32(r[26:]),
			Genre: binary.LittleEndian.Uint32(r[30:]), Morphology: binary.LittleEndian.Uint32(r[34:]),
		}
	}
	return out
}

func encodePresets(ps []Preset) []byte {
	b := make([]byte, len(ps)*presetSize)
	for i, p := range ps {
		r := b[i*presetSize:]
		putName20(r[:20], p.Name)
		binary.LittleEndian.PutUint16(r[20:], p.Program)
		binary.LittleEndian.PutUint16(r[22:], p.Bank)
		binary.LittleEndian.PutUint16(r[24:], p.BagIndex)
		binary.LittleEndian.PutUint32(r[26:], p.Library)
		binary.LittleEndian.PutUint32(r[30:], p.Genre)
		binary.LittleEndian.PutUint32(r[34:], p.Morphology)
	}
	return b
}

func decodeBags(b []byte) []Bag {
	out := make([]Bag, len(b)/bagSize)
	for i := range out {
		out[i] = Bag{binary.LittleEndian.Uint16(b[i*bagSize:]), binary.LittleEndian.Uint16(b[i*bagSize+2:])}
	}
	return out
}

func encodeBags(bs []Bag) []byte {
	b := make([]byte, len(bs)*bagSize)
	for i, g := range bs {
		binary.LittleEndian.PutUint16(b[i*bagSize:], g.GenIndex)
		binary.LittleEndian.PutUint16(b[i*bagSize+2:], g.ModIndex)
	}
	return b
}

func decodeMods(b []byte) []Mod {
	out := make([]Mod, len(b)/modSize)
	for i := range out {
		r := b[i*modSize:]
		out[i] = Mod{binary.LittleEndian.Uint16(r), binary.LittleEndian.Uint16(r[2:]), int16(binary.LittleEndian.Uint16(r[4:])),
			binary.LittleEndian.Uint16(r[6:]), binary.LittleEndian.Uint16(r[8:])}
	}
	return out
}

func encodeMods(ms []Mod) []byte {
	b := make([]byte, len(ms)*modSize)
	for i, m := range ms {
		r := b[i*modSize:]
		binary.LittleEndian.PutUint16(r, m.Src)
		binary.LittleEndian.PutUint16(r[2:], m.Dest)
		binary.LittleEndian.PutUint16(r[4:], uint16(m.Amount))
		binary.LittleEndian.PutUint16(r[6:], m.AmtSrc)
		binary.LittleEndian.PutUint16(r[8:], m.Trans)
	}
	return b
}

func decodeGens(b []byte) []Gen {
	out := make([]Gen, len(b)/genSize)
	for i := range out {
		out[i] = Gen{Oper: binary.LittleEndian.Uint16(b[i*genSize:]), Amount: [2]byte{b[i*genSize+2], b[i*genSize+3]}}
	}
	return out
}

func encodeGens(gs []Gen) []byte {
	b := make([]byte, len(gs)*genSize)
	for i, g := range gs {
		binary.LittleEndian.PutUint16(b[i*genSize:], g.Oper)
		b[i*genSize+2], b[i*genSize+3] = g.Amount[0], g.Amount[1]
	}
	return b
}

func decodeInsts(b []byte) []Inst {
	out := make([]Inst, len(b)/instSize)
	for i := range out {
		out[i] = Inst{name20(b[i*instSize : i*instSize+20]), binary.LittleEndian.Uint16(b[i*instSize+20:])}
	}
	return out
}

func encodeInsts(is []Inst) []byte {
	b := make([]byte, len(is)*instSize)
	for i, in := range is {
		putName20(b[i*instSize:i*instSize+20], in.Name)
		binary.LittleEndian.PutUint16(b[i*instSize+20:], in.BagIndex)
	}
	return b
}

func decodeSamples(b []byte) []Sample {
	out := make([]Sample, len(b)/sampleSize)
	for i := range out {
		r := b[i*sampleSize:]
		out[i] = Sample{
			Name: name20(r[:20]), Start: binary.LittleEndian.Uint32(r[20:]), End: binary.LittleEndian.Uint32(r[24:]),
			LoopStart: binary.LittleEndian.Uint32(r[28:]), LoopEnd: binary.LittleEndian.Uint32(r[32:]),
			Rate: binary.LittleEndian.Uint32(r[36:]), Pitch: r[40], Correction: int8(r[41]),
			Link: binary.LittleEndian.Uint16(r[42:]), Type: binary.LittleEndian.Uint16(r[44:]),
		}
	}
	return out
}

func encodeSamples(ss []Sample) []byte {
	b := make([]byte, len(ss)*sampleSize)
	for i, s := range ss {
		r := b[i*sampleSize:]
		putName20(r[:20], s.Name)
		binary.LittleEndian.PutUint32(r[20:], s.Start)
		binary.LittleEndian.PutUint32(r[24:], s.End)
		binary.LittleEndian.PutUint32(r[28:], s.LoopStart)
		binary.LittleEndian.PutUint32(r[32:], s.LoopEnd)
		binary.LittleEndian.PutUint32(r[36:], s.Rate)
		r[40] = s.Pitch
		r[41] = byte(s.Correction)
		binary.LittleEndian.PutUint16(r[42:], s.Link)
		binary.LittleEndian.PutUint16(r[44:], s.Type)
	}
	return b
}
