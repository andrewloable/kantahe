package video

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func inspectBytes(b []byte) (Info, error) { return Inspect(bytes.NewReader(b), int64(len(b))) }

func TestInspectAcceptsH264WithMoovFirst(t *testing.T) {
	got, err := inspectBytes(testfix.MP4(testfix.MP4Options{DurationMs: 5000, MoovFirst: true}))
	want := Info{Container: "mp4", Codec: "avc1", Width: 1920, Height: 1080, DurationMs: 5000, FastStart: true}
	if err != nil || got != want {
		t.Fatalf("got %+v %v, want %+v", got, err, want)
	}
	if got, err := inspectBytes(testfix.MP4(testfix.MP4Options{Codec: "avc3", MoovFirst: true})); err != nil || got.Codec != "avc3" {
		t.Fatalf("avc3: %+v %v", got, err)
	}
}

func TestInspectSeesAnAudioTrackAndMoovAfterMdat(t *testing.T) {
	got, err := inspectBytes(testfix.MP4(testfix.MP4Options{DurationMs: 5000, MoovFirst: true, WithAudio: true}))
	if err != nil || !got.HasAudio || !got.FastStart {
		t.Fatalf("with audio: %+v %v", got, err)
	}
	got, err = inspectBytes(testfix.MP4(testfix.MP4Options{DurationMs: 5000}))
	if err != nil || got.FastStart || got.HasAudio {
		t.Fatalf("moov after mdat: %+v %v", got, err)
	}
	if w := Warnings(Video{Width: got.Width, FastStart: got.FastStart}); len(w) != 1 || !strings.Contains(w[0], "not optimised for streaming") {
		t.Fatalf("warnings = %v", w)
	}
}

func TestInspectReadsVersion1Headers(t *testing.T) {
	got, err := inspectBytes(testfix.MP4(testfix.MP4Options{Version1: true, WithAudio: true, MoovFirst: true, DurationMs: 7000, Width: 1280, Height: 720}))
	want := Info{Container: "mp4", Codec: "avc1", Width: 1280, Height: 720, DurationMs: 7000, HasAudio: true, FastStart: true}
	if err != nil || got != want {
		t.Fatalf("got %+v %v, want %+v", got, err, want)
	}
}

func TestInspectRefusesOtherCodecsAndNamesThem(t *testing.T) {
	for _, codec := range []string{"hvc1", "av01", "vp09"} {
		_, err := inspectBytes(testfix.MP4(testfix.MP4Options{Codec: codec, MoovFirst: true}))
		var ce ErrCodec
		if !errors.As(err, &ce) || ce.Codec != codec || !strings.Contains(err.Error(), codec) || !strings.Contains(err.Error(), "H.264") {
			t.Errorf("%s: %v", codec, err)
		}
	}
}

func TestInspectAnAudioOnlyFileHasNoVideoTrack(t *testing.T) {
	if _, err := inspectBytes(testfix.MP4(testfix.MP4Options{NoVideo: true, MoovFirst: true})); !errors.Is(err, ErrNoVideoTrack) {
		t.Fatalf("err = %v", err)
	}
}

func TestInspectWidthLimit(t *testing.T) {
	if _, err := inspectBytes(testfix.MP4(testfix.MP4Options{Width: 4096, Height: 2160})); !errors.Is(err, ErrTooWide) {
		t.Fatalf("4096: %v", err)
	}
	for _, w := range []int{3840, 2560} {
		if got, err := inspectBytes(testfix.MP4(testfix.MP4Options{Width: w, Height: 1080})); err != nil || got.Width != w {
			t.Fatalf("%d: %+v %v", w, got, err)
		}
	}
	// wider than 1920 is accepted; the store warns
	if w := Warnings(Video{Width: 2560, FastStart: true}); len(w) != 1 || !strings.Contains(w[0], "wider than 1920 px") {
		t.Fatalf("warnings = %v", w)
	}
}

func TestInspectBrands(t *testing.T) {
	cases := map[string]error{"mp42": nil, "M4V ": nil, "qt  ": nil, "mkv ": ErrNotMP4, "heic": ErrNotMP4}
	for brand, want := range cases {
		got, err := inspectBytes(testfix.MP4(testfix.MP4Options{Brand: brand, MoovFirst: true}))
		if !errors.Is(err, want) && (err != nil || want != nil) {
			t.Errorf("%q: %v, want %v", brand, err, want)
		}
		if brand == "qt  " && got.Container != "mov" {
			t.Errorf("qt container = %q", got.Container)
		}
	}
}

