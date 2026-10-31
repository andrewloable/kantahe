package kar

import (
	"math/bits"
	"sort"
)

const defaultTempo = 500000 // microseconds per quarter note (120 bpm)

type tempoChange struct {
	tick uint64
	us   uint64
}

// tempoMap converts ticks to milliseconds using every FF 51 event of all tracks.
type tempoMap struct {
	division uint64
	changes  []tempoChange // ordered by tick; the last change at a tick wins
}

func newTempoMap(smf *SMF) *tempoMap {
	tm := &tempoMap{division: uint64(smf.Division)}
	for _, tr := range smf.Tracks {
		for _, e := range tr {
			if e.Status == 0xFF && e.MetaType == 0x51 && len(e.Data) == 3 {
				us := uint64(e.Data[0])<<16 | uint64(e.Data[1])<<8 | uint64(e.Data[2])
				if us > 0 {
					tm.changes = append(tm.changes, tempoChange{e.Tick, us})
				}
			}
		}
	}
	sort.SliceStable(tm.changes, func(i, j int) bool { return tm.changes[i].tick < tm.changes[j].tick })
	return tm
}

// TickToMs is exact integer math: it sums ticks x microseconds-per-quarter over
// the tempo segments and divides once by division x 1000, rounding to nearest.
// Overflow saturates at the largest representable value.
func (tm *tempoMap) TickToMs(tick uint64) int64 {
	var num uint64 // sum of ticks * us per quarter
	satur := false
	add := func(ticks, us uint64) {
		hi, lo := bits.Mul64(ticks, us)
		sum, carry := bits.Add64(num, lo, 0)
		if hi != 0 || carry != 0 {
			satur = true
		}
		num = sum
	}
	prev, tempo := uint64(0), uint64(defaultTempo)
	for _, c := range tm.changes {
		if c.tick >= tick {
			break
		}
		add(c.tick-prev, tempo)
		prev, tempo = c.tick, c.us
	}
	add(tick-prev, tempo)
	if satur {
		return 1<<63 - 1
	}
	den := tm.division * 1000
	ms := num / den
	if num%den >= den/2 && den != 0 {
		ms++
	}
	if ms > 1<<63-1 {
		return 1<<63 - 1
	}
	return int64(ms)
}
