package api

import (
	"context"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/fsutil"
	"github.com/andrewloable/kantahe/server/internal/testfix"
	"github.com/andrewloable/kantahe/server/internal/video"
)

func (a *adminEnv) listVideos(token string) (*kantahev1.ListVideosResponse, error) {
	res, err := a.adminClient.ListVideos(context.Background(), with(connect.NewRequest(&kantahev1.ListVideosRequest{}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) updateVideo(token, id string, name *string, enabled *bool) (*kantahev1.UpdateVideoResponse, error) {
	res, err := a.adminClient.UpdateVideo(context.Background(), with(connect.NewRequest(&kantahev1.UpdateVideoRequest{Id: id, Name: name, Enabled: enabled}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) reorderVideos(token string, ids ...string) (*kantahev1.ReorderVideosResponse, error) {
	res, err := a.adminClient.ReorderVideos(context.Background(), with(connect.NewRequest(&kantahev1.ReorderVideosRequest{Ids: ids}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func (a *adminEnv) deleteVideo(token, id string) error {
	_, err := a.adminClient.DeleteVideo(context.Background(), with(connect.NewRequest(&kantahev1.DeleteVideoRequest{Id: id}), token))
	return err
}

func videoIDs(vs []*kantahev1.Video) []string {
	var out []string
	for _, v := range vs {
		out = append(out, v.Id)
	}
	return out
}

func str(s string) *string { return &s }
func yes(b bool) *bool     { return &b }

func TestListVideosIsInLoopOrderWithPreviewURLsAndWarnings(t *testing.T) {
	a := newAdminEnv(t)
	v1 := a.addVideo(t, "One", 1)
	v2 := a.addVideoInfo(t, "Wide", 2, video.Info{Codec: "avc1", Width: 2560, Height: 1440, DurationMs: 1000, FastStart: true})
	v3 := a.addVideoInfo(t, "Late index", 3, video.Info{Codec: "avc1", Width: 1280, Height: 720, DurationMs: 1000, FastStart: false})
	res, err := a.listVideos(a.admin.Token)
	if err != nil || len(res.Videos) != 3 {
		t.Fatalf("%+v %v", res, err)
	}
	if got := videoIDs(res.Videos); got[0] != v1.ID || got[1] != v2.ID || got[2] != v3.ID {
		t.Fatalf("order %v", got)
	}
	for i, v := range res.Videos {
		if v.Position != int32(i+1) {
			t.Errorf("%s has position %d", v.Name, v.Position)
		}
		uid, ok := a.mounted.media.Verify(httptest.NewRequest("GET", v.Url, nil))
		if !ok || uid != a.admin.User.Id {
			t.Errorf("the preview URL of %s does not verify for the administrator: %q %v", v.Name, uid, ok)
		}
		u, _ := url.Parse(v.Url)
		exp, _ := strconv.ParseInt(u.Query().Get("exp"), 10, 64)
		if life := time.Unix(exp, 0).Sub(a.clock.now()); life != time.Hour {
			t.Errorf("preview life = %v, want 1 h", life)
		}
	}
	if len(res.Videos[0].Warnings) != 0 {
		t.Errorf("a good video has warnings: %v", res.Videos[0].Warnings)
	}
	if w := res.Videos[1].Warnings; len(w) != 1 || !strings.Contains(w[0], "wider than 1920 px") {
		t.Errorf("wide video: %v", w)
	}
	if w := res.Videos[2].Warnings; len(w) != 1 || !strings.Contains(w[0], "moov after mdat") {
		t.Errorf("late index: %v", w)
	}
}

func TestUpdateVideoRenamesAndSwitches(t *testing.T) {
	a := newAdminEnv(t)
	v := a.addVideo(t, "Old", 1)
	got, err := a.updateVideo(a.admin.Token, v.ID, str("  Beach  "), nil)
	if err != nil || got.Video.Name != "Beach" || !got.Video.Enabled || got.Video.Url == "" {
		t.Fatalf("rename: %+v %v", got, err)
	}
	for _, bad := range []string{"", "   ", strings.Repeat("x", 201)} {
		if _, err := a.updateVideo(a.admin.Token, v.ID, str(bad), nil); connect.CodeOf(err) != connect.CodeInvalidArgument || !strings.Contains(err.Error(), "the name must be 1 to 200 characters") {
			t.Errorf("name of %d characters: %v", len(bad), err)
		}
	}
	// a bad name changes nothing, not even the other field of the same call
	if _, err := a.updateVideo(a.admin.Token, v.ID, str(""), yes(false)); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("%v", err)
	}
	if list, _ := a.listVideos(a.admin.Token); list.Videos[0].Name != "Beach" || !list.Videos[0].Enabled {
		t.Fatalf("a refused update changed the video: %+v", list.Videos[0])
	}
	// switched off, a video is not in GetBackground; switched on it is again; the name stays
	if got, err := a.updateVideo(a.admin.Token, v.ID, nil, yes(false)); err != nil || got.Video.Enabled || got.Video.Name != "Beach" {
		t.Fatalf("off: %+v %v", got, err)
	}
	if bg, _ := a.background(a.user.Token); len(bg.Videos) != 0 {
		t.Fatalf("a disabled video is in GetBackground: %+v", bg.Videos)
	}
	if got, err := a.updateVideo(a.admin.Token, v.ID, str("Beach 2"), yes(true)); err != nil || !got.Video.Enabled || got.Video.Name != "Beach 2" {
		t.Fatalf("name and on together: %+v %v", got, err)
	}
	if bg, _ := a.background(a.user.Token); len(bg.Videos) != 1 {
		t.Fatalf("GetBackground after switching on: %+v", bg.Videos)
	}
	// nothing set: the video comes back unchanged
	if got, err := a.updateVideo(a.admin.Token, v.ID, nil, nil); err != nil || got.Video.Name != "Beach 2" {
		t.Fatalf("empty update: %+v %v", got, err)
	}
	if _, err := a.updateVideo(a.admin.Token, "vffffffffff", str("x"), nil); connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("unknown id: %v", err)
	}
}

func TestReorderVideosFollowsTheNewOrderAndRefusesAnythingElse(t *testing.T) {
	a := newAdminEnv(t)
	v1, v2, v3 := a.addVideo(t, "One", 1), a.addVideo(t, "Two", 2), a.addVideo(t, "Three", 3)
	res, err := a.reorderVideos(a.admin.Token, v3.ID, v1.ID, v2.ID)
	if err != nil {
		t.Fatal(err)
	}
	for i, want := range []string{v3.ID, v1.ID, v2.ID} {
		if res.Videos[i].Id != want || res.Videos[i].Position != int32(i+1) {
			t.Fatalf("slot %d = %v", i, res.Videos[i])
		}
	}
	if list, _ := a.listVideos(a.admin.Token); videoIDs(list.Videos)[0] != v3.ID {
		t.Fatal("List does not follow the new order")
	}
	for name, bad := range map[string][]string{
		"a missing id":  {v3.ID, v1.ID},
		"an extra id":   {v3.ID, v1.ID, v2.ID, "vffffffffff"},
		"a repeated id": {v3.ID, v3.ID, v1.ID},
		"an empty list": {},
	} {
		if _, err := a.reorderVideos(a.admin.Token, bad...); connect.CodeOf(err) != connect.CodeInvalidArgument || !strings.Contains(err.Error(), "reload") {
			t.Errorf("%s: %v", name, err)
		}
	}
	if list, _ := a.listVideos(a.admin.Token); videoIDs(list.Videos)[0] != v3.ID || videoIDs(list.Videos)[1] != v1.ID || videoIDs(list.Videos)[2] != v2.ID {
		t.Fatalf("a refused reorder changed the order: %v", videoIDs(list.Videos))
	}
}

func TestDeleteVideoRemovesTheRowAndTheFileAndRenumbers(t *testing.T) {
	a := newAdminEnv(t)
	v1, v2, v3 := a.addVideo(t, "One", 1), a.addVideo(t, "Two", 2), a.addVideo(t, "Three", 3)
	if err := a.deleteVideo(a.admin.Token, v2.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(video.Path(a.dataDir, v2.SHA256)); err == nil {
		t.Fatal("the file of the deleted video is still there")
	}
	for _, v := range []video.Video{v1, v3} {
		if _, err := os.Stat(video.Path(a.dataDir, v.SHA256)); err != nil {
			t.Fatalf("the file of %s was removed: %v", v.Name, err)
		}
	}
	list, _ := a.listVideos(a.admin.Token)
	if len(list.Videos) != 2 || list.Videos[0].Id != v1.ID || list.Videos[0].Position != 1 || list.Videos[1].Id != v3.ID || list.Videos[1].Position != 2 {
		t.Fatalf("after the delete: %+v", list.Videos)
	}
	if err := a.deleteVideo(a.admin.Token, v2.ID); connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("deleting again: %v", err)
	}
	// a file that is already gone is no reason to keep the row
	if err := os.Remove(video.Path(a.dataDir, v1.SHA256)); err != nil {
		t.Fatal(err)
	}
	if err := a.deleteVideo(a.admin.Token, v1.ID); err != nil {
		t.Fatalf("delete with the file already missing: %v", err)
	}
	if list, _ := a.listVideos(a.admin.Token); len(list.Videos) != 1 || list.Videos[0].Position != 1 {
		t.Fatalf("%+v", list.Videos)
	}
}

func TestDeleteVideoThatCannotLoseItsFileStaysWhole(t *testing.T) {
	if runtime.GOOS == "windows" || os.Geteuid() == 0 {
		t.Skip("needs permission bits that are enforced")
	}
	a := newAdminEnv(t)
	v := a.addVideo(t, "One", 1)
	dir := filepath.Join(a.dataDir, "videos")
	if err := os.Chmod(dir, 0o555); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(dir, 0o755)
	err := a.deleteVideo(a.admin.Token, v.ID)
	if connect.CodeOf(err) != connect.CodeFailedPrecondition || !strings.Contains(err.Error(), "the video's file could not be deleted") || !strings.Contains(err.Error(), "permission") {
		t.Fatalf("err = %v", err)
	}
	if _, serr := os.Stat(video.Path(a.dataDir, v.SHA256)); serr != nil {
		t.Fatal("the file must still be there")
	}
	if list, _ := a.listVideos(a.admin.Token); len(list.Videos) != 1 || list.Videos[0].Id != v.ID {
		t.Fatalf("the row must stay: %+v", list.Videos)
	}
}

func TestServerSettingsBackgroundOptions(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	get := func() *kantahev1.ServerSettings {
		res, err := a.adminClient.GetServerSettings(ctx, with(connect.NewRequest(&kantahev1.GetServerSettingsRequest{}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Settings
	}
	set := func(req *kantahev1.UpdateServerSettingsRequest) {
		t.Helper()
		if _, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(req), a.admin.Token)); err != nil {
			t.Fatal(err)
		}
	}
	if s := get(); !s.BackgroundEnabled || s.BackgroundShuffle || s.MaxVideoBytes != 500*mib {
		t.Fatalf("defaults: %+v", s)
	}
	set(&kantahev1.UpdateServerSettingsRequest{BackgroundShuffle: yes(true)})
	if s := get(); !s.BackgroundEnabled || !s.BackgroundShuffle || s.MaxVideoBytes != 500*mib {
		t.Fatalf("shuffle on, the rest alone: %+v", s)
	}
	set(&kantahev1.UpdateServerSettingsRequest{BackgroundEnabled: yes(false)})
	if s := get(); s.BackgroundEnabled || !s.BackgroundShuffle {
		t.Fatalf("background off, shuffle alone: %+v", s)
	}
	if bg, _ := a.background(a.user.Token); bg.Enabled || !bg.Shuffle {
		t.Fatalf("GetBackground follows the settings: %+v", bg)
	}
	v := int64(100 * mib)
	set(&kantahev1.UpdateServerSettingsRequest{BackgroundEnabled: yes(true), BackgroundShuffle: yes(false), MaxVideoBytes: &v})
	if s := get(); !s.BackgroundEnabled || s.BackgroundShuffle || s.MaxVideoBytes != 100*mib || s.ScoreSeconds != 6 {
		t.Fatalf("all together: %+v", s)
	}
	// a refused value changes none of the others in the same call
	bad := int64(0)
	if _, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{BackgroundShuffle: yes(true), MaxVideoBytes: &bad}), a.admin.Token)); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("%v", err)
	}
	if s := get(); s.BackgroundShuffle {
		t.Fatalf("a refused update changed shuffle: %+v", s)
	}
}

func TestVideoManagementIsForAdministratorsOnly(t *testing.T) {
	a := newAdminEnv(t)
	v := a.addVideo(t, "One", 1)
	calls := map[string]func(token string) error{
		"ListVideos":    func(tok string) error { _, err := a.listVideos(tok); return err },
		"UpdateVideo":   func(tok string) error { _, err := a.updateVideo(tok, v.ID, str("x"), nil); return err },
		"ReorderVideos": func(tok string) error { _, err := a.reorderVideos(tok, v.ID); return err },
		"DeleteVideo":   func(tok string) error { return a.deleteVideo(tok, v.ID) },
	}
	for name, call := range calls {
		if err := call(""); connect.CodeOf(err) != connect.CodeUnauthenticated {
			t.Errorf("%s without a token: %v", name, err)
		}
		if err := call(a.user.Token); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Errorf("%s as a user: %v", name, err)
		}
	}
	if list, _ := a.listVideos(a.admin.Token); len(list.Videos) != 1 || list.Videos[0].Name != "One" {
		t.Fatalf("a refused call changed something: %+v", list.Videos)
	}
}

// Finishing an upload of a video that is already there keeps the stored file and then looks the row up. A delete of that video in
// between must not leave a new row without a file: the two steps are ordered.
func TestDeleteVideoDuringTheCompletionOfTheSameContentLeavesNoRowWithoutAFile(t *testing.T) {
	a := newAdminEnv(t)
	data := bigMP4(2*mib, 30, testfix.MP4Options{})
	first := a.upload(t, "a.mp4", data)

	b, err := a.begin(a.admin.Token, "again.mp4", int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	a.sendAll(t, a.admin.Token, b.UploadId, int(b.ChunkSize), data, 0)

	deleted := make(chan error, 1)
	var fired atomic.Bool
	// Place keeps the file that is there and throws our copy away: that is the moment of the delete
	t.Cleanup(fsutil.SetHooksForTest(fsutil.Hooks{Remove: func(path string) error {
		if fired.CompareAndSwap(false, true) {
			go func() { deleted <- a.deleteVideo(a.admin.Token, first.Video.Id) }()
			select {
			case err := <-deleted: // not ordered: the delete finished inside the window
				deleted <- err
			case <-time.After(400 * time.Millisecond): // ordered: the delete waits until the completion is done
			}
		}
		return os.Remove(path)
	}}))
	res, err := a.complete(a.admin.Token, b.UploadId)
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if err := <-deleted; err != nil {
		t.Fatalf("delete: %v", err)
	}
	list, _ := a.listVideos(a.admin.Token)
	for _, v := range list.Videos {
		var sha string
		if err := a.db.QueryRow(`SELECT sha256 FROM videos WHERE id = ?`, v.Id).Scan(&sha); err != nil {
			t.Fatal(err)
		}
		if _, err := os.Stat(video.Path(a.dataDir, sha)); err != nil {
			t.Fatalf("video %s (%s after Complete said %v) has no file: %v", v.Name, v.Id, res.Status, err)
		}
	}
}

// A row whose hash is not a SHA-256 names no file: deleting it removes the row and touches nothing outside <data>/videos.
func TestDeleteVideoNeverTouchesAFileOutsideTheVideosFolder(t *testing.T) {
	a := newAdminEnv(t)
	secret := filepath.Join(a.dataDir, "secret.txt")
	if err := os.WriteFile(secret, []byte("keep"), 0o640); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.Exec(`INSERT INTO videos(id, sha256, name, original_name, size, duration_ms, width, height, codec, position, created_at)
		VALUES ('vbadbadbad', '../secret.txt', 'x', 'x', 1, 1, 1, 1, 'avc1', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	if err := a.deleteVideo(a.admin.Token, "vbadbadbad"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if b, err := os.ReadFile(secret); err != nil || string(b) != "keep" {
		t.Fatalf("the file outside the videos folder was touched: %q %v", b, err)
	}
	if a.count(t, "videos") != 0 {
		t.Fatal("the row must be gone")
	}
}