func TestInspectGarbageNeverPanicsOrHangs(t *testing.T) {
	good := testfix.MP4(testfix.MP4Options{MoovFirst: true, WithAudio: true})
	// every cut of a good file: only the whole file is accepted, a cut in the middle of moov is damaged
	for n := 0; n < len(good); n++ {
		if _, err := inspectBytes(good[:n]); !errors.Is(err, ErrNotMP4) && !errors.Is(err, ErrCorrupt) {
			t.Fatalf("cut at %d of %d: err = %v", n, len(good), err)
		}
	}
	for _, in := range [][]byte{nil, {}, []byte("hello"), bytes.Repeat([]byte{0xff}, 4096), bytes.Repeat([]byte{0}, 4096)} {
		if _, err := inspectBytes(in); !errors.Is(err, ErrNotMP4) && !errors.Is(err, ErrCorrupt) {
			t.Fatalf("%d garbage bytes: err = %v", len(in), err)
		}
	}
	// flipping any single byte never panics
	for i := range good {
		bad := bytes.Clone(good)
		bad[i] ^= 0xff
		_, _ = inspectBytes(bad)
	}
}

// counting counts the bytes that Inspect reads.
type counting struct {
	r io.ReaderAt
	n int64
}

func (c *counting) ReadAt(p []byte, off int64) (int, error) {
	n, err := c.r.ReadAt(p, off)
	c.n += int64(n)
	return n, err
}

func within(t *testing.T, what string, d time.Duration, f func()) {
	t.Helper()
	done := make(chan struct{})
	go func() { f(); close(done) }()
	select {
	case <-done:
	case <-time.After(d):
		t.Fatalf("%s: no answer after %v", what, d)
	}
}

// withBox is a good file (ftyp, moov) whose mdat is replaced by a box that declares the given size: in 4 bytes, or in the 64-bit form
// (size field 1, then 8 bytes).
func withBox(typ string, size uint64, wide bool, payload int) []byte {
	b := testfix.MP4(testfix.MP4Options{MoovFirst: true})
	b = b[:len(b)-24] // the mdat: 8 bytes of header and the 16 of the fixture
	var hdr []byte
	if wide {
		hdr = append([]byte{0, 0, 0, 1}, []byte(typ)...)
		hdr = append(hdr, byte(size>>56), byte(size>>48), byte(size>>40), byte(size>>32), byte(size>>24), byte(size>>16), byte(size>>8), byte(size))
	} else {
		hdr = append([]byte{byte(size >> 24), byte(size >> 16), byte(size >> 8), byte(size)}, []byte(typ)...)
	}
	return append(append(b[:0:0], b...), append(hdr, make([]byte, payload)...)...)
}

func TestInspectHugeDeclaredSizesDoNotAllocateOrLoop(t *testing.T) {
	// the declared sizes are far beyond the file; reading must stay near the file size, and the answer must come fast
	for _, tc := range []struct {
		name string
		file []byte
	}{
		{"32-bit 0xFFFFFFFF mdat after moov", withBox("mdat", 0xFFFFFFFF, false, 16)},
		{"64-bit 2^63 box", withBox("free", 1<<63, true, 16)},
		{"64-bit 2^64-1 box", withBox("free", math.MaxUint64, true, 16)},
		{"first box 0xFFFFFFFF", append([]byte{0xff, 0xff, 0xff, 0xff, 'f', 't', 'y', 'p'}, make([]byte, 64)...)},
		{"first box 2^63", append([]byte{0, 0, 0, 1, 'f', 't', 'y', 'p', 0x80, 0, 0, 0, 0, 0, 0, 0}, make([]byte, 64)...)},
	} {
		c := &counting{r: bytes.NewReader(tc.file)}
		within(t, tc.name, 2*time.Second, func() { _, _ = Inspect(c, int64(len(tc.file))) })
		if c.n > 17<<20 {
			t.Errorf("%s: read %d bytes", tc.name, c.n)
		}
	}
	// the first of them: moov is first, mdat after it declares too much; the file is damaged, not accepted
	if _, err := inspectBytes(withBox("mdat", 0xFFFFFFFF, false, 16)); err == nil {
		t.Error("a box that runs past the end of the file was accepted")
	}
}

