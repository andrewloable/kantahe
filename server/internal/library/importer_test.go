package library

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/store"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

type testEnv struct {
	im   *Importer
	db   *store.DB
	lib  string
	data string
}

func newEnv(t *testing.T) *testEnv {
	t.Helper()
	data, lib := t.TempDir(), t.TempDir()
	lib, _ = fsutil.Canonical(lib) // the importer stores canonical paths: links resolved (macOS temp dirs are symlinks), real case, no 8.3 names (Windows temp dirs have them)
	db, err := store.Open(context.Background(), data)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	im := NewImporter(db, data, []string{lib}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	return &testEnv{im, db, lib, data}
}

func karBytes(title, artist string) []byte {
	return testfix.KAR(title, artist, []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}})
}

func karNoMusic() []byte {
	return testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Delta: 0, Data: testfix.Text("@TQuiet")}, {Delta: 0, Data: testfix.Text("la")},
	}}}}.Bytes()
}

func (e *testEnv) put(t *testing.T, rel string, body []byte) string {
	t.Helper()
	p := filepath.Join(e.lib, rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, body, 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func (e *testEnv) scan(t *testing.T) ScanResult {
	t.Helper()
	res, err := e.im.Scan(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func (e *testEnv) process(t *testing.T) {
	t.Helper()
	if err := e.im.ProcessPending(context.Background()); err != nil {
		t.Fatal(err)
	}
}

type row struct {
	Number, Path, Title, Artist, Reason, Media, TitleLetter, ArtistLetter, Songbook string
	Format, Source, Duration                                                        int
	Failed, Deleted, MetadataDone                                                   bool
}

func (e *testEnv) row(t *testing.T, number string) row {
	t.Helper()
	var r row
	err := e.db.QueryRow(`SELECT number, path, file_title, file_artist, failed_reason, media_path, title_letter, artist_letter, songbook_number,
		format, source, duration_ms, failed, deleted, metadata_done FROM songs WHERE number = ?`, number).
		Scan(&r.Number, &r.Path, &r.Title, &r.Artist, &r.Reason, &r.Media, &r.TitleLetter, &r.ArtistLetter, &r.Songbook,
			&r.Format, &r.Source, &r.Duration, &r.Failed, &r.Deleted, &r.MetadataDone)
	if err != nil {
		t.Fatalf("row %s: %v", number, err)
	}
	return r
}

func (e *testEnv) numberOfPath(t *testing.T, p string) string {
	t.Helper()
	var n string
	if err := e.db.QueryRow(`SELECT number FROM songs WHERE path = ?`, p).Scan(&n); err != nil {
		t.Fatalf("no row for %s: %v", p, err)
	}
	return n
}

func (e *testEnv) count(t *testing.T, where string, args ...any) int {
	t.Helper()
	var n int
	if err := e.db.QueryRow(`SELECT COUNT(*) FROM songs WHERE `+where, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func (e *testEnv) ftsNumbers(t *testing.T, match string) []string {
	t.Helper()
	rows, err := e.db.Query(`SELECT number FROM songs_fts WHERE songs_fts MATCH ? ORDER BY number`, match)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var n string
		_ = rows.Scan(&n)
		out = append(out, n)
	}
	return out
}

func TestScanAddsAndNumbers(t *testing.T) {
	e := newEnv(t)
	pMidi := e.put(t, "01052 - A - B.kar", karBytes("B", "A"))
	pMP3 := e.put(t, "01052 - A - B.karmp3", testfix.KARMP3("x", testfix.MP3Frames(50), "[00:01.00]hi", "Title : B\nArtist : A"))
	pSong := e.put(t, "Song.kar", karBytes("Song", "Someone"))
	res := e.scan(t)
	if res.Added != 3 || res.Updated != 0 || res.Removed != 0 || res.Failed != 0 {
		t.Fatalf("result = %+v", res)
	}
	if got := e.numberOfPath(t, pMP3); got != "01052" {
		t.Errorf("mp3 number = %s, want 01052 (the MP3 keeps the songbook number)", got)
	}
	if got := e.numberOfPath(t, pMidi); got != "01053" {
		t.Errorf("midi number = %s, want 01053", got)
	}
	if got := e.numberOfPath(t, pSong); got != "01054" {
		t.Errorf("auto number = %s, want 01054", got)
	}
	r := e.row(t, "01053")
	if r.Songbook != "01052" || r.Format != int(FormatMIDI) || r.Source != int(SourceFolder) || r.MetadataDone {
		t.Errorf("midi row: %+v (original songbook number must be kept, metadata still pending)", r)
	}
	if e.row(t, "01052").Format != int(FormatMP3) {
		t.Error("mp3 row has the wrong format")
	}
}

func TestScanIdempotent(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	e.put(t, "b.karmp3", testfix.KARMP3("b", testfix.MP3Frames(20), "", ""))
	e.scan(t)
	e.process(t)
	before := e.count(t, "1=1")
	res := e.scan(t)
	if res != (ScanResult{}) {
		t.Fatalf("second scan = %+v, want all zero", res)
	}
	if e.count(t, "1=1") != before || e.count(t, "metadata_done = 1") != before {
		t.Fatal("rows changed")
	}
}

func TestScanModifiedFile(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("Old", "X"))
	e.scan(t)
	e.process(t)
	num := e.numberOfPath(t, p)
	if e.row(t, num).Title != "Old" {
		t.Fatal("first metadata missing")
	}
	if err := os.WriteFile(p, karBytes("New title", "Y"), 0o644); err != nil {
		t.Fatal(err)
	}
	later := time.Now().Add(time.Hour)
	_ = os.Chtimes(p, later, later)
	res := e.scan(t)
	if res.Updated != 1 || res.Added != 0 {
		t.Fatalf("result = %+v", res)
	}
	r := e.row(t, num)
	if r.MetadataDone || r.Title != "" {
		t.Fatalf("metadata must be reset: %+v", r)
	}
	if got := e.ftsNumbers(t, "old"); len(got) != 0 {
		t.Fatalf("stale FTS entry: %v", got)
	}
	e.process(t)
	if r = e.row(t, num); r.Title != "New title" || r.Artist != "Y" || !r.MetadataDone {
		t.Fatalf("after processing: %+v", r)
	}
	if e.numberOfPath(t, p) != num {
		t.Fatal("the number must not change")
	}
}

func TestScanSameContentNewMtimeIsNotAnUpdate(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	later := time.Now().Add(time.Hour)
	_ = os.Chtimes(p, later, later)
	if res := e.scan(t); res.Updated != 0 || res.Added != 0 {
		t.Fatalf("touching a file is not a change: %+v", res)
	}
}

func TestScanRemovedFile(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "00010 gone.kar", karBytes("Gone", "X"))
	e.scan(t)
	e.process(t)
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	res := e.scan(t)
	if res.Removed != 1 {
		t.Fatalf("result = %+v", res)
	}
	r := e.row(t, "00010")
	if !r.Deleted {
		t.Fatal("row must be marked deleted")
	}
	if got := e.ftsNumbers(t, "gone"); len(got) != 0 {
		t.Fatalf("deleted song still searchable: %v", got)
	}
	// a new file asking for the same songbook number gets a fresh one
	p2 := e.put(t, "00010 again.kar", karBytes("Again", "X"))
	e.scan(t)
	if got := e.numberOfPath(t, p2); got != "00011" {
		t.Fatalf("number %s was reused or skipped, want 00011", got)
	}
	// the same path coming back is a new entry too
	e.put(t, "00010 gone.kar", karBytes("Gone", "X"))
	res = e.scan(t)
	if res.Added != 1 {
		t.Fatalf("recreated file: %+v", res)
	}
	if got := e.numberOfPath(t, filepath.Join(e.lib, "00010 gone.kar")); got != "00012" {
		t.Fatalf("recreated file number = %s, want 00012", got)
	}
}

func TestScanMissingRootDoesNotRemoveSongs(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	moved := e.lib + "-offline"
	if err := os.Rename(e.lib, moved); err != nil {
		t.Fatal(err)
	}
	res, err := e.im.Scan(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if res.Removed != 0 || e.count(t, "deleted = 1") != 0 {
		t.Fatalf("an unmounted library must not delete its songs: %+v", res)
	}
	if err := os.Rename(moved, e.lib); err != nil {
		t.Fatal(err)
	}
	if res := e.scan(t); res != (ScanResult{}) {
		t.Fatalf("after the library is back: %+v", res)
	}
}

func TestScanFindsNestedFilesAndIgnoresOthers(t *testing.T) {
	e := newEnv(t)
	e.put(t, "deep/er/X.KAR", karBytes("X", "A"))
	e.put(t, "deep/Y.KarMp3", testfix.KARMP3("y", testfix.MP3Frames(5), "", ""))
	e.put(t, "readme.txt", []byte("hi"))
	e.put(t, "song.mid", karBytes("M", "A"))
	if res := e.scan(t); res.Added != 2 {
		t.Fatalf("result = %+v", res)
	}
}

func TestDuplicateUpload(t *testing.T) {
	e := newEnv(t)
	body := karBytes("Dup", "X")
	p1 := filepath.Join(e.data, "songs", "one.kar")
	p2 := filepath.Join(e.data, "songs", "two.kar")
	_ = os.MkdirAll(filepath.Dir(p1), 0o750)
	_ = os.WriteFile(p1, body, 0o640)
	_ = os.WriteFile(p2, body, 0o640)
	r1, err := e.im.ImportFile(context.Background(), p1, SourceUpload, "5 - Dup.kar")
	if err != nil || r1.Status != StatusAdded || r1.Number != "00005" {
		t.Fatalf("%+v %v", r1, err)
	}
	r2, err := e.im.ImportFile(context.Background(), p2, SourceUpload, "5 - Dup.kar")
	if err != nil || r2.Status != StatusDuplicate || r2.Number != r1.Number {
		t.Fatalf("%+v %v", r2, err)
	}
	if e.count(t, "1=1") != 1 {
		t.Fatal("a duplicate must not add a row")
	}
}

func TestUploadHasMetadataImmediately(t *testing.T) {
	e := newEnv(t)
	p := filepath.Join(e.data, "songs", "u.kar")
	_ = os.MkdirAll(filepath.Dir(p), 0o750)
	_ = os.WriteFile(p, karBytes("Upl", "Sing"), 0o640)
	res, err := e.im.ImportFile(context.Background(), p, SourceUpload, "Upl.kar")
	if err != nil {
		t.Fatal(err)
	}
	r := e.row(t, res.Number)
	if r.Title != "Upl" || r.Artist != "Sing" || !r.MetadataDone || r.Source != int(SourceUpload) || r.Duration <= 0 {
		t.Fatalf("%+v", r)
	}
}

func TestImportUnreadableFile(t *testing.T) {
	e := newEnv(t)
	if _, err := e.im.ImportFile(context.Background(), filepath.Join(e.data, "nope.kar"), SourceUpload, "nope.kar"); err == nil {
		t.Fatal("want an error for a missing file")
	}
	if _, err := e.im.ImportFile(context.Background(), e.lib, SourceUpload, "dir.kar"); err == nil {
		t.Fatal("want an error for a directory")
	}
	p := filepath.Join(e.data, "x.txt")
	_ = os.WriteFile(p, []byte("x"), 0o600)
	if _, err := e.im.ImportFile(context.Background(), p, SourceUpload, "x.txt"); err == nil {
		t.Fatal("want an error for an unsupported extension")
	}
}

func TestMetadataFromFile(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("Song", "Singer"))
	e.scan(t)
	e.process(t)
	r := e.row(t, "00001")
	if r.Title != "Song" || r.Artist != "Singer" || r.Duration <= 0 || r.Failed || !r.MetadataDone {
		t.Fatalf("%+v", r)
	}
	if got := e.ftsNumbers(t, "singer"); len(got) != 1 || got[0] != "00001" {
		t.Fatalf("FTS on artist: %v", got)
	}
	if got := e.ftsNumbers(t, "song"); len(got) != 1 {
		t.Fatalf("FTS on title: %v", got)
	}
}

func TestKARNoMusicFailed(t *testing.T) {
	e := newEnv(t)
	e.put(t, "q.kar", karNoMusic())
	e.scan(t)
	e.process(t)
	r := e.row(t, "00001")
	if !r.Failed || r.Reason == "" || !r.MetadataDone {
		t.Fatalf("%+v", r)
	}
	if got := e.ftsNumbers(t, "quiet"); len(got) != 0 {
		t.Fatalf("failed songs must not be searchable: %v", got)
	}
}

func TestKARGuideOnlyFailed(t *testing.T) {
	e := newEnv(t)
	e.put(t, "g.kar", testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Data: testfix.Text("@TCues")}, {Data: testfix.Text("la")},
		{Delta: 10, Data: testfix.NoteOn(15, 14, 1)}, {Delta: 10, Data: testfix.NoteOn(15, 74, 1)},
	}}}}.Bytes())
	e.scan(t)
	e.process(t)
	if r := e.row(t, "00001"); !r.Failed || r.Reason != "the file contains no music" {
		t.Fatalf("%+v", r)
	}
}

