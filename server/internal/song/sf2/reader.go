package sf2

import (
	"encoding/binary"
	"fmt"
	"io"
)

// Bank is a parsed SoundFont. The sample data stays in the source; only its
// position is kept.
type Bank struct {
	Info                []Chunk
	Presets             []Preset
	PBags, IBags        []Bag
	PMods, IMods        []Mod
	PGens, IGens        []Gen
	Insts               []Inst
	Samples             []Sample
	SmplOffset, SmplLen int64 // absolute position and byte length of the 16-bit samples
	Sm24Offset, Sm24Len int64 // the optional low bytes of 24-bit samples
}

func corrupt(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrCorrupt, fmt.Sprintf(format, args...))
}

// chunkHeader reads an 8-byte RIFF chunk header at off and checks that the data fits before end.
func chunkHeader(r io.ReaderAt, off, end int64) (id string, dataOff, dataLen int64, err error) {
	if off+8 > end {
		return "", 0, 0, corrupt("chunk header at %d runs past the end", off)
	}
	var h [8]byte
	if _, err := r.ReadAt(h[:], off); err != nil {
		return "", 0, 0, corrupt("cannot read chunk header at %d", off)
	}
	n := int64(binary.LittleEndian.Uint32(h[4:]))
	if off+8+n > end {
		return "", 0, 0, corrupt("chunk %q at %d is %d bytes but only %d remain", string(h[:4]), off, n, end-off-8)
	}
	return string(h[:4]), off + 8, n, nil
}

func readAll(r io.ReaderAt, off, n int64) ([]byte, error) {
	b := make([]byte, n)
	if _, err := r.ReadAt(b, off); err != nil && !(err == io.EOF && int64(len(b)) == n) {
		return nil, corrupt("cannot read %d bytes at %d", n, off)
	}
	return b, nil
}

// next is the offset of the chunk after one with n data bytes at dataOff (chunks are even-padded).
func next(dataOff, n int64) int64 { return dataOff + n + n%2 }

// Parse reads a SoundFont's structure without loading its sample data.
func Parse(r io.ReaderAt, size int64) (*Bank, error) {
	if size < 12 {
		return nil, corrupt("too short for a RIFF file")
	}
	var h [12]byte
	if _, err := r.ReadAt(h[:], 0); err != nil {
		return nil, corrupt("cannot read the RIFF header")
	}
	if string(h[:4]) != "RIFF" || string(h[8:12]) != "sfbk" {
		return nil, corrupt("not a RIFF sfbk file")
	}
	end := 8 + int64(binary.LittleEndian.Uint32(h[4:]))
	if end > size {
		return nil, corrupt("RIFF size %d is larger than the file (%d)", end, size)
	}
	b := &Bank{}
	hydra := map[string][]byte{}
	for off := int64(12); off < end; {
		id, dataOff, n, err := chunkHeader(r, off, end)
		if err != nil {
			return nil, err
		}
		off = next(dataOff, n)
		if id != "LIST" {
			continue // unknown top-level chunks are skipped
		}
		if n < 4 {
			return nil, corrupt("LIST chunk without a type")
		}
		var kind [4]byte
		if _, err := r.ReadAt(kind[:], dataOff); err != nil {
			return nil, corrupt("cannot read a LIST type")
		}
		listEnd := dataOff + n
		for sub := dataOff + 4; sub < listEnd; {
			sid, sOff, sn, err := chunkHeader(r, sub, listEnd)
			if err != nil {
				return nil, err
			}
			sub = next(sOff, sn)
			switch string(kind[:]) {
			case "INFO":
				data, err := readAll(r, sOff, sn)
				if err != nil {
					return nil, err
				}
				b.Info = append(b.Info, Chunk{sid, data})
			case "sdta":
				switch sid {
				case "smpl":
					b.SmplOffset, b.SmplLen = sOff, sn
				case "sm24":
					b.Sm24Offset, b.Sm24Len = sOff, sn
				}
			case "pdta":
				data, err := readAll(r, sOff, sn)
				if err != nil {
					return nil, err
				}
				hydra[sid] = data
			}
		}
	}
	for _, id := range []string{"phdr", "pbag", "pmod", "pgen", "inst", "ibag", "imod", "igen", "shdr"} {
		if _, ok := hydra[id]; !ok {
			return nil, corrupt("missing %s chunk", id)
		}
	}
	for id, size := range map[string]int{"phdr": presetSize, "pbag": bagSize, "pmod": modSize, "pgen": genSize, "inst": instSize, "ibag": bagSize, "imod": modSize, "igen": genSize, "shdr": sampleSize} {
		if len(hydra[id])%size != 0 || len(hydra[id]) == 0 {
			return nil, corrupt("%s chunk has %d bytes, not a multiple of %d", id, len(hydra[id]), size)
		}
	}
	b.Presets, b.PBags, b.PMods, b.PGens = decodePresets(hydra["phdr"]), decodeBags(hydra["pbag"]), decodeMods(hydra["pmod"]), decodeGens(hydra["pgen"])
	b.Insts, b.IBags, b.IMods, b.IGens = decodeInsts(hydra["inst"]), decodeBags(hydra["ibag"]), decodeMods(hydra["imod"]), decodeGens(hydra["igen"])
	b.Samples = decodeSamples(hydra["shdr"])
	if b.Sm24Len != 0 && b.Sm24Len != b.SmplLen/2 {
		b.Sm24Offset, b.Sm24Len = 0, 0 // the spec ties its size to smpl; anything else is ignored
	}
	return b, b.validate()
}

func (b *Bank) validate() error {
	if b.Presets[len(b.Presets)-1].Name != "EOP" {
		return corrupt("the preset list does not end with the EOP record")
	}
	if b.Insts[len(b.Insts)-1].Name != "EOI" {
		return corrupt("the instrument list does not end with the EOI record")
	}
	if b.Samples[len(b.Samples)-1].Name != "EOS" {
		return corrupt("the sample list does not end with the EOS record")
	}
	bagIdx := func(v []uint16, limit int, what string) error {
		for i, x := range v {
			if int(x) >= limit || (i > 0 && x < v[i-1]) {
				return corrupt("%s index %d at record %d is out of order or out of range", what, x, i)
			}
		}
		return nil
	}
	var idx []uint16
	for _, p := range b.Presets {
		idx = append(idx, p.BagIndex)
	}
	if err := bagIdx(idx, len(b.PBags), "preset bag"); err != nil {
		return err
	}
	idx = idx[:0]
	for _, in := range b.Insts {
		idx = append(idx, in.BagIndex)
	}
	if err := bagIdx(idx, len(b.IBags), "instrument bag"); err != nil {
		return err
	}
	check := func(bags []Bag, gens, mods int, what string) error {
		for i, bg := range bags {
			if int(bg.GenIndex) >= gens || int(bg.ModIndex) >= mods ||
				(i > 0 && (bg.GenIndex < bags[i-1].GenIndex || bg.ModIndex < bags[i-1].ModIndex)) {
				return corrupt("%s %d has generator/modulator indexes out of order or out of range", what, i)
			}
		}
		return nil
	}
	if err := check(b.PBags, len(b.PGens), len(b.PMods), "preset zone"); err != nil {
		return err
	}
	if err := check(b.IBags, len(b.IGens), len(b.IMods), "instrument zone"); err != nil {
		return err
	}
	points := uint32(b.SmplLen / 2)
	for i, s := range b.Samples[:len(b.Samples)-1] {
		if s.Start > s.End || s.End > points {
			return corrupt("sample %d (%q) lies outside the sample data", i, s.Name)
		}
	}
	return nil
}
