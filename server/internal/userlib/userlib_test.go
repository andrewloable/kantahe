package userlib

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/library"
	"github.com/andrewloable/kantahe/server/internal/store"
)

type env struct {
	db *store.DB
	l  *Library
}

func newEnv(t *testing.T) *env {
	t.Helper()
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	for _, u := range []string{"ua", "ub"} {
		if _, err := db.Exec(`INSERT INTO users(id, email, display_name, password_hash, created_at) VALUES (?, ?, 'U', 'h', 1)`, u, u+"@x.y"); err != nil {
			t.Fatal(err)
		}
	}
	return &env{db, New(db, func() int64 { return 1000 })}
}

func (e *env) song(t *testing.T, n string, state string) {
	t.Helper()
	failed, deleted, done := 0, 0, 1
	switch state {
	case "failed":
		failed = 1
	case "deleted":
		deleted = 1
	case "pending":
		done = 0
	}
	if _, err := e.db.Exec(`INSERT INTO songs(number, format, source, path, sha256, size, mtime, original_name, display_title, display_artist, failed, deleted, metadata_done, created_at)
		VALUES (?, 2, 1, ?, ?, 1, 1, 'x', ?, 'Artist', ?, ?, ?, 1)`, n, "/p/"+n, "sha"+n, "Title "+n, failed, deleted, done); err != nil {
		t.Fatal(err)
	}
}

func numbers(songs []library.SongInfo) []string {
	var out []string
	for _, s := range songs {
		out = append(out, s.Number)
	}
	return out
}

func TestFavouritesRoundTrip(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	e.song(t, "00001", "ok")
	e.song(t, "00002", "ok")
	e.song(t, "00003", "failed")
	e.song(t, "00004", "deleted")
	for _, n := range []string{"00001", "00002"} {
		if err := e.l.SetFavourite(ctx, "ua", n, true); err != nil {
			t.Fatal(err)
		}
	}
	e.l.now = func() int64 { return 2000 }
	if err := e.l.SetFavourite(ctx, "ua", "00002", true); err != nil { // idempotent, keeps the original time
		t.Fatal(err)
	}
	if err := e.l.SetFavourite(ctx, "ub", "00001", true); err != nil {
		t.Fatal(err)
	}
	got, more, err := e.l.ListFavourites(ctx, "ua", 0, 50)
	if err != nil || more || !reflect.DeepEqual(numbers(got), []string{"00002", "00001"}) {
		t.Fatalf("%v %v %v: newest first, ties by insertion", numbers(got), more, err)
	}
	set, err := e.l.FavouriteSet(ctx, "ua", []string{"00001", "00002", "00009"})
	if err != nil || !set["00001"] || !set["00002"] || set["00009"] {
		t.Fatalf("%v %v", set, err)
	}
	if set, _ := e.l.FavouriteSet(ctx, "ub", []string{"00001", "00002"}); !set["00001"] || set["00002"] {
		t.Fatalf("favourites belong to the user: %v", set)
	}
	if err := e.l.SetFavourite(ctx, "ua", "00001", false); err != nil {
		t.Fatal(err)
	}
	if err := e.l.SetFavourite(ctx, "ua", "00001", false); err != nil { // idempotent
		t.Fatal(err)
	}
	if got, _, _ = e.l.ListFavourites(ctx, "ua", 0, 50); !reflect.DeepEqual(numbers(got), []string{"00002"}) {
		t.Fatalf("%v", numbers(got))
	}
	// unknown, failed, deleted and pending songs cannot be favourited
	e.song(t, "00005", "pending")
	for _, n := range []string{"99999", "00003", "00004", "00005"} {
		if err := e.l.SetFavourite(ctx, "ua", n, true); !errors.Is(err, library.ErrNotFound) {
			t.Errorf("%s: %v", n, err)
		}
	}
	// removing the favourite of a song that vanished still works
	_ = e.l.SetFavourite(ctx, "ub", "00001", true)
	_, _ = e.db.Exec(`UPDATE songs SET deleted = 1 WHERE number = '00001'`)
	if err := e.l.SetFavourite(ctx, "ub", "00001", false); err != nil {
		t.Fatalf("un-favouriting a deleted song: %v", err)
	}
	// favourites of deleted songs are hidden, not lost
	_ = e.l.SetFavourite(ctx, "ua", "00002", true)
	_, _ = e.db.Exec(`UPDATE songs SET deleted = 1 WHERE number = '00002'`)
	if got, _, _ = e.l.ListFavourites(ctx, "ua", 0, 50); len(got) != 0 {
		t.Fatalf("%v", numbers(got))
	}
}

