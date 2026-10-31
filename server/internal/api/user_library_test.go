package api

import (
	"context"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func (e *testEnv) libClient() kantahev1connect.UserLibraryServiceClient {
	return kantahev1connect.NewUserLibraryServiceClient(e.srv.Client(), e.srv.URL)
}

func (a *adminEnv) fav(t *testing.T, token, number string, on bool) error {
	t.Helper()
	_, err := a.libClient().SetFavourite(context.Background(), with(connect.NewRequest(&kantahev1.SetFavouriteRequest{Number: number, Favourite: on}), token))
	return err
}

func (a *adminEnv) createPlaylist(t *testing.T, token, name string, numbers ...string) *kantahev1.Playlist {
	t.Helper()
	res, err := a.libClient().CreatePlaylist(context.Background(), with(connect.NewRequest(&kantahev1.CreatePlaylistRequest{Name: name, Numbers: numbers}), token))
	if err != nil {
		t.Fatalf("CreatePlaylist: %v", err)
	}
	return res.Msg.Playlist
}

func TestFavouritesRoundTripAndFlag(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	n2 := a.seed(t, "Two.kar", "Two", "X", true)
	if err := a.fav(t, a.admin.Token, n1, true); err != nil {
		t.Fatal(err)
	}
	if err := a.fav(t, a.admin.Token, n1, true); err != nil {
		t.Fatalf("idempotent: %v", err)
	}
	cat := a.catalogClient()
	ctx := context.Background()
	flags := func(token string) map[string]bool {
		res, err := cat.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{Sort: kantahev1.SongSort_SONG_SORT_NUMBER}), token))
		if err != nil {
			t.Fatal(err)
		}
		out := map[string]bool{}
		for _, s := range res.Msg.Songs {
			out[s.Number] = s.Favourite
		}
		return out
	}
	if got := flags(a.admin.Token); !got[n1] || got[n2] {
		t.Fatalf("admin sees %v", got)
	}
	if got := flags(a.user.Token); got[n1] || got[n2] {
		t.Fatalf("another user must not see the admin's favourites: %v", got)
	}
	g, _ := cat.GetSong(ctx, with(connect.NewRequest(&kantahev1.GetSongRequest{Number: n1}), a.admin.Token))
	if !g.Msg.Song.Favourite {
		t.Fatal("GetSong")
	}
	pb, err := cat.GetPlayback(ctx, with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: n1}), a.admin.Token))
	if err != nil || !pb.Msg.Playback.Song.Favourite {
		t.Fatalf("GetPlayback: %v", err)
	}
	// the state shows it too
	a.addToQueue(t, a.admin.Token, n1)
	if st := a.state(t, a.admin.Token); !st.Queue[0].Song.Favourite {
		t.Fatal("queue item in the state")
	}
	list, err := a.libClient().ListFavourites(ctx, with(connect.NewRequest(&kantahev1.ListFavouritesRequest{}), a.admin.Token))
	if err != nil || len(list.Msg.Songs) != 1 || list.Msg.Songs[0].Number != n1 || !list.Msg.Songs[0].Favourite {
		t.Fatalf("%v %v", list, err)
	}
	if other, _ := a.libClient().ListFavourites(ctx, with(connect.NewRequest(&kantahev1.ListFavouritesRequest{}), a.user.Token)); len(other.Msg.Songs) != 0 {
		t.Fatalf("other user's list: %v", other.Msg.Songs)
	}
	if err := a.fav(t, a.admin.Token, n1, false); err != nil {
		t.Fatal(err)
	}
	if got := flags(a.admin.Token); got[n1] {
		t.Fatal("still a favourite")
	}
	if err := a.fav(t, a.admin.Token, "99999", true); code(err) != connect.CodeNotFound {
		t.Fatalf("unknown song: %v", err)
	}
	if err := a.fav(t, a.admin.Token, "abc", true); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("not a number: %v", err)
	}
}

