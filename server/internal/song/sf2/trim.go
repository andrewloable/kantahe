package sf2

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"sort"
)

// ErrNoPresets means none of the requested presets exists in the bank.
var ErrNoPresets = errors.New("sf2: none of the requested presets exists")

// maxOutput bounds the trimmed bank so that a bad request cannot exhaust memory.
const maxOutput = 512 << 20

// PresetKey names a preset by bank and program (drums are bank 128).
type PresetKey struct{ Bank, Program uint16 }

// resolve finds the preset to use for a requested key: the exact one, else for
// bank 128 the standard kit (128, 0), else (0, program), else (0, 0).
func (b *Bank) resolve(k PresetKey) (int, bool) {
	find := func(bank, program uint16) (int, bool) {
		for i, p := range b.Presets[:len(b.Presets)-1] {
			if p.Bank == bank && p.Program == program {
				return i, true
			}
		}
		return 0, false
	}
	if i, ok := find(k.Bank, k.Program); ok {
		return i, true
	}
	if k.Bank == 128 {
		return find(128, 0)
	}
	if i, ok := find(0, k.Program); ok {
		return i, true
	}
	return find(0, 0)
}

func hasLink(mods []Mod) bool {
	for _, m := range mods {
		if m.Dest&0x8000 != 0 {
			return true
		}
	}
	return false
}

