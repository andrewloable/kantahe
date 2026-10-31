// Package library holds the song library rules: numbering, import, search.
package library

import (
	"context"
	"database/sql"
	"fmt"
	"math/big"
	"path"
	"sort"
	"strings"
)

// Format is how a library entry is stored; the values equal the proto Format.
type Format int

// Entry formats.
const (
	FormatMP3  Format = 1
	FormatMIDI Format = 2
)

const (
	minDigits = 5
	// maxSongbookDigits keeps one oddly named upload from pushing every later
	// automatic number into the billions.
	maxSongbookDigits = 9
)

// NewFile is a file to be numbered.
type NewFile struct {
	Path     string
	Format   Format
	Songbook string // canonical number from the file name, or ""
}

// canonical strips leading zeros and pads to at least five digits; ok is false
// unless s is non-empty and all ASCII digits.
func canonical(s string) (string, bool) {
	if s == "" {
		return "", false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return "", false
		}
	}
	t := strings.TrimLeft(s, "0")
	if len(t) < minDigits {
		t = strings.Repeat("0", minDigits-len(t)) + t
	}
	return t, true
}

// Songbook returns the canonical number in the leading digits of the file's base
// name (1052 becomes 01052), or "" when there is none.
func Songbook(filename string) string {
	base := path.Base(strings.ReplaceAll(filename, `\`, "/"))
	end := 0
	for end < len(base) && base[end] >= '0' && base[end] <= '9' {
		end++
	}
	if end == 0 {
		return ""
	}
	if len(strings.TrimLeft(base[:end], "0")) > maxSongbookDigits {
		return ""
	}
	c, _ := canonical(base[:end])
	return c
}

// Allocate assigns a number to every file of the batch and returns path to
// number. existing holds every number ever assigned, deleted ones included.
// MP3 files go first, then MIDI, each group by path, so the result does not
// depend on the order of the batch. A file keeps its songbook number unless it
// is empty or taken; then it gets the highest number ever assigned plus one.
func Allocate(existing map[string]bool, batch []NewFile) map[string]string {
	taken := make(map[string]bool, len(existing)+len(batch))
	highest := new(big.Int) // numbers can be longer than any machine integer
	claim := func(num string) {
		taken[num] = true
		if v, ok := new(big.Int).SetString(num, 10); ok && v.Cmp(highest) > 0 {
			highest = v
		}
	}
	for k := range existing {
		if c, ok := canonical(k); ok {
			claim(c)
		}
	}

	files := append([]NewFile(nil), batch...)
	sort.SliceStable(files, func(i, j int) bool {
		if (files[i].Format == FormatMP3) != (files[j].Format == FormatMP3) {
			return files[i].Format == FormatMP3
		}
		return files[i].Path < files[j].Path
	})

	out := make(map[string]string, len(files))
	for _, f := range files {
		if _, done := out[f.Path]; done {
			continue
		}
		num := ""
		if c, ok := canonical(f.Songbook); ok && !taken[c] {
			num = c
		} else {
			num, _ = canonical(new(big.Int).Add(highest, big.NewInt(1)).String())
		}
		claim(num)
		out[f.Path] = num
	}
	return out
}

// ExistingNumbers reads every number ever assigned, deleted songs included.
func ExistingNumbers(ctx context.Context, q interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}) (map[string]bool, error) {
	rows, err := q.QueryContext(ctx, `SELECT number FROM songs`)
	if err != nil {
		return nil, fmt.Errorf("read song numbers: %w", err)
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		out[n] = true
	}
	return out, rows.Err()
}
