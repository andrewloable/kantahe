// Package video keeps the background videos of the player (docs/PLAN.md section 4.2): the table that lists them and Inspect, which
// judges an uploaded file without decoding it. The server is one static pure-Go binary and cannot decode or transcode video, so it reads
// the box structure of the MP4 (ISO BMFF) and accepts only what every player decodes: H.264.
package video

import (
	"errors"
	"fmt"
	"io"
	"math"
	"math/bits"
)

// Limits of Inspect. A file is judged by its headers and its moov box only; mdat is never read.
const (
	maxMoov     = 16 << 20 // a bigger moov is refused (ErrTooLarge); the real ones of long videos are a few MB at most
	maxWidth    = 3840
	maxTopBoxes = 1024 // top-level boxes looked at before the file is called damaged
	maxFtyp     = 64 << 10
)

// What is wrong with a file; the text is shown to the administrator.
var (
	ErrNotMP4       = errors.New("not an MP4 video file")
	ErrNoVideoTrack = errors.New("the file has no video track")
	ErrTooWide      = errors.New("the video is wider than 3840 px")
	ErrTooLarge     = errors.New("the index of the video (its moov box) is bigger than 16 MiB")
	ErrCorrupt      = errors.New("the file is damaged")
)

// ErrCodec is returned for a video track that is not H.264.
type ErrCodec struct{ Codec string }

func (e ErrCodec) Error() string {
	return fmt.Sprintf("the video codec %s is not supported: re-encode it as H.264 (see the admin guide)", e.Codec)
}

// Info is what Inspect found out about an accepted file. Width above 1920 is reported, not refused (Warnings says so).
type Info struct {
	Container  string // "mp4", or "mov" for a QuickTime file
	Codec      string // "avc1" or "avc3"
	Width      int
	Height     int
	DurationMs int64
	HasAudio   bool
	FastStart  bool // moov comes before the first mdat, so playback can start before the whole file is there
}

// brands are the ftyp brands (major or compatible) that are accepted.
var brands = map[string]bool{"isom": true, "iso2": true, "mp41": true, "mp42": true, "avc1": true, "M4V ": true, "qt  ": true}

// codecs are the sample entry types that are accepted.
var codecs = map[string]bool{"avc1": true, "avc3": true}

// Inspect judges the file in r (size bytes long). It reads the box headers, the ftyp box and the moov box (at most maxMoov), never
// the media data and never more memory than it has read, whatever sizes the boxes declare.
func Inspect(r io.ReaderAt, size int64) (Info, error) {
	var info Info
	if size < 8 {
		return info, ErrNotMP4
	}
	var moov []byte
	var moovOff int64 = -1
	mdatSeen := false
	faststart := false
	for off, n := int64(0), 0; off < size; n++ {
		if n >= maxTopBoxes {
			return info, ErrCorrupt
		}
		hdr, err := readBoxHeader(r, off, size-off)
		if err != nil {
			if off == 0 {
				return info, ErrNotMP4
			}
			return info, err
		}
		if off == 0 {
			if hdr.typ != "ftyp" {
				return info, ErrNotMP4
			}
			if hdr.size > maxFtyp {
				return info, ErrNotMP4
			}
			body, err := readExact(r, off+hdr.header, hdr.size-hdr.header)
			if err != nil {
				return info, err
			}
			container, ok := checkBrands(body)
			if !ok {
				return info, ErrNotMP4
			}
			info.Container = container
		}
		switch hdr.typ {
		case "mdat":
			mdatSeen = true
		case "moov":
			if moovOff >= 0 {
				return info, ErrCorrupt // two moov boxes
			}
			if hdr.size-hdr.header > maxMoov {
				return info, ErrTooLarge
			}
			moov, err = readExact(r, off+hdr.header, hdr.size-hdr.header)
			if err != nil {
				return info, err
			}
			moovOff = off
			faststart = !mdatSeen
		}
		if moovOff >= 0 && mdatSeen {
			break
		}
		off += hdr.size
	}
	if moovOff < 0 || !mdatSeen {
		return info, ErrCorrupt
	}
	if err := parseMoov(moov, &info); err != nil {
		return info, err
	}
	info.FastStart = faststart
	return info, nil
}

