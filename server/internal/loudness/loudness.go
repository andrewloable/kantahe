// Package loudness measures how loud a song is (ITU-R BS.1770 / EBU R128 integrated loudness) and turns it into the gain that brings it to
// a common level, so that the player can play every song at about the same volume.
package loudness

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"

	mp3 "github.com/hajimehoshi/go-mp3"
)

// The level every song is brought to, and how far a song may be moved to get there.
const (
	// TargetLUFS is the integrated loudness a song is played at.
	TargetLUFS = -16.0
	// MaxCutDB and MaxBoostDB limit the change in dB (a cut is never limited by the peak).
	MaxCutDB   = 12.0
	MaxBoostDB = 9.0
	// PeakCeilingDB is the highest the sample peak may be after a boost, in dBFS.
	PeakCeilingDB = -1.0
)

// ErrSilent is returned for a song with no passage above the absolute gate (-70 LUFS) or shorter than one 400 ms block: it has no loudness.
var ErrSilent = errors.New("loudness: nothing above the gate to measure")

// Result is what was measured: the integrated loudness in LUFS and the sample peak in dBFS.
type Result struct {
	LUFS, PeakDB float64
}

// Gain is the dB to add to a song of this loudness and peak: the way to TargetLUFS, within -MaxCutDB and +MaxBoostDB, and a boost never takes
// the sample peak above PeakCeilingDB.
func Gain(lufs, peakDB float64) float64 {
	g := TargetLUFS - lufs
	if g < -MaxCutDB {
		g = -MaxCutDB
	}
	if g > MaxBoostDB {
		g = MaxBoostDB
	}
	if g > 0 {
		if room := PeakCeilingDB - peakDB; g > room {
			g = math.Max(room, 0)
		}
	}
	return g
}

// Measure decodes an MP3 and measures it, a chunk at a time: the memory does not grow with the length of the song.
// The decoder panics on some damaged frames; that is an error here, not a crash of the server.
func Measure(r io.Reader) (res Result, err error) {
	defer func() {
		if p := recover(); p != nil {
			res, err = Result{}, fmt.Errorf("loudness: the decoder failed on a damaged file: %v", p)
		}
	}()
	d, err := mp3.NewDecoder(r)
	if err != nil {
		return Result{}, fmt.Errorf("loudness: %w", err)
	}
	m := newMeter(d.SampleRate())
	// the decoder gives interleaved 16-bit little-endian stereo; a read always ends on a whole frame of four bytes in practice, a rest is carried
	buf := make([]byte, 1<<16)
	var rest []byte
	for {
		n, err := d.Read(buf)
		chunk := append(rest, buf[:n]...)
		whole := len(chunk) / 4 * 4
		for i := 0; i < whole; i += 4 {
			m.add(int16(binary.LittleEndian.Uint16(chunk[i:])), int16(binary.LittleEndian.Uint16(chunk[i+2:])))
		}
		rest = append(rest[:0], chunk[whole:]...)
		if err == io.EOF {
			break
		}
		if err != nil {
			return Result{}, fmt.Errorf("loudness: %w", err)
		}
	}
	return m.result()
}

// Meter measures a stream of stereo samples as they are made (for audio the server renders itself): Add every frame, then Result.
type Meter struct{ m *meter }

// NewMeter starts a measure at the given sample rate.
func NewMeter(rate int) *Meter { return &Meter{newMeter(rate)} }

// Add takes the next frame.
func (m *Meter) Add(l, r int16) { m.m.add(l, r) }

// Result is the loudness of everything added, or ErrSilent when there is none to measure.
func (m *Meter) Result() (Result, error) { return m.m.result() }

// MeasurePCM measures interleaved stereo 16-bit samples at the given sample rate.
func MeasurePCM(pcm []int16, rate int) (Result, error) {
	m := newMeter(rate)
	for i := 0; i+1 < len(pcm); i += 2 {
		m.add(pcm[i], pcm[i+1])
	}
	return m.result()
}

