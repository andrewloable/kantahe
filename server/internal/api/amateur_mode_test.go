package api

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
	"github.com/andrewloable/kantahe/server/internal/testfix"
)

// Amateur singer mode (docs/PLAN.md, "Amateur singer mode"): the admin's switch, and the guide window that GetPlayback gives a song with a
// vocals track: from 0 ms to the start of the third lyric line.

func lyricLines(starts ...int64) *kantahev1.Lyrics {
	l := &kantahev1.Lyrics{}
	for _, s := range starts {
		l.Lines = append(l.Lines, &kantahev1.LyricLine{StartMs: s, EndMs: s + 1000})
	}
	return l
}

func TestGuideVocalsUntil(t *testing.T) {
	for _, c := range []struct {
		name string
		in   *kantahev1.Lyrics
		want int64
	}{
		{"nil", nil, 0},
		{"no lines", lyricLines(), 0},
		{"one line", lyricLines(1000), 0},
		{"two lines: no third line to wait for, so no guide", lyricLines(1000, 3000), 0},
		{"three lines: until the third starts", lyricLines(1000, 3000, 5000), 5000},
		{"five lines: still the third", lyricLines(1000, 3000, 5000, 7000, 9000), 5000},
	} {
		if got := guideVocalsUntil(c.in); got != c.want {
			t.Errorf("%s: %d, want %d", c.name, got, c.want)
		}
	}
}

func (a *adminEnv) setAmateurMode(t *testing.T, on bool) {
	t.Helper()
	if _, err := a.adminClient.UpdateServerSettings(context.Background(), with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{AmateurMode: yes(on)}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
}

// seedVocalsLines uploads a .karmp3 with a vocals track and the given .lrc.
func (a *adminEnv) seedVocalsLines(t *testing.T, name, title, lrc string) string {
	t.Helper()
	nfo := "Title : " + title + "\nArtist : Band\nInstrumental : x.mp3\nVocals : x.vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\n"
	file := testfix.KARMP3WithVocals("x", testfix.MP3Frames(200+len(title)), testfix.MP3Frames(150+len(title)), lrc, nfo)
	res, err := a.uploadAs(a.admin.Token, name, file)
	if err != nil || res.Status != kantahev1.UploadStatus_UPLOAD_STATUS_ADDED {
		t.Fatalf("seed %s: %+v %v", name, res, err)
	}
	return res.Song.Number
}

func TestServerSettingsAmateurMode(t *testing.T) {
	a := newAdminEnv(t)
	ctx := context.Background()
	get := func() *kantahev1.ServerSettings {
		res, err := a.adminClient.GetServerSettings(ctx, with(connect.NewRequest(&kantahev1.GetServerSettingsRequest{}), a.admin.Token))
		if err != nil {
			t.Fatal(err)
		}
		return res.Msg.Settings
	}
	if s := get(); s.AmateurMode {
		t.Fatalf("off by default: %+v", s)
	}
	a.setAmateurMode(t, true)
	if s := get(); !s.AmateurMode {
		t.Fatalf("on after the update: %+v", s)
	}
	// an update of another setting leaves it on
	sec := int32(7)
	if _, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{ScoreSeconds: &sec}), a.admin.Token)); err != nil {
		t.Fatal(err)
	}
	if s := get(); !s.AmateurMode || s.ScoreSeconds != 7 {
		t.Fatalf("%+v", s)
	}
	// only an administrator changes it
	if _, err := a.adminClient.UpdateServerSettings(ctx, with(connect.NewRequest(&kantahev1.UpdateServerSettingsRequest{AmateurMode: yes(false)}), a.user.Token)); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("a user: %v", err)
	}
	if s := get(); !s.AmateurMode {
		t.Fatalf("a refused update changed it: %+v", s)
	}
}

func TestGetPlaybackGuideVocals(t *testing.T) {
	a := newAdminEnv(t)
	four := a.seedVocalsLines(t, "Four.karmp3", "Four", "[00:01.00]One\n[00:03.00]Two\n[00:05.00]Three\n[00:07.00]Four")
	two := a.seedVocalsLines(t, "Two.karmp3", "Two", "[00:01.00]One\n[00:03.00]Two")
	plain := a.seed(t, "Plain.karmp3", "Plain", "Band", false)
	midi := a.seed(t, "Tune.kar", "Tune", "Band", true)

	if pb := a.playback(t, four); pb.GuideVocalsUntilMs != 0 {
		t.Fatalf("mode off: %d", pb.GuideVocalsUntilMs)
	}
	a.setAmateurMode(t, true)
	if pb := a.playback(t, four); pb.GuideVocalsUntilMs != 5000 {
		t.Fatalf("mode on, four lines: %d, want the start of the third line, 5000", pb.GuideVocalsUntilMs)
	}
	if pb := a.playback(t, two); pb.GuideVocalsUntilMs != 0 {
		t.Fatalf("two lines get no guide: %d", pb.GuideVocalsUntilMs)
	}
	if pb := a.playback(t, plain); pb.GuideVocalsUntilMs != 0 || pb.VocalsUrl != "" {
		t.Fatalf("a song without a vocals track: %+v", pb)
	}
	if pb := a.playback(t, midi); pb.GuideVocalsUntilMs != 0 {
		t.Fatalf("a MIDI song: %d", pb.GuideVocalsUntilMs)
	}
	a.setAmateurMode(t, false)
	if pb := a.playback(t, four); pb.GuideVocalsUntilMs != 0 {
		t.Fatalf("switched off again: %d", pb.GuideVocalsUntilMs)
	}
}
