// Package devices decides which MIDI playback mode a device really uses
// (PLAN.md section 4.1) from its setting, type, memory and audio dropouts.
package devices

import (
	"sync"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

// Memory thresholds in MB for the AUTO mode: from 3 GB the full synth, from 2 GB
// low power, below that the server renders the audio. PLAN.md names only 1 GB or
// less for the server; the 1-2 GB range is decided here, conservatively, as SERVER.
const (
	fullFromMB     = 3072
	lowPowerFromMB = 2048
)

// BackgroundMinMemoryMB is the least memory a device must report for AUTO to play the background videos: decoding a video next to
// the synth is too much below it. An estimate, to be tuned by the TV verification of the background videos (docs/PLAN.md 4.2).
const BackgroundMinMemoryMB = 1536

// RenderAvailability says whether the server can render MIDI to audio.
type RenderAvailability interface{ Available() bool }

type never struct{}

func (never) Available() bool { return false }

// levels from the richest to the lightest mode.
var levels = []kantahev1.MidiMode{kantahev1.MidiMode_MIDI_MODE_FULL, kantahev1.MidiMode_MIDI_MODE_LOW_POWER, kantahev1.MidiMode_MIDI_MODE_SERVER}

func isTV(t kantahev1.DeviceType) bool {
	return t == kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV || t == kantahev1.DeviceType_DEVICE_TYPE_TIZEN || t == kantahev1.DeviceType_DEVICE_TYPE_WEBOS
}

// EffectiveBackground says whether a device plays the background videos. ON and OFF are used as they are. AUTO (and an unset mode) is
// off when the device already plays MIDI in a lighter mode (low power or server), off when it reports less than BackgroundMinMemoryMB,
// off on a TV that reports no memory, and on otherwise.
func EffectiveBackground(mode kantahev1.BackgroundMode, effectiveMidi kantahev1.MidiMode, deviceType kantahev1.DeviceType, memoryMB int) bool {
	switch mode {
	case kantahev1.BackgroundMode_BACKGROUND_MODE_ON:
		return true
	case kantahev1.BackgroundMode_BACKGROUND_MODE_OFF:
		return false
	}
	switch {
	case effectiveMidi == kantahev1.MidiMode_MIDI_MODE_LOW_POWER, effectiveMidi == kantahev1.MidiMode_MIDI_MODE_SERVER:
		return false
	case memoryMB > 0 && memoryMB < BackgroundMinMemoryMB:
		return false
	case memoryMB == 0 && isTV(deviceType):
		return false
	}
	return true
}

// Effective is the mode a device plays MIDI songs in. An explicit mode is used as
// it is. AUTO picks by reported memory (unknown memory means SERVER on TVs, FULL
// elsewhere) and steps down one level per reported dropout episode. A SERVER
// result is replaced by LOW_POWER while the server cannot render.
func Effective(mode kantahev1.MidiMode, deviceType kantahev1.DeviceType, memoryMB, stepDowns int, renderAvailable bool) kantahev1.MidiMode {
	result := mode
	if mode == kantahev1.MidiMode_MIDI_MODE_AUTO || mode == kantahev1.MidiMode_MIDI_MODE_UNSPECIFIED {
		idx := 0
		switch {
		case memoryMB >= fullFromMB:
			idx = 0
		case memoryMB >= lowPowerFromMB:
			idx = 1
		case memoryMB > 0:
			idx = 2
		case isTV(deviceType):
			idx = 2
		}
		idx = min(idx+max(stepDowns, 0), len(levels)-1)
		result = levels[idx]
	}
	if result == kantahev1.MidiMode_MIDI_MODE_SERVER && !renderAvailable {
		return kantahev1.MidiMode_MIDI_MODE_LOW_POWER
	}
	return result
}

// StepDowns counts, per device, how many times the player reported audio
// dropouts. It lives in memory only: a restart or a new sign-in starts at zero.
type StepDowns struct {
	mu sync.Mutex
	n  map[string]int
}

// NewStepDowns returns an empty counter.
func NewStepDowns() *StepDowns { return &StepDowns{n: map[string]int{}} }

// Add records one more dropout episode.
func (s *StepDowns) Add(deviceID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.n[deviceID]++
}

// Count returns the episodes recorded for the device.
func (s *StepDowns) Count(deviceID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.n[deviceID]
}

// Reset forgets the device's episodes.
func (s *StepDowns) Reset(deviceID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.n, deviceID)
}

// Modes bundles the step-down counters with the render switch, so that every
// caller computes the effective mode the same way.
type Modes struct {
	StepDowns *StepDowns
	Render    RenderAvailability
}

// NewModes builds Modes; a nil render means the server cannot render.
func NewModes(render RenderAvailability) *Modes {
	if render == nil {
		render = never{}
	}
	return &Modes{StepDowns: NewStepDowns(), Render: render}
}

// Effective is the package function with the counters and render switch filled in.
func (m *Modes) Effective(mode kantahev1.MidiMode, deviceType kantahev1.DeviceType, memoryMB int, deviceID string) kantahev1.MidiMode {
	return Effective(mode, deviceType, memoryMB, m.StepDowns.Count(deviceID), m.Render.Available())
}

// EffectiveBackground is the package function with the device's effective MIDI mode worked out the same way as Effective does.
func (m *Modes) EffectiveBackground(bg kantahev1.BackgroundMode, midi kantahev1.MidiMode, deviceType kantahev1.DeviceType, memoryMB int, deviceID string) bool {
	return EffectiveBackground(bg, m.Effective(midi, deviceType, memoryMB, deviceID), deviceType, memoryMB)
}
