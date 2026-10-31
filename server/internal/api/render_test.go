package api

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
)

// renderEnv is a second copy of the services on the same data, with the render cache limited to limit
// bytes (0 switches rendering off). The admin's device is the caller of every request.
type renderEnv struct {
	*adminEnv
	url  string
	cat  kantahev1connect.CatalogServiceClient
	sess kantahev1connect.SessionServiceClient
}

func newRenderEnv(t *testing.T, limit int64) *renderEnv {
	t.Helper()
	a := newAdminEnv(t)
	a.deps.RenderCacheBytes = limit
	mux := http.NewServeMux()
	mounted, err := mount(mux.Handle, a.deps)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { mounted.Run(ctx); close(done) }()
	srv := httptest.NewServer(mux)
	t.Cleanup(func() { srv.Close(); cancel(); <-done; _ = mounted.Close() })
	return &renderEnv{a, srv.URL, kantahev1connect.NewCatalogServiceClient(srv.Client(), srv.URL), kantahev1connect.NewSessionServiceClient(srv.Client(), srv.URL)}
}

func (r *renderEnv) setMode(t *testing.T, token, deviceID string, mode kantahev1.MidiMode) {
	t.Helper()
	if _, err := r.sess.SetMidiMode(context.Background(), with(connect.NewRequest(&kantahev1.SetMidiModeRequest{DeviceId: deviceID, Mode: mode}), token)); err != nil {
		t.Fatal(err)
	}
}

func (r *renderEnv) playback(t *testing.T, token, number string) *kantahev1.Playback {
	t.Helper()
	res, err := r.cat.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: number}), token))
	if err != nil {
		t.Fatal(err)
	}
	return res.Msg.Playback
}

func (r *renderEnv) get(t *testing.T, rawURL string, headers ...string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest("GET", r.url+rawURL, nil)
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res, b
}

func (r *renderEnv) renderedFiles() []string {
	files, _ := filepath.Glob(filepath.Join(r.dataDir, "cache", "render", "*.flac"))
	return files
}

func waitFor(t *testing.T, what string, ok func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !ok() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestGetPlaybackServerMode(t *testing.T) {
	r := newRenderEnv(t, 1<<30)
	n := r.seed(t, "Song.kar", "Song", "Artist", true)
	r.setMode(t, r.admin.Token, r.admin.DeviceId, kantahev1.MidiMode_MIDI_MODE_SERVER)

	pb := r.playback(t, r.admin.Token, n)
	if pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO || pb.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_SERVER ||
		!strings.HasPrefix(pb.AudioUrl, "/media/rendered/"+n+"?u=") || pb.MidiUrl != "" || pb.SoundfontUrl != "" {
		t.Fatalf("%+v", pb)
	}
	if !pb.Ready && pb.RetryAfterMs != 1000 {
		t.Fatalf("a render that is not ready must say when to ask again: %+v", pb)
	}
	if pb.Lyrics == nil || pb.Lyrics.Source != "kar" {
		t.Errorf("the lyrics stay: %+v", pb.Lyrics)
	}
	waitFor(t, "the render", func() bool { return r.playback(t, r.admin.Token, n).Ready })
	pb = r.playback(t, r.admin.Token, n)
	if pb.RetryAfterMs != 0 {
		t.Errorf("ready but RetryAfterMs = %d", pb.RetryAfterMs)
	}
	res, body := r.get(t, pb.AudioUrl)
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "audio/flac" || !strings.HasPrefix(string(body), "fLaC") {
		t.Fatalf("status %d type %q", res.StatusCode, res.Header.Get("Content-Type"))
	}
	res, body = r.get(t, pb.AudioUrl, "Range", "bytes=0-3")
	if res.StatusCode != http.StatusPartialContent || string(body) != "fLaC" {
		t.Fatalf("range: %d %q", res.StatusCode, body)
	}
	// another user's id on the same signature is refused
	other := strings.Replace(pb.AudioUrl, "u="+r.admin.User.Id, "u="+r.user.User.Id, 1)
	if res, _ := r.get(t, other); res.StatusCode != http.StatusForbidden {
		t.Errorf("another user: %d", res.StatusCode)
	}
}

func TestGetPlaybackNeverServerKindWhenRenderingIsOff(t *testing.T) {
	r := newRenderEnv(t, 0)
	n := r.seed(t, "Song.kar", "Song", "Artist", true)
	r.setMode(t, r.admin.Token, r.admin.DeviceId, kantahev1.MidiMode_MIDI_MODE_SERVER)
	pb := r.playback(t, r.admin.Token, n)
	if pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_MIDI_SYNTH || pb.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || pb.AudioUrl != "" || pb.MidiUrl == "" {
		t.Fatalf("%+v", pb)
	}
	signed := r.mounted.media.Sign("/media/rendered/"+n, r.admin.User.Id, r.clock.now().Add(time.Hour))
	if res, _ := r.get(t, signed); res.StatusCode != http.StatusNotFound {
		t.Errorf("/media/rendered with rendering off: %d, want 404", res.StatusCode)
	}
}

func TestGetPlaybackFallsBackWhenTheRenderFailed(t *testing.T) {
	r := newRenderEnv(t, 1<<30)
	n := r.seed(t, "Song.kar", "Song", "Artist", true)
	// the song's trimmed SoundFont is damaged, so the synth cannot use it (the lyrics still read fine)
	var sha string
	if err := r.db.QueryRow(`SELECT sha256 FROM songs WHERE number = ?`, n).Scan(&sha); err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(r.dataDir, "cache", "sf2")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, sha+"-"+r.mounted.media.Fonts().Tag()+".sf2"), []byte("this is not a SoundFont"), 0o640); err != nil {
		t.Fatal(err)
	}
	r.setMode(t, r.admin.Token, r.admin.DeviceId, kantahev1.MidiMode_MIDI_MODE_SERVER)
	if pb := r.playback(t, r.admin.Token, n); pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO || pb.Ready {
		t.Fatalf("the first answer should be a render that is still going: %+v", pb)
	}
	waitFor(t, "the failure to be noticed", func() bool {
		return r.playback(t, r.admin.Token, n).Kind == kantahev1.PlaybackKind_PLAYBACK_KIND_MIDI_SYNTH
	})
	pb := r.playback(t, r.admin.Token, n)
	if pb.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_LOW_POWER || pb.AudioUrl != "" || pb.MidiUrl == "" || pb.SoundfontUrl == "" {
		t.Fatalf("after a failed render the device plays the MIDI itself: %+v", pb)
	}
}

