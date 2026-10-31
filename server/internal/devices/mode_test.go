package devices

import (
	"sync"
	"testing"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

const (
	auto  = kantahev1.MidiMode_MIDI_MODE_AUTO
	full  = kantahev1.MidiMode_MIDI_MODE_FULL
	low   = kantahev1.MidiMode_MIDI_MODE_LOW_POWER
	srv   = kantahev1.MidiMode_MIDI_MODE_SERVER
	web   = kantahev1.DeviceType_DEVICE_TYPE_WEB
	atv   = kantahev1.DeviceType_DEVICE_TYPE_ANDROID_TV
	tizen = kantahev1.DeviceType_DEVICE_TYPE_TIZEN
	webos = kantahev1.DeviceType_DEVICE_TYPE_WEBOS
	andr  = kantahev1.DeviceType_DEVICE_TYPE_ANDROID
)

func TestEffectiveAuto(t *testing.T) {
	cases := []struct {
		typ    kantahev1.DeviceType
		mem    int
		render bool
		want   kantahev1.MidiMode
	}{
		{web, 4096, true, full},
		{web, 3072, true, full},
		{web, 3071, true, low},
		{web, 2048, true, low},
		{web, 2047, true, srv},
		{atv, 1024, true, srv},
		{atv, 1, true, srv},
		{tizen, 0, true, srv},
		{webos, 0, true, srv},
		{atv, 0, true, srv},
		{web, 0, true, full},
		{andr, 0, true, full},
		{atv, 8192, true, full},
		{web, 1024, true, srv},
		{web, -5, true, full}, // a negative report means "unknown"
	}
	for _, c := range cases {
		if got := Effective(auto, c.typ, c.mem, 0, c.render); got != c.want {
			t.Errorf("(AUTO, %v, %d MB, render %v) = %v, want %v", c.typ, c.mem, c.render, got, c.want)
		}
	}
	if got := Effective(kantahev1.MidiMode_MIDI_MODE_UNSPECIFIED, web, 4096, 0, true); got != full {
		t.Errorf("an unset mode behaves like AUTO, got %v", got)
	}
}

func TestStepDown(t *testing.T) {
	cases := []struct {
		steps  int
		render bool
		want   kantahev1.MidiMode
	}{{0, true, full}, {1, true, low}, {2, true, srv}, {3, true, srv}, {5, true, srv}, {2, false, low}, {5, false, low}, {-1, true, full}}
	for _, c := range cases {
		if got := Effective(auto, web, 4096, c.steps, c.render); got != c.want {
			t.Errorf("steps %d render %v = %v, want %v", c.steps, c.render, got, c.want)
		}
	}
	if got := Effective(auto, web, 2048, 1, true); got != srv {
		t.Errorf("low power steps down to server: %v", got)
	}
}

func TestRenderUnavailableFallsBack(t *testing.T) {
	for _, mode := range []kantahev1.MidiMode{auto, srv} {
		if got := Effective(mode, atv, 512, 0, false); got != low {
			t.Errorf("%v with render off = %v, want LOW_POWER", mode, got)
		}
	}
	if got := Effective(srv, web, 8192, 0, false); got != low {
		t.Errorf("%v", got)
	}
}

func TestOverride(t *testing.T) {
	if got := Effective(full, atv, 512, 0, true); got != full {
		t.Errorf("FULL override on a weak TV: %v", got)
	}
	if got := Effective(srv, web, 8192, 0, true); got != srv {
		t.Errorf("SERVER override: %v", got)
	}
	if got := Effective(low, web, 8192, 3, true); got != low {
		t.Errorf("an override ignores step-downs: %v", got)
	}
}

func TestStepDownsCounter(t *testing.T) {
	s := NewStepDowns()
	if s.Count("d1") != 0 {
		t.Fatal("starts at zero")
	}
	s.Add("d1")
	s.Add("d1")
	s.Add("d2")
	if s.Count("d1") != 2 || s.Count("d2") != 1 {
		t.Fatalf("%d %d", s.Count("d1"), s.Count("d2"))
	}
	s.Reset("d1")
	if s.Count("d1") != 0 || s.Count("d2") != 1 {
		t.Fatal("Reset clears only one device")
	}
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); s.Add("d3") }()
	}
	wg.Wait()
	if s.Count("d3") != 50 {
		t.Fatalf("%d", s.Count("d3"))
	}
}

func TestModesUsesTheRenderAvailability(t *testing.T) {
	m := NewModes(nil)
	if m.Effective(auto, atv, 512, "d1") != low {
		t.Fatal("without a renderer a weak TV falls back to low power")
	}
	m = NewModes(fixedRender(true))
	if m.Effective(auto, atv, 512, "d1") != srv {
		t.Fatal("with a renderer it uses the server")
	}
	m.StepDowns.Add("d2")
	if m.Effective(auto, web, 4096, "d2") != low || m.Effective(auto, web, 4096, "d1") != full {
		t.Fatal("step-downs are per device")
	}
}

type fixedRender bool

func (f fixedRender) Available() bool { return bool(f) }
