package loudness

import (
	"bytes"
	"errors"
	"math"
	"math/rand"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/assets"
)

// sine returns seconds of an interleaved stereo 16-bit sine of the given frequency whose peak is dbfs below full scale, the same in both channels.
func sine(rate int, seconds, hz, dbfs float64) []int16 {
	n := int(float64(rate) * seconds)
	amp := math.Pow(10, dbfs/20) * 32767
	out := make([]int16, 0, n*2)
	for i := 0; i < n; i++ {
		v := int16(math.Round(amp * math.Sin(2*math.Pi*hz*float64(i)/float64(rate))))
		out = append(out, v, v)
	}
	return out
}

func TestSineLoudnessIsItsLevel(t *testing.T) {
	for _, rate := range []int{44100, 48000} {
		for _, level := range []float64{-20, -10, -30} {
			r, err := MeasurePCM(sine(rate, 10, 1000, level), rate)
			if err != nil {
				t.Fatalf("%d Hz, %v dB: %v", rate, level, err)
			}
			// a stereo sine at -20 dBFS in both channels is -20 LUFS (EBU Tech 3341)
			if math.Abs(r.LUFS-level) > 0.3 {
				t.Errorf("%d Hz, %v dBFS sine: %.2f LUFS", rate, level, r.LUFS)
			}
			if math.Abs(r.PeakDB-level) > 0.1 {
				t.Errorf("%d Hz, %v dBFS sine: peak %.2f dBFS", rate, level, r.PeakDB)
			}
		}
	}
}

func TestSilenceIsAnError(t *testing.T) {
	if _, err := MeasurePCM(make([]int16, 48000*2*5), 48000); !errors.Is(err, ErrSilent) {
		t.Fatalf("err = %v, want ErrSilent", err)
	}
	// below the absolute gate too: -80 dBFS is -80 LUFS
	if _, err := MeasurePCM(sine(48000, 5, 1000, -80), 48000); !errors.Is(err, ErrSilent) {
		t.Fatalf("a -80 dB sine: err = %v, want ErrSilent", err)
	}
}

func TestTooShortIsAnError(t *testing.T) {
	if _, err := MeasurePCM(sine(48000, 0.2, 1000, -20), 48000); !errors.Is(err, ErrSilent) {
		t.Fatalf("200 ms: err = %v, want ErrSilent (no complete 400 ms block)", err)
	}
}

// The relative gate: a long quiet passage (an intro, a pause) does not pull the loudness of a loud song down.
func TestRelativeGateIgnoresQuietPassages(t *testing.T) {
	loud := sine(48000, 8, 1000, -14)
	quiet := sine(48000, 24, 1000, -60)
	mixed := append(append([]int16{}, loud...), quiet...)
	a, err := MeasurePCM(loud, 48000)
	if err != nil {
		t.Fatal(err)
	}
	b, err := MeasurePCM(mixed, 48000)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(a.LUFS-b.LUFS) > 0.5 {
		t.Errorf("loud alone %.2f LUFS, with 24 s of quiet %.2f LUFS", a.LUFS, b.LUFS)
	}
}

func TestGainIsTargetMinusLoudnessWithinTheLimits(t *testing.T) {
	cases := []struct {
		name         string
		lufs, peakDB float64
		want         float64
	}{
		{"a quiet song is boosted", -23, -30, TargetLUFS - (-23)},
		{"the boost stops at the maximum", -40, -50, MaxBoostDB},
		{"a loud song is cut", -9, -1.2, TargetLUFS - (-9)},
		{"the cut stops at the maximum", 5, -1, -MaxCutDB},
		{"already at the target", TargetLUFS, -6, 0},
	}
	for _, c := range cases {
		if got := Gain(c.lufs, c.peakDB); math.Abs(got-c.want) > 1e-9 {
			t.Errorf("%s: Gain(%v, %v) = %v, want %v", c.name, c.lufs, c.peakDB, got, c.want)
		}
	}
}

func TestABoostNeverLetsThePeakPassTheCeiling(t *testing.T) {
	// quiet but peaky: -30 LUFS would be +9 dB (the maximum), but the peak is at -3 dBFS and may rise only to the ceiling
	g := Gain(-30, -3)
	if g > PeakCeilingDB-(-3)+1e-9 {
		t.Fatalf("gain %v lifts the peak above %v dBFS", g, PeakCeilingDB)
	}
	if g <= 0 {
		t.Fatalf("gain %v: there was room for some boost", g)
	}
	// a peak already above the ceiling gets no boost at all, a cut is never limited by the ceiling
	if g := Gain(-30, 0); g != 0 {
		t.Errorf("a full-scale peak: gain %v, want 0", g)
	}
	if g := Gain(-9, 0); g >= 0 {
		t.Errorf("a loud song with a full-scale peak is still cut: %v", g)
	}
}

// The decode path, on a real MP3 of the repository: the score fanfare.
func TestMeasureDecodesAnMP3(t *testing.T) {
	b, ok := assets.Fanfare(1)
	if !ok {
		t.Fatal("no fanfare")
	}
	r, err := Measure(bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	if r.LUFS > 0 || r.LUFS < -60 || r.PeakDB > 0.01 || r.PeakDB < -60 {
		t.Fatalf("implausible: %+v", r)
	}
	r2, err := Measure(bytes.NewReader(b))
	if err != nil || r2 != r {
		t.Fatalf("not repeatable: %+v %+v %v", r, r2, err)
	}
	if g := Gain(r.LUFS, r.PeakDB); g < -MaxCutDB || g > MaxBoostDB {
		t.Fatalf("gain %v outside the limits", g)
	}
}

func TestMeasureRejectsWhatIsNotAnMP3(t *testing.T) {
	if _, err := Measure(bytes.NewReader([]byte("this is not an mp3 file at all, just text"))); err == nil {
		t.Fatal("text was measured")
	}
	if _, err := Measure(bytes.NewReader(nil)); err == nil {
		t.Fatal("an empty file was measured")
	}
}

// REGRESSION: the decoder (go-mp3) panics with an index out of range on some damaged frames, and on the owner's library one song took the
// whole server down during the loudness backfill. A damaged file must be an error, never a panic. The damage is seeded, so it is the same
// on every run; the test also proves that it does reach a panic in the decoder, so it cannot pass by luck of its input.
func TestMeasureSurvivesDamagedMP3s(t *testing.T) {
	b, ok := assets.Fanfare(1)
	if !ok {
		t.Fatal("no fanfare")
	}
	rng := rand.New(rand.NewSource(1))
	errored := 0
	for i := 0; i < 300; i++ {
		damaged := append([]byte(nil), b...)
		for j := 0; j < 12; j++ {
			damaged[2000+rng.Intn(len(damaged)-2000)] = byte(rng.Intn(256))
		}
		if _, err := Measure(bytes.NewReader(damaged)); err != nil {
			errored++
		}
	}
	if errored == 0 {
		t.Fatal("no damaged file was refused: the test does not damage anything")
	}
}
