package testfix

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// Preset is one SoundFont preset with one instrument holding one zone per sample.
type Preset struct {
	Name          string
	Bank, Program uint16
	Samples       [][]int16 // mono, 22050 Hz, original key 60
}

const (
	sf2SampleRate = 22050
	sf2Padding    = 46 // zero samples the spec requires after every sample
)

type riffBuf struct{ bytes.Buffer }

func (b *riffBuf) u16(v uint16) { _ = binary.Write(b, binary.LittleEndian, v) }
func (b *riffBuf) u32(v uint32) { _ = binary.Write(b, binary.LittleEndian, v) }

// name20 writes a NUL-padded 20-byte name.
func (b *riffBuf) name20(s string) {
	var n [20]byte
	copy(n[:19], s)
	b.Write(n[:])
}

func chunk(id string, body []byte) []byte {
	var out riffBuf
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

// SF2 builds a minimal valid SoundFont 2.01 file. Every preset needs at least
// one sample. The key range 0-127 is split evenly across a preset's samples.
func SF2(presets []Preset) []byte {
	var smpl, phdr, pbag, pgen, inst, ibag, igen, shdr riffBuf
	sampleCount := 0 // shdr records written so far
	zoneCount := 0   // ibag records written so far
	var pos uint32   // position in the smpl chunk, in samples

	for pi, p := range presets {
		if len(p.Samples) == 0 {
			panic(fmt.Sprintf("testfix.SF2: preset %q has no samples", p.Name))
		}
		phdr.name20(p.Name)
		phdr.u16(p.Program)
		phdr.u16(p.Bank)
		phdr.u16(uint16(pi)) // preset bag index
		phdr.u32(0)
		phdr.u32(0)
		phdr.u32(0)

		pbag.u16(uint16(pi)) // one generator per preset zone
		pbag.u16(0)
		pgen.u16(41) // instrument
		pgen.u16(uint16(pi))

		inst.name20(p.Name)
		inst.u16(uint16(zoneCount))
		n := len(p.Samples)
		if n > 128 {
			panic(fmt.Sprintf("testfix.SF2: preset %q has %d samples, at most 128 fit the key range", p.Name, n))
		}
		for si, s := range p.Samples {
			lo, hi := si*128/n, (si+1)*128/n-1
			ibag.u16(uint16(2 * zoneCount))
			ibag.u16(0)
			igen.u16(43) // keyRange
			igen.u16(uint16(lo) | uint16(hi)<<8)
			igen.u16(53) // sampleID, always the last generator of a zone
			igen.u16(uint16(sampleCount))
			zoneCount++

			shdr.name20(fmt.Sprintf("%s-%d", p.Name, si))
			shdr.u32(pos)
			shdr.u32(pos + uint32(len(s)))
			shdr.u32(pos)
			shdr.u32(pos + uint32(len(s)))
			shdr.u32(sf2SampleRate)
			shdr.WriteByte(60)
			shdr.WriteByte(0)
			shdr.u16(0)
			shdr.u16(1) // monoSample
			sampleCount++

			for _, v := range s {
				smpl.u16(uint16(v))
			}
			smpl.Write(make([]byte, 2*sf2Padding))
			pos += uint32(len(s)) + sf2Padding
		}
	}

	// terminal records
	phdr.name20("EOP")
	phdr.u16(0)
	phdr.u16(0)
	phdr.u16(uint16(len(presets)))
	phdr.Write(make([]byte, 12))
	pbag.u16(uint16(len(presets)))
	pbag.u16(0)
	pgen.u16(0)
	pgen.u16(0)
	inst.name20("EOI")
	inst.u16(uint16(zoneCount))
	ibag.u16(uint16(2 * zoneCount))
	ibag.u16(0)
	igen.u16(0)
	igen.u16(0)
	shdr.name20("EOS")
	shdr.Write(make([]byte, 26))
	zeroMod := make([]byte, 10) // pmod and imod only need their terminal record

	info := list("INFO",
		chunk("ifil", []byte{2, 0, 1, 0}),
		chunk("isng", zstr("EMU8000")),
		chunk("INAM", zstr("Kantahe test")),
	)
	sdta := list("sdta", chunk("smpl", smpl.Bytes()))
	pdta := list("pdta",
		chunk("phdr", phdr.Bytes()), chunk("pbag", pbag.Bytes()), chunk("pmod", zeroMod), chunk("pgen", pgen.Bytes()),
		chunk("inst", inst.Bytes()), chunk("ibag", ibag.Bytes()), chunk("imod", zeroMod), chunk("igen", igen.Bytes()),
		chunk("shdr", shdr.Bytes()),
	)
	body := append([]byte("sfbk"), bytes.Join([][]byte{info, sdta, pdta}, nil)...)
	return chunk("RIFF", body)
}
