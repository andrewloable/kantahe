package api

import (
	"bytes"
	"context"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// uploaderUser is a user with the uploader role who is not an administrator: the role has no effect any more.
func (a *adminEnv) uploaderUser(t *testing.T) *kantahev1.AuthToken {
	t.Helper()
	a.addUser(t, "up@example.com", "password1", `UPDATE users SET uploader = 1 WHERE id = ?`)
	tok, err := a.login("up@example.com", "password1", "Uploader phone")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestUploadIsForAdministratorsOnly(t *testing.T) {
	a := newAdminEnv(t)
	up := a.uploaderUser(t)
	for who, tok := range map[string]string{"a user": a.user.Token, "a user with the uploader role": up.Token} {
		if _, err := a.uploadAs(tok, "a.kar", goodKAR("A", "B")); code(err) != connect.CodePermissionDenied {
			t.Errorf("%s: %v", who, err)
		}
	}
	if _, err := a.uploadAs("", "a.kar", goodKAR("A", "B")); code(err) != connect.CodeUnauthenticated {
		t.Errorf("no token: %v", err)
	}
	if a.songRows(t) != 0 || len(a.songFiles(t)) != 0 {
		t.Fatal("a refused upload must store nothing")
	}
	if res, err := a.uploadAs(a.admin.Token, "a.kar", goodKAR("A", "B")); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("an administrator uploads: %+v %v", res, err)
	}
}

func (a *adminEnv) downloadURL(token, number string) (*kantahev1.GetSongDownloadResponse, error) {
	res, err := a.adminClient.GetSongDownload(context.Background(), with(connect.NewRequest(&kantahev1.GetSongDownloadRequest{Number: number}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) get(t *testing.T, path string, header ...string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest("GET", a.srv.URL+path, nil)
	for i := 0; i+1 < len(header); i += 2 {
		req.Header.Set(header[i], header[i+1])
	}
	res, err := a.srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res, b
}

func TestGetSongDownloadIsForAdministratorsAndNeedsALiveSong(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "T.karmp3", "Tune", "Band", false)
	up := a.uploaderUser(t)
	for who, tok := range map[string]string{"a user": a.user.Token, "an uploader": up.Token} {
		if _, err := a.downloadURL(tok, n); code(err) != connect.CodePermissionDenied {
			t.Errorf("%s: %v", who, err)
		}
	}
	if _, err := a.downloadURL("", n); code(err) != connect.CodeUnauthenticated {
		t.Errorf("no token: %v", err)
	}
	for _, bad := range []string{"99999", "abc", ""} {
		if _, err := a.downloadURL(a.admin.Token, bad); code(err) != connect.CodeNotFound {
			t.Errorf("number %q: %v", bad, err)
		}
	}
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := a.downloadURL(a.admin.Token, n); code(err) != connect.CodeNotFound {
		t.Errorf("a deleted song: %v", err)
	}
}

func TestTheDownloadIsTheStoredFileExactly(t *testing.T) {
	a := newAdminEnv(t)
	body := testfix.KARMP3("x", testfix.MP3Frames(300), "[00:01.00]hi", "Title : Tune\nArtist : Band")
	res, err := a.uploadAs(a.admin.Token, "Tune.karmp3", body)
	if err != nil {
		t.Fatal(err)
	}
	kar := a.seed(t, "M.kar", "Midi", "Singer", true)
	for number, want := range map[string]struct {
		bytes []byte
		name  string
	}{
		res.Song.Number: {body, res.Song.Number + " - Band - Tune.karmp3"},
		kar:             {nil, kar + " - Singer - Midi.kar"},
	} {
		d, err := a.downloadURL(a.admin.Token, number)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(d.Url, "/media/download/"+number+"?u=") || d.FileName != want.name || d.ExpiresUnix <= 1767268800 {
			t.Fatalf("%s: %+v", number, d)
		}
		if want.bytes == nil { // the stored file of the MIDI song
			var p string
			_ = a.db.QueryRow(`SELECT path FROM songs WHERE number = ?`, number).Scan(&p)
			want.bytes, _ = os.ReadFile(p)
		}
		resp, got := a.get(t, d.Url)
		if resp.StatusCode != 200 || !bytes.Equal(got, want.bytes) {
			t.Fatalf("%s: status %d, %d bytes, want %d", number, resp.StatusCode, len(got), len(want.bytes))
		}
		disp, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition"))
		if err != nil || disp != "attachment" || params["filename"] != want.name {
			t.Errorf("Content-Disposition %q (%v)", resp.Header.Get("Content-Disposition"), err)
		}
		if ct := resp.Header.Get("Content-Type"); ct != "application/octet-stream" || resp.Header.Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(resp.Header.Get("Cache-Control"), "no-store") {
			t.Errorf("headers %v", resp.Header)
		}
		if r, part := a.get(t, d.Url, "Range", "bytes=0-9"); r.StatusCode != 206 || !bytes.Equal(part, want.bytes[:10]) {
			t.Errorf("Range: %d %d bytes", r.StatusCode, len(part))
		}
	}
}

func TestTheDownloadAddressIsBoundToItsPathAndItsUser(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "T.karmp3", "Tune", "Band", false)
	d, err := a.downloadURL(a.admin.Token, n)
	if err != nil {
		t.Fatal(err)
	}
	// the address of the player's media route does not open the file for download, and the other way round
	pb := a.playback(t, n)
	if r, _ := a.get(t, strings.Replace(pb.AudioUrl, "/media/song/", "/media/download/", 1)); r.StatusCode != 403 {
		t.Errorf("a song address used for download: %d", r.StatusCode)
	}
	if r, _ := a.get(t, strings.Replace(d.Url, "/media/download/", "/media/song/", 1)); r.StatusCode != 403 {
		t.Errorf("a download address used as the song: %d", r.StatusCode)
	}
	// another number, another user, a changed signature, no signature
	if r, _ := a.get(t, strings.Replace(d.Url, "/media/download/"+n, "/media/download/00099", 1)); r.StatusCode != 403 {
		t.Errorf("another number: %d", r.StatusCode)
	}
	if r, _ := a.get(t, strings.Replace(d.Url, "u="+a.admin.User.Id, "u="+a.user.User.Id, 1)); r.StatusCode != 403 {
		t.Errorf("another user: %d", r.StatusCode)
	}
	if r, _ := a.get(t, d.Url+"0"); r.StatusCode != 403 {
		t.Errorf("a changed signature: %d", r.StatusCode)
	}
	if r, _ := a.get(t, "/media/download/"+n); r.StatusCode != 403 {
		t.Errorf("no signature: %d", r.StatusCode)
	}
	// a demoted administrator's address stops working before it expires
	if _, err := a.db.Exec(`UPDATE users SET admin = 0 WHERE id = ?`, a.admin.User.Id); err != nil {
		t.Fatal(err)
	}
	if r, _ := a.get(t, d.Url); r.StatusCode != 403 {
		t.Errorf("after the administrator was demoted: %d", r.StatusCode)
	}
}

func TestADownloadOfAFileThatIsGoneIs404(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "T.karmp3", "Tune", "Band", false)
	d, _ := a.downloadURL(a.admin.Token, n)
	var p string
	_ = a.db.QueryRow(`SELECT path FROM songs WHERE number = ?`, n).Scan(&p)
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	if r, _ := a.get(t, d.Url); r.StatusCode != 404 {
		t.Fatalf("status %d", r.StatusCode)
	}
}

func TestTheDownloadNameCannotBreakTheHeader(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "T.karmp3", "Tune", "Band", false)
	if _, err := a.adminClient.UpdateSong(context.Background(), with(connect.NewRequest(&kantahev1.UpdateSongRequest{Number: n, Title: ptr("A/B\"C\r\nX-Evil: 1"), Artist: ptr("../../etc")}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	d, err := a.downloadURL(a.admin.Token, n)
	if err != nil {
		t.Fatal(err)
	}
	if strings.ContainsAny(d.FileName, "/\\\"\r\n:") || strings.Contains(d.FileName, "..") {
		t.Errorf("file name %q", d.FileName)
	}
	resp, _ := a.get(t, d.Url)
	if resp.Header.Get("X-Evil") != "" || strings.ContainsAny(resp.Header.Get("Content-Disposition"), "\r\n") {
		t.Errorf("header injection: %v", resp.Header)
	}
	if _, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition")); err != nil || params["filename"] != d.FileName {
		t.Errorf("Content-Disposition %q: %v", resp.Header.Get("Content-Disposition"), err)
	}
}

func (a *adminEnv) replace(token, number, filename string, content []byte) (*kantahev1.UploadSongResponse, error) {
	res, err := a.uploadClient.UploadSong(context.Background(), with(connect.NewRequest(&kantahev1.UploadSongRequest{Filename: filename, Content: content, ReplaceNumber: number}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) songRow(t *testing.T, number string) (title, path, sha string) {
	t.Helper()
	if err := a.db.QueryRow(`SELECT display_title, path, sha256 FROM songs WHERE number = ?`, number).Scan(&title, &path, &sha); err != nil {
		t.Fatal(err)
	}
	return
}

func karmp3Titled(title string, frames int) []byte {
	return testfix.KARMP3("x", testfix.MP3Frames(frames), "[00:01.00]hi", "Title : "+title+"\nArtist : Band")
}

func TestAnAdministratorReplacesTheFileOfASong(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Old.karmp3", "Old", "Band", false)
	if err := a.fav(t, a.admin.Token, n, true); err != nil {
		t.Fatal(err)
	}
	pl := a.createPlaylist(t, a.admin.Token, "Mine", n)
	_, oldPath, oldSha := a.songRow(t, n)
	body := karmp3Titled("New", 400)
	res, err := a.replace(a.admin.Token, n, "whatever.karmp3", body)
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_UPDATED || res.Song == nil || res.Song.Number != n || res.Song.Title != "New" || !res.Song.Favourite {
		t.Fatalf("%+v", res)
	}
	title, path, sha := a.songRow(t, n)
	if title != "New" || sha == oldSha || path == oldPath {
		t.Fatalf("row after the replace: %q %q %q", title, path, sha)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Errorf("the old stored file is still there: %v", err)
	}
	if got, _ := os.ReadFile(path); !bytes.Equal(got, body) {
		t.Error("the stored file is not the new content")
	}
	list, err := a.libClient().GetPlaylist(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaylistRequest{Id: pl.Id}), a.admin.Token))
	if err != nil || len(list.Msg.Playlist.Songs) != 1 || list.Msg.Playlist.Songs[0].Number != n {
		t.Errorf("the playlist keeps the song: %v %v", list, err)
	}
	if a.songRows(t) != 1 {
		t.Errorf("rows %d: a replace never adds a song", a.songRows(t))
	}
	// the song plays from the new file
	pb := a.playback(t, n)
	if r, _ := a.get(t, pb.AudioUrl, "Range", "bytes=0-9"); r.StatusCode != 206 {
		t.Errorf("playback after the replace: %d", r.StatusCode)
	}
}

func TestAReplaceIsRefusedForTheWrongCallerFormatNumberOrContent(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Old.karmp3", "Old", "Band", false)
	other := a.seed(t, "Other.karmp3", "Other", "Band", false)
	up := a.uploaderUser(t)
	_, oldPath, oldSha := a.songRow(t, n)
	body := karmp3Titled("New", 400)
	for who, tok := range map[string]string{"a user": a.user.Token, "an uploader": up.Token} {
		if _, err := a.replace(tok, n, "a.karmp3", body); code(err) != connect.CodePermissionDenied {
			t.Errorf("%s: %v", who, err)
		}
	}
	cases := []struct {
		name, number, file string
		content            []byte
		reason             string
	}{
		{"a .kar over a .karmp3", n, "a.kar", goodKAR("A", "B"), ".karmp3"},
		{"an unknown number", "99999", "a.karmp3", body, "no such song"},
		{"not a song", n, "a.karmp3", []byte("PK\x03\x04 nonsense"), ""},
		{"the bytes of another song", n, "a.karmp3", mustRead(t, a, other), other},
	}
	for _, c := range cases {
		res, err := a.replace(a.admin.Token, c.number, c.file, c.content)
		if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_REJECTED || !strings.Contains(res.Reason, c.reason) || res.Reason == "" {
			t.Errorf("%s: %+v %v", c.name, res, err)
		}
	}
	title, path, sha := a.songRow(t, n)
	if title != "Old" || path != oldPath || sha != oldSha {
		t.Fatalf("a refused replace changes nothing: %q %q %q", title, path, sha)
	}
	// the same bytes: nothing to do
	same := mustRead(t, a, n)
	if res, err := a.replace(a.admin.Token, n, "a.karmp3", same); err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE || res.Song.Number != n {
		t.Errorf("the same bytes: %+v %v", res, err)
	}
}

func mustRead(t *testing.T, a *adminEnv, number string) []byte {
	t.Helper()
	_, p, _ := a.songRow(t, number)
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestAReplaceOfAWatchedSongOverwritesTheFileInPlace(t *testing.T) {
	a := newAdminEnv(t)
	p := filepath.Join(a.libDir, "00050 - Band - Watched.karmp3")
	if err := os.WriteFile(p, karmp3Titled("Watched", 300), 0o644); err != nil {
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
		t.Fatal(err)
	}
	body := karmp3Titled("Replaced", 500)
	res, err := a.replace(a.admin.Token, n, "x.karmp3", body)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_UPDATED || res.Song.Title != "Replaced" {
		t.Fatalf("%+v %v", res, err)
	}
	if got, _ := os.ReadFile(p); !bytes.Equal(got, body) {
		t.Fatal("the watched file must hold the new content")
	}
	if len(a.songFiles(t)) != 0 {
		t.Errorf("nothing is stored in the data folder: %v", a.songFiles(t))
	}
	if scan, err := a.importer.Scan(context.Background()); err != nil || scan.Added != 0 {
		t.Errorf("the next scan adds nothing: %+v %v", scan, err)
	}
}
