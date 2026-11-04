package api

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/gen/kantahe/v1/kantahev1connect"
	"github.com/andrewloable/kantahe/server/internal/auth"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

func (e *testEnv) catalogClient() kantahev1connect.CatalogServiceClient {
	return kantahev1connect.NewCatalogServiceClient(e.srv.Client(), e.srv.URL)
}

// seed uploads real songs through the API so that the whole pipeline is exercised.
func (a *adminEnv) seed(t *testing.T, name, title, artist string, midi bool) string {
	t.Helper()
	var res *kantahev1.UploadSongResponse
	var err error
	if midi {
		res, err = a.uploadAs(a.admin.Token, name, testfix.KAR(title, artist, []testfix.Syllable{{Tick: 0, Text: "/Hel"}, {Tick: 240, Text: "lo "}, {Tick: 960, Text: "/Next"}}))
	} else {
		res, err = a.uploadAs(a.admin.Token, name, testfix.KARMP3("x", testfix.MP3Frames(200+len(title)), "[00:01.00]<00:01.00>He<00:01.50>llo\n[00:05.00]Next", "Title : "+title+"\nArtist : "+artist))
	}
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("seed %s: %+v %v", name, res, err)
	}
	return res.Song.Number
}

func TestCatalogRequiresAuth(t *testing.T) {
	a := newAdminEnv(t)
	c := a.catalogClient()
	ctx := context.Background()
	if _, err := c.SearchSongs(ctx, connect.NewRequest(&kantahev1.SearchSongsRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("SearchSongs: %v", err)
	}
	if _, err := c.GetSong(ctx, connect.NewRequest(&kantahev1.GetSongRequest{Number: "1"})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("GetSong: %v", err)
	}
	if _, err := c.GetLyrics(ctx, connect.NewRequest(&kantahev1.GetLyricsRequest{Number: "1"})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("GetLyrics: %v", err)
	}
	if _, err := c.ListArtists(ctx, connect.NewRequest(&kantahev1.ListArtistsRequest{})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("ListArtists: %v", err)
	}
	// any signed-in user (not only uploaders or admins) may read the catalog
	if _, err := c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{}), a.user.Token)); err != nil {
		t.Errorf("plain user: %v", err)
	}
}

func TestCatalogEndToEnd(t *testing.T) {
	a := newAdminEnv(t)
	// uploads are numbered one at a time, so the MP3 must come first to keep the songbook number
	n2 := a.seed(t, "00100 - Daryl - Heto Naman Ako.karmp3", "Heto Naman Ako", "Daryl", false)
	n1 := a.seed(t, "00100 - Daryl - Heto Naman Ako.kar", "Heto Naman Ako", "Daryl", true)
	a.seed(t, "Other.kar", "Another Song", "Someone", true)
	c := a.catalogClient()
	ctx := context.Background()
	if n2 != "00100" || n1 == n2 {
		t.Fatalf("the MP3 keeps the songbook number, the MIDI is renumbered: mp3 %s midi %s", n2, n1)
	}
	res, err := c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{Query: "heto nam"}), a.user.Token))
	if err != nil || len(res.Msg.Songs) != 2 {
		t.Fatalf("both formats are listed as separate songs: %v %v", res, err)
	}
	formats := map[kantahev1.Format]bool{}
	for _, s := range res.Msg.Songs {
		formats[s.Format] = true
		if s.Title != "Heto Naman Ako" || s.Artist != "Daryl" || s.Favourite || s.Failed {
			t.Errorf("%+v", s)
		}
	}
	if !formats[kantahev1.Format_FORMAT_MP3] || !formats[kantahev1.Format_FORMAT_MIDI] {
		t.Fatalf("formats %v", formats)
	}
	res, _ = c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{Query: "heto", Format: kantahev1.Format_FORMAT_MIDI}), a.user.Token))
	if len(res.Msg.Songs) != 1 || res.Msg.Songs[0].Number != n1 {
		t.Fatalf("%v", res)
	}
	res, _ = c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{Query: "100"}), a.user.Token))
	if len(res.Msg.Songs) != 1 || res.Msg.Songs[0].Number != "00100" {
		t.Fatalf("number prefix: %v", res)
	}
	arts, err := c.ListArtists(ctx, with(connect.NewRequest(&kantahev1.ListArtistsRequest{}), a.user.Token))
	if err != nil || len(arts.Msg.Artists) != 2 || arts.Msg.Artists[0].Name != "Daryl" || arts.Msg.Artists[0].SongCount != 2 {
		t.Fatalf("%v %v", arts, err)
	}
	g, err := c.GetSong(ctx, with(connect.NewRequest(&kantahev1.GetSongRequest{Number: "100"}), a.user.Token))
	if err != nil || g.Msg.Song.Number != "00100" || g.Msg.Song.Format != kantahev1.Format_FORMAT_MP3 {
		t.Fatalf("%v %v", g, err)
	}
	l, err := c.GetLyrics(ctx, with(connect.NewRequest(&kantahev1.GetLyricsRequest{Number: n1}), a.user.Token))
	if err != nil || l.Msg.Lyrics.Source != "kar" || len(l.Msg.Lyrics.Lines) != 2 {
		t.Fatalf("%v %v", l, err)
	}
	l, err = c.GetLyrics(ctx, with(connect.NewRequest(&kantahev1.GetLyricsRequest{Number: "00100"}), a.user.Token))
	if err != nil || l.Msg.Lyrics.Source != "lrc" || l.Msg.Lyrics.Lines[0].Words[1].StartMs != 1500 {
		t.Fatalf("%v %v", l, err)
	}
}