func TestKARMP3Extracted(t *testing.T) {
	e := newEnv(t)
	mp3 := testfix.MP3Frames(300)
	e.put(t, "m.karmp3", testfix.KARMP3("m", mp3, "[00:01.00]hello", "Title : Tune\nArtist : Band"))
	e.scan(t)
	e.process(t)
	r := e.row(t, "00001")
	if r.Failed || r.Title != "Tune" || r.Artist != "Band" || r.Media == "" || r.Duration < 7000 {
		t.Fatalf("%+v", r)
	}
	got, err := os.ReadFile(r.Media)
	if err != nil || !bytes.Equal(got, mp3) {
		t.Fatalf("extracted file differs: %v", err)
	}
	if !strings.HasPrefix(r.Media, filepath.Join(e.data, "media")) || !strings.HasSuffix(r.Media, ".mp3") {
		t.Errorf("media path = %s", r.Media)
	}
	entries, _ := os.ReadDir(filepath.Join(e.data, "media"))
	if len(entries) != 1 {
		t.Fatalf("media dir holds %d files, want only the MP3 (no temp file left)", len(entries))
	}
	// the file in the watched folder is untouched
	if _, err := os.Stat(filepath.Join(e.lib, "m.karmp3")); err != nil {
		t.Fatal(err)
	}
}

