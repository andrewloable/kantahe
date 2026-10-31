package api

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func ptr[T any](v T) *T { return &v }

// folderSong puts a KAR into the watched folder, scans and processes it, and returns its number.
func (a *adminEnv) folderSong(t *testing.T, name, title, artist string) (string, string) {
	t.Helper()
	p := filepath.Join(a.libDir, name)
	if err := os.WriteFile(p, goodKAR(title, artist), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := a.importer.Scan(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := a.importer.ProcessPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	var n string
	if err := a.db.QueryRow(`SELECT number FROM songs WHERE path = ?`, p).Scan(&n); err != nil {
		t.Fatalf("no row for %s: %v", p, err)
	}
	return n, p
}

func (a *adminEnv) getSong(t *testing.T, number string) (*kantahev1.Song, error) {
	t.Helper()
	res, err := a.catalogClient().GetSong(context.Background(), with(connect.NewRequest(&kantahev1.GetSongRequest{Number: number}), a.user.Token))
	if err != nil {
		return nil, err
	}
	return res.Msg.Song, nil
}

func (a *adminEnv) updateSong(number string, title, artist *string) (*kantahev1.Song, error) {
	res, err := a.adminClient.UpdateSong(context.Background(), with(connect.NewRequest(&kantahev1.UpdateSongRequest{Number: number, Title: title, Artist: artist}), a.admin.Token))
	if err != nil {
		return nil, err
	}
	return res.Msg.Song, nil
}

func TestEditWinsOverRescan(t *testing.T) {
	a := newAdminEnv(t)
	n, p := a.folderSong(t, "a.kar", "File Title", "File Artist")
	s, err := a.updateSong(n, ptr("Edited Title"), nil)
	if err != nil || s.Title != "Edited Title" || s.Artist != "File Artist" {
		t.Fatalf("%+v %v", s, err)
	}
	if g, _ := a.getSong(t, n); g.Title != "Edited Title" {
		t.Fatalf("GetSong shows %q", g.Title)
	}
	// the file changes and is rescanned: the edit survives
	if err := os.WriteFile(p, goodKAR("Changed In File", "File Artist"), 0o644); err != nil {
		t.Fatal(err)
	}
	later := time.Now().Add(time.Hour)
	_ = os.Chtimes(p, later, later)
	res, err := a.adminClient.Rescan(context.Background(), with(connect.NewRequest(&kantahev1.RescanRequest{}), a.admin.Token))
	if err != nil || res.Msg.Updated != 1 {
		t.Fatalf("%v %v", res, err)
	}
	_ = a.importer.ProcessPending(context.Background())
	if g, _ := a.getSong(t, n); g.Title != "Edited Title" {
		t.Fatalf("the edit must survive a rescan, got %q", g.Title)
	}
	// clearing the edit brings the file's title back
	s, err = a.updateSong(n, ptr(""), nil)
	if err != nil || s.Title != "Changed In File" {
		t.Fatalf("%+v %v", s, err)
	}
	var rows int
	_ = a.db.QueryRow(`SELECT COUNT(*) FROM song_edits`).Scan(&rows)
	if rows != 0 {
		t.Fatalf("an edit with nothing left must be removed, %d rows", rows)
	}
}

func TestEditSearchable(t *testing.T) {
	a := newAdminEnv(t)
	n, _ := a.folderSong(t, "a.kar", "Damaged T\xefitle", "X")
	_ = n
	n, _ = a.folderSong(t, "b.kar", "Plain", "Y")
	if _, err := a.updateSong(n, ptr("Zebra Crossing"), ptr("Stripes")); err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{"zebra", "stripes", "zebra cro"} {
		res, err := a.catalogClient().SearchSongs(context.Background(), with(connect.NewRequest(&kantahev1.SearchSongsRequest{Query: q}), a.user.Token))
		if err != nil || len(res.Msg.Songs) != 1 || res.Msg.Songs[0].Number != n {
			t.Errorf("%q: %v %v", q, res, err)
		}
	}
	res, _ := a.catalogClient().SearchSongs(context.Background(), with(connect.NewRequest(&kantahev1.SearchSongsRequest{Query: "plain"}), a.user.Token))
	if len(res.Msg.Songs) != 0 {
		t.Fatalf("the old title must not match any more: %v", res)
	}
}

func TestUpdateSongValidation(t *testing.T) {
	a := newAdminEnv(t)
	n, _ := a.folderSong(t, "a.kar", "T", "A")
	if _, err := a.updateSong("99999", ptr("x"), nil); code(err) != connect.CodeNotFound {
		t.Errorf("unknown song: %v", err)
	}
	if _, err := a.updateSong("abc", ptr("x"), nil); code(err) != connect.CodeInvalidArgument {
		t.Errorf("bad number: %v", err)
	}
	if _, err := a.updateSong(n, ptr(strings.Repeat("x", 201)), nil); code(err) != connect.CodeInvalidArgument {
		t.Errorf("long title: %v", err)
	}
	if s, err := a.updateSong(n, nil, nil); err != nil || s.Title != "T" {
		t.Errorf("an update without fields changes nothing: %+v %v", s, err)
	}
	// non-canonical digits find the song
	if s, err := a.updateSong(strings.TrimLeft(n, "0"), ptr("Short number"), nil); err != nil || s.Title != "Short number" {
		t.Errorf("%+v %v", s, err)
	}
	// a deleted song cannot be edited
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := a.updateSong(n, ptr("x"), nil); code(err) != connect.CodeNotFound {
		t.Errorf("deleted song: %v", err)
	}
}

func TestDeleteUploadRemovesFile(t *testing.T) {
	a := newAdminEnv(t)
	body := testfix.KARMP3("x", testfix.MP3Frames(80), "[00:01.00]hi", "Title : Gone")
	res, err := a.uploadAs(a.admin.Token, "00077 - Gone.karmp3", body)
	if err != nil || res.Song.Number != "00077" {
		t.Fatalf("%+v %v", res, err)
	}
	var stored, media string
	_ = a.db.QueryRow(`SELECT path, media_path FROM songs WHERE number='00077'`).Scan(&stored, &media)
	// cache files keyed by the sha are removed too
	var sha string
	_ = a.db.QueryRow(`SELECT sha256 FROM songs WHERE number='00077'`).Scan(&sha)
	cache := filepath.Join(a.dataDir, "cache", "sf2")
	render := filepath.Join(a.dataDir, "cache", "render")
	_ = os.MkdirAll(cache, 0o750)
	_ = os.MkdirAll(render, 0o750)
	c1, c2, keep := filepath.Join(cache, sha+"-abc.sf2"), filepath.Join(render, sha+".m4a"), filepath.Join(cache, "other-abc.sf2")
	for _, f := range []string{c1, c2, keep} {
		_ = os.WriteFile(f, []byte("x"), 0o640)
	}
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: "77"}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{stored, media, c1, c2} {
		if _, err := os.Stat(f); err == nil {
			t.Errorf("%s was not removed", f)
		}
	}
	if _, err := os.Stat(keep); err != nil {
		t.Error("another song's cache file must stay")
	}
	if _, err := a.getSong(t, "77"); code(err) != connect.CodeNotFound {
		t.Fatalf("a deleted song is gone from the catalog: %v", err)
	}
	// the number is not reused by the next upload asking for it
	res, err = a.uploadAs(a.admin.Token, "00077 - Again.karmp3", testfix.KARMP3("x", testfix.MP3Frames(90), "", "Title : Again"))
	if err != nil || res.Song.Number == "00077" {
		t.Fatalf("number reused: %+v %v", res, err)
	}
	// deleting twice
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: "77"}), a.admin.Token)); code(err) != connect.CodeNotFound {
		t.Fatalf("second delete: %v", err)
	}
	// the same bytes can be uploaded again after the delete
	if res, err = a.uploadAs(a.admin.Token, "00077 - Gone.karmp3", body); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("re-upload after delete: %+v %v", res, err)
	}
}

