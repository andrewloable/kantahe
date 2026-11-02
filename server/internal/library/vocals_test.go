package library

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrewloable/kantahe/server/internal/song/karmp3"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// a Kantahe Maker 1.1 file: the .nfo names the instrumental and, when vocals is not empty, the vocals
func vocalsNFO(base string, vocals bool) string {
	s := "Title : Tune\nArtist : Band\nInstrumental : " + base + ".mp3\n"
	if vocals {
		s += "Vocals : " + base + ".vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\n"
	}
	return s
}

func vocalsFile(base string, inst, voc []byte) []byte {
	return testfix.KARMP3WithVocals(base, inst, voc, "[00:01.00]hi", vocalsNFO(base, len(voc) > 0))
}

func (e *testEnv) hasVocals(t *testing.T, number string) bool {
	t.Helper()
	var v bool
	if err := e.db.QueryRow(`SELECT has_vocals <> 0 FROM songs WHERE number = ?`, number).Scan(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

// vocalsSong imports a file with vocals and returns its number, the extracted instrumental and the extracted vocals.
func vocalsSong(t *testing.T, e *testEnv, name string, inst, voc []byte) (number, media, vocals string) {
	t.Helper()
	p := e.put(t, name+".karmp3", vocalsFile(name, inst, voc))
	e.scan(t)
	e.process(t)
	number = e.numberOfPath(t, p)
	media = e.row(t, number).Media
	return number, media, vocalsPathOf(media)
}

func TestKARMP3WithVocalsExtractsBoth(t *testing.T) {
	e := newEnv(t)
	inst, voc := testfix.MP3Frames(300), testfix.MP3Frames(200)
	n, media, vocals := vocalsSong(t, e, "m", inst, voc)
	r := e.row(t, n)
	if r.Failed || r.Media == "" || !e.hasVocals(t, n) {
		t.Fatalf("%+v hasVocals %v", r, e.hasVocals(t, n))
	}
	if got, err := os.ReadFile(media); err != nil || !bytes.Equal(got, inst) {
		t.Fatalf("instrumental differs: %v", err)
	}
	if got, err := os.ReadFile(vocals); err != nil || !bytes.Equal(got, voc) {
		t.Fatalf("vocals differ: %v", err)
	}
	if !strings.HasSuffix(vocals, ".vocals.mp3") || filepath.Dir(vocals) != filepath.Dir(media) {
		t.Errorf("vocals path %s", vocals)
	}
	if got := mediaFiles(t, e); len(got) != 2 {
		t.Fatalf("media dir holds %v: want the instrumental, the vocals and no temp file", got)
	}
	info, err := GetSong(context.Background(), e.db, n)
	if err != nil || !info.HasVocals {
		t.Fatalf("GetSong: %+v, %v", info, err)
	}
}

func TestKARMP3WithoutVocalsHasNone(t *testing.T) {
	e := newEnv(t)
	a := e.put(t, "a.karmp3", testfix.KARMP3("a", testfix.MP3Frames(300), "[00:01.00]hi", vocalsNFO("a", false)))        // 1.1, no Vocals row
	b := e.put(t, "b.karmp3", testfix.KARMP3("b", testfix.MP3Frames(310), "[00:01.00]hi", "Title : Old\nArtist : Band")) // 1.0.x
	e.scan(t)
	e.process(t)
	for _, p := range []string{a, b} {
		n := e.numberOfPath(t, p)
		if r := e.row(t, n); r.Failed || r.Media == "" || e.hasVocals(t, n) {
			t.Fatalf("%s: %+v hasVocals %v", p, r, e.hasVocals(t, n))
		}
		info, err := GetSong(context.Background(), e.db, n)
		if err != nil || info.HasVocals {
			t.Fatalf("GetSong: %+v, %v", info, err)
		}
	}
	for _, f := range mediaFiles(t, e) {
		if strings.HasSuffix(f, ".vocals.mp3") {
			t.Errorf("unexpected vocals file %s", f)
		}
	}
	if got := mediaFiles(t, e); len(got) != 2 {
		t.Fatalf("media dir holds %v", got)
	}
}

func TestKARMP3VocalsLeftOutIsLoggedOnce(t *testing.T) {
	e := newEnv(t)
	logs := logTo(e.im)
	// the Vocals row names an entry that is not in the archive
	e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(300), "[00:01.00]hi", vocalsNFO("m", true)))
	e.scan(t)
	e.process(t)
	r := e.row(t, "00001")
	if r.Failed || r.Media == "" || e.hasVocals(t, "00001") {
		t.Fatalf("%+v hasVocals %v: the song plays without vocals", r, e.hasVocals(t, "00001"))
	}
	if n := strings.Count(logs.String(), "vocals track left out"); n != 1 {
		t.Fatalf("logged %d times, want once:\n%s", n, logs)
	}
	e.scan(t) // the file is unchanged: nothing is read again
	e.process(t)
	if n := strings.Count(logs.String(), "vocals track left out"); n != 1 {
		t.Fatalf("logged %d times after a second scan, want once", n)
	}
}