func TestInspectSizeZeroMeansToTheEndOfTheFile(t *testing.T) {
	b := testfix.MP4(testfix.MP4Options{DurationMs: 3000}) // ftyp, mdat, moov
	// the size field of the last box (moov) is the 4 bytes before its type
	i := bytes.LastIndex(b, []byte("moov")) - 4
	copy(b[i:], []byte{0, 0, 0, 0})
	got, err := inspectBytes(b)
	if err != nil || got.DurationMs != 3000 || got.FastStart {
		t.Fatalf("got %+v %v", got, err)
	}
}

// sparse is a file of the given size that holds only its head and its tail; any other read gives zeros and is counted.
type sparse struct {
	size       int64
	head, tail []byte
	read       int64
}

func (s *sparse) ReadAt(p []byte, off int64) (int, error) {
	if off >= s.size {
		return 0, io.EOF
	}
	n := int64(len(p))
	if off+n > s.size {
		n = s.size - off
	}
	s.read += n
	for i := int64(0); i < n; i++ {
		pos := off + i
		switch {
		case pos < int64(len(s.head)):
			p[i] = s.head[pos]
		case pos >= s.size-int64(len(s.tail)):
			p[i] = s.tail[pos-(s.size-int64(len(s.tail)))]
		default:
			p[i] = 0
		}
	}
	if n < int64(len(p)) {
		return int(n), io.EOF
	}
	return int(n), nil
}

func TestInspectJudgesAHugeFileByItsHeaders(t *testing.T) {
	good := testfix.MP4(testfix.MP4Options{DurationMs: 90000}) // ftyp, mdat (24 bytes), moov
	ftypLen := int(be32(good))
	moovAt := bytes.LastIndex(good, []byte("moov")) - 4
	const total = int64(6) << 30 // 6 GiB: the mdat in the middle declares the rest
	mdat := append([]byte{0, 0, 0, 1, 'm', 'd', 'a', 't'}, make([]byte, 8)...)
	moov := good[moovAt:]
	mdatSize := uint64(total) - uint64(ftypLen) - uint64(len(moov))
	for i := 0; i < 8; i++ {
		mdat[8+i] = byte(mdatSize >> (56 - 8*i))
	}
	s := &sparse{size: total, head: append(append([]byte{}, good[:ftypLen]...), mdat...), tail: moov}
	var got Info
	var err error
	within(t, "6 GiB file", 2*time.Second, func() { got, err = Inspect(s, total) })
	if err != nil || got.FastStart || got.DurationMs != 90000 || got.Codec != "avc1" {
		t.Fatalf("got %+v %v", got, err)
	}
	if s.read > 1<<20 {
		t.Fatalf("read %d bytes of a 6 GiB file", s.read)
	}
}

func TestInspectRefusesAMoovBiggerThan16MiB(t *testing.T) {
	good := testfix.MP4(testfix.MP4Options{})
	moovAt := bytes.LastIndex(good, []byte("moov")) - 4
	big := append(append([]byte{}, good[:moovAt]...), 0x01, 0x40, 0x00, 0x08, 'm', 'o', 'o', 'v') // 20 MiB + 8
	big = append(big, make([]byte, 20<<20)...)
	c := &counting{r: bytes.NewReader(big)}
	if _, err := Inspect(c, int64(len(big))); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("err = %v", err)
	}
	if c.n > 1<<20 {
		t.Fatalf("read %d bytes of the oversized moov", c.n)
	}
	// and a moov of exactly the limit is still read (it is damaged here, but not "too large")
	edge := append(append([]byte{}, good[:moovAt]...), 0x01, 0x00, 0x00, 0x08, 'm', 'o', 'o', 'v') // 16 MiB exactly
	edge = append(edge, make([]byte, maxMoov-8+8)...)
	if _, err := inspectBytes(edge); errors.Is(err, ErrTooLarge) {
		t.Fatalf("a moov of 16 MiB was called too large")
	}
}