func TestDeleteFolderFile(t *testing.T) {
	a := newAdminEnv(t)
	n, p := a.folderSong(t, "a.kar", "T", "A")
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(p); err == nil {
		t.Fatal("the file must be removed from the watched folder")
	}
	// a later scan does not bring it back, nor count it as removed again
	res, err := a.adminClient.Rescan(context.Background(), with(connect.NewRequest(&kantahev1.RescanRequest{}), a.admin.Token))
	if err != nil || res.Msg.Removed != 0 || res.Msg.Added != 0 {
		t.Fatalf("%v %v", res, err)
	}
}

func TestDeleteReadOnlyFails(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs permission bits that are enforced")
	}
	a := newAdminEnv(t)
	n, p := a.folderSong(t, "a.kar", "T", "A")
	if err := os.Chmod(a.libDir, 0o555); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(a.libDir, 0o755)
	_, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n}), a.admin.Token))
	var ce *connect.Error
	if code(err) != connect.CodeFailedPrecondition || !asConnect(err, &ce) || !strings.Contains(ce.Message(), "permission") {
		t.Fatalf("err = %v", err)
	}
	if _, serr := os.Stat(p); serr != nil {
		t.Fatal("the file must still be there")
	}
	if g, gerr := a.getSong(t, n); gerr != nil || g.Title != "T" {
		t.Fatalf("nothing may change when the file cannot be deleted: %v %v", g, gerr)
	}
	var deleted int
	_ = a.db.QueryRow(`SELECT deleted FROM songs WHERE number=?`, n).Scan(&deleted)
	if deleted != 0 {
		t.Fatal("the row must not be marked deleted")
	}
}