func TestCatalogErrors(t *testing.T) {
	a := newAdminEnv(t)
	c := a.catalogClient()
	ctx := context.Background()
	tok := a.user.Token
	check := func(name string, err error, want connect.Code) {
		t.Helper()
		if code(err) != want {
			t.Errorf("%s: err = %v, want %v", name, err, want)
		}
	}
	_, err := c.GetSong(ctx, with(connect.NewRequest(&kantahev1.GetSongRequest{Number: "99999"}), tok))
	check("missing song", err, connect.CodeNotFound)
	_, err = c.GetSong(ctx, with(connect.NewRequest(&kantahev1.GetSongRequest{Number: "abc"}), tok))
	check("not a number", err, connect.CodeInvalidArgument)
	_, err = c.GetLyrics(ctx, with(connect.NewRequest(&kantahev1.GetLyricsRequest{Number: "99999"}), tok))
	check("lyrics of a missing song", err, connect.CodeNotFound)
	_, err = c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{PageToken: "garbage!"}), tok))
	check("bad token", err, connect.CodeInvalidArgument)
	_, err = c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{Letter: "AB"}), tok))
	check("bad letter", err, connect.CodeInvalidArgument)
	_, err = c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{Sort: kantahev1.SongSort(77)}), tok))
	check("bad sort", err, connect.CodeInvalidArgument)
	_, err = c.SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{Format: kantahev1.Format(9)}), tok))
	check("bad format", err, connect.CodeInvalidArgument)
	_, err = c.ListArtists(ctx, with(connect.NewRequest(&kantahev1.ListArtistsRequest{Letter: "9"}), tok))
	check("bad artist letter", err, connect.CodeInvalidArgument)
	_, err = c.ListArtists(ctx, with(connect.NewRequest(&kantahev1.ListArtistsRequest{PageToken: "x"}), tok))
	check("bad artist token", err, connect.CodeInvalidArgument)
}