func TestBadKARMP3Failed(t *testing.T) {
	e := newEnv(t)
	e.put(t, "bad.karmp3", bytes.Repeat([]byte{7, 8, 9}, 500))
	e.put(t, "nomp3.karmp3", testfix.KARMP3("x", bytes.Repeat([]byte{1}, 3000), "", ""))
	e.scan(t)
	e.process(t)
	for _, n := range []string{"00001", "00002"} {
		r := e.row(t, n)
		if !r.Failed || r.Reason == "" || r.Media != "" {
			t.Errorf("%s: %+v", n, r)
		}
	}
	entries, _ := os.ReadDir(filepath.Join(e.data, "media"))
	if len(entries) != 0 {
		t.Fatalf("failed songs leave %d files in media", len(entries))
	}
}

func TestBadKARFailed(t *testing.T) {
	e := newEnv(t)
	e.put(t, "bad.kar", []byte("this is not midi"))
	e.scan(t)
	e.process(t)
	if r := e.row(t, "00001"); !r.Failed || r.Reason == "" {
		t.Fatalf("%+v", r)
	}
}

func TestLetters(t *testing.T) {
	cases := map[string]string{"Élan": "E", "123 Go": "#", "zebra": "Z", "": "#", "ñandú": "N", "  ": "#", "Ωmega": "#", "-dash": "#"}
	for in, want := range cases {
		if got := letterOf(in); got != want {
			t.Errorf("letterOf(%q) = %q, want %q", in, got, want)
		}
	}
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("Élan", "123 Go"))
	e.scan(t)
	e.process(t)
	if r := e.row(t, "00001"); r.TitleLetter != "E" || r.ArtistLetter != "#" {
		t.Fatalf("%+v", r)
	}
}

