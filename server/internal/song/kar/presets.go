package kar

import "sort"

// Preset is a General MIDI bank and program; drums use Bank 128.
type Preset struct {
	Bank, Program uint16
}

const drumChannel = 9

// usedPresets returns the sorted unique set of presets that sound a note.
func usedPresets(smf *SMF) []Preset {
	var all []Event
	for _, tr := range smf.Tracks {
		for _, e := range tr {
			if e.Status >= 0x80 && e.Status < 0xF0 {
				all = append(all, e)
			}
		}
	}
	sort.SliceStable(all, func(i, j int) bool { return all[i].Tick < all[j].Tick })

	var bankMSB, bankLSB, program [16]uint16
	seen := map[Preset]bool{}
	for _, e := range all {
		ch := e.Status & 0x0F
		switch e.Status & 0xF0 {
		case 0xB0:
			switch e.Data[0] {
			case 0:
				bankMSB[ch] = uint16(e.Data[1])
			case 32:
				bankLSB[ch] = uint16(e.Data[1])
			}
		case 0xC0:
			program[ch] = uint16(e.Data[0])
		case 0x90:
			if e.Data[1] == 0 {
				continue
			}
			p := Preset{Bank: bankMSB[ch]*128 + bankLSB[ch], Program: program[ch]}
			if ch == drumChannel {
				p.Bank = 128
			}
			seen[p] = true
		}
	}
	out := make([]Preset, 0, len(seen))
	for p := range seen {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Bank != out[j].Bank {
			return out[i].Bank < out[j].Bank
		}
		return out[i].Program < out[j].Program
	})
	return out
}
