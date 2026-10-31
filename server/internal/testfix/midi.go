// Package testfix builds synthetic song files (MIDI/KAR, KARMP3, MP3 frames and
// SoundFont 2) in memory for tests. No real songs are ever committed.
package testfix

import (
	"bytes"
	"encoding/binary"
	"sort"
)

// MIDI describes a Standard MIDI File.
type MIDI struct {
	Format   int // 0 or 1
	Division uint16
	Tracks   []Track
}

// Track is one MTrk chunk; the End of Track event is added by Bytes.
type Track struct {
	Events []Event
}

// Event is a delta time in ticks followed by the raw event bytes.
type Event struct {
	Delta uint32
	Data  []byte
}

// vlq encodes a MIDI variable-length quantity (big-endian 7-bit groups).
func vlq(v uint32) []byte {
	out := []byte{byte(v & 0x7F)}
	for v >>= 7; v > 0; v >>= 7 {
		out = append([]byte{byte(v&0x7F) | 0x80}, out...)
	}
	return out
}

func meta(kind byte, data []byte) []byte {
	out := append([]byte{0xFF, kind}, vlq(uint32(len(data)))...)
	return append(out, data...)
}

// Tempo is a set-tempo meta event (microseconds per quarter note).
func Tempo(usPerQuarter uint32) []byte {
	return []byte{0xFF, 0x51, 0x03, byte(usPerQuarter >> 16), byte(usPerQuarter >> 8), byte(usPerQuarter)}
}

// Text is a text meta event (FF 01).
func Text(s string) []byte { return meta(0x01, []byte(s)) }

// Lyric is a lyric meta event (FF 05).
func Lyric(s string) []byte { return meta(0x05, []byte(s)) }

// TrackName is a track name meta event (FF 03).
func TrackName(s string) []byte { return meta(0x03, []byte(s)) }

// NoteOn is a note-on channel message.
func NoteOn(ch, key, vel byte) []byte { return []byte{0x90 | ch&0x0F, key, vel} }

// NoteOff is a note-off channel message.
func NoteOff(ch, key byte) []byte { return []byte{0x80 | ch&0x0F, key, 0} }

// Program is a program change.
func Program(ch, prog byte) []byte { return []byte{0xC0 | ch&0x0F, prog} }

// CC is a control change.
func CC(ch, ctrl, val byte) []byte { return []byte{0xB0 | ch&0x0F, ctrl, val} }

// Bytes serialises the file. Every track gets an End of Track event.
func (m MIDI) Bytes() []byte {
	var out bytes.Buffer
	out.WriteString("MThd")
	_ = binary.Write(&out, binary.BigEndian, uint32(6))
	_ = binary.Write(&out, binary.BigEndian, uint16(m.Format))
	_ = binary.Write(&out, binary.BigEndian, uint16(len(m.Tracks)))
	_ = binary.Write(&out, binary.BigEndian, m.Division)
	for _, tr := range m.Tracks {
		var body bytes.Buffer
		for _, ev := range tr.Events {
			body.Write(vlq(ev.Delta))
			body.Write(ev.Data)
		}
		body.Write([]byte{0x00, 0xFF, 0x2F, 0x00})
		out.WriteString("MTrk")
		_ = binary.Write(&out, binary.BigEndian, uint32(body.Len()))
		out.Write(body.Bytes())
	}
	return out.Bytes()
}

// Syllable is one lyric syllable at an absolute tick.
type Syllable struct {
	Tick uint32
	Text string
}

type timed struct {
	tick uint32
	data []byte
}

// track turns absolute-tick events into a delta-timed Track (stable by tick).
func track(evs []timed) Track {
	sort.SliceStable(evs, func(i, j int) bool { return evs[i].tick < evs[j].tick })
	var t Track
	var prev uint32
	for _, e := range evs {
		t.Events = append(t.Events, Event{Delta: e.tick - prev, Data: e.data})
		prev = e.tick
	}
	return t
}

// KAR builds a format-1 Soft Karaoke file (division 480, 120 bpm): a conductor
// track, a Soft Karaoke info track (@KMIDI, @V0100, @T title and artist), a
// Words track with the syllables as text events, and a melody track with a
// note per syllable on channel 0 plus a drum beat on channel 9.
func KAR(title, artist string, syllables []Syllable) []byte {
	syllables = append([]Syllable(nil), syllables...)
	sort.SliceStable(syllables, func(i, j int) bool { return syllables[i].Tick < syllables[j].Tick })
	conductor := Track{Events: []Event{{0, TrackName("Conductor")}, {0, Tempo(500000)}}}
	info := Track{Events: []Event{
		{0, TrackName("Soft Karaoke")},
		{0, Text("@KMIDI KARAOKE FILE")},
		{0, Text("@V0100")},
		{0, Text("@T" + title)},
		{0, Text("@T" + artist)},
	}}
	words := []timed{{0, TrackName("Words")}}
	melody := []timed{{0, TrackName("Melody")}, {0, Program(0, 0)}}
	drums := []timed{{0, Program(9, 0)}}
	var last uint32
	for i, s := range syllables {
		words = append(words, timed{s.Tick, Text(s.Text)})
		key := byte(60 + i%12)
		melody = append(melody, timed{s.Tick, NoteOn(0, key, 90)}, timed{s.Tick + 240, NoteOff(0, key)})
		if end := s.Tick + 480; end > last {
			last = end
		}
	}
	for tick := uint32(0); tick <= last; tick += 480 {
		drums = append(drums, timed{tick, NoteOn(9, 36, 100)}, timed{tick + 120, NoteOff(9, 36)})
	}
	return MIDI{Format: 1, Division: 480, Tracks: []Track{
		conductor, info, track(words), track(melody), track(drums),
	}}.Bytes()
}
