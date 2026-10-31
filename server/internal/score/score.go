// Package score implements the end-of-song score rules (plan section 3). The
// random number is a parameter so that the rules are deterministic in tests;
// the caller supplies it from crypto/rand.
package score

// Mode says how the score is produced.
type Mode int

// Score modes.
const (
	ModeOff Mode = iota + 1
	ModeRandom
	ModeMicrophone
)

// Level is the difficulty of the score.
type Level int

// Score levels.
const (
	LevelLow Level = iota + 1
	LevelMiddle
	LevelHigh
)

// MinLoudReadings is how many loud 100 ms readings the microphone mode needs.
const MinLoudReadings = 21

// NoScoreReason is shown when the microphone heard too little singing.
const NoScoreReason = "Not enough singing was heard"

// Result is what the score screen shows.
type Result struct {
	HasValue bool
	Value    int
	Comment  string
	Fanfare  int // 0 none, 1 to 3
	Reason   string
}

// Value maps the random number onto the level's range: the number is read as a
// signed 32-bit integer and the truncated remainder is added to the base, so
// about half the results fall below the base. An unset level counts as Middle.
func Value(r uint32, l Level) int {
	mod, base := 21, 80
	switch l {
	case LevelLow:
		mod, base = 26, 75
	case LevelHigh:
		mod, base = 11, 90
	}
	return int(r%uint32(mod)) + base
}

// Comment is the sentence shown under the score.
func Comment(v int) string {
	switch {
	case v <= 69:
		return "You can do better."
	case v <= 80:
		return "You have the talent."
	case v <= 90:
		return "You are a good singer."
	default:
		return "You are excellent!"
	}
}

// Fanfare is the fanfare tier for a score: 1 (70-80), 2 (81-90), 3 (91+), else 0.
func Fanfare(v int) int {
	switch {
	case v >= 91:
		return 3
	case v >= 81:
		return 2
	case v >= 70:
		return 1
	}
	return 0
}

// Decide returns what to show after a song that ended on its own, and false
// when no score screen is shown at all.
func Decide(m Mode, l Level, loudReadings int, r uint32) (Result, bool) {
	switch m {
	case ModeRandom:
	case ModeMicrophone:
		if loudReadings < MinLoudReadings {
			return Result{Reason: NoScoreReason}, true
		}
	default:
		return Result{}, false
	}
	v := Value(r, l)
	return Result{HasValue: true, Value: v, Comment: Comment(v), Fanfare: Fanfare(v)}, true
}
