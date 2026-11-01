package library

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func karmp3Bytes(title string) []byte {
	return testfix.KARMP3("m", testfix.MP3Frames(300), "[00:01.00]hi", "Title : "+title+"\nArtist : Band")
}

// setOK pretends that the song was judged fine at import: the check has to find out for itself.
func (e *testEnv) setOK(t *testing.T, number string) {
	t.Helper()
	if _, err := e.db.Exec(`UPDATE songs SET failed = 0, failed_reason = '' WHERE number = ?`, number); err != nil {
		t.Fatal(err)
	}
}

func (e *testEnv) check(t *testing.T) (int, []int) {
	t.Helper()
	var seen []int
	n, err := e.im.CheckLibrary(context.Background(), func(checked, total, broken int) { seen = append(seen, checked, total, broken) })
	if err != nil {
		t.Fatal(err)
	}
	return n, seen
}

func TestCheckLibraryFlagsASongWithoutMusicAndLeavesTheOthers(t *testing.T) {
	e := newEnv(t)
	guide := e.put(t, "g.kar", guideOnly())
	good := e.put(t, "a.kar", karBytes("Alpha", "B"))
	mp3 := e.put(t, "m.karmp3", karmp3Bytes("Tune"))
	e.scan(t)
	e.process(t)
	gn := e.numberOfPath(t, guide)
	e.setOK(t, gn) // "imported before the rule existed"
	n, _ := e.check(t)
	if n != 1 {
		t.Fatalf("broken = %d, want 1", n)
	}
	if r := e.row(t, gn); !r.Failed || r.Reason != noMusicReason {
		t.Fatalf("the song without music: failed=%v reason=%q", r.Failed, r.Reason)
	}
	for _, p := range []string{good, mp3} {
		if r := e.row(t, e.numberOfPath(t, p)); r.Failed {
			t.Fatalf("%s must stay fine: %q", p, r.Reason)
		}
	}
	if got := e.ftsNumbers(t, "Alpha"); len(got) != 1 {
		t.Fatalf("a fine song stays searchable: %v", got)
	}
}

func TestCheckLibraryFlagsAMissingFile(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Alpha", "B"))
	e.scan(t)
	e.process(t)
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	if n, _ := e.check(t); n != 1 {
		t.Fatalf("broken = %d, want 1", n)
	}
	if r := e.row(t, "00001"); !r.Failed || r.Reason != "the file is missing" {
		t.Fatalf("failed=%v reason=%q", r.Failed, r.Reason)
	}
	if got := e.ftsNumbers(t, "Alpha"); len(got) != 0 {
		t.Fatalf("a broken song leaves the search: %v", got)
	}
}

func TestCheckLibraryFlagsUnparsableBytesWithAReason(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "x.kar", []byte("this is not a midi file at all"))
	e.scan(t)
	e.process(t)
	n := e.numberOfPath(t, p)
	e.setOK(t, n)
	if got, _ := e.check(t); got != 1 {
		t.Fatalf("broken = %d, want 1", got)
	}
	if r := e.row(t, n); !r.Failed || r.Reason == "" {
		t.Fatalf("an unparsable file needs a reason: failed=%v %q", r.Failed, r.Reason)
	}
}