func TestCatalogNoLyricsAndMissingFile(t *testing.T) {
	a := newAdminEnv(t)
	c := a.catalogClient()
	ctx := context.Background()
	bare := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.NoteOn(0, 60, 90)}}}}}.Bytes()
	res, err := a.uploadAs(a.admin.Token, "bare.kar", bare)
	if err != nil {
		t.Fatal(err)
	}
	_, err = c.GetLyrics(ctx, with(connect.NewRequest(&kantahev1.GetLyricsRequest{Number: res.Song.Number}), a.user.Token))
	if code(err) != connect.CodeNotFound {
		t.Fatalf("no lyrics: %v", err)
	}
	// the stored file disappears: an internal error that does not leak the path
	good := a.seed(t, "good.kar", "Good", "X", true)
	var p string
	_ = a.db.QueryRow(`SELECT path FROM songs WHERE number=?`, good).Scan(&p)
	// a different sha so that the lyrics cache does not answer
	_, _ = a.db.Exec(`UPDATE songs SET sha256 = 'forced-miss' WHERE number = ?`, good)
	_ = os.Remove(p)
	_, err = c.GetLyrics(ctx, with(connect.NewRequest(&kantahev1.GetLyricsRequest{Number: good}), a.user.Token))
	var ce *connect.Error
	if code(err) != connect.CodeInternal || !asConnect(err, &ce) || ce.Message() != "internal error" {
		t.Fatalf("err = %v", err)
	}
}

func TestCatalogPagingThroughTheAPI(t *testing.T) {
	a := newAdminEnv(t)
	for i := 0; i < 7; i++ {
		a.seed(t, fmt.Sprintf("Song %d.kar", i), fmt.Sprintf("Paged %d", i), "P", true)
	}
	c := a.catalogClient()
	var got int
	token := ""
	pages := 0
	for {
		res, err := c.SearchSongs(context.Background(), with(connect.NewRequest(&kantahev1.SearchSongsRequest{Query: "paged", PageSize: 3, PageToken: token}), a.user.Token))
		if err != nil {
			t.Fatal(err)
		}
		got += len(res.Msg.Songs)
		pages++
		if res.Msg.NextPageToken == "" {
			break
		}
		token = res.Msg.NextPageToken
	}
	if got != 7 || pages != 3 {
		t.Fatalf("songs %d pages %d", got, pages)
	}
}

func fetch(t *testing.T, a *adminEnv, rawURL string, headers ...string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest("GET", a.srv.URL+rawURL, nil)
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := a.srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res, b
}

func TestGetPlaybackMP3(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Tune.karmp3", "Tune", "Band", false)
	c := a.catalogClient()
	res, err := c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: n}), a.user.Token))
	if err != nil {
		t.Fatal(err)
	}
	pb := res.Msg.Playback
	if pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO || !pb.Ready || pb.MidiUrl != "" || pb.SoundfontUrl != "" ||
		!strings.HasPrefix(pb.AudioUrl, "/media/song/"+n+"?u="+url.QueryEscape(a.user.User.Id)+"&exp=") || pb.Song.Number != n || pb.Lyrics == nil || len(pb.Lyrics.Lines) != 2 {
		t.Fatalf("%+v", pb)
	}
	// the URL works for its user ...
	r, body := fetch(t, a, pb.AudioUrl, "Range", "bytes=0-9")
	if r.StatusCode != 206 || len(body) != 10 {
		t.Fatalf("status %d len %d", r.StatusCode, len(body))
	}
	// ... and for nobody else
	other := strings.Replace(pb.AudioUrl, "u="+url.QueryEscape(a.user.User.Id), "u="+url.QueryEscape(a.admin.User.Id), 1)
	if r, _ := fetch(t, a, other); r.StatusCode != 403 {
		t.Fatalf("another user's id on the same signature: %d", r.StatusCode)
	}
	// expires about six hours from now
	exp := regexpExp(t, pb.AudioUrl)
	if d := time.Unix(exp, 0).Sub(a.clock.now()); d != 6*time.Hour {
		t.Errorf("lifetime %v", d)
	}
}

