package score

import "testing"

func TestRanges(t *testing.T) {
	want := map[Level][2]int{LevelLow: {50, 100}, LevelMiddle: {60, 100}, LevelHigh: {80, 100}}
	for lvl, w := range want {
		lo, hi := 1000, -1000
		for i := 0; i < 200000; i++ {
			v := Value(uint32(i*2654435761), lvl)
			lo, hi = min(lo, v), max(hi, v)
		}
		if lo != w[0] || hi != w[1] {
			t.Errorf("level %d: range %d-%d, want %d-%d", lvl, lo, hi, w[0], w[1])
		}
	}
}

func TestSignedRemainder(t *testing.T) {
	if got := Value(0xFFFFFFFF, LevelLow); got != 74 {
		t.Errorf("Value(0xFFFFFFFF, Low) = %d, want 74", got)
	}
	if got := Value(27, LevelLow); got != 76 {
		t.Errorf("Value(27, Low) = %d, want 76", got)
	}
	if got := Value(0x80000000, LevelHigh); got != 90+(-2147483648%11) {
		t.Errorf("most negative: %d", got)
	}
	if got := Value(5, LevelMiddle); got != 85 {
		t.Errorf("Value(5, Middle) = %d, want 85", got)
	}
	if got := Value(5, LevelHigh); got != 95 {
		t.Errorf("Value(5, High) = %d, want 95", got)
	}
}

func TestUnknownLevelIsMiddle(t *testing.T) {
	if Value(5, Level(0)) != Value(5, LevelMiddle) {
		t.Error("an unset level should behave like Middle")
	}
}

func TestComment(t *testing.T) {
	cases := map[int]string{
		0: "You can do better.", 69: "You can do better.",
		70: "You have the talent.", 80: "You have the talent.",
		81: "You are a good singer.", 90: "You are a good singer.",
		91: "You are excellent!", 100: "You are excellent!",
	}
	for v, want := range cases {
		if got := Comment(v); got != want {
			t.Errorf("Comment(%d) = %q, want %q", v, got, want)
		}
	}
}

func TestFanfare(t *testing.T) {
	cases := map[int]int{0: 0, 69: 0, 70: 1, 80: 1, 81: 2, 90: 2, 91: 3, 100: 3}
	for v, want := range cases {
		if got := Fanfare(v); got != want {
			t.Errorf("Fanfare(%d) = %d, want %d", v, got, want)
		}
	}
}

func TestDecideOff(t *testing.T) {
	if _, show := Decide(ModeOff, LevelLow, 1000, 7); show {
		t.Error("Off must show no score screen")
	}
	if _, show := Decide(Mode(0), LevelLow, 1000, 7); show {
		t.Error("an unset mode must show no score screen")
	}
}

func TestDecideRandomAlwaysScores(t *testing.T) {
	res, show := Decide(ModeRandom, LevelLow, 0, 27)
	if !show || !res.HasValue || res.Value != 76 || res.Comment != "You have the talent." || res.Fanfare != 1 {
		t.Fatalf("got %+v, %v", res, show)
	}
}

func TestDecideMicLow(t *testing.T) {
	res, show := Decide(ModeMicrophone, LevelLow, 20, 27)
	if !show || res.HasValue || res.Reason != "Not enough singing was heard" || res.Value != 0 || res.Comment != "" || res.Fanfare != 0 {
		t.Fatalf("20 readings: %+v, %v", res, show)
	}
	res, show = Decide(ModeMicrophone, LevelLow, 21, 27)
	if !show || !res.HasValue || res.Value != 76 || res.Reason != "" {
		t.Fatalf("21 readings: %+v, %v", res, show)
	}
}

func TestDecideHighScoreHasTopFanfare(t *testing.T) {
	res, _ := Decide(ModeRandom, LevelHigh, 0, 10) // 10%11 = 10 -> 100
	if res.Value != 100 || res.Fanfare != 3 || res.Comment != "You are excellent!" {
		t.Fatalf("got %+v", res)
	}
}