// boxHeader is the size and type of one box; size is the whole box (header included), header the length of the header (8 or 16).
type boxHeader struct {
	typ    string
	size   int64
	header int64
}

// readBoxHeader reads the header at off; remaining is the number of bytes from off to the end of the container. A box that is smaller
// than its header or runs past the end is ErrCorrupt. Size 0 means to the end; size 1 means a 64-bit size follows.
func readBoxHeader(r io.ReaderAt, off, remaining int64) (boxHeader, error) {
	if remaining < 8 {
		return boxHeader{}, ErrCorrupt
	}
	b, err := readExact(r, off, 8)
	if err != nil {
		return boxHeader{}, err
	}
	return finishHeader(b, remaining, func() ([]byte, error) { return readExact(r, off+8, 8) })
}

// finishHeader turns the first 8 bytes of a header into a boxHeader; wide fetches the 8 bytes of a 64-bit size.
func finishHeader(b []byte, remaining int64, wide func() ([]byte, error)) (boxHeader, error) {
	size := uint64(uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3]))
	h := boxHeader{typ: string(b[4:8]), header: 8}
	switch size {
	case 0:
		size = uint64(remaining)
	case 1:
		if remaining < 16 {
			return h, ErrCorrupt
		}
		w, err := wide()
		if err != nil {
			return h, err
		}
		size = 0
		for _, c := range w {
			size = size<<8 | uint64(c)
		}
		h.header = 16
	}
	if size < uint64(h.header) || size > uint64(remaining) {
		return h, ErrCorrupt
	}
	h.size = int64(size)
	return h, nil
}

// readExact reads n bytes at off. Short data is a damaged file; any other error is the reader's own and is passed on.
func readExact(r io.ReaderAt, off, n int64) ([]byte, error) {
	buf := make([]byte, 0, min(n, 64<<10))
	for int64(len(buf)) < n {
		chunk := min(n-int64(len(buf)), 1<<20)
		part := make([]byte, chunk)
		got, err := r.ReadAt(part, off+int64(len(buf)))
		buf = append(buf, part[:got]...)
		if int64(got) < chunk {
			if err == nil || errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
				return nil, ErrCorrupt
			}
			return nil, fmt.Errorf("read video: %w", err)
		}
	}
	return buf, nil
}

// checkBrands reads the body of ftyp (major brand, minor version, compatible brands).
func checkBrands(body []byte) (container string, ok bool) {
	if len(body) < 8 {
		return "", false
	}
	major := string(body[:4])
	container = "mp4"
	if major == "qt  " {
		container = "mov"
	}
	if brands[major] {
		return container, true
	}
	for i := 8; i+4 <= len(body); i += 4 {
		if brands[string(body[i:i+4])] {
			return container, true
		}
	}
	return "", false
}

// parseMoov fills info from the body of the moov box: duration from mvhd, then size and codec of the first video track.
func parseMoov(moov []byte, info *Info) error {
	mvhd, ok, err := child(moov, "mvhd")
	if err != nil || !ok {
		return orCorrupt(err)
	}
	duration, err := movieDuration(mvhd)
	if err != nil {
		return err
	}
	info.DurationMs = duration
	found := false
	for rest := moov; ; {
		var trak []byte
		trak, rest, ok, err = next(rest, "trak")
		if err != nil {
			return err
		}
		if !ok {
			break
		}
		kind, mdia, err := trackKind(trak)
		if err != nil {
			return err
		}
		switch kind {
		case "soun":
			info.HasAudio = true
		case "vide":
			if found {
				continue // the first video track is the one the player shows
			}
			found = true
			if err := parseVideoTrack(trak, mdia, info); err != nil {
				return err
			}
		}
	}
	if !found {
		return ErrNoVideoTrack
	}
	return nil
}

// trackKind returns the handler type of a trak ("vide", "soun", ...) and its mdia body.
func trackKind(trak []byte) (kind string, mdia []byte, err error) {
	mdia, ok, err := child(trak, "mdia")
	if err != nil || !ok {
		return "", nil, orCorrupt(err)
	}
	hdlr, ok, err := child(mdia, "hdlr")
	if err != nil || !ok || len(hdlr) < 12 {
		return "", nil, ErrCorrupt
	}
	return string(hdlr[8:12]), mdia, nil
}

