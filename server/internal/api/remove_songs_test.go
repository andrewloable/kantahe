package api

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

func (a *adminEnv) removeSongs(token string, scope kantahev1.RemoveScope) (*kantahev1.RemoveSongsResponse, error) {
	res, err := a.adminClient.RemoveSongs(context.Background(), with(connect.NewRequest(&kantahev1.RemoveSongsRequest{Scope: scope}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func TestDeleteSongKeepFileOnlyTakesItOffTheList(t *testing.T) {
	a := newAdminEnv(t)
	n, p := a.folderSong(t, "a.kar", "T", "A")
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n, KeepFile: true}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(p); err != nil {
		t.Fatalf("keep_file leaves the file: %v", err)
	}
	if _, err := a.getSong(t, n); code(err) != connect.CodeNotFound {
		t.Fatalf("the song is off the list: %v", err)
	}
}

func TestRemoveSongsBrokenKeepsTheFilesWithoutDeleteFiles(t *testing.T) {
	a := newAdminEnv(t)
	_, p1 := a.folderSong(t, "a.kar", "T", "A")
	n2, p2 := a.folderSong(t, "b.kar", "U", "B")
	if _, err := a.db.Exec(`UPDATE songs SET failed = 1, failed_reason = 'test'`); err != nil {
		t.Fatal(err)
	}
	res, err := a.removeSongs(a.admin.Token, kantahev1.RemoveScope_REMOVE_SCOPE_BROKEN)
	if err != nil || res.Removed != 2 {
		t.Fatalf("%+v %v", res, err)
	}
	for _, p := range []string{p1, p2} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s must stay: %v", filepath.Base(p), err)
		}
	}
	if _, err := a.getSong(t, n2); code(err) != connect.CodeNotFound {
		t.Fatalf("%v", err)
	}
}

func TestRemoveSongsChecksWhoAsksAndWhat(t *testing.T) {
	a := newAdminEnv(t)
	if _, err := a.removeSongs(a.user.Token, kantahev1.RemoveScope_REMOVE_SCOPE_BROKEN); code(err) != connect.CodePermissionDenied {
		t.Fatalf("a user who is not an administrator: %v", err)
	}
	if _, err := a.removeSongs(a.admin.Token, kantahev1.RemoveScope_REMOVE_SCOPE_UNSPECIFIED); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("no scope: %v", err)
	}
}

// The admin guide promises that an uploaded song that was only taken off the list comes back by uploading it again.
func TestUploadAgainAfterRemoveFromList(t *testing.T) {
	a := newAdminEnv(t)
	body := goodKAR("Again", "X")
	first, err := a.uploadAs(a.admin.Token, "Again.kar", body)
	if err != nil || first.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("%+v %v", first, err)
	}
	var stored string
	_ = a.db.QueryRow(`SELECT path FROM songs WHERE number = ?`, first.Song.Number).Scan(&stored)
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: first.Song.Number, KeepFile: true}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(stored); err != nil {
		t.Fatalf("the uploaded file stays in the data folder: %v", err)
	}
	again, err := a.uploadAs(a.admin.Token, "Again.kar", body)
	if err != nil || again.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED || again.Song == nil {
		t.Fatalf("uploading it again adds it: %+v %v", again, err)
	}
	if again.Song.Number == first.Song.Number {
		t.Fatalf("a removed song's number is not reused: %s", again.Song.Number)
	}
	if _, err := os.Stat(stored); err != nil {
		t.Fatalf("the file must still be there: %v", err)
	}
}

func (a *adminEnv) removeSelected(token string, numbers []string, deleteFiles bool) (*kantahev1.RemoveSelectedSongsResponse, error) {
	res, err := a.adminClient.RemoveSelectedSongs(context.Background(), with(connect.NewRequest(&kantahev1.RemoveSelectedSongsRequest{Numbers: numbers, DeleteFiles: deleteFiles}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func TestRemoveSelectedSongs(t *testing.T) {
	a := newAdminEnv(t)
	n1, p1 := a.folderSong(t, "a.kar", "T", "A")
	n2, p2 := a.folderSong(t, "b.kar", "U", "B")
	n3, p3 := a.folderSong(t, "c.kar", "V", "C")
	res, err := a.removeSelected(a.admin.Token, []string{n1, n2}, false)
	if err != nil || res.Removed != 2 || res.FilesDeleted != 0 || res.FilesFailed != 0 {
		t.Fatalf("%+v %v", res, err)
	}
	for _, n := range []string{n1, n2} {
		if _, err := a.getSong(t, n); code(err) != connect.CodeNotFound {
			t.Errorf("%s is off the list: %v", n, err)
		}
	}
	if _, err := a.getSong(t, n3); err != nil {
		t.Errorf("the song that was not chosen stays: %v", err)
	}
	for _, p := range []string{p1, p2, p3} {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("no file is deleted without delete_files: %v", err)
		}
	}
	// with the files
	res, err = a.removeSelected(a.admin.Token, []string{n3}, true)
	if err != nil || res.Removed != 1 || res.FilesDeleted != 1 {
		t.Fatalf("%+v %v", res, err)
	}
	if _, err := os.Stat(p3); err == nil {
		t.Error("the file of the song removed with delete_files must be deleted")
	}
}

func TestRemoveSelectedSongsChecksWhoAsksAndWhat(t *testing.T) {
	a := newAdminEnv(t)
	n, _ := a.folderSong(t, "a.kar", "T", "A")
	if _, err := a.removeSelected(a.user.Token, []string{n}, false); code(err) != connect.CodePermissionDenied {
		t.Fatalf("a user who is not an administrator: %v", err)
	}
	if _, err := a.getSong(t, n); err != nil {
		t.Fatalf("nothing changed for a refused request: %v", err)
	}
	many := make([]string, 1001)
	for i := range many {
		many[i] = "00001"
	}
	for name, nums := range map[string][]string{"empty": nil, "1001 numbers": many, "not digits": {"abc"}, "five letters": {"abcde"}, "too short": {"12"}, "one bad among good": {n, "x1"}} {
		if _, err := a.removeSelected(a.admin.Token, nums, false); code(err) != connect.CodeInvalidArgument {
			t.Errorf("%s: %v", name, err)
		}
	}
	if _, err := a.getSong(t, n); err != nil {
		t.Fatalf("nothing changed for refused requests: %v", err)
	}
	// 1000 numbers are fine
	if _, err := a.removeSelected(a.admin.Token, many[:1000], false); err != nil {
		t.Fatalf("1000 numbers: %v", err)
	}
}

// The scopes ALL (1) and NO_MUSIC (2) were removed: selecting the songs to delete (RemoveSelectedSongs) replaced them. An old client that still
// sends them is refused, and nothing is removed.
func TestRemoveSongsRefusesTheRemovedScopes(t *testing.T) {
	a := newAdminEnv(t)
	n, _ := a.folderSong(t, "a.kar", "T", "A")
	for _, scope := range []kantahev1.RemoveScope{1, 2, 99} {
		if _, err := a.removeSongs(a.admin.Token, scope); code(err) != connect.CodeInvalidArgument {
			t.Errorf("scope %d: %v", scope, err)
		}
	}
	if _, err := a.getSong(t, n); err != nil {
		t.Fatalf("a refused request removed a song: %v", err)
	}
}
