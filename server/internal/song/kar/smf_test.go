package kar

import (
	"bytes"
	"encoding/binary"
	"errors"
	"math/big"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// rawSMF wraps hand-written track bodies in a format-1 header (division div).
func rawSMF(format, div uint16, tracks ...[]byte) []byte {
	var b bytes.Buffer
	b.WriteString("MThd")
	_ = binary.Write(&b, binary.BigEndian, uint32(6))
	_ = binary.Write(&b, binary.BigEndian, format)
	_ = binary.Write(&b, binary.BigEndian, uint16(len(tracks)))
	_ = binary.Write(&b, binary.BigEndian, div)
	for _, t := range tracks {
		b.WriteString("MTrk")
		_ = binary.Write(&b, binary.BigEndian, uint32(len(t)))
		b.Write(t)
	}
	return b.Bytes()
}

var eot = []byte{0x00, 0xFF, 0x2F, 0x00}

func TestRunningStatus(t *testing.T) {
	trk := append([]byte{0x00, 0x90, 0x3C, 0x40, 0x10, 0x3E, 0x40}, eot...)
	smf, err := ParseSMF(rawSMF(1, 480, trk))
	if err != nil {
		t.Fatal(err)
	}
	ev := smf.Tracks[0]
	if len(ev) != 3 {
		t.Fatalf("events = %d, want 3 (two notes + end)", len(ev))
	}
	if ev[0].Status != 0x90 || ev[1].Status != 0x90 || ev[1].Data[0] != 0x3E || ev[1].Tick != 0x10 {
		t.Fatalf("running status not applied: %+v", ev)
	}
}

func TestSysExSkipped(t *testing.T) {
	trk := []byte{0x00, 0x90, 0x3C, 0x40, 0x00, 0xF0, 0x05, 0x7E, 0x7F, 0x09, 0x01, 0xF7, 0x20, 0x80, 0x3C, 0x00}
	trk = append(trk, eot...)
	smf, err := ParseSMF(rawSMF(1, 480, trk))
	if err != nil {
		t.Fatal(err)
	}
	ev := smf.Tracks[0]
	if len(ev) != 4 || ev[1].Status != 0xF0 || ev[2].Status != 0x80 || ev[2].Tick != 0x20 {
		t.Fatalf("events after sysex wrong: %+v", ev)
	}
	// F7 escape form
	trk = append([]byte{0x00, 0xF7, 0x02, 0x01, 0x02, 0x00, 0x90, 0x3C, 0x40}, eot...)
	if smf, err = ParseSMF(rawSMF(1, 480, trk)); err != nil || len(smf.Tracks[0]) != 3 {
		t.Fatalf("F7 sysex: %v %+v", err, smf)
	}
}

func TestMetaTextAndAbsoluteTicks(t *testing.T) {
	trk := append([]byte{0x81, 0x00, 0xFF, 0x01, 0x02, 'h', 'i', 0x7F, 0xFF, 0x05, 0x01, 'x'}, eot...)
	smf, err := ParseSMF(rawSMF(0, 96, trk))
	if err != nil {
		t.Fatal(err)
	}
	ev := smf.Tracks[0]
	if ev[0].Tick != 128 || ev[0].MetaType != 0x01 || string(ev[0].Text) != "hi" {
		t.Fatalf("first: %+v", ev[0])
	}
	if ev[1].Tick != 128+127 || ev[1].MetaType != 0x05 {
		t.Fatalf("second: %+v", ev[1])
	}
	if smf.Format != 0 || smf.Division != 96 {
		t.Errorf("header: %+v", smf)
	}
}

func TestRejects(t *testing.T) {
	good := testfix.MIDI{Format: 1, Division: 480, Tracks: []testfix.Track{{}}}.Bytes()
	tooBig := append([]byte(nil), good...)
	tooBig = append(tooBig, make([]byte, maxFileSize)...)
	cases := map[string]struct {
		in   []byte
		want error
	}{
		"empty":           {nil, ErrMalformed},
		"no MThd":         {[]byte("RIFFxxxxxxxxxxxxxxxx"), ErrMalformed},
		"short header":    {rawHeader(5), ErrMalformed},
		"format 2":        {rawSMF(2, 480, eot), ErrUnsupported},
		"SMPTE division":  {rawSMF(1, 0xE728, eot), ErrUnsupported},
		"zero division":   {rawSMF(1, 0, eot), ErrMalformed},
		"huge chunk":      {append(rawSMF(1, 480)[:14:14], []byte{'M', 'T', 'r', 'k', 0xFF, 0xFF, 0xFF, 0xFF, 0, 0}...), ErrMalformed},
		"truncated event": {rawSMF(1, 480, []byte{0x00, 0x90, 0x3C}), ErrMalformed},
		"truncated meta":  {rawSMF(1, 480, []byte{0x00, 0xFF, 0x01, 0x09, 'a'}), ErrMalformed},
		"data byte first": {rawSMF(1, 480, []byte{0x00, 0x3C, 0x40}), ErrMalformed},
		"vlq too long":    {rawSMF(1, 480, []byte{0xFF, 0xFF, 0xFF, 0xFF, 0x7F, 0x90, 0x3C, 0x40}), ErrMalformed},
		"over 10 MB":      {tooBig, ErrTooLarge},
	}
	for name, c := range cases {
		if _, err := ParseSMF(c.in); !errors.Is(err, c.want) {
			t.Errorf("%s: err = %v, want %v", name, err, c.want)
		}
	}
}

func rawHeader(n uint32) []byte {
	var b bytes.Buffer
	b.WriteString("MThd")
	_ = binary.Write(&b, binary.BigEndian, n)
	b.Write(make([]byte, n))
	return b.Bytes()
}

func TestUnknownChunkIgnoredAndLongHeaderAccepted(t *testing.T) {
	var b bytes.Buffer
	b.WriteString("MThd")
	_ = binary.Write(&b, binary.BigEndian, uint32(8))
	b.Write([]byte{0, 1, 0, 1, 0x01, 0xE0, 0xAA, 0xBB}) // 2 extra header bytes
	b.WriteString("JUNK")
	_ = binary.Write(&b, binary.BigEndian, uint32(3))
	b.Write([]byte{1, 2, 3})
	b.WriteString("MTrk")
	_ = binary.Write(&b, binary.BigEndian, uint32(4))
	b.Write(eot)
	smf, err := ParseSMF(b.Bytes())
	if err != nil || len(smf.Tracks) != 1 || smf.Division != 480 {
		t.Fatalf("%v %+v", err, smf)
	}
}

func TestMissingEndOfTrackIsFine(t *testing.T) {
	smf, err := ParseSMF(rawSMF(1, 480, []byte{0x00, 0x90, 0x3C, 0x40}))
	if err != nil || len(smf.Tracks[0]) != 1 {
		t.Fatalf("%v %+v", err, smf)
	}
}

func TestTrailingBytesAfterLastChunkIgnored(t *testing.T) {
	b := append(rawSMF(1, 480, eot), 1, 2, 3)
	if _, err := ParseSMF(b); err != nil {
		t.Fatal(err)
	}
}

func TestTempoMap(t *testing.T) {
	tr := []byte{0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20}          // 500000 at 0
	tr = append(tr, 0x87, 0x40, 0xFF, 0x51, 0x03, 0x03, 0xD0, 0x90) // delta 960, 250000
	smf, err := ParseSMF(rawSMF(1, 480, append(tr, eot...)))
	if err != nil {
		t.Fatal(err)
	}
	tm := newTempoMap(smf)
	for tick, want := range map[uint64]int64{0: 0, 480: 500, 960: 1000, 1440: 1250, 2400: 1750} {
		if got := tm.TickToMs(tick); got != want {
			t.Errorf("TickToMs(%d) = %d, want %d", tick, got, want)
		}
	}
}

func TestTempoDefaultAndAcrossTracks(t *testing.T) {
	// no tempo event: 500000 default, 480 ticks = 500 ms
	smf, _ := ParseSMF(rawSMF(1, 480, eot))
	if got := newTempoMap(smf).TickToMs(480); got != 500 {
		t.Errorf("default tempo: %d, want 500", got)
	}
	// tempo in the second track applies to the whole file
	smf, _ = ParseSMF(rawSMF(1, 480, eot, append([]byte{0x00, 0xFF, 0x51, 0x03, 0x0F, 0x42, 0x40}, eot...))) // 1,000,000
	if got := newTempoMap(smf).TickToMs(480); got != 1000 {
		t.Errorf("tempo from track 2: %d, want 1000", got)
	}
}

func TestTempoRoundsOnce(t *testing.T) {
	// 3 ticks at division 7 and 500000: 214285.7 us -> 214 ms; per-segment rounding would drift
	smf, _ := ParseSMF(rawSMF(1, 7, eot))
	if got := newTempoMap(smf).TickToMs(3); got != 214 {
		t.Errorf("got %d, want 214", got)
	}
}

func TestTempoLastEventAtSameTickWins(t *testing.T) {
	a := []byte{0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20, 0x00, 0xFF, 0x51, 0x03, 0x0F, 0x42, 0x40}
	smf, _ := ParseSMF(rawSMF(1, 480, append(a, eot...)))
	if got := newTempoMap(smf).TickToMs(480); got != 1000 {
		t.Errorf("got %d, want 1000", got)
	}
}

func TestTempoHugeTicksDoNotOverflow(t *testing.T) {
	smf, _ := ParseSMF(rawSMF(1, 1, eot))
	got := newTempoMap(smf).TickToMs(1 << 62)
	if got <= 0 {
		t.Errorf("huge tick gave %d, want a saturated positive value", got)
	}
}

// A 10-minute file with 600 tempo changes: every conversion must equal exact
// rational arithmetic rounded once.
func TestTempoMapMatchesExactArithmetic(t *testing.T) {
	const div = 480
	var trk []byte
	type seg struct{ tick, us uint64 }
	var segs []seg
	rng := uint64(12345)
	next := func() uint64 { rng = rng*6364136223846793005 + 1442695040888963407; return rng >> 33 }
	tick := uint64(0)
	for i := 0; i < 600; i++ {
		us := 250000 + next()%500000
		delta := uint64(0)
		if i > 0 {
			delta = 100 + next()%2000
		}
		tick += delta
		segs = append(segs, seg{tick, us})
		trk = append(trk, vlqBytes(uint32(delta))...)
		trk = append(trk, 0xFF, 0x51, 0x03, byte(us>>16), byte(us>>8), byte(us))
	}
	smf, err := ParseSMF(rawSMF(1, div, append(trk, eot...)))
	if err != nil {
		t.Fatal(err)
	}
	tm := newTempoMap(smf)
	for _, q := range []uint64{0, 1, 999, 123456, tick / 2, tick, tick + 777, tick + 480000} {
		total := new(big.Rat)
		prevTick, prevUs := uint64(0), uint64(defaultTempo)
		for _, s := range segs {
			if s.tick >= q {
				break
			}
			total.Add(total, new(big.Rat).SetFrac64(int64((s.tick-prevTick)*prevUs), int64(div*1000)))
			prevTick, prevUs = s.tick, s.us
		}
		total.Add(total, new(big.Rat).SetFrac64(int64((q-prevTick)*prevUs), int64(div*1000)))
		// round half up
		fl := new(big.Int).Div(total.Num(), total.Denom())
		rem := new(big.Rat).Sub(total, new(big.Rat).SetInt(fl))
		if rem.Cmp(big.NewRat(1, 2)) >= 0 {
			fl.Add(fl, big.NewInt(1))
		}
		if got := tm.TickToMs(q); got != fl.Int64() {
			t.Errorf("TickToMs(%d) = %d, want %d", q, got, fl.Int64())
		}
	}
}

func vlqBytes(v uint32) []byte {
	out := []byte{byte(v & 0x7F)}
	for v >>= 7; v > 0; v >>= 7 {
		out = append([]byte{byte(v&0x7F) | 0x80}, out...)
	}
	return out
}
