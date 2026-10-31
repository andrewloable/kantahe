// Command s1b-render is spike S1b: render a MIDI/KAR file with a SoundFont in pure Go and encode
// the result as WAV or FLAC, to measure speed, memory and size (docs/spikes/s1b-render.md).
//
//	go run . -sf2 GeneralUser-GS.sf2 -in song.kar -out song.flac
package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"flag"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/mewkiz/flac"
	"github.com/mewkiz/flac/frame"
	"github.com/mewkiz/flac/meta"
	"github.com/sinshu/go-meltysynth/meltysynth"
)

// render plays the MIDI file through the SoundFont and returns the audio of exactly the file's
// length (a production renderer should add a second or two for the last notes to die away).
func render(midi, sf2 []byte, sampleRate int) (left, right []float32, err error) {
	font, err := meltysynth.NewSoundFont(bytes.NewReader(sf2))
	if err != nil {
		return nil, nil, fmt.Errorf("soundfont: %w", err)
	}
	file, err := meltysynth.NewMidiFile(bytes.NewReader(midi))
	if err != nil {
		return nil, nil, fmt.Errorf("midi: %w", err)
	}
	synth, err := meltysynth.NewSynthesizer(font, meltysynth.NewSynthesizerSettings(int32(sampleRate)))
	if err != nil {
		return nil, nil, fmt.Errorf("synthesizer: %w", err)
	}
	seq := meltysynth.NewMidiFileSequencer(synth)
	seq.Play(file, false)
	n := int(math.Round(file.GetLength().Seconds() * float64(sampleRate)))
	left, right = make([]float32, n), make([]float32, n)
	seq.Render(left, right)
	return left, right, nil
}

// pcm16 interleaves the channels as signed 16-bit samples, clipping to the range.
func pcm16(left, right []float32) []int16 {
	out := make([]int16, 0, 2*len(left))
	conv := func(v float32) int16 {
		x := math.Round(float64(v) * 32768)
		return int16(math.Max(-32768, math.Min(32767, x)))
	}
	for i := range left {
		out = append(out, conv(left[i]), conv(right[i]))
	}
	return out
}

// encodeWAV returns a 16-bit stereo PCM WAV file.
func encodeWAV(left, right []float32, rate int) []byte {
	data := len(left) * 2 * 2
	var b bytes.Buffer
	b.WriteString("RIFF")
	binary.Write(&b, binary.LittleEndian, uint32(36+data))
	b.WriteString("WAVEfmt ")
	binary.Write(&b, binary.LittleEndian, uint32(16))
	binary.Write(&b, binary.LittleEndian, []uint16{1, 2})
	binary.Write(&b, binary.LittleEndian, []uint32{uint32(rate), uint32(rate * 4)})
	binary.Write(&b, binary.LittleEndian, []uint16{4, 16})
	b.WriteString("data")
	binary.Write(&b, binary.LittleEndian, uint32(data))
	binary.Write(&b, binary.LittleEndian, pcm16(left, right))
	return b.Bytes()
}

// memFile is an io.WriteSeeker in memory: the FLAC encoder seeks back to fill in the stream info.
type memFile struct {
	buf []byte
	pos int64
}

func (m *memFile) Write(p []byte) (int, error) {
	if end := m.pos + int64(len(p)); end > int64(len(m.buf)) {
		m.buf = append(m.buf, make([]byte, end-int64(len(m.buf)))...)
	}
	copy(m.buf[m.pos:], p)
	m.pos += int64(len(p))
	return len(p), nil
}

func (m *memFile) Seek(off int64, whence int) (int64, error) {
	switch whence {
	case 0:
		m.pos = off
	case 1:
		m.pos += off
	default:
		m.pos = int64(len(m.buf)) + off
	}
	if m.pos < 0 {
		return 0, errors.New("negative position")
	}
	return m.pos, nil
}

const flacBlock = 4096