func TestDisplayTitleFallsBackToTheFileName(t *testing.T) {
	cases := map[string]string{
		"01052 - Artist - Title.kar": "Artist - Title",
		"Plain Name.karmp3":          "Plain Name",
		"007.kar":                    "007",
		"12_Song.kar":                "Song",
		".kar":                       "",
	}
	for in, want := range cases {
		if got := titleFromFileName(in); got != want {
			t.Errorf("titleFromFileName(%q) = %q, want %q", in, got, want)
		}
	}
	e := newEnv(t)
	e.put(t, "42 - Fallback Name.kar", testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.NoteOn(0, 60, 90)}}}}}.Bytes())
	e.scan(t)
	e.process(t)
	if got := e.ftsNumbers(t, "fallback"); len(got) != 1 {
		t.Fatalf("a song without a title is searchable by its file name: %v", got)
	}
}

func TestReindexUsesAdminEdits(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("Original", "Band"))
	e.scan(t)
	e.process(t)
	if _, err := e.db.Exec(`INSERT INTO song_edits(number, title, artist) VALUES ('00001', 'Zeta edited', NULL)`); err != nil {
		t.Fatal(err)
	}
	if err := e.im.Reindex(context.Background(), "00001"); err != nil {
		t.Fatal(err)
	}
	if got := e.ftsNumbers(t, "original"); len(got) != 0 {
		t.Fatalf("old title still indexed: %v", got)
	}
	if got := e.ftsNumbers(t, "zeta"); len(got) != 1 {
		t.Fatalf("edited title not indexed: %v", got)
	}
	if got := e.ftsNumbers(t, "band"); len(got) != 1 {
		t.Fatalf("a NULL edit keeps the file's artist: %v", got)
	}
	if r := e.row(t, "00001"); r.TitleLetter != "Z" || r.ArtistLetter != "B" {
		t.Fatalf("letters not refreshed: %+v", r)
	}
	if err := e.im.Reindex(context.Background(), "99999"); err == nil {
		t.Fatal("unknown number should be an error")
	}
	// an edit survives a rescan that changes the file
	p := filepath.Join(e.lib, "a.kar")
	_ = os.WriteFile(p, karBytes("Changed", "Band"), 0o644)
	later := time.Now().Add(time.Hour)
	_ = os.Chtimes(p, later, later)
	e.scan(t)
	e.process(t)
	if got := e.ftsNumbers(t, "zeta"); len(got) != 1 {
		t.Fatalf("admin edit lost after a rescan: %v", got)
	}
}

func TestSymlinkOutsideIgnored(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlinks need privileges on Windows")
	}
	e := newEnv(t)
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "secret.kar"), karBytes("Secret", "X"), 0o644); err != nil {
		t.Fatal(err)
	}
	_ = os.Symlink(filepath.Join(outside, "secret.kar"), filepath.Join(e.lib, "link.kar"))
	_ = os.Symlink(outside, filepath.Join(e.lib, "linkdir"))
	e.put(t, "real.kar", karBytes("Real", "X"))
	res := e.scan(t)
	if res.Added != 1 || e.count(t, "path LIKE ? OR path LIKE ? OR path LIKE ?", "%"+string(filepath.Separator)+"secret.kar", "%"+string(filepath.Separator)+"link.kar", "%"+string(filepath.Separator)+"linkdir"+string(filepath.Separator)+"%") != 0 {
		t.Fatalf("symlinks were followed: %+v", res)
	}
}

func TestSymlinkedLibraryRootIsFollowed(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlinks need privileges on Windows")
	}
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	link := filepath.Join(t.TempDir(), "music")
	if err := os.Symlink(e.lib, link); err != nil {
		t.Fatal(err)
	}
	e.im.libraries = []string{link}
	if res := e.scan(t); res.Added != 1 {
		t.Fatalf("a library given as a symlink must work: %+v", res)
	}
}

func TestScanConcurrent(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	entered, release := make(chan struct{}), make(chan struct{})
	var walks int
	var mu sync.Mutex
	e.im.hookWalk = func() {
		mu.Lock()
		walks++
		first := walks == 1
		mu.Unlock()
		if first {
			close(entered)
			<-release
		}
	}
	results := make([]ScanResult, 2)
	errs := make([]error, 2)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() { defer wg.Done(); results[0], errs[0] = e.im.Scan(context.Background()) }()
	<-entered
	wg.Add(1)
	go func() { defer wg.Done(); results[1], errs[1] = e.im.Scan(context.Background()) }()
	for i := 0; i < 500 && e.im.waiting() == 0; i++ {
		time.Sleep(2 * time.Millisecond)
	}
	if e.im.waiting() != 1 {
		t.Fatal("the second call should be waiting for the first")
	}
	close(release)
	wg.Wait()
	if errs[0] != nil || errs[1] != nil || results[0] != results[1] || results[0].Added != 1 {
		t.Fatalf("results %+v %+v errors %v %v", results[0], results[1], errs[0], errs[1])
	}
	if walks != 1 {
		t.Fatalf("walks = %d, want 1", walks)
	}
	// a later scan walks again
	e.scan(t)
	if walks != 2 {
		t.Fatalf("walks = %d after a third call", walks)
	}
}