func TestFavouritesPaging(t *testing.T) {
	a := newAdminEnv(t)
	for i := 0; i < 5; i++ {
		n := a.seed(t, "S"+string(rune('a'+i))+".kar", "Song"+string(rune('a'+i)), "X", true)
		if err := a.fav(t, a.admin.Token, n, true); err != nil {
			t.Fatal(err)
		}
	}
	token, total, pages := "", 0, 0
	for {
		res, err := a.libClient().ListFavourites(context.Background(), with(connect.NewRequest(&kantahev1.ListFavouritesRequest{PageSize: 2, PageToken: token}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		total += len(res.Msg.Songs)
		pages++
		if res.Msg.NextPageToken == "" {
			break
		}
		token = res.Msg.NextPageToken
	}
	if total != 5 || pages != 3 {
		t.Fatalf("songs %d pages %d", total, pages)
	}
	if _, err := a.libClient().ListFavourites(context.Background(), with(connect.NewRequest(&kantahev1.ListFavouritesRequest{PageToken: "garbage!"}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("%v", err)
	}
}

func TestHistoryOrderAndScoresThroughTheAPI(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	n2 := a.seed(t, "Two.kar", "Two", "X", true)
	n3 := a.seed(t, "Three.kar", "Three", "X", true)
	for _, n := range []string{n1, n2, n3} {
		a.addToQueue(t, a.admin.Token, n)
	}
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	c := a.sessionClient()
	ctx := context.Background()
	if _, err := c.Ended(ctx, with(connect.NewRequest(&kantahev1.EndedRequest{Number: n1}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	a.ms.v.Add(6000)
	a.mounted.session.TickAll(ctx)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_SKIP) // n2 skipped
	off := kantahev1.ScoreMode_SCORE_MODE_OFF
	if _, err := c.UpdateUserSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateUserSettingsRequest{ScoreMode: &off}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Ended(ctx, with(connect.NewRequest(&kantahev1.EndedRequest{Number: n3}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	h, err := a.libClient().ListHistory(ctx, with(connect.NewRequest(&kantahev1.ListHistoryRequest{}), a.admin.Token))
	if err != nil || len(h.Msg.Entries) != 3 {
		t.Fatalf("%v %v", h, err)
	}
	e := h.Msg.Entries
	if e[0].Song.Number != n3 || e[0].Skipped || e[0].HasScore || e[1].Song.Number != n2 || !e[1].Skipped || e[2].Song.Number != n1 || e[2].Skipped || !e[2].HasScore || e[2].Score < 50 {
		t.Fatalf("newest first with the recorded flags: %+v %+v %+v", e[0], e[1], e[2])
	}
	if e[2].SungAtUnix == 0 || e[0].Song.Title != "Three" {
		t.Fatalf("%+v", e[2])
	}
	if other, _ := a.libClient().ListHistory(ctx, with(connect.NewRequest(&kantahev1.ListHistoryRequest{}), a.user.Token)); len(other.Msg.Entries) != 0 {
		t.Fatal("history is per user")
	}
	// page through it
	p1, _ := a.libClient().ListHistory(ctx, with(connect.NewRequest(&kantahev1.ListHistoryRequest{PageSize: 2}), a.admin.Token))
	if len(p1.Msg.Entries) != 2 || p1.Msg.NextPageToken == "" {
		t.Fatalf("%v", p1)
	}
	p2, _ := a.libClient().ListHistory(ctx, with(connect.NewRequest(&kantahev1.ListHistoryRequest{PageSize: 2, PageToken: p1.Msg.NextPageToken}), a.admin.Token))
	if len(p2.Msg.Entries) != 1 || p2.Msg.NextPageToken != "" || p2.Msg.Entries[0].Song.Number != n1 {
		t.Fatalf("%v", p2)
	}
}

func TestHistoryKeepsDeletedTitleThroughTheAPI(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Gone.kar", "Gone Song", "Band", true)
	a.addToQueue(t, a.admin.Token, n)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE)
	a.control(t, a.admin.Token, kantahev1.ControlAction_CONTROL_ACTION_SKIP)
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	h, err := a.libClient().ListHistory(context.Background(), with(connect.NewRequest(&kantahev1.ListHistoryRequest{}), a.admin.Token))
	if err != nil || len(h.Msg.Entries) == 0 || h.Msg.Entries[len(h.Msg.Entries)-1].Song.Title != "Gone Song" {
		t.Fatalf("%v %v", h, err)
	}
}

func TestPlaylistCRUDThroughTheAPI(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	n2 := a.seed(t, "Two.kar", "Two", "X", true)
	n3 := a.seed(t, "Three.kar", "Three", "X", true)
	ctx := context.Background()
	c := a.libClient()
	p := a.createPlaylist(t, a.admin.Token, "Party", n2, n1)
	if p.Name != "Party" || len(p.Songs) != 2 || p.Songs[0].Number != n2 || p.Songs[1].Number != n1 {
		t.Fatalf("%+v", p)
	}
	list, _ := c.ListPlaylists(ctx, with(connect.NewRequest(&kantahev1.ListPlaylistsRequest{}), a.admin.Token))
	if len(list.Msg.Playlists) != 1 || list.Msg.Playlists[0].SongCount != 2 || list.Msg.Playlists[0].Id != p.Id {
		t.Fatalf("%v", list)
	}
	name := "Renamed"
	up, err := c.UpdatePlaylist(ctx, with(connect.NewRequest(&kantahev1.UpdatePlaylistRequest{Id: p.Id, Name: &name, Numbers: []string{n3}}), a.admin.Token))
	if err != nil || up.Msg.Playlist.Name != "Renamed" || len(up.Msg.Playlist.Songs) != 3 || up.Msg.Playlist.Songs[2].Number != n3 {
		t.Fatalf("append: %v %v", up, err)
	}
	up, err = c.UpdatePlaylist(ctx, with(connect.NewRequest(&kantahev1.UpdatePlaylistRequest{Id: p.Id, ReplaceNumbers: true, Numbers: []string{n1}}), a.admin.Token))
	if err != nil || len(up.Msg.Playlist.Songs) != 1 || up.Msg.Playlist.Songs[0].Number != n1 || up.Msg.Playlist.Name != "Renamed" {
		t.Fatalf("replace: %v %v", up, err)
	}
	g, err := c.GetPlaylist(ctx, with(connect.NewRequest(&kantahev1.GetPlaylistRequest{Id: p.Id}), a.admin.Token))
	if err != nil || len(g.Msg.Playlist.Songs) != 1 {
		t.Fatalf("%v %v", g, err)
	}
	if _, err := c.DeletePlaylist(ctx, with(connect.NewRequest(&kantahev1.DeletePlaylistRequest{Id: p.Id}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if _, err := c.GetPlaylist(ctx, with(connect.NewRequest(&kantahev1.GetPlaylistRequest{Id: p.Id}), a.admin.Token)); code(err) != connect.CodeNotFound {
		t.Fatalf("%v", err)
	}
}

func TestPlaylistInvalidNumbersAndLimit(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	ctx := context.Background()
	c := a.libClient()
	_, err := c.CreatePlaylist(ctx, with(connect.NewRequest(&kantahev1.CreatePlaylistRequest{Name: "L", Numbers: []string{n1, "88888", "99999"}}), a.admin.Token))
	var ce *connect.Error
	if code(err) != connect.CodeInvalidArgument || !asConnect(err, &ce) || !strings.Contains(ce.Message(), "88888") || !strings.Contains(ce.Message(), "99999") || strings.Contains(ce.Message(), n1) {
		t.Fatalf("the message names the bad numbers only: %v", err)
	}
	many := make([]string, 1001)
	for i := range many {
		many[i] = n1
	}
	if _, err := c.CreatePlaylist(ctx, with(connect.NewRequest(&kantahev1.CreatePlaylistRequest{Name: "L", Numbers: many}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("limit: %v", err)
	}
	if _, err := c.CreatePlaylist(ctx, with(connect.NewRequest(&kantahev1.CreatePlaylistRequest{Name: ""}), a.admin.Token)); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("empty name: %v", err)
	}
}

func TestPlaylistIsolationThroughTheAPI(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	p := a.createPlaylist(t, a.admin.Token, "Mine", n1)
	ctx := context.Background()
	c := a.libClient()
	name := "Hacked"
	if _, err := c.GetPlaylist(ctx, with(connect.NewRequest(&kantahev1.GetPlaylistRequest{Id: p.Id}), a.user.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("Get: %v", err)
	}
	if _, err := c.UpdatePlaylist(ctx, with(connect.NewRequest(&kantahev1.UpdatePlaylistRequest{Id: p.Id, Name: &name}), a.user.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("Update: %v", err)
	}
	if _, err := c.DeletePlaylist(ctx, with(connect.NewRequest(&kantahev1.DeletePlaylistRequest{Id: p.Id}), a.user.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("Delete: %v", err)
	}
	if _, err := a.sessionClient().AddPlaylistToQueue(ctx, with(connect.NewRequest(&kantahev1.AddPlaylistToQueueRequest{PlaylistId: p.Id}), a.user.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("AddPlaylistToQueue: %v", err)
	}
	if g, err := c.GetPlaylist(ctx, with(connect.NewRequest(&kantahev1.GetPlaylistRequest{Id: p.Id}), a.admin.Token)); err != nil || g.Msg.Playlist.Name != "Mine" {
		t.Errorf("the owner's playlist must be untouched by the other user's update: %v %v", g, err)
	}
	if st := a.state(t, a.user.Token); len(st.Queue) != 0 {
		t.Errorf("nothing was queued for the other user: %v", st.Queue)
	}
	if list, _ := c.ListPlaylists(ctx, with(connect.NewRequest(&kantahev1.ListPlaylistsRequest{}), a.user.Token)); len(list.Msg.Playlists) != 0 {
		t.Errorf("List: %v", list.Msg.Playlists)
	}
}

func TestAddPlaylistToQueue(t *testing.T) {
	a := newAdminEnv(t)
	n1 := a.seed(t, "One.kar", "One", "X", true)
	n2 := a.seed(t, "Two.kar", "Two", "X", true)
	n3 := a.seed(t, "Three.kar", "Three", "X", true)
	p := a.createPlaylist(t, a.admin.Token, "L", n1, n2, n3)
	if _, err := a.adminClient.DeleteSong(context.Background(), with(connect.NewRequest(&kantahev1.DeleteSongRequest{Number: n3}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	w := a.watch(t, a.admin.Token)
	w.next(t, 2*time.Second)
	res, err := a.sessionClient().AddPlaylistToQueue(context.Background(), with(connect.NewRequest(&kantahev1.AddPlaylistToQueueRequest{PlaylistId: p.Id}), a.admin.Token))
	if err != nil || res.Msg.Added != 2 {
		t.Fatalf("%v %v", res, err)
	}
	got := w.next(t, time.Second)
	if len(got.Queue) != 2 || got.Queue[0].Song.Number != n1 || got.Queue[1].Song.Number != n2 {
		t.Fatalf("one push with both songs: %+v", got.Queue)
	}
	w.expectSilence(t, 200*time.Millisecond)
	// an empty playlist adds nothing
	empty := a.createPlaylist(t, a.admin.Token, "Empty")
	res, err = a.sessionClient().AddPlaylistToQueue(context.Background(), with(connect.NewRequest(&kantahev1.AddPlaylistToQueueRequest{PlaylistId: empty.Id}), a.admin.Token))
	if err != nil || res.Msg.Added != 0 {
		t.Fatalf("%v %v", res, err)
	}
	if _, err := a.sessionClient().AddPlaylistToQueue(context.Background(), with(connect.NewRequest(&kantahev1.AddPlaylistToQueueRequest{PlaylistId: "nope"}), a.admin.Token)); code(err) != connect.CodeNotFound {
		t.Fatalf("%v", err)
	}
}

func TestUserLibraryRequiresAuth(t *testing.T) {
	a := newAdminEnv(t)
	c := a.libClient()
	ctx := context.Background()
	if _, err := c.ListFavourites(ctx, connect.NewRequest(&kantahev1.ListFavouritesRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("%v", err)
	}
	if _, err := c.ListPlaylists(ctx, connect.NewRequest(&kantahev1.ListPlaylistsRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("%v", err)
	}
	if _, err := c.ListHistory(ctx, connect.NewRequest(&kantahev1.ListHistoryRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("%v", err)
	}
	if _, err := c.SetFavourite(ctx, connect.NewRequest(&kantahev1.SetFavouriteRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("%v", err)
	}
	if _, err := c.CreatePlaylist(ctx, connect.NewRequest(&kantahev1.CreatePlaylistRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("%v", err)
	}
}

// Regression: song-returning admin and upload RPCs hard-coded favourite=false, so an
// admin's own favourite showed as unfavourited right after editing or re-uploading it.
func TestRegression_FavouriteFlagOnAdminUpdateAndDuplicateUpload(t *testing.T) {
	a := newAdminEnv(t)
	content := testfix.KAR("One", "X", []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}, {Tick: 960, Text: "/Next"}})
	first, err := a.uploadAs(a.admin.Token, "One.kar", content)
	if err != nil {
		t.Fatal(err)
	}
	n := first.Song.Number
	if err := a.fav(t, a.admin.Token, n, true); err != nil {
		t.Fatal(err)
	}
	title := "Edited"
	up, err := a.adminClient.UpdateSong(context.Background(), with(connect.NewRequest(&kantahev1.UpdateSongRequest{Number: n, Title: &title}), a.admin.Token))
	if err != nil || !up.Msg.Song.Favourite {
		t.Fatalf("UpdateSong must carry the caller's flag: %v %v", up, err)
	}
	dup, err := a.uploadAs(a.admin.Token, "One-again.kar", content)
	if err != nil || dup.Status != kantahev1.UploadStatus_UPLOAD_STATUS_DUPLICATE || !dup.Song.Favourite {
		t.Fatalf("duplicate upload must carry the caller's flag: %v %v", dup, err)
	}
}
