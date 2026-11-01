package video

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/andrewloable/kantahe/server/internal/store"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return New(db)
}

func sha(n int) string { return fmt.Sprintf("%064x", n) }

func add(t *testing.T, s *Store, n int) Video {
	t.Helper()
	v, err := s.Add(context.Background(), NewVideo{SHA256: sha(n), Size: 1000, Name: fmt.Sprintf("Clip %d", n), OriginalName: fmt.Sprintf("clip%d.mp4", n),
		Info: Info{Codec: "avc1", Width: 1920, Height: 1080, DurationMs: 5000, FastStart: true}})
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func ids(vs []Video) []string {
	var out []string
	for _, v := range vs {
		out = append(out, v.ID)
	}
	return out
}

func TestAddNumbersTheVideosFromOneAndRefusesTheSameContentTwice(t *testing.T) {
	s := newStore(t)
	var added []Video
	for i := 1; i <= 3; i++ {
		v := add(t, s, i)
		added = append(added, v)
		if v.Position != i || !v.Enabled || v.CreatedAt == 0 || v.Codec != "avc1" || v.Width != 1920 || !v.FastStart || v.HasAudio {
			t.Fatalf("video %d = %+v", i, v)
		}
		if !regexp.MustCompile(`^v[0-9a-f]{10}$`).MatchString(v.ID) {
			t.Fatalf("id = %q", v.ID)
		}
	}
	_, err := s.Add(context.Background(), NewVideo{SHA256: sha(1), Name: "Again", OriginalName: "again.mp4", Info: Info{Codec: "avc1"}})
	var dup ErrDuplicate
	if !errors.As(err, &dup) || dup.Existing.ID != added[0].ID || dup.Existing.Name != "Clip 1" {
		t.Fatalf("a second add of the same content: %v", err)
	}
	if all, _ := s.List(context.Background()); len(all) != 3 {
		t.Fatalf("%d videos after a duplicate", len(all))
	}
}

func TestAddRefusesABadName(t *testing.T) {
	s := newStore(t)
	for _, name := range []string{"", "   ", strings.Repeat("x", 201)} {
		if _, err := s.Add(context.Background(), NewVideo{SHA256: sha(9), Name: name, Info: Info{Codec: "avc1"}}); !errors.Is(err, ErrInvalidName) {
			t.Errorf("%d characters: %v", len(name), err)
		}
	}
}

func TestListIsInOrderOfPosition(t *testing.T) {
	s := newStore(t)
	a, b, c := add(t, s, 1), add(t, s, 2), add(t, s, 3)
	if _, err := s.Reorder(context.Background(), []string{c.ID, a.ID, b.ID}); err != nil {
		t.Fatal(err)
	}
	got, err := s.List(context.Background())
	if err != nil || fmt.Sprint(ids(got)) != fmt.Sprint([]string{c.ID, a.ID, b.ID}) {
		t.Fatalf("list = %v %v", ids(got), err)
	}
}

func TestReorderFollowsTheNewOrder(t *testing.T) {
	s := newStore(t)
	v := []Video{add(t, s, 1), add(t, s, 2), add(t, s, 3)}
	got, err := s.Reorder(context.Background(), []string{v[2].ID, v[0].ID, v[1].ID})
	if err != nil {
		t.Fatal(err)
	}
	for i, want := range []string{v[2].ID, v[0].ID, v[1].ID} {
		if got[i].ID != want || got[i].Position != i+1 {
			t.Fatalf("slot %d = %+v, want %s at %d", i, got[i], want, i+1)
		}
	}
}

func TestReorderRefusesAnythingButAPermutationAndChangesNothing(t *testing.T) {
	s := newStore(t)
	v := []Video{add(t, s, 1), add(t, s, 2), add(t, s, 3)}
	for name, bad := range map[string][]string{
		"a subset":      {v[2].ID, v[0].ID},
		"an extra id":   {v[0].ID, v[1].ID, v[2].ID, "vffffffffff"},
		"an unknown id": {v[0].ID, v[1].ID, "vffffffffff"},
		"a repeated id": {v[0].ID, v[0].ID, v[1].ID},
		"nothing":       {},
	} {
		if _, err := s.Reorder(context.Background(), bad); !errors.Is(err, ErrNotPermutation) {
			t.Errorf("%s: %v", name, err)
		}
	}
	got, _ := s.List(context.Background())
	if fmt.Sprint(ids(got)) != fmt.Sprint(ids(v)) {
		t.Fatalf("the order changed: %v", ids(got))
	}
}

func TestDeleteReturnsTheHashAndClosesTheGap(t *testing.T) {
	s := newStore(t)
	v := []Video{add(t, s, 1), add(t, s, 2), add(t, s, 3), add(t, s, 4)}
	h, err := s.Delete(context.Background(), v[1].ID)
	if err != nil || h != sha(2) {
		t.Fatalf("delete = %q %v", h, err)
	}
	got, _ := s.List(context.Background())
	if len(got) != 3 {
		t.Fatalf("%d videos", len(got))
	}
	for i, want := range []string{v[0].ID, v[2].ID, v[3].ID} {
		if got[i].ID != want || got[i].Position != i+1 {
			t.Fatalf("slot %d = %+v", i, got[i])
		}
	}
	if _, err := s.Delete(context.Background(), v[1].ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleting again: %v", err)
	}
	// the same content can be uploaded again, at the end
	if again := add(t, s, 2); again.Position != 4 {
		t.Fatalf("re-added at %d", again.Position)
	}
}

func TestRenameTrimsAndRefusesEmptyAndTooLong(t *testing.T) {
	s := newStore(t)
	v := add(t, s, 1)
	got, err := s.Rename(context.Background(), v.ID, "  Beach at night \n")
	if err != nil || got.Name != "Beach at night" {
		t.Fatalf("rename = %+v %v", got, err)
	}
	for _, bad := range []string{"", "  \t ", strings.Repeat("é", 201)} {
		if _, err := s.Rename(context.Background(), v.ID, bad); !errors.Is(err, ErrInvalidName) {
			t.Errorf("%d characters: %v", len([]rune(bad)), err)
		}
	}
	if got, err := s.Rename(context.Background(), v.ID, strings.Repeat("é", 200)); err != nil || len([]rune(got.Name)) != 200 {
		t.Fatalf("200 characters: %v", err)
	}
	if _, err := s.Rename(context.Background(), "vffffffffff", "x"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown id: %v", err)
	}
}

func TestSetEnabled(t *testing.T) {
	s := newStore(t)
	v := add(t, s, 1)
	if got, err := s.SetEnabled(context.Background(), v.ID, false); err != nil || got.Enabled {
		t.Fatalf("off: %+v %v", got, err)
	}
	if got, err := s.SetEnabled(context.Background(), v.ID, true); err != nil || !got.Enabled {
		t.Fatalf("on: %+v %v", got, err)
	}
	if _, err := s.SetEnabled(context.Background(), "vffffffffff", true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown id: %v", err)
	}
}

func TestPathNamesOnlyAFileInTheVideosFolder(t *testing.T) {
	dir := t.TempDir()
	if got, want := Path(dir, sha(7)), filepath.Join(dir, "videos", sha(7)+".mp4"); got != want {
		t.Fatalf("path = %q, want %q", got, want)
	}
	for _, bad := range []string{"", "../../etc/passwd", sha(7)[:63], strings.ToUpper(sha(255)), sha(7) + "/../x"} {
		if got := Path(dir, bad); got != "" {
			t.Errorf("Path(%q) = %q, want empty", bad, got)
		}
	}
}

func TestWarningsAreWidthAndStreamingButNotSound(t *testing.T) {
	if w := Warnings(Video{Width: 1920, FastStart: true, HasAudio: true}); len(w) != 0 {
		t.Fatalf("a good video with sound has warnings: %v", w)
	}
	w := Warnings(Video{Width: 3840, FastStart: false})
	if len(w) != 2 || !strings.Contains(w[0], "wider than 1920 px") || !strings.Contains(w[1], "moov after mdat") {
		t.Fatalf("warnings = %v", w)
	}
}

func TestConcurrentAddReorderAndDeleteKeepThePositionsFromOneToN(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	var first []Video
	for i := 1; i <= 8; i++ {
		first = append(first, add(t, s, i))
	}
	check := func(phase string, want int) {
		t.Helper()
		got, err := s.List(ctx)
		if err != nil || len(got) != want {
			t.Fatalf("%s: %d videos, want %d (%v)", phase, len(got), want, err)
		}
		for i, v := range got {
			if v.Position != i+1 {
				t.Fatalf("%s: slot %d has position %d", phase, i, v.Position)
			}
		}
	}
	var wg sync.WaitGroup
	// phase A: adds and reorders at the same time; a reorder whose list is out of date is refused, never applied half
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			_, _ = s.Add(ctx, NewVideo{SHA256: sha(100 + n), Name: "new", Info: Info{Codec: "avc1"}})
		}(i)
	}
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cur, _ := s.List(ctx)
			order := ids(cur)
			rand.Shuffle(len(order), func(a, b int) { order[a], order[b] = order[b], order[a] })
			_, _ = s.Reorder(ctx, order)
		}()
	}
	wg.Wait()
	check("after adds and reorders", 12)
	// phase B: deletes (of the first four) and adds at the same time
	for _, v := range first[:4] {
		wg.Add(1)
		go func(id string) { defer wg.Done(); _, _ = s.Delete(ctx, id) }(v.ID)
	}
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			_, _ = s.Add(ctx, NewVideo{SHA256: sha(200 + n), Name: "later", Info: Info{Codec: "avc1"}})
		}(i)
	}
	wg.Wait()
	check("after deletes and adds", 10)
}