func TestMovieDuration(t *testing.T) {
	v0 := func(scale, dur uint32) []byte {
		b := make([]byte, 100)
		copy(b[12:], []byte{byte(scale >> 24), byte(scale >> 16), byte(scale >> 8), byte(scale)})
		copy(b[16:], []byte{byte(dur >> 24), byte(dur >> 16), byte(dur >> 8), byte(dur)})
		return b
	}
	if ms, err := movieDuration(v0(600, 3000)); err != nil || ms != 5000 {
		t.Fatalf("v0 = %d %v", ms, err)
	}
	if _, err := movieDuration(v0(0, 3000)); !errors.Is(err, ErrCorrupt) {
		t.Fatalf("timescale 0: %v", err)
	}
	v1 := make([]byte, 112)
	v1[0] = 1
	copy(v1[20:], []byte{0, 0, 0x03, 0xe8})                               // timescale 1000
	copy(v1[24:], []byte{0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff}) // the largest duration
	if _, err := movieDuration(v1); !errors.Is(err, ErrCorrupt) && err != nil {
		t.Fatalf("overflow: %v", err)
	}
	if ms, err := movieDuration(v1); err == nil && ms < 0 {
		t.Fatalf("negative duration %d", ms)
	}
}

func FuzzInspect(f *testing.F) {
	for _, o := range []testfix.MP4Options{
		{MoovFirst: true}, {}, {WithAudio: true, MoovFirst: true}, {Version1: true, MoovFirst: true}, {Codec: "hvc1"}, {NoVideo: true},
	} {
		f.Add(testfix.MP4(o))
	}
	f.Add([]byte{})
	f.Add([]byte{0, 0, 0, 1, 'f', 't', 'y', 'p', 0x80, 0, 0, 0, 0, 0, 0, 0})
	f.Fuzz(func(t *testing.T, data []byte) {
		info, err := inspectBytes(data)
		if err != nil {
			return
		}
		if info.Width > maxWidth || !codecs[info.Codec] || info.DurationMs < 0 || info.Container == "" {
			t.Fatalf("an accepted file with %+v", info)
		}
	})
}

// TestInspectMatchesFFprobeOnRealFiles compares Inspect with ffprobe on every video in the folder named by KANTAHE_TEST_VIDEOS; it
// skips when that is unset or ffprobe is missing. No video is ever committed: the folder is the developer's own.
func TestInspectMatchesFFprobeOnRealFiles(t *testing.T) {
	dir := os.Getenv("KANTAHE_TEST_VIDEOS")
	if dir == "" {
		t.Skip("KANTAHE_TEST_VIDEOS is not set")
	}
	if _, err := exec.LookPath("ffprobe"); err != nil {
		t.Skip("ffprobe is not installed")
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*"))
	if len(files) == 0 {
		t.Fatalf("no files in %s", dir)
	}
	for _, path := range files {
		out, err := exec.Command("ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path).Output()
		if err != nil {
			continue // not a media file at all
		}
		var probe struct {
			Streams []struct {
				CodecType string `json:"codec_type"`
				CodecName string `json:"codec_name"`
				Width     int    `json:"width"`
				Height    int    `json:"height"`
			} `json:"streams"`
			Format struct {
				Duration string `json:"duration"`
			} `json:"format"`
		}
		if err := json.Unmarshal(out, &probe); err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		var vcodec string
		var w, h int
		audio := false
		for _, st := range probe.Streams {
			switch st.CodecType {
			case "video":
				if vcodec == "" {
					vcodec, w, h = st.CodecName, st.Width, st.Height
				}
			case "audio":
				audio = true
			}
		}
		f, err := os.Open(path)
		if err != nil {
			t.Fatal(err)
		}
		st, _ := f.Stat()
		info, err := Inspect(f, st.Size())
		f.Close()
		name := filepath.Base(path)
		switch {
		case vcodec == "h264":
			if err != nil {
				t.Errorf("%s: ffprobe says H.264, Inspect says %v", name, err)
				continue
			}
			var secs float64
			_, _ = fmt.Sscanf(probe.Format.Duration, "%f", &secs)
			if info.Width != w || info.Height != h || info.HasAudio != audio || math.Abs(float64(info.DurationMs)-secs*1000) > 50 {
				t.Errorf("%s: Inspect %+v, ffprobe %dx%d audio=%v %.3f s", name, info, w, h, audio, secs)
			}
			t.Logf("%s: %+v", name, info)
		case vcodec != "":
			// another codec in an MP4 is ErrCodec; another container (WebM, Matroska) is not an MP4 at all
			var ce ErrCodec
			if !errors.As(err, &ce) && !errors.Is(err, ErrNotMP4) {
				t.Errorf("%s: ffprobe says %s, Inspect says %v", name, vcodec, err)
			} else {
				t.Logf("%s: %v", name, err)
			}
		}
	}
}