func TestFavouritePaging(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	for i := 1; i <= 7; i++ {
		n := fmt.Sprintf("%05d", i)
		e.song(t, n, "ok")
		if err := e.l.SetFavourite(ctx, "ua", n, true); err != nil {
			t.Fatal(err)
		}
	}
	page1, more, _ := e.l.ListFavourites(ctx, "ua", 0, 3)
	page2, more2, _ := e.l.ListFavourites(ctx, "ua", 3, 3)
	page3, more3, _ := e.l.ListFavourites(ctx, "ua", 6, 3)
	if !more || !more2 || more3 || len(page1) != 3 || len(page2) != 3 || len(page3) != 1 || page1[0].Number != "00007" || page3[0].Number != "00001" {
		t.Fatalf("%v %v %v / %v %v %v", numbers(page1), numbers(page2), numbers(page3), more, more2, more3)
	}
}

func TestHistoryOrderAndScores(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	e.song(t, "00001", "ok")
	e.song(t, "00002", "ok")
	ins := `INSERT INTO history(user_id, number, sung_at, skipped, has_score, score) VALUES (?, ?, ?, ?, ?, ?)`
	for _, row := range [][]any{{"ua", "00001", 100, 0, 1, 88}, {"ua", "00002", 200, 1, 0, 0}, {"ua", "00001", 300, 0, 0, 0}, {"ub", "00002", 400, 0, 1, 70}} {
		if _, err := e.db.Exec(ins, row...); err != nil {
			t.Fatal(err)
		}
	}
	h, more, err := e.l.ListHistory(ctx, "ua", 0, 50)
	if err != nil || more || len(h) != 3 {
		t.Fatalf("%v %v %v", h, more, err)
	}
	want := []HistoryItem{
		{SungAt: 300, Skipped: false, HasScore: false}, {SungAt: 200, Skipped: true, HasScore: false}, {SungAt: 100, Skipped: false, HasScore: true, Score: 88},
	}
	for i, w := range want {
		if h[i].SungAt != w.SungAt || h[i].Skipped != w.Skipped || h[i].HasScore != w.HasScore || h[i].Score != w.Score {
			t.Errorf("entry %d: %+v, want %+v", i, h[i], w)
		}
	}
	if h[0].Song.Number != "00001" || h[0].Song.Title != "Title 00001" {
		t.Fatalf("%+v", h[0].Song)
	}
	if hb, _, _ := e.l.ListHistory(ctx, "ub", 0, 50); len(hb) != 1 || hb[0].Score != 70 {
		t.Fatalf("history is per user: %+v", hb)
	}
}

func TestHistoryKeepsDeletedTitle(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	e.song(t, "00001", "deleted")
	_, _ = e.db.Exec(`INSERT INTO history(user_id, number, sung_at, skipped, has_score, score) VALUES ('ua', '00001', 1, 0, 0, 0)`)
	_, _ = e.db.Exec(`INSERT INTO history(user_id, number, sung_at, skipped, has_score, score) VALUES ('ua', '00077', 2, 0, 0, 0)`) // row gone completely
	h, _, err := e.l.ListHistory(ctx, "ua", 0, 50)
	if err != nil || len(h) != 2 {
		t.Fatalf("%v %v", h, err)
	}
	if h[1].Song.Number != "00001" || h[1].Song.Title != "Title 00001" || h[1].Song.Artist != "Artist" {
		t.Fatalf("a deleted song still shows its last title: %+v", h[1].Song)
	}
	if h[0].Song.Number != "00077" || h[0].Song.Title != "" {
		t.Fatalf("a song without a row is shown by number: %+v", h[0].Song)
	}
}

