package library

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func hashOf(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }

// stored puts an upload where the upload service puts it (<data>/songs/<sha>.<ext>) and imports it.
func (e *testEnv) stored(t *testing.T, name string, body []byte) (number, path string) {
	t.Helper()
	dir := filepath.Join(e.data, "songs")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatal(err)
	}
	path = filepath.Join(dir, hashOf(body)+filepath.Ext(name))
	if err := os.WriteFile(path, body, 0o640); err != nil {
		t.Fatal(err)
	}
	if _, err := e.im.ImportFile(context.Background(), path, SourceUpload, name); err != nil {
		t.Fatal(err)
	}
	return e.numberOfPath(t, path), path
}

func karmp3Of(title string, frames int) []byte {
	return testfix.KARMP3("x", testfix.MP3Frames(frames), "[00:01.00]hi", "Title : "+title+"\nArtist : Band\nTiming by : line")
}

func (e *testEnv) exists(p string) bool { _, err := os.Stat(p); return err == nil }

func TestReplaceKeepsTheNumberAndEverythingThatHangsOnIt(t *testing.T) {
	e := newEnv(t)
	oldBody := karmp3Of("Old", 200)
	n, oldPath := e.stored(t, "Old.karmp3", oldBody)
	oldMedia := e.row(t, n).Media
	if oldMedia == "" || !e.exists(oldMedia) {
		t.Fatalf("old media %q", oldMedia)
	}
	if _, err := e.db.Exec(`INSERT INTO users(id, email, display_name, password_hash, created_at) VALUES ('u1', 'a@b.c', 'A', 'h', 1)`); err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Exec(`INSERT INTO favourites(user_id, number, created_at) VALUES ('u1', ?, 1)`, n); err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Exec(`INSERT INTO song_edits(number, title, artist) VALUES (?, 'Edited title', NULL)`, n); err != nil {
		t.Fatal(err)
	}

	newBody := karmp3Of("New", 300)
	res, err := e.im.Replace(context.Background(), n, newBody)
	if err != nil || res.Number != n || res.Unchanged {
		t.Fatalf("%+v %v", res, err)
	}
	r := e.row(t, n)
	if r.Failed || !r.MetadataDone || r.Title != "New" {
		t.Fatalf("the new file must be read: %+v", r)
	}
	newPath := filepath.Join(e.data, "songs", hashOf(newBody)+".karmp3")
	if r.Path != newPath || !e.exists(newPath) {
		t.Fatalf("path %q, want %q", r.Path, newPath)
	}
	if e.exists(oldPath) || e.exists(oldMedia) {
		t.Error("the old stored file and its extracted MP3 must be gone")
	}
	if r.Media == "" || !e.exists(r.Media) {
		t.Errorf("the new extracted MP3 is missing: %q", r.Media)
	}
	if e.count(t, "number = ? AND sha256 = ? AND source = 1 AND lyric_timing = 1", n, hashOf(newBody)) != 1 {
		t.Error("sha256, source and lyric timing must describe the new file")
	}
	var fav, edits int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM favourites WHERE number = ?`, n).Scan(&fav)
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM song_edits WHERE number = ?`, n).Scan(&edits)
	if fav != 1 || edits != 1 {
		t.Errorf("favourites %d, edits %d: they stay", fav, edits)
	}
	if got := e.ftsNumbers(t, "New"); len(got) != 0 && got[0] != n {
		t.Errorf("search index %v", got)
	}
	var shown string
	_ = e.db.QueryRow(`SELECT display_title FROM songs WHERE number = ?`, n).Scan(&shown)
	if shown != "Edited title" {
		t.Errorf("the admin's title edit wins: %q", shown)
	}
}

func TestReplaceOfAWatchedFileOverwritesItInPlace(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.karmp3", karmp3Of("Old", 200))
	e.scan(t)
	e.process(t)
	n := e.numberOfPath(t, p)
	newBody := karmp3Of("New", 300)
	if _, err := e.im.Replace(context.Background(), n, newBody); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(p); !bytes.Equal(got, newBody) {
		t.Fatal("the watched file must hold the new content")
	}
	r := e.row(t, n)
	if r.Path != p || r.Source != int(SourceFolder) || r.Title != "New" || r.Failed {
		t.Fatalf("%+v", r)
	}
	if left, _ := filepath.Glob(filepath.Join(e.lib, ".*")); len(left) != 0 {
		t.Errorf("temporary files left in the watched folder: %v", left)
	}
	if res := e.scan(t); res.Added != 0 || res.Updated != 0 || res.Removed != 0 {
		t.Fatalf("the next scan finds nothing new: %+v (the old file must not come back as another song)", res)
	}
	if e.count(t, "deleted = 0") != 1 {
		t.Fatal("still one song")
	}
}