// meter is the measure as a stream: K-weighting filters with their state, and the mean square of every 100 ms segment; a 400 ms block is four
// segments, so a block every 100 ms comes from a window of the last four.
type meter struct {
	rate        int
	left, right kFilter
	step        int       // frames in 100 ms
	inSegment   int       // frames in the segment being filled
	segment     float64   // sum of squares (both channels) of the segment being filled
	last        []float64 // the last four complete segments, oldest first
	powers      []float64 // the mean square of every block (per frame), in order
	peak        float64
}

func newMeter(rate int) *meter {
	return &meter{rate: rate, left: newKFilter(rate), right: newKFilter(rate), step: int(0.1 * float64(rate))}
}

func (m *meter) add(l, r int16) {
	if m.step == 0 {
		return
	}
	fl, fr := float64(l)/32768, float64(r)/32768
	m.peak = math.Max(m.peak, math.Max(math.Abs(fl), math.Abs(fr)))
	yl, yr := m.left.next(fl), m.right.next(fr)
	m.segment += yl*yl + yr*yr
	m.inSegment++
	if m.inSegment < m.step {
		return
	}
	m.last = append(m.last, m.segment)
	if len(m.last) > 4 {
		m.last = m.last[1:]
	}
	if len(m.last) == 4 {
		m.powers = append(m.powers, (m.last[0]+m.last[1]+m.last[2]+m.last[3])/float64(4*m.step))
	}
	m.inSegment, m.segment = 0, 0
}

func (m *meter) result() (Result, error) {
	loudness := func(z float64) float64 { return -0.691 + 10*math.Log10(z) }
	var abs []float64
	var sum float64
	for _, z := range m.powers {
		if z > 0 && loudness(z) > -70 {
			abs = append(abs, z)
			sum += z
		}
	}
	if len(abs) == 0 {
		return Result{}, ErrSilent
	}
	relative := loudness(sum/float64(len(abs))) - 10
	var gated float64
	var n int
	for _, z := range abs {
		if loudness(z) > relative {
			gated += z
			n++
		}
	}
	if n == 0 {
		return Result{}, ErrSilent
	}
	peakDB := -200.0
	if m.peak > 0 {
		peakDB = 20 * math.Log10(m.peak)
	}
	return Result{LUFS: loudness(gated / float64(n)), PeakDB: peakDB}, nil
}

// biquad is one second-order filter section (direct form I), coefficients already divided by a0, with its state.
type biquad struct {
	b0, b1, b2, a1, a2 float64
	x1, x2, y1, y2     float64
}

func (f *biquad) next(x float64) float64 {
	y := f.b0*x + f.b1*f.x1 + f.b2*f.x2 - f.a1*f.y1 - f.a2*f.y2
	f.x2, f.x1 = f.x1, x
	f.y2, f.y1 = f.y1, y
	return y
}

// kFilter is the K-weighting of BS.1770: a high shelf (the head) and a high-pass, designed for any sample rate.
type kFilter struct{ shelf, highPass biquad }

func newKFilter(rate int) kFilter {
	fs := float64(rate)
	// stage 1: high shelf of +4 dB
	const f1, gain, q1 = 1681.974450955533, 3.999843853973347, 0.7071752369554196
	k := math.Tan(math.Pi * f1 / fs)
	vh := math.Pow(10, gain/20)
	vb := math.Pow(vh, 0.4996667741545416)
	a0 := 1 + k/q1 + k*k
	shelf := biquad{
		b0: (vh + vb*k/q1 + k*k) / a0,
		b1: 2 * (k*k - vh) / a0,
		b2: (vh - vb*k/q1 + k*k) / a0,
		a1: 2 * (k*k - 1) / a0,
		a2: (1 - k/q1 + k*k) / a0,
	}
	// stage 2: high-pass at 38 Hz
	const f2, q2 = 38.13547087602444, 0.5003270373238773
	k = math.Tan(math.Pi * f2 / fs)
	a0 = 1 + k/q2 + k*k
	return kFilter{shelf: shelf, highPass: biquad{b0: 1, b1: -2, b2: 1, a1: 2 * (k*k - 1) / a0, a2: (1 - k/q2 + k*k) / a0}}
}

func (f *kFilter) next(x float64) float64 { return f.highPass.next(f.shelf.next(x)) }