func TestDeleteRefusesFilesOutsideTheManagedFolders(t *testing.T) {
	a := newAdminEnv(t)
	n, _ := a.folderSong(t, "a.kar", "T", "A")
	outside := filepath.Join(t.TempDir(), "precious.kar")
	_ = os.WriteFile(outside, goodKAR("P", "Q"), 0o644)
	// a row that (through a bug or a hand-edited database) points outside every managed folder
	if _, err := a.db.Exec(`UPDATE songs SET path = ? WHERE number = ?`, outside, n); err != nil {
		t.Fatal(err)
	}
	_, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n}), a.admin.Token))
	if code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("err = %v", err)
	}
	if _, serr := os.Stat(outside); serr != nil {
		t.Fatal("a file outside the managed folders must never be deleted")
	}
}

func TestRescanCounts(t *testing.T) {
	a := newAdminEnv(t)
	call := func() *kantahev1.RescanResponse {
		res, err := a.adminClient.Rescan(context.Background(), with(connect.NewRequest(&kantahev1.RescanRequest{}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg
	}
	if r := call(); r.Added != 0 || r.Updated != 0 || r.Removed != 0 || r.Failed != 0 {
		t.Fatalf("%+v", r)
	}
	p := filepath.Join(a.libDir, "a.kar")
	_ = os.WriteFile(p, goodKAR("A", "B"), 0o644)
	if r := call(); r.Added != 1 {
		t.Fatalf("%+v", r)
	}
	_ = a.importer.ProcessPending(context.Background())
	_ = os.Remove(p)
	if r := call(); r.Removed != 1 {
		t.Fatalf("%+v", r)
	}
	// a new file that turns out to be unusable counts as failed once its metadata pass has run
	quiet := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.Text("la")}}}}}.Bytes()
	_ = os.WriteFile(filepath.Join(a.libDir, "q.kar"), quiet, 0o644)
	r := call()
	if r.Added != 1 {
		t.Fatalf("%+v", r)
	}
}

func TestSettingsDefaultsAndUpdate(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	get := func() *kantahev1.ServerSettings {
		res, err := a.adminClient.GetServerSettings(ctx, with(connect.NewRequest(&kantahev1.GetServerSettingsRequest{}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Settings
	}
	if s := get(); s.MaxUploadBytes != 52428800 || s.ScoreSeconds != 6 {
		t.Fatalf("defaults: %+v", s)
	}
	res, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{MaxUploadBytes: ptr(int64(10 << 20))}), a.admin.Token))
	if err != nil || res.Msg.Settings.MaxUploadBytes != 10<<20 || res.Msg.Settings.ScoreSeconds != 6 {
		t.Fatalf("%v %v", res, err)
	}
	res, err = a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{ScoreSeconds: ptr(int32(0))}), a.admin.Token))
	if err != nil || res.Msg.Settings.ScoreSeconds != 0 || res.Msg.Settings.MaxUploadBytes != 10<<20 {
		t.Fatalf("a zero is a real value, only unset fields stay: %v %v", res, err)
	}
	for name, req := range map[string]*kantahev1.UpdateServerSettingsRequest{
		"upload too small": {MaxUploadBytes: ptr(int64(1000))},
		"upload too large": {MaxUploadBytes: ptr(int64(2 << 30))},
		"seconds negative": {ScoreSeconds: ptr(int32(-1))},
		"seconds too long": {ScoreSeconds: ptr(int32(61))},
	} {
		if _, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(req), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%s: %v", name, err)
		}
	}
	// an invalid field blocks the valid one in the same request
	_, err = a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{MaxUploadBytes: ptr(int64(5 << 20)), ScoreSeconds: ptr(int32(99))}), a.admin.Token))
	if code(err) != connect.CodeInvalidArgument || get().MaxUploadBytes != 10<<20 {
		t.Fatalf("nothing may be written when any value is invalid: %v %+v", err, get())
	}
	// the upload limit takes effect on the next upload
	if _, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{MaxUploadBytes: ptr(int64(1 << 20))}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	big := append(goodKAR("Big", "X"), make([]byte, 1<<20)...)
	up, err := a.uploadAs(a.admin.Token, "big.kar", big)
	if err != nil || up.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || up.Reason != "file too large" {
		t.Fatalf("%+v %v", up, err)
	}
}
