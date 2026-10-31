package api

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func (e *testEnv) uploadAs(token, filename string, content []byte) (*kantahev1.UploadSongResponse, error) {
	res, err := e.uploadClient.UploadSong(context.Background(), with(connect.NewRequest(&kantahev1.UploadSongRequest{Filename: filename, Content: content}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (e *testEnv) songFiles(t *testing.T) []string {
	t.Helper()
	entries, _ := os.ReadDir(filepath.Join(e.dataDir, "songs"))
	var out []string
	for _, en := range entries {
		out = append(out, en.Name())
	}
	return out
}

func (e *testEnv) songRows(t *testing.T) int {
	t.Helper()
	var n int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM songs`).Scan(&n)
	return n
}

func goodKAR(title, artist string) []byte {
	return testfix.KAR(title, artist, []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}})
}

func TestUploadRequiresUploader(t *testing.T) {
	a := newAdminEnv(t)
	_, err := a.uploadAs(a.user.Token, "a.kar", goodKAR("A", "B"))
	if code(err) != connect.CodePermissionDenied {
		t.Fatalf("err = %v", err)
	}
	if _, err := a.uploadAs("", "a.kar", goodKAR("A", "B")); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("no token: %v", err)
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatal("a refused upload must store nothing")
	}
}

func TestUploadKAR(t *testing.T) {
	a := newAdminEnv(t)
	res, err := a.uploadAs(a.admin.Token, "00042 - Singer - Song.kar", goodKAR("Song", "Singer"))
	if err != nil {
		t.Fatal(err)
	}
	s := res.Song
	if res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED || s == nil || s.Number != "00042" || s.Title != "Song" || s.Artist != "Singer" ||
		s.Format != kantahev1.Format_FORMAT_MIDI || s.DurationMs <= 0 || s.SongbookNumber != "00042" || s.Failed {
		t.Fatalf("%+v", res)
	}
	files := a.songFiles(t)
	if len(files) != 1 || filepath.Ext(files[0]) != ".kar" || len(files[0]) != 64+4 {
		t.Fatalf("files = %v, want one <sha256>.kar", files)
	}
}

func TestUploadKARMP3(t *testing.T) {
	a := newAdminEnv(t)
	body := testfix.KARMP3("x", testfix.MP3Frames(1000), "[00:01.00]hi", "Title : Tune\nArtist : Band")
	res, err := a.uploadAs(a.admin.Token, "Tune.karmp3", body)
	if err != nil {
		t.Fatal(err)
	}
	s := res.Song
	if res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED || s.Format != kantahev1.Format_FORMAT_MP3 || s.Title != "Tune" || s.Artist != "Band" ||
		s.DurationMs < 26100 || s.DurationMs > 26150 || s.Number != "00001" {
		t.Fatalf("%+v", res)
	}
	var media string
	_ = a.db.QueryRow(`SELECT media_path FROM songs WHERE number = ?`, s.Number).Scan(&media)
	if _, err := os.Stat(media); err != nil {
		t.Fatalf("the MP3 must be extracted for Range requests: %v", err)
	}
}

func TestUploadTooLarge(t *testing.T) {
	a := newAdminEnv(t)
	if _, err := a.db.Exec(`INSERT INTO settings(key, value) VALUES ('max_upload_bytes', '1000')`); err != nil {
		t.Fatal(err)
	}
	big := append(goodKAR("A", "B"), make([]byte, 1001)...)
	res, err := a.uploadAs(a.admin.Token, "a.kar", big)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason != "file too large" || res.Song != nil {
		t.Fatalf("%+v %v", res, err)
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatal("nothing may be stored")
	}
	// exactly at the limit is fine
	if _, err := a.db.Exec(`UPDATE settings SET value = ? WHERE key = 'max_upload_bytes'`, len(goodKAR("A", "B"))); err != nil {
		t.Fatal(err)
	}
	if res, err = a.uploadAs(a.admin.Token, "a.kar", goodKAR("A", "B")); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("at the limit: %+v %v", res, err)
	}
}

func TestUploadBadExtension(t *testing.T) {
	a := newAdminEnv(t)
	for _, name := range []string{"x.mp3", "x.mid", "x", "", ".kar.exe", "x.kar\x00.txt", "dir/", "..", strings200()} {
		res, err := a.uploadAs(a.admin.Token, name, goodKAR("A", "B"))
		if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason != "unsupported file type" {
			t.Errorf("%q: %+v %v", name, res, err)
		}
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatal("nothing may be stored")
	}
}

func strings200() string {
	b := bytes.Repeat([]byte("a"), 252)
	return string(b) + ".kar" // 256 bytes
}

func TestUploadExtensionIsCaseInsensitive(t *testing.T) {
	a := newAdminEnv(t)
	res, err := a.uploadAs(a.admin.Token, "SONG.KAR", goodKAR("A", "B"))
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("%+v %v", res, err)
	}
}

func TestUploadPathInFilename(t *testing.T) {
	a := newAdminEnv(t)
	res, err := a.uploadAs(a.admin.Token, "../../etc/00001 - a.kar", goodKAR("A", "B"))
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED || res.Song.Number != "00001" {
		t.Fatalf("%+v %v", res, err)
	}
	res, err = a.uploadAs(a.admin.Token, `C:\music\..\00002 - b.kar`, goodKAR("B", "B"))
	if err != nil || res.Song.Number != "00002" {
		t.Fatalf("backslash path: %+v %v", res, err)
	}
	for _, f := range a.songFiles(t) {
		if len(f) != 64+4 {
			t.Errorf("stored file %q is not named by its hash", f)
		}
	}
	if _, err := os.Stat(filepath.Join(a.dataDir, "..", "..", "etc")); err == nil {
		t.Log("(the host has /etc; only checking that nothing was written outside the data directory)")
	}
	entries, _ := os.ReadDir(a.dataDir)
	for _, en := range entries {
		switch en.Name() {
		case "songs", "media", "cache", "kantahe.db", "kantahe.db-wal", "kantahe.db-shm":
		default:
			t.Errorf("unexpected entry %q in the data directory", en.Name())
		}
	}
}

func TestUploadNotMIDI(t *testing.T) {
	a := newAdminEnv(t)
	res, err := a.uploadAs(a.admin.Token, "a.kar", []byte("this is not midi at all"))
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason != "not a valid MIDI file" {
		t.Fatalf("%+v %v", res, err)
	}
	res, err = a.uploadAs(a.admin.Token, "a.karmp3", []byte("MThd not a zip"))
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason != "not a valid .karmp3 file" {
		t.Fatalf("%+v %v", res, err)
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatal("nothing may be stored")
	}
}

func TestUploadNoMusic(t *testing.T) {
	a := newAdminEnv(t)
	quiet := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.Text("@TQuiet")}, {Data: testfix.Text("la")}}}}}.Bytes()
	res, err := a.uploadAs(a.admin.Token, "q.kar", quiet)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason == "" || res.Song != nil {
		t.Fatalf("%+v %v", res, err)
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatalf("rejected uploads leave nothing behind: rows %d files %v", a.songRows(t), a.songFiles(t))
	}
}

// A song from a karaoke card can hold only lyric timing cues and a velocity-1 pitch guide on channel 16: it has no
// instrument, so it is refused before anything is stored.
func TestUploadGuideOnlyIsRefused(t *testing.T) {
	a := newAdminEnv(t)
	cues := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{
		{Data: testfix.Text("@TCues")}, {Data: testfix.Text("la")},
		{Delta: 10, Data: testfix.NoteOn(15, 0, 64)}, {Delta: 10, Data: testfix.NoteOn(15, 14, 1)}, {Delta: 10, Data: testfix.NoteOn(15, 74, 1)},
	}}}}.Bytes()
	res, err := a.uploadAs(a.admin.Token, "c.kar", cues)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason != "the file contains no music" || res.Song != nil {
		t.Fatalf("%+v %v", res, err)
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatalf("a refused upload leaves nothing behind: rows %d files %v", a.songRows(t), a.songFiles(t))
	}
}

func TestUploadBadKARMP3Contents(t *testing.T) {
	a := newAdminEnv(t)
	body := testfix.KARMP3("x", bytes.Repeat([]byte{1}, 3000), "", "") // a zip whose .mp3 is not audio
	res, err := a.uploadAs(a.admin.Token, "x.karmp3", body)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || res.Reason == "" {
		t.Fatalf("%+v %v", res, err)
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatal("nothing may be stored")
	}
}

func TestUploadDuplicate(t *testing.T) {
	a := newAdminEnv(t)
	body := goodKAR("Dup", "X")
	r1, err := a.uploadAs(a.admin.Token, "Dup.kar", body)
	if err != nil || r1.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("%+v %v", r1, err)
	}
	r2, err := a.uploadAs(a.admin.Token, "Other name.kar", body)
	if err != nil || r2.Status != kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE || r2.Song == nil || r2.Song.Number != r1.Song.Number {
		t.Fatalf("%+v %v", r2, err)
	}
	if a.songRows(t) != 1 || len(a.songFiles(t)) != 1 {
		t.Fatalf("rows %d files %v", a.songRows(t), a.songFiles(t))
	}
}

func TestUploadDuplicateOfAFolderSongStoresNoCopy(t *testing.T) {
	a := newAdminEnv(t)
	body := goodKAR("Folder", "X")
	p := filepath.Join(t.TempDir(), "in-folder.kar")
	_ = os.WriteFile(p, body, 0o644)
	if _, err := a.importer.ImportFile(context.Background(), p, 2, "in-folder.kar"); err != nil {
		t.Fatal(err)
	}
	res, err := a.uploadAs(a.admin.Token, "same.kar", body)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE {
		t.Fatalf("%+v %v", res, err)
	}
	if len(a.songFiles(t)) != 0 {
		t.Fatalf("a duplicate of a folder song must not leave a copy: %v", a.songFiles(t))
	}
}

func TestUploadOverReadLimit(t *testing.T) {
	a := newAdminEnv(t)
	huge := make([]byte, 65<<20)
	_, err := a.uploadAs(a.admin.Token, "huge.kar", huge)
	if code(err) != connect.CodeResourceExhausted {
		t.Fatalf("err = %v, want ResourceExhausted", err)
	}
	// the server is still up and serving
	if res, err := a.uploadAs(a.admin.Token, "ok.kar", goodKAR("A", "B")); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("after the oversized message: %+v %v", res, err)
	}
}

func TestUploadedSongsTitleFallsBackToTheFileName(t *testing.T) {
	a := newAdminEnv(t)
	bare := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.NoteOn(0, 60, 90)}}}}}.Bytes()
	res, err := a.uploadAs(a.admin.Token, "12 - Plain Name.kar", bare)
	if err != nil || res.Song.Title != "Plain Name" || res.Song.Number != "00012" {
		t.Fatalf("%+v %v", res, err)
	}
}

func TestDropOnlyRemovesUnreferencedFiles(t *testing.T) {
	a := newAdminEnv(t)
	res, err := a.uploadAs(a.admin.Token, "k.kar", goodKAR("Keep", "X"))
	if err != nil {
		t.Fatal(err)
	}
	files := a.songFiles(t)
	if len(files) != 1 {
		t.Fatal(files)
	}
	stored := filepath.Join(a.dataDir, "songs", files[0])
	s := newUploadServer(Deps{DB: a.db, Importer: a.importer, DataDir: a.dataDir, Logger: a.logger})
	s.dropUnreferenced(context.Background(), stored)
	if _, err := os.Stat(stored); err != nil {
		t.Fatalf("a file that a song row points at must stay (another upload of the same bytes may be using it): %v", err)
	}
	other := filepath.Join(a.dataDir, "songs", "orphan.kar")
	_ = os.WriteFile(other, []byte("x"), 0o640)
	s.dropUnreferenced(context.Background(), other)
	if _, err := os.Stat(other); err == nil {
		t.Fatal("an orphan must be removed")
	}
	_ = res
}
