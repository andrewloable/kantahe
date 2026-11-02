// Package assets holds files embedded in the server binary.
package assets

import (
	"embed"
	"fmt"
)

// The default SoundFont is embedded from soundfont/ (git-ignored). `go generate ./internal/assets` puts it there (a cached, checksum-checked
// download, scripts/fetch-soundfont.sh); do it once per checkout, before building, so that the binary can play MIDI with no --soundfont.
//
//go:generate ../../../scripts/fetch-soundfont.sh

//go:embed fanfare/*.mp3
var fanfares embed.FS

// Fanfare returns the bytes of score fanfare n (1, 2 or 3).
func Fanfare(n int) ([]byte, bool) {
	if n < 1 || n > 3 {
		return nil, false
	}
	b, err := fanfares.ReadFile(fmt.Sprintf("fanfare/fanfare%d.mp3", n))
	return b, err == nil
}
