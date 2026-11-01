package testfix

import "encoding/binary"

// MP4Options describes a synthetic MP4 for MP4. Zero values mean: brand "isom", codec "avc1", 1920x1080, 1000 ms. There are no real
// frames: mdat holds a few bytes, so the file is judged by its boxes only.
type MP4Options struct {
	Brand      string // the one brand of ftyp, four characters; empty: "isom" with the compatible brands isom, iso2, avc1, mp41
	Codec      string // sample entry type of the video track: "avc1", "avc3", "hvc1", "av01", "vp09"
	Width      int
	Height     int
	DurationMs int
	MoovFirst  bool // moov before mdat ("faststart")
	WithAudio  bool // adds an audio track (mp4a)
	NoVideo    bool // leaves out the video track (an audio track is added so that the file still has a trak)
	Version1   bool // writes mvhd and tkhd in version 1 (64-bit times and duration), as long videos do
}

func be32(v uint32) []byte { return binary.BigEndian.AppendUint32(nil, v) }
func be16(v uint16) []byte { return binary.BigEndian.AppendUint16(nil, v) }

func cat(parts ...[]byte) []byte {
	var out []byte
	for _, p := range parts {
		out = append(out, p...)
	}
	return out
}

func zeros(n int) []byte { return make([]byte, n) }

// box is size + type + payload.
func box(typ string, payload ...[]byte) []byte {
	body := cat(payload...)
	return cat(be32(uint32(8+len(body))), []byte(typ), body)
}

// MP4 builds ftyp, moov (mvhd and one trak per track) and mdat. Timestamps and ids are fixed, so the output is deterministic.
func MP4(o MP4Options) []byte {
	compat := cat([]byte("isom"), []byte("iso2"), []byte("avc1"), []byte("mp41"))
	if o.Brand == "" {
		o.Brand = "isom"
	} else {
		compat = nil
	}
	if o.Codec == "" {
		o.Codec = "avc1"
	}
	if o.Width == 0 {
		o.Width = 1920
	}
	if o.Height == 0 {
		o.Height = 1080
	}
	if o.DurationMs == 0 {
		o.DurationMs = 1000
	}
	ftyp := box("ftyp", []byte(o.Brand), be32(512), compat)
	times := cat(be32(0), be32(0), be32(1000), be32(uint32(o.DurationMs))) // creation, modification, timescale, duration
	if o.Version1 {
		times = cat(be32(0), be32(0), be32(0), be32(0), be32(1000), be32(0), be32(uint32(o.DurationMs)))
	}
	mvhd := box("mvhd", version(o.Version1), times, be32(0x00010000), be16(0x0100), zeros(10), identityMatrix(), zeros(24), be32(3))
	traks := []byte{}
	if !o.NoVideo {
		traks = append(traks, videoTrak(o)...)
	}
	if o.WithAudio || o.NoVideo {
		traks = append(traks, audioTrak(o)...)
	}
	moov := box("moov", mvhd, traks)
	mdat := box("mdat", zeros(16))
	if o.MoovFirst {
		return cat(ftyp, moov, mdat)
	}
	return cat(ftyp, mdat, moov)
}

func identityMatrix() []byte {
	return cat(be32(0x00010000), be32(0), be32(0), be32(0), be32(0x00010000), be32(0), be32(0), be32(0), be32(0x40000000))
}

// version is the version byte and the three flag bytes of a full box.
func version(v1 bool) []byte {
	if v1 {
		return be32(1<<24 | 3)
	}
	return be32(3)
}

func tkhd(v1 bool, id uint32, width, height int) []byte {
	times := cat(be32(0), be32(0), be32(id), be32(0), be32(1000)) // creation, modification, track id, reserved, duration
	if v1 {
		times = cat(be32(0), be32(0), be32(0), be32(0), be32(id), be32(0), be32(0), be32(1000))
	}
	return box("tkhd", version(v1), times, zeros(8), be16(0), be16(0), be16(0), be16(0), identityMatrix(),
		be32(uint32(width)<<16), be32(uint32(height)<<16))
}

func mdhd() []byte {
	return box("mdhd", be32(0), be32(0), be32(0), be32(1000), be32(1000), be16(0x55c4), be16(0))
}

func hdlr(kind, name string) []byte {
	return box("hdlr", be32(0), be32(0), []byte(kind), zeros(12), []byte(name+"\x00"))
}

func trak(v1 bool, id uint32, width, height int, kind, name, media string, entry []byte) []byte {
	stbl := box("stbl", box("stsd", be32(0), be32(1), entry))
	minf := box("minf", box(media, be32(1), zeros(8)), stbl)
	return box("trak", tkhd(v1, id, width, height), box("mdia", mdhd(), hdlr(kind, name), minf))
}

func videoTrak(o MP4Options) []byte {
	// a visual sample entry: 6 reserved + data_reference_index + 16 reserved + width + height + 50 bytes of resolution, frame count, name, depth
	entry := box(o.Codec, zeros(6), be16(1), zeros(16), be16(uint16(o.Width)), be16(uint16(o.Height)), zeros(50))
	return trak(o.Version1, 1, o.Width, o.Height, "vide", "VideoHandler", "vmhd", entry)
}

func audioTrak(o MP4Options) []byte {
	entry := box("mp4a", zeros(6), be16(1), zeros(8), be16(2), be16(16), zeros(4), be32(48000<<16))
	return trak(o.Version1, 2, 0, 0, "soun", "SoundHandler", "smhd", entry)
}