func TestGetPlaybackOfAnMP3IsUnchangedInServerMode(t *testing.T) {
	r := newRenderEnv(t, 1<<30)
	n := r.seed(t, "Tune.karmp3", "Tune", "Band", false)
	r.setMode(t, r.admin.Token, r.admin.DeviceId, kantahev1.MidiMode_MIDI_MODE_SERVER)
	pb := r.playback(t, r.admin.Token, n)
	if pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO || !strings.HasPrefix(pb.AudioUrl, "/media/song/"+n) || !pb.Ready {
		t.Fatalf("%+v", pb)
	}
}

func (r *renderEnv) play(t *testing.T, token string) {
	t.Helper()
	if _, err := r.sess.Control(context.Background(), with(connect.NewRequest(&kantahev1.ControlRequest{Action: kantahev1.ControlAction_CONTROL_ACTION_PLAY_HERE}), token)); err != nil {
		t.Fatal(err)
	}
}

func TestRenderAheadForAServerPlayer(t *testing.T) {
	r := newRenderEnv(t, 1<<30)
	n := r.seed(t, "Song.kar", "Song", "Artist", true)
	r.setMode(t, r.admin.Token, r.admin.DeviceId, kantahev1.MidiMode_MIDI_MODE_SERVER)
	if _, err := r.sess.AddToQueue(context.Background(), with(connect.NewRequest(&kantahev1.AddToQueueRequest{Number: n}), r.admin.Token)); err != nil {
		t.Fatal(err)
	}
	r.play(t, r.admin.Token) // the song starts: no GetPlayback has asked for it
	waitFor(t, "the render ahead", func() bool { return len(r.renderedFiles()) > 0 })
}

func TestNoRenderAheadForADeviceThatPlaysMIDIItself(t *testing.T) {
	r := newRenderEnv(t, 1<<30)
	n := r.seed(t, "Song.kar", "Song", "Artist", true)
	r.setMode(t, r.admin.Token, r.admin.DeviceId, kantahev1.MidiMode_MIDI_MODE_FULL)
	if _, err := r.sess.AddToQueue(context.Background(), with(connect.NewRequest(&kantahev1.AddToQueueRequest{Number: n}), r.admin.Token)); err != nil {
		t.Fatal(err)
	}
	r.play(t, r.admin.Token)
	time.Sleep(500 * time.Millisecond)
	if files := r.renderedFiles(); len(files) != 0 {
		t.Fatalf("rendered %v for a device that does not use renders", files)
	}
}