// Trim builds a SoundFont holding only the presets the keys resolve to, the
// instruments they use and the samples (with their stereo partners) those use.
// Sample data is read from src one sample at a time.
func Trim(b *Bank, keep []PresetKey, src io.ReaderAt) ([]byte, error) {
	chosen := map[int]bool{}
	for _, k := range keep {
		if i, ok := b.resolve(k); ok {
			chosen[i] = true
		}
	}
	if len(chosen) == 0 {
		return nil, ErrNoPresets
	}
	presets := sortedKeys(chosen)

	// instruments used by the kept presets
	usedInst := map[int]bool{}
	for _, p := range presets {
		for z := int(b.Presets[p].BagIndex); z < int(b.Presets[p+1].BagIndex); z++ {
			gens, mods := zone(b.PBags, b.PGens, b.PMods, z)
			if hasLink(mods) {
				return nil, fmt.Errorf("%w: linked modulators", ErrUnsupported)
			}
			for _, g := range gens {
				if g.Oper == genInstrument {
					if int(g.U16()) >= len(b.Insts)-1 {
						return nil, corrupt("preset %q uses instrument %d which does not exist", b.Presets[p].Name, g.U16())
					}
					usedInst[int(g.U16())] = true
				}
			}
		}
	}
	insts := sortedKeys(usedInst)

	// samples used by those instruments, plus linked partners
	usedSample := map[int]bool{}
	for _, in := range insts {
		for z := int(b.Insts[in].BagIndex); z < int(b.Insts[in+1].BagIndex); z++ {
			gens, mods := zone(b.IBags, b.IGens, b.IMods, z)
			if hasLink(mods) {
				return nil, fmt.Errorf("%w: linked modulators", ErrUnsupported)
			}
			for _, g := range gens {
				if g.Oper == genSampleID {
					if int(g.U16()) >= len(b.Samples)-1 {
						return nil, corrupt("instrument %q uses sample %d which does not exist", b.Insts[in].Name, g.U16())
					}
					usedSample[int(g.U16())] = true
				}
			}
		}
	}
	for changed := true; changed; {
		changed = false
		for s := range usedSample {
			sm := b.Samples[s]
			if sm.Type&romSample != 0 {
				return nil, fmt.Errorf("%w: ROM samples", ErrUnsupported)
			}
			if sm.Type&(2|4|8) != 0 && int(sm.Link) < len(b.Samples)-1 && !usedSample[int(sm.Link)] {
				usedSample[int(sm.Link)] = true
				changed = true
			}
		}
	}
	samples := sortedKeys(usedSample)

	newInst := index(insts)
	newSample := index(samples)
	out := &File{Info: b.Info}

	// samples: data, offsets and links
	var total int64
	for _, s := range samples {
		total += (int64(b.Samples[s].End-b.Samples[s].Start) + samplePadding) * 2
		if total > maxOutput {
			return nil, fmt.Errorf("%w: the trimmed bank would exceed %d bytes", ErrUnsupported, maxOutput)
		}
	}
	out.Smpl = make([]byte, 0, total)
	if b.Sm24Len > 0 {
		out.Sm24 = make([]byte, 0, total/2)
	}
	for _, s := range samples {
		old := b.Samples[s]
		n := int64(old.End - old.Start)
		data := make([]byte, n*2)
		if err := readFull(src, data, b.SmplOffset+int64(old.Start)*2, old.Name); err != nil {
			return nil, err
		}
		start := uint32(len(out.Smpl) / 2)
		out.Smpl = append(out.Smpl, data...)
		out.Smpl = append(out.Smpl, make([]byte, samplePadding*2)...)
		if b.Sm24Len > 0 {
			low := make([]byte, n)
			if err := readFull(src, low, b.Sm24Offset+int64(old.Start), old.Name); err != nil {
				return nil, err
			}
			out.Sm24 = append(out.Sm24, low...)
			out.Sm24 = append(out.Sm24, make([]byte, samplePadding)...)
		}
		ns := old
		ns.Start, ns.End = start, start+uint32(n)
		ns.LoopStart = start + clamp(old.LoopStart, old.Start, old.End) - old.Start
		ns.LoopEnd = start + clamp(old.LoopEnd, old.Start, old.End) - old.Start
		ns.Link = 0
		if old.Type&(2|4|8) != 0 {
			if idx, ok := newSample[int(old.Link)]; ok && int(old.Link) < len(b.Samples)-1 {
				ns.Link = uint16(idx)
			} else {
				ns.Type = 1 // the partner does not exist: play it as a mono sample
			}
		}
		out.Samples = append(out.Samples, ns)
	}
	out.Samples = append(out.Samples, Sample{Name: "EOS"})

	// instruments and their zones
	for _, in := range insts {
		out.Insts = append(out.Insts, Inst{Name: b.Insts[in].Name, BagIndex: uint16(len(out.IBags))})
		for z := int(b.Insts[in].BagIndex); z < int(b.Insts[in+1].BagIndex); z++ {
			gens, mods := zone(b.IBags, b.IGens, b.IMods, z)
			out.IBags = append(out.IBags, Bag{uint16(len(out.IGens)), uint16(len(out.IMods))})
			for _, g := range gens {
				if g.Oper == genSampleID {
					g = GenU16(genSampleID, uint16(newSample[int(g.U16())]))
				}
				out.IGens = append(out.IGens, g)
			}
			out.IMods = append(out.IMods, mods...)
		}
	}
	out.Insts = append(out.Insts, Inst{Name: "EOI", BagIndex: uint16(len(out.IBags))})
	out.IBags = append(out.IBags, Bag{uint16(len(out.IGens)), uint16(len(out.IMods))})
	out.IGens = append(out.IGens, Gen{})
	out.IMods = append(out.IMods, Mod{})

	// presets and their zones
	for _, p := range presets {
		np := b.Presets[p]
		np.BagIndex = uint16(len(out.PBags))
		out.Presets = append(out.Presets, np)
		for z := int(b.Presets[p].BagIndex); z < int(b.Presets[p+1].BagIndex); z++ {
			gens, mods := zone(b.PBags, b.PGens, b.PMods, z)
			out.PBags = append(out.PBags, Bag{uint16(len(out.PGens)), uint16(len(out.PMods))})
			for _, g := range gens {
				if g.Oper == genInstrument {
					g = GenU16(genInstrument, uint16(newInst[int(g.U16())]))
				}
				out.PGens = append(out.PGens, g)
			}
			out.PMods = append(out.PMods, mods...)
		}
	}
	out.Presets = append(out.Presets, Preset{Name: "EOP", BagIndex: uint16(len(out.PBags))})
	out.PBags = append(out.PBags, Bag{uint16(len(out.PGens)), uint16(len(out.PMods))})
	out.PGens = append(out.PGens, Gen{})
	out.PMods = append(out.PMods, Mod{})

	var buf bytes.Buffer
	if err := Write(&buf, out); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// zone returns the generators and modulators of zone z (the next bag bounds it).
func zone(bags []Bag, gens []Gen, mods []Mod, z int) ([]Gen, []Mod) {
	return gens[bags[z].GenIndex:bags[z+1].GenIndex], mods[bags[z].ModIndex:bags[z+1].ModIndex]
}

func sortedKeys(m map[int]bool) []int {
	out := make([]int, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Ints(out)
	return out
}

func index(sorted []int) map[int]int {
	m := make(map[int]int, len(sorted))
	for i, v := range sorted {
		m[v] = i
	}
	return m
}

func clamp(v, lo, hi uint32) uint32 { return min(max(v, lo), hi) }

// readFull fills data from src at off.
func readFull(src io.ReaderAt, data []byte, off int64, what string) error {
	n, err := src.ReadAt(data, off)
	if n == len(data) {
		return nil
	}
	if err == nil {
		err = io.ErrUnexpectedEOF
	}
	return fmt.Errorf("read sample %q: %w", what, err)
}