func TestScanContextCancelled(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := e.im.Scan(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
}

func TestDuplicateFilesInFolderAreImportedOnce(t *testing.T) {
	e := newEnv(t)
	body := karBytes("Same", "X")
	e.put(t, "a/one.kar", body)
	e.put(t, "b/two.kar", body)
	res := e.scan(t)
	if res.Added != 1 || e.count(t, "1=1") != 1 {
		t.Fatalf("result %+v rows %d", res, e.count(t, "1=1"))
	}
	if res := e.scan(t); res != (ScanResult{}) {
		t.Fatalf("second scan %+v", res)
	}
}

func TestRunStopsPromptlyAndProcessesInTheBackground(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("Bg", "X"))
	e.put(t, "b.kar", karBytes("Bg2", "X"))
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.im.Run(ctx); close(done) }()
	deadline := time.Now().Add(5 * time.Second)
	for e.count(t, "metadata_done = 1") < 2 && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	if e.count(t, "metadata_done = 1") != 2 {
		t.Fatal("the background worker did not process the new songs")
	}
	start := time.Now()
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not stop within 2 s")
	}
	if time.Since(start) > 2*time.Second {
		t.Fatal("slow shutdown")
	}
}

func mediaFiles(t *testing.T, e *testEnv) []string {
	t.Helper()
	entries, _ := os.ReadDir(filepath.Join(e.data, "media"))
	var out []string
	for _, en := range entries {
		out = append(out, en.Name())
	}
	return out
}

func TestRemovedKARMP3DeletesItsExtractedMedia(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(40), "", ""))
	e.scan(t)
	e.process(t)
	if len(mediaFiles(t, e)) != 1 {
		t.Fatal("media not extracted")
	}
	_ = os.Remove(p)
	e.scan(t)
	if got := mediaFiles(t, e); len(got) != 0 {
		t.Fatalf("extracted media of a removed song left behind: %v", got)
	}
	if r := e.row(t, "00001"); !r.Deleted || r.Media != "" {
		t.Fatalf("%+v", r)
	}
}

func TestChangedKARMP3ReplacesItsExtractedMedia(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(40), "", ""))
	e.scan(t)
	e.process(t)
	first := mediaFiles(t, e)
	newMP3 := testfix.MP3Frames(60)
	_ = os.WriteFile(p, testfix.KARMP3("m", newMP3, "", ""), 0o644)
	later := time.Now().Add(time.Hour)
	_ = os.Chtimes(p, later, later)
	if res := e.scan(t); res.Updated != 1 {
		t.Fatalf("%+v", res)
	}
	e.process(t)
	second := mediaFiles(t, e)
	if len(second) != 1 || second[0] == first[0] {
		t.Fatalf("media before %v after %v: the stale file must be replaced", first, second)
	}
	r := e.row(t, "00001")
	if got, _ := os.ReadFile(r.Media); !bytes.Equal(got, newMP3) {
		t.Fatal("new media content wrong")
	}
}

func TestFileVanishingBeforeTheMetadataPassFailsTheSong(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	_ = os.Remove(p)
	e.process(t)
	if r := e.row(t, "00001"); !r.Failed || r.Reason == "" {
		t.Fatalf("%+v", r)
	}
}

func TestProcessPendingStopsWhenCancelled(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := e.im.ProcessPending(ctx); err == nil {
		t.Fatal("want the cancellation error")
	}
}

func TestOversizedMIDIFails(t *testing.T) {
	e := newEnv(t)
	big := append(karBytes("Big", "X"), make([]byte, 11<<20)...)
	e.put(t, "big.kar", big)
	e.scan(t)
	e.process(t)
	if r := e.row(t, "00001"); !r.Failed || !strings.Contains(r.Reason, "large") {
		t.Fatalf("%+v", r)
	}
}

func TestMetadataIsNotAppliedToAFileThatChangedMeanwhile(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	// between reading the file and writing the result, a scan replaces the content
	e.im.hookMetadata = func() {
		_, err := e.db.Exec(`UPDATE songs SET sha256 = 'replaced-by-a-scan', metadata_done = 0`)
		if err != nil {
			t.Error(err)
		}
	}
	if err := e.im.processMetadata(context.Background(), "00001"); err != nil {
		t.Fatal(err)
	}
	e.im.hookMetadata = nil
	if r := e.row(t, "00001"); r.MetadataDone || r.Title != "" {
		t.Fatalf("stale metadata was written for newer content: %+v", r)
	}
}

func TestScanAndLogWithoutLibrariesIsANoop(t *testing.T) {
	e := newEnv(t)
	e.im.libraries = nil
	e.im.scanAndLog(context.Background())
	if e.count(t, "1=1") != 0 {
		t.Fatal("nothing to scan")
	}
}

func TestShortReasonIsBounded(t *testing.T) {
	if got := shortReason(errors.New(strings.Repeat("x", 500))); len(got) != maxReasonLen {
		t.Fatalf("len = %d", len(got))
	}
}

func TestHashFileHonoursCancellation(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("A", "X"))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, _, err := hashFile(ctx, p); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
}

