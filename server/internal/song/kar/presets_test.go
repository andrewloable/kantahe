package kar

import (
	"reflect"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func ev(delta uint32, data []byte) testfix.Event { return testfix.Event{Delta: delta, Data: data} }

func TestPresets(t *testing.T) {
	m := testfix.MIDI{Format: 1, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		ev(0, testfix.CC(0, 0, 0)), ev(0, testfix.Program(0, 24)), ev(0, testfix.NoteOn(0, 60, 90)), // {0,24}
		ev(0, testfix.NoteOn(9, 36, 100)),                                                                  // drums, program 0
		ev(0, testfix.NoteOn(2, 60, 90)), ev(10, testfix.Program(2, 40)), ev(0, testfix.NoteOn(2, 62, 90)), // {0,0} then {0,40}
		ev(0, testfix.Program(5, 70)), // program change without notes
	}}}}
	s, err := Parse(m.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	want := []Preset{{0, 0}, {0, 24}, {0, 40}, {128, 0}}
	if !reflect.DeepEqual(s.Presets, want) {
		t.Fatalf("presets = %v, want %v", s.Presets, want)
	}
}

func TestPresetsBankSelectMSBAndLSB(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		ev(0, testfix.CC(1, 0, 1)), ev(0, testfix.CC(1, 32, 3)), ev(0, testfix.Program(1, 5)), ev(0, testfix.NoteOn(1, 60, 90)),
	}}}}
	s, _ := Parse(m.Bytes())
	if want := []Preset{{1*128 + 3, 5}}; !reflect.DeepEqual(s.Presets, want) {
		t.Fatalf("presets = %v, want %v", s.Presets, want)
	}
}

func TestPresetsDrumsUseCurrentProgram(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		ev(0, testfix.CC(9, 0, 5)), ev(0, testfix.Program(9, 16)), ev(0, testfix.NoteOn(9, 36, 90)),
	}}}}
	s, _ := Parse(m.Bytes())
	if want := []Preset{{128, 16}}; !reflect.DeepEqual(s.Presets, want) {
		t.Fatalf("presets = %v, want %v", s.Presets, want)
	}
}

func TestPresetsAcrossTracksInTimeOrder(t *testing.T) {
	// track 0 has the note at tick 480; track 1 sets the program at tick 0 (it comes later in the file)
	m := testfix.MIDI{Format: 1, Division: 480, Tracks: []testfix.Track{
		{Events: []testfix.Event{ev(480, testfix.NoteOn(3, 60, 90))}},
		{Events: []testfix.Event{ev(0, testfix.Program(3, 12))}},
	}}
	s, _ := Parse(m.Bytes())
	if want := []Preset{{0, 12}}; !reflect.DeepEqual(s.Presets, want) {
		t.Fatalf("presets = %v, want %v", s.Presets, want)
	}
}

func TestPresetsVelocityZeroIgnored(t *testing.T) {
	m := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		ev(0, testfix.Program(0, 9)), ev(0, testfix.NoteOn(0, 60, 0)),
	}}}}
	s, _ := Parse(m.Bytes())
	if len(s.Presets) != 0 {
		t.Fatalf("presets = %v, want none", s.Presets)
	}
}
