package api

import (
	"context"
	"os"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

// runCheck calls CheckLibrary and returns every message of the stream.
func (a *adminEnv) runCheck(token string) ([]*kantahev1.CheckLibraryResponse, error) {
	stream, err := a.adminClient.CheckLibrary(context.Background(), with(connect.NewRequest(&kantahev1.CheckLibraryRequest{}), token))
	if err != nil {
		return nil, err
	}
	defer stream.Close()
	var out []*kantahev1.CheckLibraryResponse
	for stream.Receive() {
		out = append(out, stream.Msg())
	}
	return out, stream.Err()
}

func (a *adminEnv) listBroken(token, page string, size int32) (*kantahev1.ListBrokenSongsResponse, error) {
	res, err := a.adminClient.ListBrokenSongs(context.Background(), with(connect.NewRequest(&kantahev1.ListBrokenSongsRequest{PageToken: page, PageSize: size}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func TestBrokenSongRPCsAreForAdministratorsOnly(t *testing.T) {
	a := newAdminEnv(t)
	if _, err := a.runCheck(a.user.Token); code(err) != connect.CodePermissionDenied {
		t.Fatalf("CheckLibrary as a user: %v", err)
	}
	if _, err := a.listBroken(a.user.Token, "", 0); code(err) != connect.CodePermissionDenied {
		t.Fatalf("ListBrokenSongs as a user: %v", err)
	}
	if _, err := a.removeSongs(a.user.Token, kantahev1.RemoveScope_REMOVE_SCOPE_BROKEN); code(err) != connect.CodePermissionDenied {
		t.Fatalf("RemoveSongs(BROKEN) as a user: %v", err)
	}
}

func TestDeleteFilesIsOnlyForTheBrokenScope(t *testing.T) {
	a := newAdminEnv(t)
	for _, scope := range []kantahev1.RemoveScope{kantahev1.RemoveScope_REMOVE_SCOPE_ALL, kantahev1.RemoveScope_REMOVE_SCOPE_NO_MUSIC} {
		_, err := a.adminClient.RemoveSongs(context.Background(), with(connect.NewRequest(&kantahev1.RemoveSongsRequest{Scope: scope, DeleteFiles: true}), a.admin.Token))
		if code(err) != connect.CodeInvalidArgument {
			t.Fatalf("scope %v with delete_files: %v", scope, err)
		}
	}
}

func TestCheckLibraryStreamsProgressAndEndsWithDone(t *testing.T) {
	a := newAdminEnv(t)
	_, p := a.folderSong(t, "a.kar", "Alpha", "A")
	a.folderSong(t, "b.kar", "Bravo", "B")
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	msgs, err := a.runCheck(a.admin.Token)
	if err != nil || len(msgs) == 0 {
		t.Fatalf("%d messages, %v", len(msgs), err)
	}
	last := msgs[len(msgs)-1]
	if !last.Done || last.Checked != 2 || last.Total != 2 || last.Broken != 1 {
		t.Fatalf("the last message: %+v", last)
	}
	for _, m := range msgs[:len(msgs)-1] {
		if m.Done {
			t.Fatalf("only the last message is done: %+v", msgs)
		}
	}
	broken, err := a.listBroken(a.admin.Token, "", 0)
	if err != nil || broken.Total != 1 || len(broken.Songs) != 1 || broken.Songs[0].Reason != "the file is missing" || broken.Songs[0].Song.Title != "Alpha" {
		t.Fatalf("%+v %v", broken, err)
	}
	// the broken song is hidden from users: it cannot be fetched or queued, and it is not in a search
	if _, err := a.getSong(t, broken.Songs[0].Song.Number); code(err) != connect.CodeNotFound {
		t.Fatalf("a user cannot fetch a broken song: %v", err)
	}
	// the broken song is gone from every user's catalog; removing the broken ones takes it off the list
	res, err := a.removeSongs(a.admin.Token, kantahev1.RemoveScope_REMOVE_SCOPE_BROKEN)
	if err != nil || res.Removed != 1 || res.FilesDeleted != 0 {
		t.Fatalf("%+v %v", res, err)
	}
	if again, _ := a.listBroken(a.admin.Token, "", 0); again.Total != 0 {
		t.Fatalf("nothing is broken after the removal: %+v", again)
	}
}

func TestASecondCheckWhileOneRunsIsRefused(t *testing.T) {
	a := newAdminEnv(t)
	a.folderSong(t, "a.kar", "Alpha", "A")
	entered, release := make(chan struct{}, 1), make(chan struct{})
	a.importer.SetCheckHookForTest(func() {
		select {
		case entered <- struct{}{}:
		default:
		}
		<-release
	})
	defer a.importer.SetCheckHookForTest(nil)
	first := make(chan error, 1)
	go func() {
		_, err := a.runCheck(a.admin.Token)
		first <- err
	}()
	<-entered
	if _, err := a.runCheck(a.admin.Token); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("a second check: %v", err)
	}
	close(release)
	if err := <-first; err != nil {
		t.Fatalf("the first check ends normally: %v", err)
	}
	// and a new one is allowed again
	if _, err := a.runCheck(a.admin.Token); err != nil {
		t.Fatalf("after the first: %v", err)
	}
}

func TestListBrokenSongsPages(t *testing.T) {
	a := newAdminEnv(t)
	var paths []string
	for _, n := range []string{"a", "b", "c", "d", "e"} {
		_, p := a.folderSong(t, n+".kar", "Song "+n, "X")
		paths = append(paths, p)
	}
	for _, p := range paths {
		_ = os.Remove(p)
	}
	if _, err := a.runCheck(a.admin.Token); err != nil {
		t.Fatal(err)
	}
	var got int
	page := ""
	for i := 0; i < 5; i++ {
		res, err := a.listBroken(a.admin.Token, page, 2)
		if err != nil || res.Total != 5 {
			t.Fatalf("%+v %v", res, err)
		}
		got += len(res.Songs)
		if res.NextPageToken == "" {
			break
		}
		page = res.NextPageToken
	}
	if got != 5 {
		t.Fatalf("five songs over three pages, got %d", got)
	}
}

func TestAClosedStreamEndsTheCheckAndAnotherCanRunAfterwards(t *testing.T) {
	a := newAdminEnv(t)
	_, p := a.folderSong(t, "a.kar", "Alpha", "A")
	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}, 1), make(chan struct{})
	a.importer.SetCheckHookForTest(func() {
		select {
		case entered <- struct{}{}:
		default:
		}
		<-release
	})
	defer a.importer.SetCheckHookForTest(nil)
	ctx, cancel := context.WithCancel(context.Background())
	go func() { // the call returns only once the server has sent something, and the hook holds it
		stream, err := a.adminClient.CheckLibrary(ctx, with(connect.NewRequest(&kantahev1.CheckLibraryRequest{}), a.admin.Token))
		if err != nil {
			return
		}
		defer stream.Close()
		for stream.Receive() {
		}
	}()
	<-entered
	cancel() // the browser tab is closed
	time.Sleep(200 * time.Millisecond)
	close(release)
	a.importer.SetCheckHookForTest(nil)
	var last error
	for i := 0; i < 40; i++ {
		if _, last = a.runCheck(a.admin.Token); last == nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if last != nil {
		t.Fatalf("a new check must be possible once the closed one has ended: %v", last)
	}
}