func TestGetPlaybackGain(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Tune.karmp3", "Tune", "Band", false)
	c := a.catalogClient()
	playback := func(number string) *kantahev1.Playback {
		res, err := c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: number}), a.user.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Playback
	}
	// not measured yet: no gain is sent, the song plays as it is
	if pb := playback(n); pb.GainDb != nil {
		t.Fatalf("an unmeasured song has a gain: %v", *pb.GainDb)
	}
	if _, err := a.db.Exec(`UPDATE songs SET gain_db = -3.5, loudness_done = 1 WHERE number = ?`, n); err != nil {
		t.Fatal(err)
	}
	if pb := playback(n); pb.GainDb == nil || *pb.GainDb != -3.5 {
		t.Fatalf("gain = %v, want -3.5", pb.GainDb)
	}
	// a song that cannot be measured has none
	if _, err := a.db.Exec(`UPDATE songs SET gain_db = NULL WHERE number = ?`, n); err != nil {
		t.Fatal(err)
	}
	if pb := playback(n); pb.GainDb != nil {
		t.Fatalf("a song with no loudness has a gain: %v", *pb.GainDb)
	}
	// a MIDI song has none: its loudness follows the synthesizer and the MIDI volume of the device
	m := a.seed(t, "Song.kar", "Song", "Artist", true)
	if _, err := a.db.Exec(`UPDATE songs SET gain_db = 4 WHERE number = ?`, m); err != nil {
		t.Fatal(err)
	}
	if pb := playback(m); pb.GainDb != nil {
		t.Fatalf("a MIDI song has a gain: %v", *pb.GainDb)
	}
}

func regexpExp(t *testing.T, u string) int64 {
	t.Helper()
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatal(err)
	}
	n, err := strconv.ParseInt(parsed.Query().Get("exp"), 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func TestGetPlaybackMIDI(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Song.kar", "Song", "Artist", true)
	c := a.catalogClient()
	get := func() *kantahev1.Playback {
		res, err := c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: n}), a.user.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Playback
	}
	pb := get()
	if pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_MIDI_SYNTH || pb.AudioUrl != "" || !strings.HasPrefix(pb.SoundfontUrl, "/media/soundfont/"+n+".sf2?u=") ||
		pb.EffectiveMidiMode != kantahev1.MidiMode_MIDI_MODE_FULL || pb.Lyrics == nil || pb.Lyrics.Source != "kar" {
		t.Fatalf("%+v", pb)
	}
	if pb.GainDb != nil {
		t.Errorf("a MIDI song played by the device's synthesizer has no gain: %v", *pb.GainDb)
	}
	// the first request starts the build: not ready yet, retry in 500 ms (unless the worker was very fast)
	deadline := time.Now().Add(5 * time.Second)
	for !pb.Ready && time.Now().Before(deadline) {
		if pb.RetryAfterMs != 500 {
			t.Fatalf("a song that is not ready must say when to ask again: %+v", pb)
		}
		time.Sleep(20 * time.Millisecond)
		pb = get()
	}
	if !pb.Ready || pb.RetryAfterMs != 0 {
		t.Fatalf("the SoundFont never became ready: %+v", pb)
	}
	r, body := fetch(t, a, pb.MidiUrl)
	if r.StatusCode != 200 || r.Header.Get("Content-Type") != "audio/midi" || !bytes.HasPrefix(body, []byte("MThd")) {
		t.Fatalf("status %d type %q", r.StatusCode, r.Header.Get("Content-Type"))
	}
	r, body = fetch(t, a, pb.SoundfontUrl)
	if r.StatusCode != 200 || !bytes.HasPrefix(body, []byte("RIFF")) || r.Header.Get("Cache-Control") != "private, max-age=86400" {
		t.Fatalf("per-song soundfont: %d %q", r.StatusCode, r.Header.Get("Cache-Control"))
	}
	// the full bank stays available
	if r, body = fetch(t, a, "/media/soundfont.sf2"); r.StatusCode != 200 || !bytes.HasPrefix(body, []byte("RIFF")) || r.Header.Get("ETag") == "" {
		t.Fatalf("full bank: %d", r.StatusCode)
	}
}