func TestUnreadableDirectoryKeepsItsSongs(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs permission bits that are enforced")
	}
	e := newEnv(t)
	e.put(t, "sub/a.kar", karBytes("A", "X"))
	e.put(t, "b.kar", karBytes("B", "X"))
	e.scan(t)
	sub := filepath.Join(e.lib, "sub")
	if err := os.Chmod(sub, 0); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(sub, 0o755)
	res := e.scan(t)
	if res.Removed != 0 || e.count(t, "deleted = 1") != 0 {
		t.Fatalf("songs in a directory that could not be read are not 'missing': %+v", res)
	}
}

func TestRemoveMediaOnlyTouchesTheMediaFolderAndUnusedFiles(t *testing.T) {
	e := newEnv(t)
	outside := filepath.Join(t.TempDir(), "keep.mp3")
	_ = os.WriteFile(outside, []byte("x"), 0o644)
	e.im.removeMediaIfUnused(context.Background(), outside)
	if _, err := os.Stat(outside); err != nil {
		t.Fatal("a file outside the media folder must never be deleted")
	}
	e.put(t, "m.karmp3", testfix.KARMP3("m", testfix.MP3Frames(10), "", ""))
	e.scan(t)
	e.process(t)
	media := e.row(t, "00001").Media
	e.im.removeMediaIfUnused(context.Background(), media)
	if _, err := os.Stat(media); err != nil {
		t.Fatal("media still referenced by a live song must stay")
	}
	e.im.removeMediaIfUnused(context.Background(), "")
	e.im.removeMediaIfUnused(context.Background(), filepath.Join(e.data, "media", "missing.mp3")) // not an error
}

func TestWorkerRecoversFromAFailedPass(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	_, _ = e.db.Exec(`ALTER TABLE songs RENAME TO songs_away`) // make the pass fail
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { e.im.worker(ctx); close(done) }()
	time.Sleep(100 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("the worker must stop even while it is backing off after an error")
	}
}

func TestRegression_RenamedFileKeepsItsNumber(t *testing.T) {
	e := newEnv(t)
	old := e.put(t, "00007 old name.kar", karBytes("Tune", "Band"))
	e.scan(t)
	e.process(t)
	moved := filepath.Join(e.lib, "sub", "new name.kar")
	_ = os.MkdirAll(filepath.Dir(moved), 0o755)
	if err := os.Rename(old, moved); err != nil {
		t.Fatal(err)
	}
	res := e.scan(t)
	if res.Added != 0 || res.Removed != 0 || res.Updated != 1 {
		t.Fatalf("a rename is one update, not a removal plus an addition: %+v", res)
	}
	r := e.row(t, "00007")
	if r.Deleted || r.Path != moved || r.Title != "Tune" || !r.MetadataDone {
		t.Fatalf("%+v", r)
	}
	if e.count(t, "1=1") != 1 {
		t.Fatalf("rows = %d, want the one original", e.count(t, "1=1"))
	}
	if got := e.ftsNumbers(t, "tune"); len(got) != 1 || got[0] != "00007" {
		t.Fatalf("search after the rename: %v", got)
	}
	if res := e.scan(t); res != (ScanResult{}) {
		t.Fatalf("second scan: %+v", res)
	}
}

func TestRegression_RemovingOneOfTwoIdenticalFilesPromotesTheOther(t *testing.T) {
	e := newEnv(t)
	body := karBytes("Twin", "X")
	a := e.put(t, "a/one.kar", body)
	two := e.put(t, "b/two.kar", body)
	if res := e.scan(t); res.Added != 1 {
		t.Fatalf("%+v", res)
	}
	if err := os.Remove(a); err != nil {
		t.Fatal(err)
	}
	// the original is gone; the copy takes over the entry instead of vanishing
	res := e.scan(t)
	if res.Removed+res.Updated < 1 {
		t.Fatalf("%+v", res)
	}
	live := e.count(t, "deleted = 0")
	if live != 1 {
		t.Fatalf("live entries = %d, want 1 (the copy must stay in the library)", live)
	}
	if got := e.count(t, "path = ? AND deleted = 0", two); got != 1 {
		t.Fatalf("the surviving file is not in the library")
	}
}

func TestUnreadableChangedFileIsNotTreatedAsMissing(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs permission bits that are enforced")
	}
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	later := time.Now().Add(time.Hour)
	_ = os.Chtimes(p, later, later)
	if err := os.Chmod(p, 0); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(p, 0o644)
	res := e.scan(t)
	if res.Failed != 1 || res.Removed != 0 || e.count(t, "deleted = 1") != 0 {
		t.Fatalf("a file that exists but cannot be read stays in the library: %+v", res)
	}
}

func TestSearchFoldsAccents(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("Élan Vital", "Café Band"))
	e.scan(t)
	e.process(t)
	for _, q := range []string{"elan", "ÉLAN", "cafe", "caf*", "vital band"} {
		if got := e.ftsNumbers(t, q); len(got) != 1 {
			t.Errorf("query %q found %v", q, got)
		}
	}
}

func TestRegression_DisplayedTextIsAlwaysValidUTF8(t *testing.T) {
	bad := "Bisrock\xefp\xcf.kar" // a damaged file name, as found in real libraries
	title, artist := display("", "", bad, sql.NullString{}, sql.NullString{})
	if !utf8.ValidString(title) || !utf8.ValidString(artist) || title == "" {
		t.Fatalf("title %q artist %q: protobuf strings must be valid UTF-8", title, artist)
	}
	title, artist = display("T\xff", "A\xfe", "x.kar", sql.NullString{}, sql.NullString{})
	if !utf8.ValidString(title) || !utf8.ValidString(artist) {
		t.Fatalf("title %q artist %q", title, artist)
	}
	if utf8.ValidString("\xef") {
		t.Fatal("test input is supposed to be invalid")
	}
}