// encodeFLAC returns a 16-bit stereo FLAC file (lossless).
func encodeFLAC(left, right []float32, rate int) ([]byte, error) {
	out := &memFile{}
	info := &meta.StreamInfo{BlockSizeMin: flacBlock, BlockSizeMax: flacBlock, SampleRate: uint32(rate), NChannels: 2, BitsPerSample: 16}
	enc, err := flac.NewEncoder(out, info)
	if err != nil {
		return nil, err
	}
	pcm := pcm16(left, right)
	for from := 0; from < len(left); from += flacBlock {
		to := min(from+flacBlock, len(left))
		sub := func(ch int) *frame.Subframe {
			s := make([]int32, 0, to-from)
			for i := from; i < to; i++ {
				s = append(s, int32(pcm[2*i+ch]))
			}
			return &frame.Subframe{SubHeader: frame.SubHeader{Pred: frame.PredVerbatim}, Samples: s, NSamples: len(s)}
		}
		fr := &frame.Frame{
			Header:    frame.Header{HasFixedBlockSize: true, BlockSize: uint16(to - from), SampleRate: uint32(rate), Channels: frame.ChannelsLR, BitsPerSample: 16},
			Subframes: []*frame.Subframe{sub(0), sub(1)},
		}
		if err := enc.WriteFrame(fr); err != nil {
			return nil, err
		}
	}
	if err := enc.Close(); err != nil {
		return nil, err
	}
	// Close records the shorter last block as the minimum block size, which makes decoders treat the
	// stream as variable-block and complain about the frame numbers. The minimum excludes the last
	// block: patch it back (STREAMINFO starts after "fLaC" and the 4-byte block header; it begins
	// with the 16-bit big-endian minimum block size).
	binary.BigEndian.PutUint16(out.buf[8:], flacBlock)
	return out.buf, nil
}

func main() {
	sf2Path := flag.String("sf2", "", "SoundFont file")
	in := flag.String("in", "", "MIDI or KAR file")
	outPath := flag.String("out", "", "output file; .wav or .flac decides the format")
	rate := flag.Int("rate", 44100, "sample rate in Hz (16000-192000)")
	flag.Parse()
	if *sf2Path == "" || *in == "" || *outPath == "" {
		flag.Usage()
		os.Exit(2)
	}
	if err := run(*sf2Path, *in, *outPath, *rate); err != nil {
		fmt.Fprintln(os.Stderr, "s1b-render:", err)
		os.Exit(1)
	}
}

func run(sf2Path, in, outPath string, rate int) error {
	sf2, err := os.ReadFile(sf2Path)
	if err != nil {
		return err
	}
	midi, err := os.ReadFile(in)
	if err != nil {
		return err
	}
	t0 := time.Now()
	if _, err := meltysynth.NewSoundFont(bytes.NewReader(sf2)); err != nil {
		return fmt.Errorf("soundfont: %w", err)
	}
	loadTime := time.Since(t0) // render parses the SoundFont again; this is only to show its share
	runtime.GC()               // and the probe's copy must not count in the memory numbers
	t0 = time.Now()
	left, right, err := render(midi, sf2, rate)
	if err != nil {
		return err
	}
	renderTime := time.Since(t0)
	audio := float64(len(left)) / float64(rate)

	t1 := time.Now()
	var data []byte
	switch strings.ToLower(filepath.Ext(outPath)) {
	case ".wav":
		data = encodeWAV(left, right, rate)
	case ".flac":
		if data, err = encodeFLAC(left, right, rate); err != nil {
			return err
		}
	default:
		return errors.New("the output file must end in .wav or .flac")
	}
	encodeTime := time.Since(t1)
	if err := os.WriteFile(outPath, data, 0o644); err != nil {
		return err
	}

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	fmt.Printf("audio:        %.1f s at %d Hz stereo\n", audio, rate)
	fmt.Printf("soundfont:    %v to parse %.1f MB (included in the render time)\n", loadTime.Round(time.Millisecond), float64(len(sf2))/1e6)
	fmt.Printf("render:       %v (%.1fx real time)\n", renderTime.Round(time.Millisecond), audio/renderTime.Seconds())
	fmt.Printf("encode:       %v (%.1fx real time)\n", encodeTime.Round(time.Millisecond), audio/encodeTime.Seconds())
	fmt.Printf("output:       %s, %.2f MB (%.0f kbit/s)\n", outPath, float64(len(data))/1e6, float64(len(data))*8/audio/1000)
	fmt.Printf("memory:       %.0f MB obtained from the OS, %.0f MB allocated in total\n", float64(ms.Sys)/1e6, float64(ms.TotalAlloc)/1e6)
	return nil
}
