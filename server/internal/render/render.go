// Package render turns a song's MIDI into audio on the server for devices that cannot run the
// synthesizer themselves (PLAN.md section 4.1, layer 3), and caches the result. The synth is
// go-meltysynth and the output is 16-bit stereo FLAC, both pure Go (spike S1b, docs/spikes/s1b-render.md).
package render

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"time"

	"github.com/mewkiz/flac"
	"github.com/mewkiz/flac/frame"
	"github.com/mewkiz/flac/meta"
	"github.com/sinshu/go-meltysynth/meltysynth"
)

const (
	// SampleRate of the rendered audio. 32 kHz keeps everything below 16 kHz and is 1.5x faster and
	// 22 % smaller than 44.1 kHz (spike S1b); it is one constant if listening says otherwise.
	SampleRate = 32000
	// Tail is added after the last MIDI event so that the final notes ring out.
	Tail = 1500 * time.Millisecond
	// MaxLength bounds a render: a damaged file with an hours-long gap must not occupy the worker.
	MaxLength = 20 * time.Minute

	blockSize = 4096 // samples per FLAC frame (fixed)
)

// ErrTooLong means the song would render to more than MaxLength of audio.
var ErrTooLong = errors.New("render: the song is too long")

// Render plays the MIDI file through the SoundFont and writes the audio as FLAC to w, exactly as
// long as the file. It stops with the context's error as soon as ctx is cancelled.
func Render(ctx context.Context, midi []byte, sf2 io.ReaderAt, w io.Writer) error {
	return RenderWithTail(ctx, midi, sf2, w, 0)
}

// RenderWithTail is Render with tail of silence-padded playing time added at the end.
func RenderWithTail(ctx context.Context, midi []byte, sf2 io.ReaderAt, w io.Writer, tail time.Duration) (err error) {
	// The synth reads files that users uploaded; a damaged one must fail the render, not the server.
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("render: damaged song: %v", r)
		}
	}()
	if err := ctx.Err(); err != nil {
		return err
	}
	font, err := meltysynth.NewSoundFont(io.NewSectionReader(sf2, 0, math.MaxInt64))
	if err != nil {
		return fmt.Errorf("render: SoundFont: %w", err)
	}
	file, err := meltysynth.NewMidiFile(bytes.NewReader(midi))
	if err != nil {
		return fmt.Errorf("render: MIDI: %w", err)
	}
	synth, err := meltysynth.NewSynthesizer(font, meltysynth.NewSynthesizerSettings(SampleRate))
	if err != nil {
		return fmt.Errorf("render: synthesizer: %w", err)
	}
	length := file.GetLength() + tail
	if length > MaxLength {
		return ErrTooLong
	}
	seq := meltysynth.NewMidiFileSequencer(synth)
	seq.Play(file, false)

	total := int(math.Round(length.Seconds() * SampleRate))
	info := &meta.StreamInfo{
		BlockSizeMin: blockSize, BlockSizeMax: blockSize, SampleRate: SampleRate,
		NChannels: 2, BitsPerSample: 16, NSamples: uint64(total),
	}
	// Only Write is passed on: the encoder would otherwise seek back to rewrite the stream info (and
	// record the short last block as the minimum block size) and close w.
	enc, err := flac.NewEncoder(struct{ io.Writer }{w}, info)
	if err != nil {
		return err
	}
	var left, right [blockSize]float32
	var l, r [blockSize]int32
	for done := 0; done < total; {
		if err := ctx.Err(); err != nil {
			return err
		}
		n := min(blockSize, total-done)
		seq.Render(left[:n], right[:n])
		for i := 0; i < n; i++ {
			l[i], r[i] = pcm16(left[i]), pcm16(right[i])
		}
		fr := &frame.Frame{
			Header: frame.Header{HasFixedBlockSize: true, BlockSize: uint16(n), SampleRate: SampleRate, Channels: frame.ChannelsLR, BitsPerSample: 16},
			Subframes: []*frame.Subframe{
				{SubHeader: frame.SubHeader{Pred: frame.PredVerbatim}, Samples: l[:n], NSamples: n},
				{SubHeader: frame.SubHeader{Pred: frame.PredVerbatim}, Samples: r[:n], NSamples: n},
			},
		}
		if err := enc.WriteFrame(fr); err != nil {
			return err
		}
		done += n
	}
	return enc.Close()
}

// pcm16 converts a float sample to a 16-bit value, clipping.
func pcm16(v float32) int32 {
	return int32(math.Max(-32768, math.Min(32767, math.Round(float64(v)*32768))))
}