func TestRemovedKARMP3DeletesItsVocalsToo(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "m.karmp3", vocalsFile("m", testfix.MP3Frames(40), testfix.MP3Frames(30)))
	e.scan(t)
	e.process(t)
	if len(mediaFiles(t, e)) != 2 {
		t.Fatalf("media not extracted: %v", mediaFiles(t, e))
	}
	_ = os.Remove(p)
	e.scan(t)
	if got := mediaFiles(t, e); len(got) != 0 {
		t.Fatalf("extracted media of a removed song left behind: %v", got)
	}
}

func TestChangedKARMP3ReplacesItsVocals(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "m.karmp3", vocalsFile("m", testfix.MP3Frames(40), testfix.MP3Frames(30)))
	e.scan(t)
	e.process(t)
	first := mediaFiles(t, e)
	newMP3 := testfix.MP3Frames(60)
	_ = os.WriteFile(p, testfix.KARMP3("m", newMP3, "", ""), 0o644) // the new content has no vocals
	later := time.Now().Add(time.Hour)
	_ = os.Chtimes(p, later, later)
	if res := e.scan(t); res.Updated != 1 {
		t.Fatalf("%+v", res)
	}
	e.process(t)
	second := mediaFiles(t, e)
	if len(second) != 1 || strings.HasSuffix(second[0], ".vocals.mp3") {
		t.Fatalf("media before %v after %v: the old vocals must be gone", first, second)
	}
	if e.hasVocals(t, "00001") {
		t.Fatal("has_vocals must be 0 after the change")
	}
}

func ageFile(t *testing.T, p string) {
	t.Helper()
	old := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(p, old, old); err != nil {
		t.Fatal(err)
	}
}

func TestSweepKeepsTheVocalsOfALiveSong(t *testing.T) {
	e := newEnv(t)
	_, media, vocals := vocalsSong(t, e, "m", testfix.MP3Frames(40), testfix.MP3Frames(30))
	ageFile(t, media)
	ageFile(t, vocals)
	if n, err := e.im.SweepOrphans(context.Background()); err != nil || n != 0 {
		t.Fatalf("removed %d, %v", n, err)
	}
	for _, p := range []string{media, vocals} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("the sweep removed %s: %v", p, err)
		}
	}
}

func TestSweepRemovesTheVocalsOfAGoneSong(t *testing.T) {
	e := newEnv(t)
	// a vocals file that no song names
	stray := filepath.Join(e.data, "media", strings.Repeat("a", 64)+".vocals.mp3")
	if err := os.MkdirAll(filepath.Dir(stray), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(stray, testfix.MP3Frames(5), 0o640); err != nil {
		t.Fatal(err)
	}
	// and the vocals file next to the instrumental of a live song that has none (has_vocals 0)
	_, media := karmp3Song(t, e, "plain.karmp3")
	sibling := vocalsPathOf(media)
	if err := os.WriteFile(sibling, testfix.MP3Frames(5), 0o640); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{stray, sibling, media} {
		ageFile(t, p)
	}
	n, err := e.im.SweepOrphans(context.Background())
	if err != nil || n != 2 {
		t.Fatalf("removed %d, %v; want the two vocals files", n, err)
	}
	for _, p := range []string{stray, sibling} {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Fatalf("%s should be gone: %v", p, err)
		}
	}
	if _, err := os.Stat(media); err != nil {
		t.Fatalf("the instrumental must stay: %v", err)
	}
}

func TestCheckLibraryExtractsMissingVocalsAgain(t *testing.T) {
	e := newEnv(t)
	voc := testfix.MP3Frames(30)
	n, _, vocals := vocalsSong(t, e, "m", testfix.MP3Frames(40), voc)
	if err := os.Remove(vocals); err != nil {
		t.Fatal(err)
	}
	if broken, _ := e.check(t); broken != 0 {
		t.Fatalf("broken = %d, want 0", broken)
	}
	if got, err := os.ReadFile(vocals); err != nil || !bytes.Equal(got, voc) {
		t.Fatalf("the vocals must be back: %v", err)
	}
	if e.row(t, n).Failed || !e.hasVocals(t, n) {
		t.Fatalf("failed %v hasVocals %v", e.row(t, n).Failed, e.hasVocals(t, n))
	}
}

func TestCheckLibraryBringsBackASongRefusedForTwoMP3s(t *testing.T) {
	e := newEnv(t)
	n, media, vocals := vocalsSong(t, e, "m", testfix.MP3Frames(40), testfix.MP3Frames(30))
	// what the version before vocals did to the file: failed with this reason, nothing extracted
	_ = os.Remove(media)
	_ = os.Remove(vocals)
	if _, err := e.db.Exec(`UPDATE songs SET failed = 1, failed_reason = ?, media_path = '', has_vocals = 0 WHERE number = ?`, karmp3.ErrMP3Count.Error(), n); err != nil {
		t.Fatal(err)
	}
	if broken, _ := e.check(t); broken != 0 {
		t.Fatalf("broken = %d, want 0", broken)
	}
	r := e.row(t, n)
	if r.Failed || r.Media == "" || !e.hasVocals(t, n) {
		t.Fatalf("%+v hasVocals %v", r, e.hasVocals(t, n))
	}
	if _, err := os.Stat(vocalsPathOf(r.Media)); err != nil {
		t.Fatal(err)
	}
}
