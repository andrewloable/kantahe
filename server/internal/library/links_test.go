package library

import (
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

// linkedDirs makes the named directories look like junctions (or fail to be judged) for the duration of a test. Only Windows can say
// "linked" for real; the walk's handling of the answer is the same everywhere.
func linkedDirs(t *testing.T, linked []string, failing ...string) {
	t.Helper()
	old := dirLinked
	t.Cleanup(func() { dirLinked = old })
	dirLinked = func(dir string) (bool, error) {
		for _, f := range failing {
			if dir == f {
				return false, errors.New("test: cannot resolve")
			}
		}
		for _, l := range linked {
			if dir == l {
				return true, nil
			}
		}
		return false, nil
	}
}

func TestScanSkipsAFolderThatIsALinkAndSaysSoOnce(t *testing.T) {
	e := newEnv(t)
	logs := logTo(e.im)
	e.put(t, "own/a.kar", karBytes("Alpha", "A"))
	e.put(t, "jump/b.kar", karBytes("Beta", "B"))         // behind a junction that points outside the folder
	e.put(t, "jump/deeper/c.kar", karBytes("Gamma", "C")) // and below it
	linkedDirs(t, []string{filepath.Join(e.lib, "jump")})

	for i := 0; i < 3; i++ { // every scan skips it, only the first one says so
		e.scan(t)
		e.process(t)
	}
	if n := e.count(t, "deleted = 0"); n != 1 {
		t.Fatalf("%d songs listed, want only the one outside the link", n)
	}
	if got := e.ftsNumbers(t, "Alpha"); len(got) != 1 {
		t.Fatalf("Alpha: %v", got)
	}
	if got := e.ftsNumbers(t, "Beta OR Gamma"); len(got) != 0 {
		t.Fatalf("songs behind a link must not be listed: %v", got)
	}
	if n := strings.Count(logs.String(), "is a link"); n != 1 {
		t.Fatalf("the link was reported %d times, want once:\n%s", n, logs)
	}
}

func TestSongsBelowAFolderThatBecameALinkAreRemovedFromTheList(t *testing.T) {
	e := newEnv(t)
	e.put(t, "own/a.kar", karBytes("Alpha", "A"))
	e.put(t, "jump/b.kar", karBytes("Beta", "B"))
	e.scan(t)
	e.process(t)
	if n := e.count(t, "deleted = 0"); n != 2 {
		t.Fatalf("%d songs before, want 2", n)
	}
	// the folder is replaced by a junction to somewhere else: it must not stay a source of songs
	linkedDirs(t, []string{filepath.Join(e.lib, "jump")})
	res := e.scan(t)
	if res.Removed != 1 || e.count(t, "deleted = 0") != 1 {
		t.Fatalf("scan %+v, %d listed; want the song behind the link removed from the list", res, e.count(t, "deleted = 0"))
	}
}

func TestAFolderThatCannotBeJudgedIsSkippedAndItsSongsAreKept(t *testing.T) {
	e := newEnv(t)
	logs := logTo(e.im)
	e.put(t, "own/a.kar", karBytes("Alpha", "A"))
	e.put(t, "odd/b.kar", karBytes("Beta", "B"))
	e.scan(t)
	e.process(t)
	e.put(t, "odd/new.kar", karBytes("Delta", "D")) // a new file below the folder that cannot be judged
	linkedDirs(t, nil, filepath.Join(e.lib, "odd"))
	res := e.scan(t)
	e.process(t)
	if res.Removed != 0 || e.count(t, "deleted = 0") != 2 {
		t.Fatalf("scan %+v, %d listed; a folder that cannot be judged must not make its songs disappear, and must not be entered (the new file stays unlisted)", res, e.count(t, "deleted = 0"))
	}
	if got := e.ftsNumbers(t, "Delta"); len(got) != 0 {
		t.Fatalf("a folder that cannot be judged was entered: %v", got)
	}
	if !strings.Contains(logs.String(), "cannot tell whether a folder is a link") {
		t.Fatalf("expected a warning:\n%s", logs)
	}
}

func TestTheWatchedFolderItselfIsNeverAskedAboutLinks(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("Alpha", "A"))
	asked := map[string]bool{}
	old := dirLinked
	t.Cleanup(func() { dirLinked = old })
	dirLinked = func(dir string) (bool, error) { asked[dir] = true; return false, nil }
	e.scan(t)
	if asked[e.lib] {
		t.Fatal("the folder the admin chose is the root of the walk, whatever it is")
	}
}
