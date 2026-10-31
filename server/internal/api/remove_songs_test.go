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

func TestRemoveSongsAllKeepsTheFiles(t *testing.T) {
	a := newAdminEnv(t)
	_, p1 := a.folderSong(t, "a.kar", "T", "A")
	n2, p2 := a.folderSong(t, "b.kar", "U", "B")
	res, err := a.removeSongs(a.admin.Token, kantahev1.RemoveScope_REMOVE_SCOPE_ALL)
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
	if _, err := a.removeSongs(a.user.Token, kantahev1.RemoveScope_REMOVE_SCOPE_ALL); code(err) != connect.CodePermissionDenied {
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
