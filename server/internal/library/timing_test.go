package library

import (
	"context"
	"os"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func (e *testEnv) timing(t *testing.T, number string) int {
	t.Helper()
	var v int
	if err := e.db.QueryRow(`SELECT lyric_timing FROM songs WHERE number = ?`, number).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

func timedKARMP3(base, timingRow, lrc string) []byte {
	nfo := "Title : Tune\nArtist : Band\nInstrumental : " + base + ".mp3\n"
	if timingRow != "" {
		nfo += "Timing by : " + timingRow + "\n"
	}
	return testfix.KARMP3(base, testfix.MP3Frames(200), lrc, nfo)
}

func TestTheMetadataPassStoresTheLyricTiming(t *testing.T) {
	e := newEnv(t)
	e.put(t, "word.karmp3", timedKARMP3("word", "word", "[00:01.00]Sing along"))
	e.put(t, "line.karmp3", timedKARMP3("line", "line", "[00:01.00]<00:01.00>Sing <00:01.50>along"))
	e.put(t, "old.karmp3", timedKARMP3("old", "", "[00:01.00]Sing along")) // made before Maker 1.2.6: read from the lyrics
	e.put(t, "marks.karmp3", timedKARMP3("marks", "", "[00:01.00]<00:01.00>Sing <00:01.50>along"))
	e.put(t, "midi.kar", karBytes("Tune", "Band")) // syllables
	e.scan(t)
	e.process(t)
	want := map[string]int{"word.karmp3": 2, "line.karmp3": 1, "old.karmp3": 1, "marks.karmp3": 2, "midi.kar": 2}
	for name, v := range want {
		if got := e.timing(t, e.numberOfPath(t, e.lib+"/"+name)); got != v {
			t.Errorf("%s: lyric_timing %d, want %d", name, got, v)
		}
	}
}

func TestAChangedFileIsReadAgainForItsTiming(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.karmp3", timedKARMP3("a", "line", "[00:01.00]Sing along"))
	e.scan(t)
	e.process(t)
	n := e.numberOfPath(t, p)
	if e.timing(t, n) != 1 {
		t.Fatalf("lyric_timing %d, want 1", e.timing(t, n))
	}
	e.put(t, "a.karmp3", timedKARMP3("a", "word", "[00:01.00]Sing along again")) // the same place, another content (and size: the scan compares size and time)
	e.scan(t)
	if got := e.timing(t, n); got != 0 {
		t.Fatalf("a changed file keeps its old timing: %d, want 0 until it is read again", got)
	}
	e.process(t)
	if got := e.timing(t, n); got != 2 {
		t.Fatalf("lyric_timing %d, want 2", got)
	}
}

func TestTheBackfillFillsSongsThatWereImportedBeforeTheColumnExisted(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.karmp3", timedKARMP3("a", "word", "[00:01.00]Sing along"))
	gone := e.put(t, "b.karmp3", timedKARMP3("b", "line", "[00:01.00]Sing along"))
	e.scan(t)
	e.process(t)
	a, b := e.numberOfPath(t, e.lib+"/a.karmp3"), e.numberOfPath(t, gone)
	// as after the migration: metadata read, timing not
	if _, err := e.db.Exec(`UPDATE songs SET lyric_timing = 0`); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(gone); err != nil {
		t.Fatal(err)
	}
	interrupted, err := e.im.ProcessLyricTiming(context.Background())
	if err != nil || interrupted {
		t.Fatalf("interrupted %v, err %v", interrupted, err)
	}
	if got := e.timing(t, a); got != 2 {
		t.Errorf("song a: %d, want 2", got)
	}
	if got := e.timing(t, b); got != 9 {
		t.Errorf("song b (its file is gone): %d, want 9 so that it is not tried again", got)
	}
	// nothing is left to read
	if n := e.count(t, "lyric_timing = 0 AND metadata_done = 1 AND failed = 0"); n != 0 {
		t.Fatalf("%d songs are still waiting", n)
	}
	if e.count(t, "deleted = 0 AND failed = 0") != 2 {
		t.Fatal("no song is hidden or failed because of its timing")
	}
}

func TestTheBackfillGivesWayToASongThatWaitsForItsMetadata(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.karmp3", timedKARMP3("a", "word", "[00:01.00]Sing along"))
	e.scan(t)
	e.process(t)
	if _, err := e.db.Exec(`UPDATE songs SET lyric_timing = 0`); err != nil {
		t.Fatal(err)
	}
	e.put(t, "new.kar", karBytes("New", "X"))
	e.scan(t) // a song that has no metadata yet
	interrupted, err := e.im.ProcessLyricTiming(context.Background())
	if err != nil || !interrupted {
		t.Fatalf("interrupted %v, err %v: the metadata of the new song comes first", interrupted, err)
	}
	if got := e.timing(t, "00001"); got != 0 {
		t.Fatalf("the backfill read a song while another waited: %d", got)
	}
}
