package api

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/testfix"
	"github.com/andrewloable/kantahe/server/internal/video"
)

// addVideo stores a background video: its file and its row.
func (a *adminEnv) addVideo(t *testing.T, name string, seed byte) video.Video {
	t.Helper()
	return a.addVideoInfo(t, name, seed, video.Info{Codec: "avc1", Width: 1920, Height: 1080, DurationMs: 1000, FastStart: true})
}

// addVideoInfo is addVideo with the facts about the file chosen by the caller.
func (a *adminEnv) addVideoInfo(t *testing.T, name string, seed byte, info video.Info) video.Video {
	t.Helper()
	content := append(testfix.MP4(testfix.MP4Options{MoovFirst: true}), seed, seed, seed)
	hash := sum(content)
	file := video.Path(a.dataDir, hash)
	if err := os.MkdirAll(filepath.Dir(file), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, content, 0o640); err != nil {
		t.Fatal(err)
	}
	v, err := video.New(a.db).Add(context.Background(), video.NewVideo{SHA256: hash, Size: int64(len(content)), Name: name, OriginalName: name + ".mp4", Info: info})
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func (a *adminEnv) background(token string) (*kantahev1.GetBackgroundResponse, error) {
	res, err := a.catalogClient().GetBackground(context.Background(), with(connect.NewRequest(&kantahev1.GetBackgroundRequest{}), token))
	if err != nil {
		return nil, err
	}
	return res.Msg, nil
}

func TestGetBackgroundReturnsTheEnabledVideosInLoopOrderWithWorkingURLs(t *testing.T) {
	a := newAdminEnv(t)
	v1, v2, v3 := a.addVideo(t, "One", 1), a.addVideo(t, "Two", 2), a.addVideo(t, "Three", 3)
	store := video.New(a.db)
	if _, err := store.SetEnabled(context.Background(), v2.ID, false); err != nil {
		t.Fatal(err)
	}
	// a regular user may call it
	res, err := a.background(a.user.Token)
	if err != nil || !res.Enabled || res.Shuffle || len(res.Videos) != 2 {
		t.Fatalf("%+v %v", res, err)
	}
	if res.Videos[0].Id != v1.ID || res.Videos[1].Id != v3.ID || res.Videos[0].Position != 1 || res.Videos[1].Position != 3 {
		t.Fatalf("videos = %v %v", res.Videos[0], res.Videos[1])
	}
	first := res.Videos[0]
	if first.Name != "One" || first.Width != 1920 || first.Height != 1080 || first.Codec != "avc1" || !first.Faststart || !first.Enabled || first.Url == "" {
		t.Fatalf("fields = %+v", first)
	}
	for _, v := range res.Videos {
		uid, ok := a.mounted.media.Verify(httptest.NewRequest("GET", v.Url, nil))
		if !ok || uid != a.user.User.Id {
			t.Fatalf("the URL of %s does not verify for the caller: %q %v", v.Id, uid, ok)
		}
	}
	// the URL works through the real mux, with Range
	get := func(url string, rng string) (int, []byte) {
		req, _ := http.NewRequest("GET", a.srv.URL+url, nil)
		if rng != "" {
			req.Header.Set("Range", rng)
		}
		r, err := a.srv.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer r.Body.Close()
		b, _ := io.ReadAll(r.Body)
		return r.StatusCode, b
	}
	if code, b := get(first.Url, ""); code != 200 || int64(len(b)) != first.SizeBytes {
		t.Fatalf("GET: %d, %d bytes", code, len(b))
	}
	if code, b := get(first.Url, "bytes=0-7"); code != 206 || len(b) != 8 {
		t.Fatalf("Range: %d, %d bytes", code, len(b))
	}
	// the URLs do not change between two calls, so a browser keeps the files it has
	again, _ := a.background(a.user.Token)
	if again.Videos[0].Url != first.Url || again.Videos[1].Url != res.Videos[1].Url {
		t.Fatal("the URLs changed between two calls")
	}
	// another user gets other URLs
	if other, _ := a.background(a.admin.Token); other.Videos[0].Url == first.Url {
		t.Fatal("two users must not share a URL")
	}
	// the loop order follows Reorder
	if _, err := store.Reorder(context.Background(), []string{v3.ID, v2.ID, v1.ID}); err != nil {
		t.Fatal(err)
	}
	if reordered, _ := a.background(a.user.Token); len(reordered.Videos) != 2 || reordered.Videos[0].Id != v3.ID || reordered.Videos[1].Id != v1.ID {
		t.Fatalf("after reorder: %v", reordered.Videos)
	}
}

func TestGetBackgroundWhenTheAdminSwitchedItOffIsEmpty(t *testing.T) {
	a := newAdminEnv(t)
	a.addVideo(t, "One", 1)
	if _, err := a.db.Exec(`INSERT INTO settings(key, value) VALUES ('background_enabled', '0'), ('background_shuffle', '1')`); err != nil {
		t.Fatal(err)
	}
	res, err := a.background(a.user.Token)
	if err != nil || res.Enabled || len(res.Videos) != 0 {
		t.Fatalf("%+v %v", res, err)
	}
	if _, err := a.db.Exec(`UPDATE settings SET value = '1' WHERE key = 'background_enabled'`); err != nil {
		t.Fatal(err)
	}
	if res, _ := a.background(a.user.Token); !res.Enabled || !res.Shuffle || len(res.Videos) != 1 {
		t.Fatalf("switched on with shuffle: %+v", res)
	}
}

func TestGetBackgroundNeedsASignIn(t *testing.T) {
	a := newAdminEnv(t)
	if _, err := a.background(""); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("no token: %v", err)
	}
	if res, err := a.background(a.user.Token); err != nil || !res.Enabled || len(res.Videos) != 0 {
		t.Fatalf("no videos yet: %+v %v", res, err)
	}
}