func TestReplaceWithTheSameBytesChangesNothing(t *testing.T) {
	e := newEnv(t)
	body := karmp3Of("Same", 200)
	n, path := e.stored(t, "a.karmp3", body)
	res, err := e.im.Replace(context.Background(), n, body)
	if err != nil || !res.Unchanged || res.Number != n {
		t.Fatalf("%+v %v", res, err)
	}
	if !e.exists(path) || e.row(t, n).Title != "Same" {
		t.Fatal("nothing changes")
	}
}

func TestReplaceRefusesTheBytesOfAnotherSong(t *testing.T) {
	e := newEnv(t)
	a, aPath := e.stored(t, "a.karmp3", karmp3Of("A", 200))
	otherBody := karmp3Of("B", 250)
	b, _ := e.stored(t, "b.karmp3", otherBody)
	_, err := e.im.Replace(context.Background(), a, otherBody)
	var dup *DuplicateError
	if !errors.As(err, &dup) || dup.Number != b {
		t.Fatalf("err %v, want a *DuplicateError of %s", err, b)
	}
	if r := e.row(t, a); r.Title != "A" || r.Path != aPath || !e.exists(aPath) {
		t.Fatalf("the song is unchanged: %+v", r)
	}
}

func TestReplaceOfAnUnknownNumber(t *testing.T) {
	e := newEnv(t)
	if _, err := e.im.Replace(context.Background(), "99999", karmp3Of("A", 200)); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err %v", err)
	}
	n, _ := e.stored(t, "a.karmp3", karmp3Of("A", 200))
	if err := e.im.DeleteSong(context.Background(), n); err != nil {
		t.Fatal(err)
	}
	if _, err := e.im.Replace(context.Background(), n, karmp3Of("B", 220)); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a deleted song: %v", err)
	}
}

func TestReplaceThatLeavesTheSongBrokenRestoresAnUpload(t *testing.T) {
	e := newEnv(t)
	oldBody := karmp3Of("Old", 200)
	n, oldPath := e.stored(t, "a.karmp3", oldBody)
	e.im.hookAfterReplace = func() { // the new file turns out to be unusable once it is read
		_, _ = e.db.Exec(`UPDATE songs SET failed = 1, failed_reason = 'boom' WHERE number = ?`, n)
	}
	newBody := karmp3Of("New", 300)
	_, err := e.im.Replace(context.Background(), n, newBody)
	e.im.hookAfterReplace = nil
	if err == nil {
		t.Fatal("the replace must fail")
	}
	r := e.row(t, n)
	if r.Failed || r.Title != "Old" || r.Path != oldPath || !e.exists(oldPath) {
		t.Fatalf("the old file must be back: %+v", r)
	}
	if e.exists(filepath.Join(e.data, "songs", hashOf(newBody)+".karmp3")) {
		t.Error("the new stored file must be removed")
	}
}

func TestReplaceOfAWatchedFileInAFolderThatCannotBeWrittenChangesNothing(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs a folder that its owner cannot write")
	}
	e := newEnv(t)
	oldBody := karmp3Of("Old", 200)
	p := e.put(t, "a.karmp3", oldBody)
	e.scan(t)
	e.process(t)
	n := e.numberOfPath(t, p)
	if err := os.Chmod(e.lib, 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(e.lib, 0o755) })
	_, err := e.im.Replace(context.Background(), n, karmp3Of("New", 300))
	if !errors.Is(err, ErrNotWritable) {
		t.Fatalf("err %v, want ErrNotWritable", err)
	}
	if got, _ := os.ReadFile(p); !bytes.Equal(got, oldBody) || e.row(t, n).Title != "Old" || e.row(t, n).Failed {
		t.Fatal("the song and its file are unchanged")
	}
}
