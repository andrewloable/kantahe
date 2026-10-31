package testfix

import (
	"bytes"
	"time"
)

const (
	mp3FrameSize    = 417 // floor(144 * 128000 / 44100), no padding
	mp3FrameSamples = 1152
	mp3SampleRate   = 44100
)

// MP3Frames returns n silent MPEG-1 Layer III frames (44.1 kHz, 128 kbps,
// stereo, no CRC, no padding); the header is FF FB 90 00 and the payload zeros.
func MP3Frames(n int) []byte {
	frame := make([]byte, mp3FrameSize)
	copy(frame, []byte{0xFF, 0xFB, 0x90, 0x00})
	return bytes.Repeat(frame, n)
}

// MP3Duration is the playing time of MP3Frames(n).
func MP3Duration(n int) time.Duration {
	return time.Duration(n) * mp3FrameSamples * time.Second / mp3SampleRate
}