func TestGetPlaybackErrors(t *testing.T) {
	a := newAdminEnv(t)
	c := a.catalogClient()
	ctx := context.Background()
	if _, err := c.GetPlayback(ctx, with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: "99999"}), a.user.Token)); code(err) != connect.CodeNotFound {
		t.Errorf("missing: %v", err)
	}
	if _, err := c.GetPlayback(ctx, connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: "1"})); code(err) != connect.CodeUnauthenticated {
		t.Errorf("no token: %v", err)
	}
	// a song without lyrics still plays
	bare := testfix.MIDI{Format: 0, Division: 480, Tracks: []testfix.Track{{Events: []testfix.Event{{Data: testfix.NoteOn(0, 60, 90)}}}}}.Bytes()
	up, _ := a.uploadAs(a.admin.Token, "bare.kar", bare)
	res, err := c.GetPlayback(ctx, with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: up.Song.Number}), a.user.Token))
	if err != nil || res.Msg.Playback.Lyrics != nil || res.Msg.Playback.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_MIDI_SYNTH {
		t.Errorf("%+v %v", res, err)
	}
}

func TestGetPlaybackWithoutSoundFont(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Song.kar", "Song", "Artist", true)
	// a server started without --soundfont
	mux := http.NewServeMux()
	deps := Deps{DB: a.db, Version: "x", Now: a.clock.now, Logger: a.logger, DataDir: a.dataDir, Importer: a.importer, HashCost: auth.CheapCost}
	m2, err := Mount(mux.Handle, deps)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m2.Close() })
	srv := httptest.NewServer(mux)
	defer srv.Close()
	c := kantahev1connect.NewCatalogServiceClient(srv.Client(), srv.URL)
	_, err = c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: n}), a.user.Token))
	if code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("err = %v", err)
	}
	// MP3 songs do not need a SoundFont
	m := a.seed(t, "Tune.karmp3", "Tune", "Band", false)
	if _, err := c.GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: m}), a.user.Token)); err != nil {
		t.Fatalf("MP3: %v", err)
	}
}

// seedVocals uploads a Kantahe Maker 1.1 file with a vocals track and returns its number.
func (a *adminEnv) seedVocals(t *testing.T, name, title string) string {
	t.Helper()
	nfo := "Title : " + title + "\nArtist : Band\nInstrumental : x.mp3\nVocals : x.vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\n"
	file := testfix.KARMP3WithVocals("x", testfix.MP3Frames(200+len(title)), testfix.MP3Frames(150+len(title)), "[00:01.00]<00:01.00>He<00:01.50>llo\n[00:05.00]Next", nfo)
	res, err := a.uploadAs(a.admin.Token, name, file)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("seed %s: %+v %v", name, res, err)
	}
	return res.Song.Number
}

func (a *adminEnv) playback(t *testing.T, number string) *kantahev1.Playback {
	t.Helper()
	res, err := a.catalogClient().GetPlayback(context.Background(), with(connect.NewRequest(&kantahev1.GetPlaybackRequest{Number: number}), a.user.Token))
	if err != nil {
		t.Fatal(err)
	}
	return res.Msg.Playback
}

