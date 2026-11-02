package library

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// four songs, the number of each by its path
func selectedEnv(t *testing.T) (*testEnv, []string, []string) {
	t.Helper()
	e := newEnv(t)
	var paths, numbers []string
	for _, n := range []string{"a", "b", "c", "d"} {
		paths = append(paths, e.put(t, n+".kar", karBytes("Song "+n, "X")))
	}
	e.scan(t)
	e.process(t)
	for _, p := range paths {
		numbers = append(numbers, e.numberOfPath(t, p))
	}
	return e, paths, numbers
}

func TestRemoveSelectedTakesExactlyTheChosenSongsOffTheList(t *testing.T) {
	e, paths, numbers := selectedEnv(t)
	res, err := e.im.RemoveSelected(context.Background(), []string{numbers[0], numbers[2]}, false)
	if err != nil || res.Removed != 2 || res.FilesDeleted != 0 || res.FilesFailed != 0 {
		t.Fatalf("%+v %v", res, err)
	}
	for i, n := range numbers {
		gone := i == 0 || i == 2
		if e.row(t, n).Deleted != gone {
			t.Errorf("song %s: deleted = %v, want %v", n, !gone, gone)
		}
	}
	// no search entry for a removed song, and no file touched without deleteFiles
	if got := e.ftsNumbers(t, "Song"); len(got) != 2 {
		t.Errorf("searchable songs: %v", got)
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("the file stays without deleteFiles: %v", err)
		}
	}
}

func TestRemoveSelectedSkipsUnknownAndAlreadyRemovedNumbers(t *testing.T) {
	e, _, numbers := selectedEnv(t)
	ctx := context.Background()
	if err := e.im.RemoveFromList(ctx, numbers[1]); err != nil {
		t.Fatal(err)
	}
	res, err := e.im.RemoveSelected(ctx, []string{numbers[1], "99999", numbers[3], numbers[3]}, false)
	if err != nil || res.Removed != 1 {
		t.Fatalf("%+v %v; want 1 removed (the unknown, the removed and the repeated number do not count)", res, err)
	}
	if !e.row(t, numbers[3]).Deleted || e.row(t, numbers[0]).Deleted {
		t.Fatal("wrong songs removed")
	}
	if res, err := e.im.RemoveSelected(ctx, nil, false); err != nil || res.Removed != 0 {
		t.Fatalf("an empty list: %+v %v", res, err)
	}
}

func TestRemoveSelectedDeletesFilesOnlyInsideTheManagedFolders(t *testing.T) {
	e, paths, numbers := selectedEnv(t)
	outside := filepath.Join(t.TempDir(), "outside.kar")
	if err := os.WriteFile(outside, karBytes("Out", "X"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Exec(`UPDATE songs SET path = ? WHERE number = ?`, outside, numbers[2]); err != nil {
		t.Fatal(err)
	}
	res, err := e.im.RemoveSelected(context.Background(), []string{numbers[0], numbers[2]}, true)
	if err != nil || res.Removed != 2 || res.FilesDeleted != 1 || res.FilesFailed != 1 {
		t.Fatalf("%+v %v; want 2 removed, 1 file deleted, 1 failed", res, err)
	}
	if _, err := os.Stat(paths[0]); err == nil {
		t.Error("a file inside the library folder must be deleted")
	}
	if _, err := os.Stat(outside); err != nil {
		t.Errorf("a file outside the managed folders must stay: %v", err)
	}
	for _, p := range []string{paths[1], paths[3]} {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("a song that was not chosen keeps its file: %v", err)
		}
	}
	// both songs are off the list all the same
	if !e.row(t, numbers[2]).Deleted {
		t.Error("the song whose file could not be deleted is still off the list")
	}
}

func TestRemoveSelectedRemovesTheDerivedFilesOfEachSong(t *testing.T) {
	e := newEnv(t)
	e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(200), "[00:01.00]hi", "Title : Tune\nArtist : Band"))
	e.put(t, "n.karmp3", testfix.KARMP3("n", testfix.MP3Frames(250), "[00:01.00]hi", "Title : Other\nArtist : Band"))
	e.scan(t)
	e.process(t)
	media1, media2 := e.row(t, "00001").Media, e.row(t, "00002").Media
	if media1 == "" || media2 == "" {
		t.Fatal("no extracted MP3")
	}
	if _, err := e.im.RemoveSelected(context.Background(), []string{"00001"}, false); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(media1); err == nil {
		t.Error("the extracted MP3 of a removed song must go")
	}
	if _, err := os.Stat(media2); err != nil {
		t.Errorf("the extracted MP3 of the other song stays: %v", err)
	}
}