func TestUpdateChangesNameAndFlagInOneStepOrNotAtAll(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	v := add(t, s, 1)
	name, off := "  New  ", false
	got, err := s.Update(ctx, v.ID, &name, &off)
	if err != nil || got.Name != "New" || got.Enabled {
		t.Fatalf("both: %+v %v", got, err)
	}
	if got, err := s.Update(ctx, v.ID, nil, nil); err != nil || got.Name != "New" || got.Enabled {
		t.Fatalf("nothing: %+v %v", got, err)
	}
	on, empty := true, "  "
	if _, err := s.Update(ctx, v.ID, &empty, &on); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("empty name: %v", err)
	}
	if got, _ := s.Get(ctx, v.ID); got.Enabled || got.Name != "New" {
		t.Fatalf("a refused update changed the video: %+v", got)
	}
	if _, err := s.Update(ctx, "vffffffffff", &name, nil); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown id: %v", err)
	}
}

func TestDeleteWithFileRollsBackWhenTheFileCannotGo(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	a, b := add(t, s, 1), add(t, s, 2)
	var seen string
	boom := errors.New("permission denied")
	err := s.DeleteWithFile(ctx, a.ID, func(sha string) error { seen = sha; return boom })
	var re *RemoveError
	if !errors.As(err, &re) || !errors.Is(err, boom) || seen != sha(1) {
		t.Fatalf("err = %v, saw %q", err, seen)
	}
	if all, _ := s.List(ctx); len(all) != 2 || all[0].ID != a.ID || all[0].Position != 1 || all[1].Position != 2 {
		t.Fatalf("the failed delete changed something: %+v", all)
	}
	if err := s.DeleteWithFile(ctx, a.ID, func(string) error { return nil }); err != nil {
		t.Fatal(err)
	}
	if all, _ := s.List(ctx); len(all) != 1 || all[0].ID != b.ID || all[0].Position != 1 {
		t.Fatalf("after the delete: %+v", all)
	}
	if err := s.DeleteWithFile(ctx, a.ID, func(string) error { t.Error("the file of an unknown video was asked for"); return nil }); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown id: %v", err)
	}
}