func TestPlaylistCRUD(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	for _, n := range []string{"00001", "00002", "00003"} {
		e.song(t, n, "ok")
	}
	p, err := e.l.CreatePlaylist(ctx, "ua", "  Party ", []string{"3", "00001", "00003"})
	if err != nil || p.Name != "Party" || p.ID == "" {
		t.Fatalf("%+v %v", p, err)
	}
	got, err := e.l.GetPlaylist(ctx, "ua", p.ID)
	if err != nil || !reflect.DeepEqual(numbers(got.Songs), []string{"00003", "00001", "00003"}) {
		t.Fatalf("order and duplicates are kept: %v %v", numbers(got.Songs), err)
	}
	if _, err := e.l.CreatePlaylist(ctx, "ua", "Empty", nil); err != nil {
		t.Fatal(err)
	}
	list, err := e.l.ListPlaylists(ctx, "ua")
	if err != nil || len(list) != 2 || list[0].Name != "Party" || list[0].Count != 3 || list[1].Name != "Empty" || list[1].Count != 0 {
		t.Fatalf("%+v %v", list, err)
	}
	name := "Renamed"
	if _, err := e.l.UpdatePlaylist(ctx, "ua", p.ID, &name, false, nil); err != nil {
		t.Fatal(err)
	}
	got, _ = e.l.GetPlaylist(ctx, "ua", p.ID)
	if got.Name != "Renamed" || len(got.Songs) != 3 {
		t.Fatalf("a rename keeps the songs: %+v", got)
	}
	if err := e.l.DeletePlaylist(ctx, "ua", p.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.l.GetPlaylist(ctx, "ua", p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
	if err := e.l.DeletePlaylist(ctx, "ua", p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("%v", err)
	}
	var left int
	_ = e.db.QueryRow(`SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?`, p.ID).Scan(&left)
	if left != 0 {
		t.Fatalf("songs of a deleted playlist must cascade, %d left", left)
	}
}

func TestPlaylistAppendVsReplace(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	for _, n := range []string{"00001", "00002", "00003", "00004"} {
		e.song(t, n, "ok")
	}
	p, _ := e.l.CreatePlaylist(ctx, "ua", "L", []string{"00001", "00002"})
	got, err := e.l.UpdatePlaylist(ctx, "ua", p.ID, nil, false, []string{"00003", "00004"})
	if err != nil || !reflect.DeepEqual(numbers(got.Songs), []string{"00001", "00002", "00003", "00004"}) {
		t.Fatalf("append: %v %v", numbers(got.Songs), err)
	}
	got, err = e.l.UpdatePlaylist(ctx, "ua", p.ID, nil, true, []string{"00004", "00001"})
	if err != nil || !reflect.DeepEqual(numbers(got.Songs), []string{"00004", "00001"}) {
		t.Fatalf("replace: %v %v", numbers(got.Songs), err)
	}
	got, _ = e.l.UpdatePlaylist(ctx, "ua", p.ID, nil, true, nil)
	if len(got.Songs) != 0 {
		t.Fatalf("replace with nothing empties the list: %v", numbers(got.Songs))
	}
	got, _ = e.l.UpdatePlaylist(ctx, "ua", p.ID, nil, false, nil)
	if len(got.Songs) != 0 {
		t.Fatal("append nothing changes nothing")
	}
}

func TestPlaylistInvalidNumbers(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	e.song(t, "00001", "ok")
	e.song(t, "00002", "failed")
	e.song(t, "00003", "deleted")
	_, err := e.l.CreatePlaylist(ctx, "ua", "L", []string{"00001", "00002", "99999", "00003"})
	var inv *InvalidError
	if !errors.As(err, &inv) || !errors.Is(err, ErrInvalid) {
		t.Fatalf("err = %v", err)
	}
	for _, n := range []string{"00002", "99999", "00003"} {
		if !strings.Contains(err.Error(), n) {
			t.Errorf("the message must name %s: %v", n, err)
		}
	}
	if strings.Contains(err.Error(), "00001") {
		t.Errorf("the valid number must not be named: %v", err)
	}
	if list, _ := e.l.ListPlaylists(ctx, "ua"); len(list) != 0 {
		t.Fatalf("nothing is created when a number is bad: %+v", list)
	}
	if _, err := e.l.CreatePlaylist(ctx, "ua", "L", []string{"abc"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("%v", err)
	}
	for _, name := range []string{"", "   ", strings.Repeat("x", 101)} {
		if _, err := e.l.CreatePlaylist(ctx, "ua", name, nil); !errors.Is(err, ErrInvalid) {
			t.Errorf("name %q: %v", name, err)
		}
	}
	p, _ := e.l.CreatePlaylist(ctx, "ua", "L", []string{"00001"})
	if _, err := e.l.UpdatePlaylist(ctx, "ua", p.ID, nil, false, []string{"99999"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("append of an unknown song: %v", err)
	}
	empty := " "
	if _, err := e.l.UpdatePlaylist(ctx, "ua", p.ID, &empty, false, nil); !errors.Is(err, ErrInvalid) {
		t.Fatalf("blank rename: %v", err)
	}
	if got, _ := e.l.GetPlaylist(ctx, "ua", p.ID); len(got.Songs) != 1 || got.Name != "L" {
		t.Fatalf("a failed update changes nothing: %+v", got)
	}
}

func TestPlaylistLimit1000(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	e.song(t, "00001", "ok")
	thousand := make([]string, 1000)
	for i := range thousand {
		thousand[i] = "00001"
	}
	p, err := e.l.CreatePlaylist(ctx, "ua", "Big", thousand)
	if err != nil {
		t.Fatalf("1000 songs are allowed: %v", err)
	}
	if _, err := e.l.UpdatePlaylist(ctx, "ua", p.ID, nil, false, []string{"00001"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("the 1001st song: %v", err)
	}
	if _, err := e.l.CreatePlaylist(ctx, "ua", "Bigger", append(thousand, "00001")); !errors.Is(err, ErrInvalid) {
		t.Fatalf("1001 at creation: %v", err)
	}
	if _, err := e.l.UpdatePlaylist(ctx, "ua", p.ID, nil, true, append(thousand, "00001")); !errors.Is(err, ErrInvalid) {
		t.Fatalf("replace with 1001: %v", err)
	}
	if got, _ := e.l.GetPlaylist(ctx, "ua", p.ID); len(got.Songs) != 1000 {
		t.Fatalf("%d", len(got.Songs))
	}
}

func TestPlaylistIsolation(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	e.song(t, "00001", "ok")
	p, _ := e.l.CreatePlaylist(ctx, "ua", "Mine", []string{"00001"})
	name := "Hacked"
	if _, err := e.l.GetPlaylist(ctx, "ub", p.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("Get: %v", err)
	}
	if _, err := e.l.UpdatePlaylist(ctx, "ub", p.ID, &name, true, nil); !errors.Is(err, ErrNotFound) {
		t.Errorf("Update: %v", err)
	}
	if err := e.l.DeletePlaylist(ctx, "ub", p.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("Delete: %v", err)
	}
	if _, err := e.l.PlayableSongs(ctx, "ub", p.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("PlayableSongs: %v", err)
	}
	if list, _ := e.l.ListPlaylists(ctx, "ub"); len(list) != 0 {
		t.Errorf("List: %+v", list)
	}
	if got, _ := e.l.GetPlaylist(ctx, "ua", p.ID); got.Name != "Mine" || len(got.Songs) != 1 {
		t.Errorf("the owner's playlist is untouched: %+v", got)
	}
}

func TestPlayableSongsSkipUnplayable(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	for _, n := range []string{"00001", "00002", "00003"} {
		e.song(t, n, "ok")
	}
	p, _ := e.l.CreatePlaylist(ctx, "ua", "L", []string{"00001", "00002", "00003"})
	_, _ = e.db.Exec(`UPDATE songs SET deleted = 1 WHERE number = '00003'`)
	_, _ = e.db.Exec(`UPDATE songs SET failed = 1 WHERE number = '00002'`)
	songs, err := e.l.PlayableSongs(ctx, "ua", p.ID)
	if err != nil || !reflect.DeepEqual(numbers(songs), []string{"00001"}) {
		t.Fatalf("%v %v", numbers(songs), err)
	}
	if list, _ := e.l.ListPlaylists(ctx, "ua"); list[0].Count != 1 {
		t.Fatalf("the count covers playable songs only: %+v", list)
	}
	if got, _ := e.l.GetPlaylist(ctx, "ua", p.ID); len(got.Songs) != 1 {
		t.Fatalf("%v", numbers(got.Songs))
	}
}
