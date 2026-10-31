package render

import (
	"bytes"
	"context"
	"errors"
	"io"
	"math"
	"testing"
	"time"

	"github.com/mewkiz/flac"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// sineBank is a SoundFont with one preset: a one-second 441 Hz sine at 22050 Hz.
func sineBank() []byte {
	s := make([]int16, 22050)
	for i := range s {
		s[i] = int16(20000 * math.Sin(2*math.Pi*441*float64(i)/22050))
	}
	return testfix.SF2([]testfix.Preset{{Name: "Sine", Bank: 0, Program: 0, Samples: [][]int16{s}}})
}

// noteSong holds middle C for the given number of seconds (120 bpm, 480 ticks per quarter note).
func noteSong(seconds int) []byte {
	return testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.NoteOn(0, 60, 100)},
		{Delta: uint32(960 * seconds), Data: testfix.NoteOff(0, 60)},
	}}}}.Bytes()
}

type decoded struct {
	info     flac.Stream
	samples  int
	left     []int32
	rms      float64
	minBlock uint16
	maxBlock uint16
}

func decode(t *testing.T, b []byte) decoded {
	t.Helper()
	st, err := flac.New(bytes.NewReader(b))
	if err != nil {
		t.Fatalf("not a FLAC stream: %v", err)
	}
	d := decoded{info: *st}
	var sum float64
	for {
		fr, err := st.ParseNext()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("decode: %v", err)
		}
		d.samples += int(fr.BlockSize)
		for _, v := range fr.Subframes[0].Samples {
			f := float64(v) / 32768
			sum += f * f
			d.left = append(d.left, v)
		}
	}
	if d.samples > 0 {
		d.rms = math.Sqrt(sum / float64(d.samples))
	}
	return d
}

func TestRenderFixture(t *testing.T) {
	var out bytes.Buffer
	if err := Render(context.Background(), noteSong(2), bytes.NewReader(sineBank()), &out); err != nil {
		t.Fatal(err)
	}
	d := decode(t, out.Bytes())
	if d.info.Info.SampleRate != SampleRate || d.info.Info.NChannels != 2 || d.info.Info.BitsPerSample != 16 {
		t.Fatalf("stream info %+v", d.info.Info)
	}
	if diff := d.samples - 2*SampleRate; diff < -SampleRate/10 || diff > SampleRate/10 {
		t.Fatalf("%d samples, want %d +- 0.1 s", d.samples, 2*SampleRate)
	}
	if d.rms <= 0.01 {
		t.Fatalf("the output is silent: rms %v", d.rms)
	}
	// the stream info is complete although the output was written without seeking
	if d.info.Info.NSamples != uint64(d.samples) {
		t.Errorf("stream info says %d samples, the stream holds %d", d.info.Info.NSamples, d.samples)
	}
	if d.info.Info.BlockSizeMin != d.info.Info.BlockSizeMax {
		t.Errorf("block sizes %d..%d: a fixed-block stream needs equal limits", d.info.Info.BlockSizeMin, d.info.Info.BlockSizeMax)
	}
}

func TestRenderWithTailIsLonger(t *testing.T) {
	var plain, tailed bytes.Buffer
	if err := Render(context.Background(), noteSong(1), bytes.NewReader(sineBank()), &plain); err != nil {
		t.Fatal(err)
	}
	if err := RenderWithTail(context.Background(), noteSong(1), bytes.NewReader(sineBank()), &tailed, 1500*time.Millisecond); err != nil {
		t.Fatal(err)
	}
	a, b := decode(t, plain.Bytes()).samples, decode(t, tailed.Bytes()).samples
	if want := a + SampleRate*3/2; b != want {
		t.Fatalf("with a tail %d samples, want %d (plain %d + 1.5 s)", b, want, a)
	}
}

func TestRenderIsDeterministic(t *testing.T) {
	var a, b bytes.Buffer
	for _, w := range []*bytes.Buffer{&a, &b} {
		if err := Render(context.Background(), noteSong(1), bytes.NewReader(sineBank()), w); err != nil {
			t.Fatal(err)
		}
	}
	if !bytes.Equal(a.Bytes(), b.Bytes()) {
		t.Fatal("two renders of the same song differ")
	}
}

// cancelAfter cancels the context on the n-th write.
type cancelAfter struct {
	n      int
	cancel context.CancelFunc
	writes int
}

func (c *cancelAfter) Write(p []byte) (int, error) {
	c.writes++
	if c.writes == c.n {
		c.cancel()
	}
	return len(p), nil
}

func TestRenderCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	var out bytes.Buffer
	if err := Render(ctx, noteSong(2), bytes.NewReader(sineBank()), &out); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled before the start: %v", err)
	}

	// cancelled while writing: the render stops at the next block instead of finishing
	ctx, cancel = context.WithCancel(context.Background())
	defer cancel()
	w := &cancelAfter{n: 3, cancel: cancel}
	err := Render(ctx, noteSong(120), bytes.NewReader(sineBank()), w)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled while writing: %v", err)
	}
	if w.writes > 10 {
		t.Fatalf("%d writes after the cancellation: the render did not stop", w.writes)
	}
}

func TestRenderRejectsBadInput(t *testing.T) {
	var out bytes.Buffer
	if err := Render(context.Background(), []byte("not midi"), bytes.NewReader(sineBank()), &out); err == nil {
		t.Error("garbage MIDI was accepted")
	}
	if err := Render(context.Background(), noteSong(1), bytes.NewReader([]byte("not a soundfont")), &out); err == nil {
		t.Error("garbage SoundFont was accepted")
	}
}

type failingWriter struct{ after int }

func (f *failingWriter) Write(p []byte) (int, error) {
	if f.after--; f.after < 0 {
		return 0, errors.New("disk full")
	}
	return len(p), nil
}

func TestRenderReportsWriteErrors(t *testing.T) {
	if err := Render(context.Background(), noteSong(5), bytes.NewReader(sineBank()), &failingWriter{after: 2}); err == nil {
		t.Fatal("a failing writer was not reported")
	}
}

func TestRenderSurvivesDamagedFiles(t *testing.T) {
	good := noteSong(1)
	bank := bytes.NewReader(sineBank())
	// every truncation and a flipped byte at every position: an error or a render, never a panic
	for n := 0; n < len(good); n++ {
		_ = Render(context.Background(), good[:n], bank, io.Discard)
	}
	for i := 0; i < len(good); i++ {
		bad := append([]byte(nil), good...)
		bad[i] ^= 0xFF
		_ = Render(context.Background(), bad, bank, io.Discard)
	}
	sf := sineBank()
	for n := 0; n < len(sf); n += 97 {
		_ = Render(context.Background(), good, bytes.NewReader(sf[:n]), io.Discard)
	}
}

func TestRenderRefusesAnAbsurdLength(t *testing.T) {
	// a note-off three hours after the note-on
	song := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.NoteOn(0, 60, 100)},
		{Delta: uint32(960 * 3 * 3600), Data: testfix.NoteOff(0, 60)},
	}}}}.Bytes()
	var out bytes.Buffer
	if err := Render(context.Background(), song, bytes.NewReader(sineBank()), &out); !errors.Is(err, ErrTooLong) {
		t.Fatalf("err = %v, want ErrTooLong", err)
	}
	if out.Len() != 0 {
		t.Fatalf("%d bytes were written before the refusal", out.Len())
	}
}
