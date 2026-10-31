package karmp3

import (
	"bytes"
	"errors"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func dur(t *testing.T, b []byte) int64 {
	t.Helper()
	ms, err := MP3Duration(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		t.Fatal(err)
	}
	return ms
}

func TestMP3Duration(t *testing.T) {
	got := dur(t, testfix.MP3Frames(1000)) // 1000 x 1152 / 44100 = 26122.4 ms
	if got < 26121 || got > 26123 {
		t.Fatalf("duration = %d, want 26122 +-1", got)
	}
}

func TestMP3DurationSkipsID3AndTrailingTag(t *testing.T) {
	body := append(id3v2(500, false), testfix.MP3Frames(100)...)
	body = append(body, append([]byte("TAG"), make([]byte, 125)...)...) // ID3v1
	if got, want := dur(t, body), dur(t, testfix.MP3Frames(100)); got != want {
		t.Fatalf("with tags %d, without %d", got, want)
	}
}

func TestMP3DurationResyncsOverPadding(t *testing.T) {
	body := append(bytes.Repeat([]byte{0}, 300), testfix.MP3Frames(100)...)
	if got, want := dur(t, body), dur(t, testfix.MP3Frames(100)); got != want {
		t.Fatalf("with padding %d, without %d", got, want)
	}
}

// header builds a frame of the given version/layer/bitrate/sample-rate bits.
func frame(version, layer, brIdx, srIdx, pad int, size int) []byte {
	f := make([]byte, size)
	f[0] = 0xFF
	f[1] = 0xE0 | byte(version<<3) | byte(layer<<1) | 1
	f[2] = byte(brIdx<<4) | byte(srIdx<<2) | byte(pad<<1)
	f[3] = 0xC0 // mono
	return f
}

func TestMP3DurationMPEG2(t *testing.T) {
	// MPEG-2 (version bits 10), Layer III, 64 kbps (index 8), 22050 Hz (index 0): 72*64000/22050 = 208 bytes, 576 samples
	var body []byte
	for i := 0; i < 100; i++ {
		body = append(body, frame(2, 1, 8, 0, 0, 208)...)
	}
	// 100 x 576 / 22050 = 2612.2 ms
	if got := dur(t, body); got < 2611 || got > 2613 {
		t.Fatalf("duration = %d, want about 2612", got)
	}
}

func TestMP3DurationWithPaddingBit(t *testing.T) {
	// MPEG-1 128 kbps 44.1 kHz with padding: 418 bytes
	var body []byte
	for i := 0; i < 50; i++ {
		body = append(body, frame(3, 1, 9, 0, 1, 418)...)
	}
	if got := dur(t, body); got < 1305 || got > 1306 { // 50*1152/44100 = 1306.1
		t.Fatalf("duration = %d, want about 1306", got)
	}
}

func TestMP3DurationUsesXingFrameCount(t *testing.T) {
	first := frame(3, 1, 9, 0, 0, 417)
	// MPEG-1 mono side info is 17 bytes: Xing header at 4+17
	copy(first[21:], "Xing")
	copy(first[25:], []byte{0, 0, 0, 1})       // flags: frames present
	copy(first[29:], []byte{0, 0, 0x27, 0x10}) // 10000 frames
	body := append(first, testfix.MP3Frames(3)...)
	if got := dur(t, body); got < 261000 || got > 261300 { // 10000*1152/44100 = 261224 ms
		t.Fatalf("duration = %d, want about 261224 from the Xing count", got)
	}
}

func TestMP3DurationRejectsNonMP3(t *testing.T) {
	cases := map[string][]byte{
		"empty":            nil,
		"junk":             bytes.Repeat([]byte{0x41}, 5000),
		"layer II":         frame(3, 2, 9, 0, 0, 417),
		"bad bitrate":      frame(3, 1, 15, 0, 0, 417),
		"free bitrate":     frame(3, 1, 0, 0, 0, 417),
		"bad samplerate":   frame(3, 1, 9, 3, 0, 417),
		"reserved version": frame(1, 1, 9, 0, 0, 417),
		"sync only":        {0xFF, 0xFB},
	}
	for name, b := range cases {
		if _, err := MP3Duration(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrNotMP3) {
			t.Errorf("%s: err = %v, want ErrNotMP3", name, err)
		}
	}
}

func TestMP3DurationTruncatedLastFrameCounts(t *testing.T) {
	full := testfix.MP3Frames(10)
	cut := full[:len(full)-100]
	if got, want := dur(t, cut), dur(t, full); got != want {
		t.Fatalf("truncated %d, full %d", got, want)
	}
}

func TestID3SizeBeyondFileIsNotAnMP3(t *testing.T) {
	b := []byte{'I', 'D', '3', 4, 0, 0, 0x7F, 0x7F, 0x7F, 0x7F}
	if _, err := MP3Duration(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrNotMP3) {
		t.Fatalf("err = %v", err)
	}
}

func FuzzMP3Duration(f *testing.F) {
	f.Add(testfix.MP3Frames(5))
	f.Add(append(id3v2(20, true), testfix.MP3Frames(3)...))
	f.Add([]byte("ID3"))
	f.Fuzz(func(t *testing.T, b []byte) {
		_, _ = MP3Duration(bytes.NewReader(b), int64(len(b)))
	})
}

func TestMP3DurationMPEG25(t *testing.T) {
	// MPEG-2.5 (version bits 00), Layer III, 64 kbps (index 8), 11025 Hz (index 0): 72*64000/11025 = 417 bytes, 576 samples
	var body []byte
	for i := 0; i < 100; i++ {
		body = append(body, frame(0, 1, 8, 0, 0, 417)...)
	}
	if got := dur(t, body); got < 5224 || got > 5226 { // 100*576/11025 = 5224.8
		t.Fatalf("duration = %d, want about 5225", got)
	}
}

func TestRandomBytesAreNotMistakenForFrames(t *testing.T) {
	rng := uint32(7)
	b := make([]byte, 200000)
	for i := range b {
		rng = rng*1664525 + 1013904223
		b[i] = byte(rng >> 24)
	}
	if _, err := MP3Duration(bytes.NewReader(b), int64(len(b))); !errors.Is(err, ErrNotMP3) {
		t.Fatalf("err = %v, want ErrNotMP3", err)
	}
}