func TestDiscard(t *testing.T) {
	e := newEnv(t)
	p := filepath.Join(e.data, "songs", "u.karmp3")
	_ = os.MkdirAll(filepath.Dir(p), 0o750)
	_ = os.WriteFile(p, testfix.KARMP3("u", testfix.MP3Frames(20), "", "Title : Up"), 0o640)
	res, err := e.im.ImportFile(context.Background(), p, SourceUpload, "u.karmp3")
	if err != nil {
		t.Fatal(err)
	}
	media := e.row(t, res.Number).Media
	if got := e.ftsNumbers(t, "up"); len(got) != 1 {
		t.Fatalf("setup: %v", got)
	}
	if err := e.im.Discard(context.Background(), res.Number); err != nil {
		t.Fatal(err)
	}
	if e.count(t, "1=1") != 0 || len(e.ftsNumbers(t, "up")) != 0 {
		t.Fatal("row or search entry left behind")
	}
	for _, f := range []string{p, media} {
		if _, err := os.Stat(f); err == nil {
			t.Errorf("%s left behind", f)
		}
	}
	if err := e.im.Discard(context.Background(), "99999"); err != nil {
		t.Fatalf("unknown number is a no-op: %v", err)
	}
	// watched-folder entries are never discarded
	e.put(t, "f.kar", karBytes("F", "X"))
	e.scan(t)
	if err := e.im.Discard(context.Background(), "00001"); err == nil {
		t.Fatal("a folder entry must not be discardable")
	}
	if e.count(t, "deleted = 0") != 1 {
		t.Fatal("the folder entry must be untouched")
	}
}

func TestIsReferenced(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("A", "X"))
	e.scan(t)
	if ok, err := e.im.IsReferenced(context.Background(), p); err != nil || !ok {
		t.Fatalf("%v %v", ok, err)
	}
	if ok, _ := e.im.IsReferenced(context.Background(), p+".other"); ok {
		t.Fatal("unknown path")
	}
	_ = os.Remove(p)
	e.scan(t)
	if ok, _ := e.im.IsReferenced(context.Background(), p); ok {
		t.Fatal("a removed song's path must not count (its path is tombstoned)")
	}
}

func TestGetSongAndPathOf(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "00042 - Artist - Name.kar", testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.NoteOn(0, 60, 90)}}}}}.Bytes())
	e.scan(t)
	e.process(t)
	s, err := GetSong(context.Background(), e.db, "00042")
	if err != nil || s.Title != "Name" || s.Artist != "Artist" || s.Format != FormatMIDI || s.Songbook != "00042" {
		t.Fatalf("%+v %v", s, err)
	}
	if got, err := e.im.PathOf(context.Background(), "00042"); err != nil || got != p {
		t.Fatalf("%q %v", got, err)
	}
	if _, err := GetSong(context.Background(), e.db, "99999"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
	if _, err := e.im.PathOf(context.Background(), "99999"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
	_ = os.Remove(p)
	e.scan(t)
	if _, err := GetSong(context.Background(), e.db, "00042"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("a deleted song is not found: %v", err)
	}
}

func TestDisplayFromFileNamePattern(t *testing.T) {
	none := sql.NullString{}
	cases := []struct{ name, fileTitle, fileArtist, wantTitle, wantArtist string }{
		{"01052 - Artist - Title.kar", "", "", "Title", "Artist"},
		{"1052 - The Band - Song - Live.karmp3", "", "", "Song - Live", "The Band"},
		{"01052 - Only Title.kar", "", "", "Only Title", ""},
		{"Plain.kar", "", "", "Plain", ""},
		{"Artist - Title.kar", "", "", "Artist - Title", ""}, // without a number prefix the file name is not guessed at
		{"01052 - Artist - Title.kar", "Real", "", "Real", "Artist"},
		{"01052 - Artist - Title.kar", "", "Real", "Title", "Real"},
		{"01052 - Artist - Title.kar", "Real", "Singer", "Real", "Singer"},
		{"01052 -  - Title.kar", "", "", "Title", ""},
	}
	for _, c := range cases {
		gt, ga := display(c.fileTitle, c.fileArtist, c.name, none, none)
		if gt != c.wantTitle || ga != c.wantArtist {
			t.Errorf("%q (%q, %q): got (%q, %q), want (%q, %q)", c.name, c.fileTitle, c.fileArtist, gt, ga, c.wantTitle, c.wantArtist)
		}
	}
	// an edit wins over everything, and an edited empty artist stays empty
	gt, ga := display("F", "G", "01052 - A - B.kar", sql.NullString{String: "Edited", Valid: true}, sql.NullString{String: "", Valid: true})
	if gt != "Edited" || ga != "" {
		t.Errorf("got (%q, %q)", gt, ga)
	}
}

func TestSortKeyFoldsAccentsAndCase(t *testing.T) {
	if sortKey("  Éclair ") != "eclair" || sortKey("Ñandú") != "nandu" || sortKey("ABBA") != sortKey("abba") {
		t.Fatalf("%q %q", sortKey("Éclair"), sortKey("Ñandú"))
	}
}

func TestSyncStoresDisplayColumns(t *testing.T) {
	e := newEnv(t)
	e.put(t, "01052 - Artist - Title.kar", testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.NoteOn(0, 60, 90)}}}}}.Bytes())
	e.scan(t)
	e.process(t)
	var dt, da, tk, ak string
	if err := e.db.QueryRow(`SELECT display_title, display_artist, title_key, artist_key FROM songs WHERE number='01052'`).Scan(&dt, &da, &tk, &ak); err != nil {
		t.Fatal(err)
	}
	if dt != "Title" || da != "Artist" || tk != "title" || ak != "artist" {
		t.Fatalf("%q %q %q %q", dt, da, tk, ak)
	}
}