func TestCheckLibraryClearsTheMarkOfARepairedSong(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karNoMusic())
	e.scan(t)
	e.process(t)
	n := e.numberOfPath(t, p)
	if !e.row(t, n).Failed {
		t.Fatal("a song without music is failed at import")
	}
	if err := os.WriteFile(p, karBytes("Alpha", "B"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, _ := e.check(t); got != 0 {
		t.Fatalf("broken = %d after the repair, want 0", got)
	}
	if r := e.row(t, n); r.Failed || r.Reason != "" {
		t.Fatalf("the mark must be cleared: failed=%v %q", r.Failed, r.Reason)
	}
	// the check clears the mark and refreshes the search entry; the title is the one stored (a rescan reads a changed file again)
	if got := e.ftsNumbers(t, "Quiet"); len(got) != 1 {
		t.Fatalf("a repaired song is searchable again: %v", got)
	}
}

func TestCheckLibraryExtractsAMissingMP3AgainAndFlagsACorruptKARMP3(t *testing.T) {
	e := newEnv(t)
	good := e.put(t, "m.karmp3", karmp3Bytes("Tune"))
	bad := e.put(t, "c.karmp3", []byte("not a zip"))
	e.scan(t)
	e.process(t)
	gn, bn := e.numberOfPath(t, good), e.numberOfPath(t, bad)
	media := e.row(t, gn).Media
	if media == "" {
		t.Fatal("the .karmp3 needs an extracted MP3")
	}
	if err := os.Remove(media); err != nil {
		t.Fatal(err)
	}
	e.setOK(t, bn)
	if n, _ := e.check(t); n != 1 {
		t.Fatalf("broken = %d, want 1 (the corrupt file)", n)
	}
	if r := e.row(t, gn); r.Failed {
		t.Fatalf("a missing extracted MP3 is extracted again, not flagged: %q", r.Reason)
	}
	if st, err := os.Stat(e.row(t, gn).Media); err != nil || st.Size() == 0 {
		t.Fatalf("the MP3 must be back: %v", err)
	}
	if r := e.row(t, bn); !r.Failed {
		t.Fatal("a corrupt .karmp3 must be flagged")
	}
}

func TestCheckLibraryProgressNeverGoesBackAndEndsAtTheTotal(t *testing.T) {
	e := newEnv(t)
	for i := 0; i < 3; i++ {
		e.put(t, filepath.Join("s", string(rune('a'+i))+".kar"), karBytes("S"+string(rune('A'+i)), "B"))
	}
	e.scan(t)
	e.process(t)
	_, seen := e.check(t)
	if len(seen) == 0 {
		t.Fatal("progress is called at least at the end")
	}
	last := -1
	for i := 0; i < len(seen); i += 3 {
		if seen[i] < last {
			t.Fatalf("checked went back: %v", seen)
		}
		last = seen[i]
	}
	if n := len(seen); seen[n-3] != 3 || seen[n-2] != 3 {
		t.Fatalf("the last call must have checked == total == 3: %v", seen)
	}
}

func TestCheckLibraryStopsWhenTheContextEndsAndFlagsNothingMore(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Alpha", "B"))
	e.scan(t)
	e.process(t)
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := e.im.CheckLibrary(ctx, nil); err == nil {
		t.Fatal("a cancelled check reports it")
	}
	if e.row(t, "00001").Failed {
		t.Fatal("a cancelled check flags nothing")
	}
}

// brokenFive makes five songs whose files are gone and one that is fine, and checks the library.
func brokenFive(t *testing.T) (*testEnv, []string) {
	t.Helper()
	e := newEnv(t)
	var paths []string
	for _, n := range []string{"a", "b", "c", "d", "e", "f"} {
		paths = append(paths, e.put(t, n+".kar", karBytes("Song "+n, "X")))
	}
	e.scan(t)
	e.process(t)
	for _, p := range paths[:5] {
		if err := os.Remove(p); err != nil {
			t.Fatal(err)
		}
	}
	if n, _ := e.check(t); n != 5 {
		t.Fatalf("broken = %d, want 5", n)
	}
	return e, paths
}

func TestListBrokenPagesWithTotalAndReasons(t *testing.T) {
	e, _ := brokenFive(t)
	ctx := context.Background()
	var all []string
	for off := 0; ; off += 2 {
		page, total, err := ListBroken(ctx, e.db, off, 2)
		if err != nil {
			t.Fatal(err)
		}
		if total != 5 {
			t.Fatalf("total = %d, want 5", total)
		}
		for _, b := range page {
			if b.Reason != "the file is missing" || b.Title == "" || !b.Failed {
				t.Fatalf("a broken song needs title and reason: %+v", b)
			}
			all = append(all, b.Number)
		}
		if len(page) < 2 {
			break
		}
	}
	if len(all) != 5 || all[0] >= all[4] {
		t.Fatalf("five songs in number order: %v", all)
	}
	if got := e.ftsNumbers(t, "Song"); len(got) != 1 {
		t.Fatalf("only the fine song is searchable: %v", got)
	}
}

func TestRemoveBrokenKeepsFilesUnlessAskedAndNeverTouchesAnOutsideFile(t *testing.T) {
	e := newEnv(t)
	// five songs that stay broken because their content has no music; their files exist
	var paths []string
	for _, n := range []string{"a", "b", "c"} {
		p := e.put(t, n+".kar", karBytes("Song "+n, "X"))
		paths = append(paths, p)
	}
	fine := e.put(t, "z.kar", karBytes("Fine", "X"))
	e.scan(t)
	e.process(t)
	for _, p := range paths {
		if err := os.WriteFile(p, karNoMusic(), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if n, _ := e.check(t); n != 3 {
		t.Fatalf("broken = %d, want 3", n)
	}
	res, err := e.im.RemoveSongsFiles(context.Background(), ScopeBroken, false)
	if err != nil || res.Removed != 3 || res.FilesDeleted != 0 {
		t.Fatalf("remove without files: %+v %v", res, err)
	}
	for _, p := range append(append([]string{}, paths...), fine) {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("the file stays without deleteFiles: %v", err)
		}
	}
	if e.count(t, "deleted = 0") != 1 {
		t.Fatal("only the fine song is left on the list")
	}

	// again, with the files; one row points outside the managed folders
	e2 := newEnv(t)
	var broken []string
	for _, n := range []string{"a", "b", "c"} {
		broken = append(broken, e2.put(t, n+".kar", karBytes("Song "+n, "X")))
	}
	keep := e2.put(t, "k.kar", karBytes("Keep", "X"))
	e2.scan(t)
	e2.process(t)
	outside := filepath.Join(t.TempDir(), "outside.kar")
	if err := os.WriteFile(outside, karNoMusic(), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, p := range broken {
		if err := os.WriteFile(p, karNoMusic(), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if n, _ := e2.check(t); n != 3 {
		t.Fatalf("broken = %d, want 3", n)
	}
	if _, err := e2.db.Exec(`UPDATE songs SET path = ? WHERE path = ?`, outside, broken[2]); err != nil {
		t.Fatal(err)
	}
	res, err = e2.im.RemoveSongsFiles(context.Background(), ScopeBroken, true)
	if err != nil || res.Removed != 3 || res.FilesDeleted != 2 || res.FilesFailed != 1 {
		t.Fatalf("remove with files: %+v %v", res, err)
	}
	for _, p := range broken[:2] {
		if _, err := os.Stat(p); err == nil {
			t.Fatalf("%s must be deleted", p)
		}
	}
	for _, p := range []string{outside, keep} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s must be untouched: %v", p, err)
		}
	}
}

func TestRemoveSongsFilesRefusesToDeleteFilesForTheOtherScopes(t *testing.T) {
	e := newEnv(t)
	for _, s := range []RemoveScope{ScopeAll, ScopeNoMusic} {
		if _, err := e.im.RemoveSongsFiles(context.Background(), s, true); err == nil {
			t.Fatalf("scope %d must refuse deleteFiles", s)
		}
	}
}

func TestCheckLibraryIsIdempotent(t *testing.T) {
	e, _ := brokenFive(t)
	first, _ := e.check(t)
	second, _ := e.check(t)
	if first != 5 || second != 5 {
		t.Fatalf("running the check again gives the same count: %d then %d", first, second)
	}
	if e.count(t, "failed <> 0 AND deleted = 0") != 5 {
		t.Fatal("the marks stay")
	}
}

func TestRemoveBrokenWithFilesIsNotAnErrorWhenTheFileIsAlreadyGone(t *testing.T) {
	e := newEnv(t)
	gone := e.put(t, "gone.kar", karBytes("Gone", "X"))
	keep := e.put(t, "keep.kar", karBytes("Keep", "X"))
	e.scan(t)
	e.process(t)
	if err := os.Remove(gone); err != nil {
		t.Fatal(err)
	}
	if n, _ := e.check(t); n != 1 {
		t.Fatalf("broken = %d, want 1", n)
	}
	res, err := e.im.RemoveSongsFiles(context.Background(), ScopeBroken, true)
	if err != nil || res.Removed != 1 || res.FilesFailed != 0 {
		t.Fatalf("a file that is already gone is not a failure: %+v %v", res, err)
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatalf("a song that is fine keeps its file: %v", err)
	}
}
