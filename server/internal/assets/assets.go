// Package assets holds files embedded in the server binary.
package assets

import (
	"embed"
	"fmt"
)

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