func TestGetPlaybackWithVocals(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seedVocals(t, "Tune.karmp3", "Tune")
	pb := a.playback(t, n)
	if !strings.HasPrefix(pb.VocalsUrl, "/media/vocals/"+n+"?u="+url.QueryEscape(a.user.User.Id)+"&exp=") || !pb.Song.HasVocals {
		t.Fatalf("%+v", pb)
	}
	if !strings.HasPrefix(pb.AudioUrl, "/media/song/"+n+"?u=") || pb.Kind != kantahev1.PlaybackKind_PLAYBACK_KIND_AUDIO || len(pb.Lyrics.Lines) != 2 {
		t.Fatalf("the instrumental's playback changed: %+v", pb)
	}
	// the URL works for its user and gives the vocals, not the instrumental
	r, vocals := fetch(t, a, pb.VocalsUrl, "Range", "bytes=0-9")
	if r.StatusCode != 206 || len(vocals) != 10 {
		t.Fatalf("status %d len %d", r.StatusCode, len(vocals))
	}
	_, audio := fetch(t, a, pb.AudioUrl)
	_, allVocals := fetch(t, a, pb.VocalsUrl)
	if len(allVocals) == 0 || len(allVocals) >= len(audio) {
		t.Fatalf("vocals %d bytes, instrumental %d bytes: the vocals are the shorter test track", len(allVocals), len(audio))
	}
	// ... and for nobody else; it lives six hours like the audio URL
	other := strings.Replace(pb.VocalsUrl, "u="+url.QueryEscape(a.user.User.Id), "u="+url.QueryEscape(a.admin.User.Id), 1)
	if r, _ := fetch(t, a, other); r.StatusCode != 403 {
		t.Fatalf("another user's id on the same signature: %d", r.StatusCode)
	}
	if d := time.Unix(regexpExp(t, pb.VocalsUrl), 0).Sub(a.clock.now()); d != 6*time.Hour {
		t.Errorf("lifetime %v", d)
	}
}

func TestGetPlaybackWithoutVocals(t *testing.T) {
	a := newAdminEnv(t)
	mp3 := a.seed(t, "Plain.karmp3", "Plain", "Band", false)
	midi := a.seed(t, "Song.kar", "Song", "Artist", true)
	for _, n := range []string{mp3, midi} {
		if pb := a.playback(t, n); pb.VocalsUrl != "" || pb.Song.HasVocals {
			t.Errorf("%s: %+v", n, pb)
		}
	}
}

func TestSongListsCarryHasVocals(t *testing.T) {
	a := newAdminEnv(t)
	with1 := a.seedVocals(t, "With.karmp3", "Withvocals")
	without := a.seed(t, "Without.karmp3", "Withoutvocals", "Band", false)
	res, err := a.catalogClient().SearchSongs(context.Background(), with(connect.NewRequest(&kantahev1.SearchSongsRequest{}), a.user.Token))
	if err != nil || len(res.Msg.Songs) != 2 {
		t.Fatalf("%v %v", res, err)
	}
	for _, s := range res.Msg.Songs {
		if s.HasVocals != (s.Number == with1) || (s.Number != with1 && s.Number != without) {
			t.Errorf("%+v", s)
		}
	}
	got, err := a.catalogClient().GetSong(context.Background(), with(connect.NewRequest(&kantahev1.GetSongRequest{Number: with1}), a.user.Token))
	if err != nil || !got.Msg.Song.HasVocals {
		t.Fatalf("GetSong: %v %v", got, err)
	}
}

func TestStateCarriesHasVocalsForTheQueueAndTheCurrentSong(t *testing.T) {
	a := newAdminEnv(t)
	with1 := a.seedVocals(t, "With.karmp3", "Withvocals")
	without := a.seed(t, "Without.karmp3", "Withoutvocals", "Band", false)
	a.addToQueue(t, a.user.Token, with1)
	a.addToQueue(t, a.user.Token, without)
	a.control(t, a.user.Token, kantahev1.ControlAction_CONTROL_ACTION_PLAY)
	st := a.state(t, a.user.Token)
	if st.Now == nil || st.Now.Song.Number != with1 || !st.Now.Song.HasVocals {
		t.Fatalf("now: %+v", st.Now)
	}
	if len(st.Queue) == 0 {
		t.Fatalf("queue: %+v", st)
	}
	for _, item := range st.Queue {
		if item.Song.Number == without && item.Song.HasVocals {
			t.Errorf("a song without vocals is shown with them: %+v", item.Song)
		}
	}
}

// timingOf looks a song up in a list.
func timingOf(songs []*kantahev1.Song, number string) kantahev1.LyricTiming {
	for _, s := range songs {
		if s.Number == number {
			return s.LyricTiming
		}
	}
	return -1
}