func TestSetEditSemantics(t *testing.T) {
	e := newEnv(t)
	e.put(t, "a.kar", karBytes("File title", "File artist"))
	e.scan(t)
	e.process(t)
	ctx := context.Background()
	s := func(v string) *string { return &v }
	if err := e.im.SetEdit(ctx, "00001", s("  Edited  "), nil); err != nil {
		t.Fatal(err)
	}
	if info, _ := GetSong(ctx, e.db, "00001"); info.Title != "Edited" || info.Artist != "File artist" {
		t.Fatalf("%+v", info)
	}
	// an artist edit keeps the title edit
	if err := e.im.SetEdit(ctx, "00001", nil, s("New artist")); err != nil {
		t.Fatal(err)
	}
	if info, _ := GetSong(ctx, e.db, "00001"); info.Title != "Edited" || info.Artist != "New artist" {
		t.Fatalf("%+v", info)
	}
	// clearing one leaves the other
	if err := e.im.SetEdit(ctx, "00001", s(""), nil); err != nil {
		t.Fatal(err)
	}
	if info, _ := GetSong(ctx, e.db, "00001"); info.Title != "File title" || info.Artist != "New artist" {
		t.Fatalf("%+v", info)
	}
	if err := e.im.SetEdit(ctx, "00001", nil, s("   ")); err != nil {
		t.Fatal(err)
	}
	var n int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM song_edits`).Scan(&n)
	if n != 0 {
		t.Fatalf("edit rows left: %d", n)
	}
	if err := e.im.SetEdit(ctx, "99999", s("x"), nil); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
}

func TestDeleteSongAndManagedPaths(t *testing.T) {
	e := newEnv(t)
	p := e.put(t, "a.kar", karBytes("A", "B"))
	e.scan(t)
	e.process(t)
	ctx := context.Background()
	if !e.im.managed(p) || e.im.managed(filepath.Join(t.TempDir(), "x.kar")) || e.im.managed(filepath.Join(e.lib, "missing-dir", "x.kar")) {
		t.Fatal("managed() judges only the data folder and the watched folders")
	}
	if err := e.im.DeleteSong(ctx, "00001"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(p); err == nil {
		t.Fatal("file not removed")
	}
	if err := e.im.DeleteSong(ctx, "00001"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
	// a file that is already gone is not an obstacle
	p2 := e.put(t, "b.kar", karBytes("B", "C"))
	e.scan(t)
	_ = os.Remove(p2)
	if err := e.im.DeleteSong(ctx, "00002"); err != nil {
		t.Fatalf("an already missing file: %v", err)
	}
	if n, err := e.im.FailedCount(ctx); err != nil || n != 0 {
		t.Fatalf("%d %v", n, err)
	}
	var re *RemoveError
	if !errors.As(&RemoveError{Err: errors.New("x")}, &re) || re.Error() != "x" || re.Unwrap() == nil {
		t.Fatal("RemoveError")
	}
}

func TestRegression_CacheCleanupWorksInDataDirsWithGlobCharacters(t *testing.T) {
	base := t.TempDir()
	name := "my [music] *data*"
	if runtime.GOOS == "windows" {
		name = "my [music] data" // "*" and "?" cannot be in a Windows file name; "[" and "]" are glob characters too
	}
	data := filepath.Join(base, name)
	lib := t.TempDir()
	lib, _ = fsutil.Canonical(lib)
	if err := os.MkdirAll(data, 0o750); err != nil {
		t.Fatal(err)
	}
	db, err := store.Open(context.Background(), data)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	im := NewImporter(db, data, []string{lib}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	p := filepath.Join(lib, "a.kar")
	_ = os.WriteFile(p, karBytes("A", "B"), 0o644)
	if _, err := im.Scan(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := im.ProcessPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	var sha string
	_ = db.QueryRow(`SELECT sha256 FROM songs`).Scan(&sha)
	sf2 := filepath.Join(data, "cache", "sf2")
	render := filepath.Join(data, "cache", "render")
	_ = os.MkdirAll(sf2, 0o750)
	_ = os.MkdirAll(render, 0o750)
	mine1, mine2 := filepath.Join(sf2, sha+"-x.sf2"), filepath.Join(render, sha+".m4a")
	other := filepath.Join(sf2, "someone-else-x.sf2")
	for _, f := range []string{mine1, mine2, other} {
		_ = os.WriteFile(f, []byte("x"), 0o640)
	}
	if err := im.DeleteSong(context.Background(), "00001"); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{mine1, mine2} {
		if _, err := os.Stat(f); err == nil {
			t.Errorf("%s was not removed (a data directory name must not be read as a pattern)", f)
		}
	}
	if _, err := os.Stat(other); err != nil {
		t.Error("another song's cache file must stay")
	}
}
