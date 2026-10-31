// Package kar parses .kar karaoke files: Standard MIDI Files whose lyrics are
// text or lyric meta events. It extracts lyrics with millisecond times, title,
// artist, duration, whether there is any music, and the SoundFont presets used.
package kar

import (
	"encoding/binary"
	"errors"
	"fmt"
)

// Errors returned by the parser. All input problems are reported as errors;
// the parser never panics on malformed files.
var (
	ErrMalformed   = errors.New("kar: malformed MIDI file")
	ErrUnsupported = errors.New("kar: unsupported MIDI file (format 2 or SMPTE time)")
	ErrTooLarge    = errors.New("kar: file too large")
)

const maxFileSize = 10 << 20

// Event is one MIDI event at an absolute tick.
type Event struct {
	Tick     uint64
	Status   byte   // full status byte (channel included); 0xFF for meta, 0xF0/0xF7 for SysEx
	Data     []byte // channel message data bytes, SysEx payload, or meta payload
	MetaType byte   // meta events only
	Text     []byte // the payload of meta events 0x01-0x0F, else nil
}

// SMF is a parsed Standard MIDI File.
type SMF struct {
	Format, Division uint16
	Tracks           [][]Event
}

// ParseSMF reads format 0 and 1 files with tick-based time.
func ParseSMF(b []byte) (*SMF, error) {
	if len(b) > maxFileSize {
		return nil, ErrTooLarge
	}
	if len(b) < 8 || string(b[:4]) != "MThd" {
		return nil, fmt.Errorf("%w: no MThd header", ErrMalformed)
	}
	hlen := binary.BigEndian.Uint32(b[4:])
	if hlen < 6 || uint64(hlen) > uint64(len(b)-8) {
		return nil, fmt.Errorf("%w: bad header length", ErrMalformed)
	}
	smf := &SMF{
		Format:   binary.BigEndian.Uint16(b[8:]),
		Division: binary.BigEndian.Uint16(b[12:]),
	}
	if smf.Format > 1 || smf.Division&0x8000 != 0 {
		return nil, ErrUnsupported
	}
	if smf.Division == 0 {
		return nil, fmt.Errorf("%w: zero division", ErrMalformed)
	}
	off := 8 + int(hlen)
	for len(b)-off >= 8 {
		id := string(b[off : off+4])
		n := binary.BigEndian.Uint32(b[off+4:])
		off += 8
		if uint64(n) > uint64(len(b)-off) {
			return nil, fmt.Errorf("%w: chunk %q runs past the end of the file", ErrMalformed, id)
		}
		if id == "MTrk" {
			events, err := parseTrack(b[off : off+int(n)])
			if err != nil {
				return nil, err
			}
			smf.Tracks = append(smf.Tracks, events)
		}
		off += int(n)
	}
	return smf, nil
}

// vlq reads a variable-length quantity of at most four bytes.
func vlq(b []byte, i int) (v uint32, next int, err error) {
	for k := 0; k < 4; k++ {
		if i >= len(b) {
			return 0, 0, fmt.Errorf("%w: truncated delta or length", ErrMalformed)
		}
		c := b[i]
		i++
		v = v<<7 | uint32(c&0x7F)
		if c&0x80 == 0 {
			return v, i, nil
		}
	}
	return 0, 0, fmt.Errorf("%w: variable-length number longer than 4 bytes", ErrMalformed)
}

func parseTrack(b []byte) ([]Event, error) {
	var events []Event
	var tick uint64
	var running byte
	i := 0
	for i < len(b) {
		delta, next, err := vlq(b, i)
		if err != nil {
			return nil, err
		}
		i = next
		tick += uint64(delta)
		if i >= len(b) {
			return nil, fmt.Errorf("%w: event missing after delta time", ErrMalformed)
		}
		status := b[i]
		if status < 0x80 { // running status: the byte is the first data byte
			if running == 0 {
				return nil, fmt.Errorf("%w: data byte without a status", ErrMalformed)
			}
			status = running
		} else {
			i++
		}
		ev := Event{Tick: tick, Status: status}
		switch {
		case status == 0xFF:
			if i >= len(b) {
				return nil, fmt.Errorf("%w: truncated meta event", ErrMalformed)
			}
			ev.MetaType = b[i]
			n, nx, err := vlq(b, i+1)
			if err != nil {
				return nil, err
			}
			if uint64(n) > uint64(len(b)-nx) {
				return nil, fmt.Errorf("%w: meta event runs past the track", ErrMalformed)
			}
			ev.Data = b[nx : nx+int(n)]
			if ev.MetaType >= 0x01 && ev.MetaType <= 0x0F {
				ev.Text = ev.Data
			}
			i = nx + int(n)
		case status == 0xF0 || status == 0xF7:
			n, nx, err := vlq(b, i)
			if err != nil {
				return nil, err
			}
			if uint64(n) > uint64(len(b)-nx) {
				return nil, fmt.Errorf("%w: SysEx runs past the track", ErrMalformed)
			}
			ev.Data = b[nx : nx+int(n)]
			i = nx + int(n)
		default:
			n := dataLen(status)
			if n > len(b)-i {
				return nil, fmt.Errorf("%w: truncated channel message", ErrMalformed)
			}
			ev.Data = b[i : i+n]
			i += n
			if status < 0xF0 {
				running = status
			}
		}
		events = append(events, ev)
	}
	return events, nil
}

// dataLen is the number of data bytes after a channel or system common status.
func dataLen(status byte) int {
	switch {
	case status >= 0xF8: // real-time
		return 0
	case status == 0xF1 || status == 0xF3:
		return 1
	case status == 0xF2:
		return 2
	case status >= 0xF0: // F4-F6
		return 0
	case status >= 0xC0 && status < 0xE0: // program change, channel pressure
		return 1
	}
	return 2
}