func TestSongsCarryTheLyricTiming(t *testing.T) {
	a := newAdminEnv(t)
	up := func(name, nfo string) string {
		res, err := a.uploadAs(a.admin.Token, name, testfix.KARMP3("x", testfix.MP3Frames(200), "[00:01.00]hi", nfo))
		if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
			t.Fatalf("upload %s: %+v %v", name, res, err)
		}
		return res.Song.Number
	}
	word := up("W.karmp3", "Title : Word\nArtist : Band\nTiming by : word")
	line := up("L.karmp3", "Title : Line\nArtist : Band\nTiming by : line")
	midi := a.seed(t, "M.kar", "Midi", "Band", true)
	ctx := context.Background()
	want := map[string]kantahev1.LyricTiming{word: kantahev1.LyricTiming_LYRIC_TIMING_WORD, line: kantahev1.LyricTiming_LYRIC_TIMING_LINE, midi: kantahev1.LyricTiming_LYRIC_TIMING_WORD}

	search, err := a.catalogClient().SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	for n, w := range want {
		if got := timingOf(search.Msg.Songs, n); got != w {
			t.Errorf("SearchSongs %s: %v, want %v", n, got, w)
		}
		one, err := a.catalogClient().GetSong(ctx, with(connect.NewRequest(&kantahev1.GetSongRequest{Number: n}), a.admin.Token))
		if err != nil || one.Msg.Song.LyricTiming != w {
			t.Errorf("GetSong %s: %v %v, want %v", n, one, err, w)
		}
		if err := a.fav(t, a.admin.Token, n, true); err != nil {
			t.Fatal(err)
		}
	}
	favs, err := a.libClient().ListFavourites(ctx, with(connect.NewRequest(&kantahev1.ListFavouritesRequest{}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	for n, w := range want {
		if got := timingOf(favs.Msg.Songs, n); got != w {
			t.Errorf("ListFavourites %s: %v, want %v", n, got, w)
		}
	}
	// a song that has not been read yet (as after the migration) says nothing
	if _, err := a.db.Exec(`UPDATE songs SET lyric_timing = 0 WHERE number = ?`, word); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.Exec(`UPDATE songs SET lyric_timing = 9 WHERE number = ?`, line); err != nil {
		t.Fatal(err)
	}
	search, err = a.catalogClient().SearchSongs(ctx, with(connect.NewRequest(&kantahev1.SearchSongsRequest{}), a.admin.Token))
	if err != nil {
		t.Fatal(err)
	}
	if timingOf(search.Msg.Songs, word) != 0 || timingOf(search.Msg.Songs, line) != 0 {
		t.Errorf("not read yet and no lyrics: %v and %v, want unspecified", timingOf(search.Msg.Songs, word), timingOf(search.Msg.Songs, line))
	}
}

// versionOf is what the server must report for a file: its size and its modification time in milliseconds.
func versionOf(t *testing.T, path string) string {
	t.Helper()
	st, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	return fmt.Sprintf("%d-%d", st.Size(), st.ModTime().UnixMilli())
}

func (a *adminEnv) mediaPath(t *testing.T, number string) string {
	t.Helper()
	var p string
	if err := a.db.QueryRow(`SELECT media_path FROM songs WHERE number = ?`, number).Scan(&p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestGetPlaybackVersionMP3(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Tune.karmp3", "Tune", "Band", false)
	pb := a.playback(t, n)
	if want := versionOf(t, a.mediaPath(t, n)); pb.AudioVersion != want || pb.AudioVersion == "" {
		t.Fatalf("audio_version = %q, want %q", pb.AudioVersion, want)
	}
	if pb.VocalsVersion != "" {
		t.Errorf("a song without vocals has a vocals version: %q", pb.VocalsVersion)
	}
}

func TestGetPlaybackVersionVocals(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seedVocals(t, "Tune.karmp3", "Tune")
	pb := a.playback(t, n)
	media := a.mediaPath(t, n)
	if want := versionOf(t, media); pb.AudioVersion != want {
		t.Errorf("audio_version = %q, want %q", pb.AudioVersion, want)
	}
	if want := versionOf(t, strings.TrimSuffix(media, ".mp3")+".vocals.mp3"); pb.VocalsVersion != want || pb.VocalsVersion == "" {
		t.Errorf("vocals_version = %q, want %q", pb.VocalsVersion, want)
	}
	if pb.AudioVersion == pb.VocalsVersion {
		t.Errorf("two different files have the same version %q", pb.AudioVersion)
	}
}

func TestGetPlaybackVersionChangesOnReplace(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Old.karmp3", "Old", "Band", false)
	before := a.playback(t, n).AudioVersion
	if before == "" {
		t.Fatal("no version before the replace")
	}
	if _, err := a.replace(a.admin.Token, n, "x.karmp3", karmp3Titled("New", 900)); err != nil {
		t.Fatal(err)
	}
	if after := a.playback(t, n).AudioVersion; after == "" || after == before {
		t.Fatalf("REGRESSION: the version after a replace is %q, before it was %q", after, before)
	}
}

func TestGetPlaybackVersionMIDI(t *testing.T) {
	a := newAdminEnv(t)
	n := a.seed(t, "Song.kar", "Song", "Artist", true)
	if pb := a.playback(t, n); pb.AudioVersion != "" || pb.VocalsVersion != "" {
		t.Fatalf("a MIDI synth playback has versions: %q %q", pb.AudioVersion, pb.VocalsVersion)
	}
}

func TestSearchSongsFiltersAndSortsForTheAdminList(t *testing.T) {
	a := newAdminEnv(t)
	voc := a.seedVocals(t, "Voc.karmp3", "Voc")
	plain := a.seed(t, "Plain.karmp3", "Plain", "Band", false)
	mid := a.seed(t, "Mid.kar", "Mid", "Band", true)
	search := func(req *kantahev1.SearchSongsRequest) []string {
		t.Helper()
		res, err := a.catalogClient().SearchSongs(context.Background(), with(connect.NewRequest(req), a.user.Token))
		if err != nil {
			t.Fatal(err)
		}
		var out []string
		for _, s := range res.Msg.Songs {
			out = append(out, s.Number)
		}
		return out
	}
	yes, no := true, false
	eq := func(got, want []string) {
		t.Helper()
		if strings.Join(got, ",") != strings.Join(want, ",") {
			t.Errorf("got %v, want %v", got, want)
		}
	}
	eq(search(&kantahev1.SearchSongsRequest{HasVocals: &yes}), []string{voc})
	eq(search(&kantahev1.SearchSongsRequest{HasVocals: &no}), []string{plain, mid})
	eq(search(&kantahev1.SearchSongsRequest{Format: kantahev1.Format_FORMAT_MIDI}), []string{mid})
	// MIDI sorts after MP3 by format; descending turns it round
	eq(search(&kantahev1.SearchSongsRequest{Sort: kantahev1.SongSort_SONG_SORT_FORMAT}), []string{voc, plain, mid})
	eq(search(&kantahev1.SearchSongsRequest{Sort: kantahev1.SongSort_SONG_SORT_FORMAT, Descending: true}), []string{mid, voc, plain})
	eq(search(&kantahev1.SearchSongsRequest{Sort: kantahev1.SongSort_SONG_SORT_VOCALS, Descending: true}), []string{voc, plain, mid})
	// the timing of the test files: the two karmp3 have word marks in their .lrc
	if got := search(&kantahev1.SearchSongsRequest{LyricTiming: kantahev1.LyricTiming_LYRIC_TIMING_WORD, Format: kantahev1.Format_FORMAT_MP3}); len(got) != 2 {
		t.Errorf("word-timed MP3 songs: %v", got)
	}
	// an unknown timing is refused
	_, err := a.catalogClient().SearchSongs(context.Background(), with(connect.NewRequest(&kantahev1.SearchSongsRequest{LyricTiming: 7}), a.user.Token))
	if code(err) != connect.CodeInvalidArgument {
		t.Errorf("unknown timing: %v", err)
	}
}
