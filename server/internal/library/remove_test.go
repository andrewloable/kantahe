package library

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// guideOnly is a song that was imported before the no-music check existed: lyric cues and a pitch guide, no instrument.
func guideOnly() []byte {
	return testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Data: testfix.Text("@TCues")}, {Data: testfix.Text("la")},
		{Delta: 10, Data: testfix.NoteOn(15, 14, 1)}, {Delta: 10, Data: testfix.NoteOn(15, 74, 1)},
	}}}}.Bytes()
}

func TestRemoveFromListKeepsTheFile(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Alpha", "B"))
	e.scan(t)
	e.process(t)
	ctx := context.Background()
	if got := e.ftsNumbers(t, "Alpha"); len(got) != 1 {
		t.Fatalf("searchable before: %v", got)
	}
	if err := e.im.RemoveFromList(ctx, "00001"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(p); err != nil {
		t.Fatalf("the file must stay: %v", err)
	}
	if r := e.row(t, "00001"); !r.Deleted {
		t.Fatal("the entry must be marked deleted")
	}
	if got := e.ftsNumbers(t, "Alpha"); len(got) != 0 {
		t.Fatalf("a removed song is not searchable: %v", got)
	}
	if err := e.im.RemoveFromList(ctx, "00001"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("removing twice: %v", err)
	}
	// the file is still in the watched folder, so the next scan lists it again, under a new number
	e.scan(t)
	e.process(t)
	if got := e.numberOfPath(t, p); got == "00001" {
		t.Fatalf("the number of a removed song is never reused: %s", got)
	}
}

func TestRemoveSongsAllKeepsEveryFile(t *testing.T) {
	e := newEnv(t)
	files := []string{
		e.put(t, "a.kar", karBytes("A", "X")),
		e.put(t, "b.kar", karBytes("B", "Y")),
		e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(300), "[00:01.00]hi", "Title : Tune\nArtist : Band")),
	}
	e.scan(t)
	e.process(t)
	media := e.row(t, e.numberOfPath(t, files[2])).Media
	if media == "" {
		t.Fatal("the .karmp3 should have an extracted MP3 by now")
	}
	n, err := e.im.RemoveSongs(context.Background(), ScopeAll)
	if err != nil || n != 3 {
		t.Fatalf("removed %d, %v; want 3", n, err)
	}
	for _, f := range files {
		if _, err := os.Stat(f); err != nil {
			t.Fatalf("song file %s must stay: %v", f, err)
		}
	}
	if _, err := os.Stat(media); err == nil {
		t.Fatal("the extracted MP3 is a derived file and goes")
	}
	if e.count(t, "deleted = 0") != 0 {
		t.Fatal("no live song may be left")
	}
	if got := e.ftsNumbers(t, "Tune OR A OR B"); len(got) != 0 {
		t.Fatalf("search index must be empty: %v", got)
	}
	if n, err := e.im.RemoveSongs(context.Background(), ScopeAll); err != nil || n != 0 {
		t.Fatalf("an empty library: %d %v", n, err)
	}
}

func TestRemoveSongsNoMusicOnlyTakesSilentMIDI(t *testing.T) {
	e := newEnv(t)
	good := e.put(t, "good.kar", karBytes("Good", "G"))
	silent := e.put(t, "silent.kar", guideOnly())
	e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(300), "[00:01.00]hi", "Title : Tune\nArtist : Band"))
	e.scan(t)
	e.process(t)
	// as in a library imported before the check: the silent song looks fine
	if _, err := e.db.Exec(`UPDATE songs SET failed = 0, failed_reason = '' WHERE path = ?`, silent); err != nil {
		t.Fatal(err)
	}
	n, err := e.im.RemoveSongs(context.Background(), ScopeNoMusic)
	if err != nil || n != 1 {
		t.Fatalf("removed %d, %v; want 1", n, err)
	}
	if e.count(t, "deleted = 0") != 2 {
		t.Fatal("the song with music and the MP3 stay")
	}
	if !e.row(t, e.numberOfPath(t, silent+"#deleted-"+numberOfDeleted(t, e, silent))).Deleted || e.row(t, e.numberOfPath(t, good)).Deleted {
		t.Fatal("the silent song goes, the one with music stays")
	}
	if _, err := os.Stat(silent); err != nil {
		t.Fatalf("the file stays: %v", err)
	}
}

// numberOfDeleted is the number of the removed entry that pointed at path (removal renames the path).
func numberOfDeleted(t *testing.T, e *testEnv, path string) string {
	t.Helper()
	var n string
	if err := e.db.QueryRow(`SELECT number FROM songs WHERE path LIKE ? AND deleted = 1`, path+"#deleted-%").Scan(&n); err != nil {
		t.Fatalf("no removed entry for %s: %v", path, err)
	}
	return n
}

func TestRemoveSongsRejectsAnUnknownScope(t *testing.T) {
	e := newEnv(t)
	if _, err := e.im.RemoveSongs(context.Background(), RemoveScope(99)); err == nil {
		t.Fatal("an unknown scope must be an error")
	}
}
