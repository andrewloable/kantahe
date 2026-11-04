package api

import (
	"testing"

	kantahev1 "github.com/andrewloable/kantahe/server/gen/kantahe/v1"
)

func TestLyricTimingMapping(t *testing.T) {
	for v, want := range map[int]kantahev1.LyricTiming{
		0: kantahev1.LyricTiming_LYRIC_TIMING_UNSPECIFIED, // not read yet
		1: kantahev1.LyricTiming_LYRIC_TIMING_LINE,
		2: kantahev1.LyricTiming_LYRIC_TIMING_WORD,
		9: kantahev1.LyricTiming_LYRIC_TIMING_UNSPECIFIED, // no lyrics
		7: kantahev1.LyricTiming_LYRIC_TIMING_UNSPECIFIED, // anything else
	} {
		if got := lyricTiming(v); got != want {
			t.Errorf("%d: %v, want %v", v, got, want)
		}
	}
}
