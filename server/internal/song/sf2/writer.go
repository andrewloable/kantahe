package sf2

import (
	"bytes"
	"encoding/binary"
	"io"
)

// File is a whole SoundFont held in memory, ready to be written. The hydra lists
// include their terminal records (EOP, EOI, EOS and the closing bag, mod and gen).
type File struct {
	Info         []Chunk
	Presets      []Preset
	PBags, IBags []Bag
	PMods, IMods []Mod
	PGens, IGens []Gen
	Insts        []Inst
	Samples      []Sample
	Smpl         []byte // 16-bit sample data
	Sm24         []byte // optional low bytes of 24-bit samples, one byte per point
}

func chunk(id string, data []byte) []byte {
	var b bytes.Buffer
	b.WriteString(id)
	_ = binary.Write(&b, binary.LittleEndian, uint32(len(data)))
	b.Write(data)
	if len(data)%2 == 1 {
		b.WriteByte(0)
	}
	return b.Bytes()
}

func list(kind string, parts ...[]byte) []byte {
	return chunk("LIST", append([]byte(kind), bytes.Join(parts, nil)...))
}

// Write serialises the file as a RIFF sfbk with exact sizes and even-padded chunks.
func Write(w io.Writer, f *File) error {
	var info [][]byte
	for _, c := range f.Info {
		info = append(info, chunk(c.ID, c.Data))
	}
	sdta := [][]byte{chunk("smpl", f.Smpl)}
	if len(f.Sm24) > 0 {
		sdta = append(sdta, chunk("sm24", f.Sm24))
	}
	pdta := [][]byte{
		chunk("phdr", encodePresets(f.Presets)), chunk("pbag", encodeBags(f.PBags)), chunk("pmod", encodeMods(f.PMods)), chunk("pgen", encodeGens(f.PGens)),
		chunk("inst", encodeInsts(f.Insts)), chunk("ibag", encodeBags(f.IBags)), chunk("imod", encodeMods(f.IMods)), chunk("igen", encodeGens(f.IGens)),
		chunk("shdr", encodeSamples(f.Samples)),
	}
	body := append([]byte("sfbk"), bytes.Join([][]byte{list("INFO", info...), list("sdta", sdta...), list("pdta", pdta...)}, nil)...)
	_, err := w.Write(chunk("RIFF", body))
	return err
}
