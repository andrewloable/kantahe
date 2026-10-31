package karmp3

import (
	"bufio"
	"errors"
	"io"
)

// ErrNotMP3 means the data has no MPEG audio frames.
var ErrNotMP3 = errors.New("karmp3: not an MP3")

const (
	maxResync = 64 << 10 // how far past an ID3v2 tag to look for the first frame
	peekSize  = 64 << 10
)

var (
	bitratesV1 = [16]int{0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0}
	bitratesV2 = [16]int{0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0}
	ratesV1    = [4]int{44100, 48000, 32000, 0}
	ratesV2    = [4]int{22050, 24000, 16000, 0}
	ratesV25   = [4]int{11025, 12000, 8000, 0}
)

// frameInfo describes one MPEG audio frame (Layer III only).
type frameInfo struct {
	length, samples, rate int
	mono, crc, v1         bool
}

// parseHeader decodes a 4-byte MPEG audio frame header.
func parseHeader(h []byte) (frameInfo, bool) {
	if len(h) < 4 || h[0] != 0xFF || h[1]&0xE0 != 0xE0 {
		return frameInfo{}, false
	}
	version := h[1] >> 3 & 3 // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5, 1 = reserved
	if version == 1 || h[1]>>1&3 != 1 {
		return frameInfo{}, false // reserved version or not Layer III
	}
	brIdx, srIdx := h[2]>>4, h[2]>>2&3
	if brIdx == 0 || brIdx == 15 || srIdx == 3 {
		return frameInfo{}, false
	}
	pad := int(h[2] >> 1 & 1)
	f := frameInfo{mono: h[3]>>6 == 3, crc: h[1]&1 == 0, v1: version == 3}
	switch version {
	case 3:
		f.rate = ratesV1[srIdx]
		f.samples = 1152
		f.length = 144*bitratesV1[brIdx]*1000/f.rate + pad
	case 2:
		f.rate = ratesV2[srIdx]
		f.samples = 576
		f.length = 72*bitratesV2[brIdx]*1000/f.rate + pad
	default:
		f.rate = ratesV25[srIdx]
		f.samples = 576
		f.length = 72*bitratesV2[brIdx]*1000/f.rate + pad
	}
	return f, f.length >= 4
}

// skipID3v2 discards an ID3v2 tag at the start of the stream, if there is one.
func skipID3v2(br *bufio.Reader) error {
	h, err := br.Peek(10)
	if err != nil || string(h[:3]) != "ID3" {
		return nil
	}
	if h[6]|h[7]|h[8]|h[9] >= 0x80 {
		return nil // not a syncsafe size: treat as audio data
	}
	n := 10 + int(h[6])<<21 + int(h[7])<<14 + int(h[8])<<7 + int(h[9])
	if h[5]&0x10 != 0 {
		n += 10 // footer
	}
	if _, err := br.Discard(n); err != nil {
		return ErrNotMP3
	}
	return nil
}

// syncToFrame skips an ID3v2 tag, then padding, until a frame header starts a
// plausible frame: the next frame follows directly, or the data ends inside
// the frame. It leaves the reader at the frame's first byte.
func syncToFrame(br *bufio.Reader) (frameInfo, error) {
	if err := skipID3v2(br); err != nil {
		return frameInfo{}, err
	}
	for skipped := 0; skipped <= maxResync; skipped++ {
		h, _ := br.Peek(4)
		if len(h) < 4 {
			return frameInfo{}, ErrNotMP3
		}
		if f, ok := parseHeader(h); ok {
			win, _ := br.Peek(f.length + 4)
			if len(win) <= f.length { // the data ends inside this frame
				return f, nil
			}
			if _, next := parseHeader(win[f.length:]); next {
				return f, nil
			}
		}
		if _, err := br.Discard(1); err != nil {
			return frameInfo{}, ErrNotMP3
		}
	}
	return frameInfo{}, ErrNotMP3
}

// MP3Duration returns the playing time in milliseconds of an MP3 file: it skips
// an ID3v2 tag, then sums the samples of every Layer III frame, or uses the
// frame count of a Xing/Info header when there is one.
func MP3Duration(r io.ReaderAt, size int64) (int64, error) {
	return streamDuration(io.NewSectionReader(r, 0, size))
}

func streamDuration(r io.Reader) (int64, error) {
	br := bufio.NewReaderSize(r, peekSize)
	first, err := syncToFrame(br)
	if err != nil {
		return 0, err
	}
	if n := xingFrames(br, first); n > 0 {
		return n * int64(first.samples) * 1000 / int64(first.rate), nil
	}
	samples := map[int]int64{} // sample rate -> samples
	for {
		h, _ := br.Peek(4)
		f, ok := parseHeader(h)
		if !ok {
			break // trailing ID3v1 tag, other tags or padding
		}
		samples[f.rate] += int64(f.samples)
		if _, err := br.Discard(f.length); err != nil {
			break // truncated last frame still counts
		}
	}
	var ms int64
	for rate, n := range samples {
		ms += n * 1000 / int64(rate)
	}
	return ms, nil
}

// xingFrames returns the frame count of a Xing/Info header in the first frame, or 0.
func xingFrames(br *bufio.Reader, f frameInfo) int64 {
	side := 32
	switch {
	case f.v1 && f.mono:
		side = 17
	case !f.v1 && f.mono:
		side = 9
	case !f.v1:
		side = 17
	}
	off := 4 + side
	if f.crc {
		off += 2
	}
	b, _ := br.Peek(off + 12)
	if len(b) < off+12 || (string(b[off:off+4]) != "Xing" && string(b[off:off+4]) != "Info") {
		return 0
	}
	if b[off+7]&1 == 0 { // flags: frame count present
		return 0
	}
	return int64(uint32(b[off+8])<<24 | uint32(b[off+9])<<16 | uint32(b[off+10])<<8 | uint32(b[off+11]))
}
