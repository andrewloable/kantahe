package session

import (
	"context"
	"database/sql"
	"errors"

	"github.com/andrewloable/kantahe/server/internal/store"
)

const (
	pickAttempts = 30 // random probes before a full scan
	scanLimit    = 100_000
)

// sqlPicker draws a random visible song that is not excluded. It probes random
// positions first (fast for big libraries) and falls back to a full scan, so small
// libraries and heavy exclusion still give an exact uniform choice.
type sqlPicker struct {
	db  *store.DB
	rnd func(n int) int
}

func (p *sqlPicker) intn(n int) int {
	if p.rnd != nil {
		return p.rnd(n)
	}
	return int(cryptoRand{}.Uint32() % uint32(n))
}

const visibleSongs = `deleted = 0 AND failed = 0 AND metadata_done = 1`

// Pick implements Picker.
func (p *sqlPicker) Pick(exclude func(string) bool) (Song, bool) {
	ctx := context.Background()
	var total int
	if err := p.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM songs WHERE `+visibleSongs).Scan(&total); err != nil || total == 0 {
		return Song{}, false
	}
	row := func(offset int) (Song, bool) {
		var s Song
		err := p.db.QueryRowContext(ctx, `SELECT number, format, duration_ms FROM songs WHERE `+visibleSongs+` ORDER BY rowid LIMIT 1 OFFSET ?`, offset).Scan(&s.Number, &s.Format, &s.DurationMs)
		if errors.Is(err, sql.ErrNoRows) || err != nil {
			return Song{}, false
		}
		return s, true
	}
	for i := 0; i < pickAttempts; i++ {
		if s, ok := row(p.intn(total)); ok && !exclude(s.Number) {
			return s, true
		}
	}
	rows, err := p.db.QueryContext(ctx, `SELECT number, format, duration_ms FROM songs WHERE `+visibleSongs+` ORDER BY rowid LIMIT ?`, scanLimit)
	if err != nil {
		return Song{}, false
	}
	defer rows.Close()
	var candidates []Song
	for rows.Next() {
		var s Song
		if err := rows.Scan(&s.Number, &s.Format, &s.DurationMs); err != nil {
			return Song{}, false
		}
		if !exclude(s.Number) {
			candidates = append(candidates, s)
		}
	}
	if len(candidates) == 0 {
		return Song{}, false
	}
	return candidates[p.intn(len(candidates))], true
}
