package library

import (
	"bytes"
	"context"
	"database/sql"
	"math"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/assets"
	"github.com/andrewloable/kantahe/server/internal/loudness"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// a real MP3 of the repository (the score fanfare) inside a .karmp3: the loudness pass decodes it
func fanfareKARMP3(t *testing.T) []byte {
	t.Helper()
	b, ok := assets.Fanfare(1)
	if !ok {
		t.Fatal("no fanfare")
	}
	return testfix.KARMP3("m", b, "[00:01.00]hello", "Title : Tune\nArtist : Band")
}

func (e *testEnv) loudnessRow(t *testing.T, number string) (gain sql.NullFloat64, done int) {
	t.Helper()
	if err := e.db.QueryRow(`SELECT gain_db, loudness_done FROM songs WHERE number = ?`, number).Scan(&gain, &done); err != nil {
		t.Fatal(err)
	}
	return gain, done
}

func (e *testEnv) loudnessPass(t *testing.T) bool {
	t.Helper()
	interrupted, err := e.im.ProcessLoudness(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return interrupted
}

func TestLoudnessPassStoresTheGainOfAnMP3Song(t *testing.T) {
	e := newEnv(t)
	e.put(t, "m.karmp3", fanfareKARMP3(t))
	e.scan(t)
	e.process(t)
	if _, done := e.loudnessRow(t, "00001"); done != 0 {
		t.Fatalf("loudness_done = %d before the pass", done)
	}
	if e.loudnessPass(t) {
		t.Fatal("interrupted with nothing else to do")
	}
	gain, done := e.loudnessRow(t, "00001")
	if done != 1 || !gain.Valid {
		t.Fatalf("done = %d, gain = %+v", done, gain)
	}
	b, _ := assets.Fanfare(1)
	want, err := loudness.Measure(bytesReader(b))
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(gain.Float64-loudness.Gain(want.LUFS, want.PeakDB)) > 1e-9 {
		t.Fatalf("stored gain %v, measured %v", gain.Float64, loudness.Gain(want.LUFS, want.PeakDB))
	}
	got, ok, err := GainOf(context.Background(), e.db, "00001")
	if err != nil || !ok || got != gain.Float64 {
		t.Fatalf("GainOf = %v %v %v", got, ok, err)
	}
}

func TestASongThatCannotBeMeasuredIsMarkedDoneWithNoGain(t *testing.T) {
	e := newEnv(t)
	e.put(t, "silent.karmp3", testfix.KARMP3("s", testfix.MP3Frames(300), "", "")) // frames of silence: no loudness
	e.scan(t)
	e.process(t)
	e.loudnessPass(t)
	gain, done := e.loudnessRow(t, "00001")
	if done != 1 || gain.Valid {
		t.Fatalf("done = %d, gain = %+v; want done with no gain", done, gain)
	}
	if _, ok, _ := GainOf(context.Background(), e.db, "00001"); ok {
		t.Fatal("GainOf says it has a gain")
	}
	// and the song is still a normal, playable one
	if r := e.row(t, "00001"); r.Failed {
		t.Fatalf("the song failed: %+v", r)
	}
}

func TestMIDISongsAreNotMeasured(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("Tune", "Band"))
	e.scan(t)
	e.process(t)
	e.loudnessPass(t)
	if _, done := e.loudnessRow(t, "00001"); done != 0 {
		t.Fatalf("a MIDI song was marked measured: %d", done)
	}
}

func TestLoudnessPassLeavesMeasuredSongsAlone(t *testing.T) {
	e := newEnv(t)
	e.put(t, "m.karmp3", fanfareKARMP3(t))
	e.scan(t)
	e.process(t)
	e.loudnessPass(t)
	if _, err := e.db.Exec(`UPDATE songs SET gain_db = 1.25 WHERE number = '00001'`); err != nil {
		t.Fatal(err)
	}
	e.loudnessPass(t)
	if gain, _ := e.loudnessRow(t, "00001"); gain.Float64 != 1.25 {
		t.Fatalf("a measured song was measured again: %v", gain.Float64)
	}
}

func TestNewContentForTheSameNumberClearsTheGain(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "m.karmp3", fanfareKARMP3(t))
	e.scan(t)
	e.process(t)
	e.loudnessPass(t)
	if gain, done := e.loudnessRow(t, "00001"); done != 1 || !gain.Valid {
		t.Fatalf("not measured: %v %v", gain, done)
	}
	// the file is replaced by another song's audio
	e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(200), "[00:01.00]other", "Title : Other\nArtist : Band"))
	_ = p
	e.scan(t)
	gain, done := e.loudnessRow(t, "00001")
	if done != 0 || gain.Valid {
		t.Fatalf("after new content: done = %d, gain = %+v; want both cleared", done, gain)
	}
}

func TestLoudnessPassGivesWayToMetadataWork(t *testing.T) {
	e := newEnv(t)
	e.put(t, "m.karmp3", fanfareKARMP3(t))
	e.scan(t)
	e.process(t) // the first song is ready for its loudness
	e.put(t, "n.karmp3", testfix.KARMP3("n", testfix.MP3Frames(100), "", ""))
	e.scan(t) // a new song waits for its metadata
	if !e.loudnessPass(t) {
		t.Fatal("the pass did not give way to the metadata of a new song")
	}
	if _, done := e.loudnessRow(t, "00001"); done != 0 {
		t.Fatal("the pass measured while metadata was waiting")
	}
	e.process(t)
	if e.loudnessPass(t) {
		t.Fatal("interrupted with nothing waiting")
	}
	if _, done := e.loudnessRow(t, "00001"); done != 1 {
		t.Fatal("not measured once the metadata was done")
	}
}

func bytesReader(b []byte) *bytes.Reader { return bytes.NewReader(b) }