func parseVideoTrack(trak, mdia []byte, info *Info) error {
	tkhd, ok, err := child(trak, "tkhd")
	if err != nil || !ok {
		return orCorrupt(err)
	}
	// width and height are 16.16 fixed point at the end of tkhd: 84 bytes in version 0, 96 in version 1
	if len(tkhd) < 84 || (tkhd[0] == 1 && len(tkhd) < 96) {
		return ErrCorrupt
	}
	end := 84
	if tkhd[0] == 1 {
		end = 96
	}
	info.Width = int(uint32(tkhd[end-8])<<8 | uint32(tkhd[end-7])) // ponytail: the integer part only (2 bytes), a width is never fractional
	info.Height = int(uint32(tkhd[end-4])<<8 | uint32(tkhd[end-3]))
	codec, err := firstSampleEntry(mdia)
	if err != nil {
		return err
	}
	if !codecs[codec] {
		return ErrCodec{Codec: printable(codec)}
	}
	if info.Width > maxWidth {
		return ErrTooWide
	}
	info.Codec = codec
	return nil
}

// firstSampleEntry returns the type of the first sample entry in mdia/minf/stbl/stsd.
func firstSampleEntry(mdia []byte) (string, error) {
	minf, ok, err := child(mdia, "minf")
	if err != nil || !ok {
		return "", orCorrupt(err)
	}
	stbl, ok, err := child(minf, "stbl")
	if err != nil || !ok {
		return "", orCorrupt(err)
	}
	stsd, ok, err := child(stbl, "stsd")
	if err != nil || !ok || len(stsd) < 16 {
		return "", ErrCorrupt
	}
	if be32(stsd[4:]) == 0 { // no sample entry
		return "", ErrCorrupt
	}
	return string(stsd[12:16]), nil
}

// movieDuration reads timescale and duration of mvhd and gives the duration in milliseconds.
func movieDuration(mvhd []byte) (int64, error) {
	var scale, duration uint64
	switch {
	case len(mvhd) >= 20 && mvhd[0] == 0:
		scale, duration = uint64(be32(mvhd[12:])), uint64(be32(mvhd[16:]))
	case len(mvhd) >= 32 && mvhd[0] == 1:
		scale, duration = uint64(be32(mvhd[20:])), uint64(be32(mvhd[24:]))<<32|uint64(be32(mvhd[28:]))
	default:
		return 0, ErrCorrupt
	}
	if scale == 0 {
		return 0, ErrCorrupt
	}
	hi, lo := bits.Mul64(duration, 1000)
	if hi >= scale {
		return 0, ErrCorrupt
	}
	ms, _ := bits.Div64(hi, lo, scale)
	if ms > math.MaxInt64 {
		return 0, ErrCorrupt
	}
	return int64(ms), nil
}

func be32(b []byte) uint32 {
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}

// child returns the body of the first box of the given type directly inside parent (a body already in memory).
func child(parent []byte, typ string) ([]byte, bool, error) {
	body, _, ok, err := next(parent, typ)
	return body, ok, err
}

// next returns the body of the first box of type typ in data, and the data after it, so that a caller can ask for the next one.
func next(data []byte, typ string) (body, rest []byte, ok bool, err error) {
	for len(data) > 0 {
		if len(data) < 8 {
			return nil, nil, false, ErrCorrupt
		}
		h, err := finishHeader(data[:8], int64(len(data)), func() ([]byte, error) {
			if len(data) < 16 {
				return nil, ErrCorrupt
			}
			return data[8:16], nil
		})
		if err != nil {
			return nil, nil, false, err
		}
		if h.typ == typ {
			return data[h.header:h.size], data[h.size:], true, nil
		}
		data = data[h.size:]
	}
	return nil, nil, false, nil
}

// orCorrupt is err, or ErrCorrupt when err is nil (a required box is missing).
func orCorrupt(err error) error {
	if err != nil {
		return err
	}
	return ErrCorrupt
}

// printable keeps a codec name that came from the file safe to show: anything but letters, digits and spaces becomes "?".
func printable(s string) string {
	out := []byte(s)
	for i, c := range out {
		if c < ' ' || c > '~' {
			out[i] = '?'
		}
	}
	return string(out)
}
