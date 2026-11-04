package library

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"time"

	"github.com/andrewloable/kantahe/server/internal/loudness"
)

// loudnessLogEvery is how many songs the backfill measures between two progress lines.
const loudnessLogEvery = 500

// GainOf returns the gain in dB that brings a song to the common loudness; false when it has none (not an MP3, not measured yet, or it cannot
// be measured).
func GainOf(ctx context.Context, q Querier, number string) (float64, bool, error) {
	var g sql.NullFloat64
	err := q.QueryRowContext(ctx, `SELECT gain_db FROM songs WHERE number = ? AND deleted = 0`, number).Scan(&g)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	return g.Float64, g.Valid, err
}

// MediaPathOf is the extracted audio file of a song (the MP3 of a .karmp3); "" when the song has none or does not exist.
func MediaPathOf(ctx context.Context, q Querier, number string) (string, error) {
	var p string
	err := q.QueryRowContext(ctx, `SELECT media_path FROM songs WHERE number = ? AND deleted = 0`, number).Scan(&p)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return p, err
}

// VocalsPathOf is the vocals track that goes with an extracted instrumental ("" for no instrumental).
func VocalsPathOf(mediaPath string) string { return vocalsPathOf(mediaPath) }

// ProcessLoudness measures the songs that have audio of their own (the extracted MP3 of a .karmp3) and no loudness yet, one at a time with a
// pause between, and stores each one's gain. It covers new songs and, once, the songs of a library that was imported before the measure
// existed. A song that cannot be measured is marked done with no gain. It gives way (true) as soon as a song waits for its metadata, which
// comes first; the worker comes back to it.
func (im *Importer) ProcessLoudness(ctx context.Context) (interrupted bool, err error) {
	measured := 0
	for {
		var waiting int
		if err := im.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM (SELECT 1 FROM songs WHERE metadata_done = 0 AND deleted = 0 LIMIT 1)`).Scan(&waiting); err != nil {
			return false, err
		}
		if waiting > 0 {
			return true, nil
		}
		var number, media string
		err := im.db.QueryRowContext(ctx, `SELECT number, media_path FROM songs WHERE loudness_done = 0 AND deleted = 0 AND failed = 0 AND media_path <> '' ORDER BY number LIMIT 1`).Scan(&number, &media)
		if errors.Is(err, sql.ErrNoRows) {
			if measured >= loudnessLogEvery {
				im.logger.Info("loudness measured", "songs", measured)
			}
			return false, nil
		}
		if err != nil {
			return false, err
		}
		began := time.Now()
		gain := im.measureGain(media)
		took := time.Since(began)
		if err := im.db.WriteTx(ctx, func(tx *sql.Tx) error {
			// only if the song still has this audio: a replaced file is measured again by the next pass
			_, err := tx.ExecContext(ctx, `UPDATE songs SET gain_db = ?, loudness_done = 1 WHERE number = ? AND media_path = ? AND deleted = 0`, gain, number, media)
			return err
		}); err != nil {
			return false, err
		}
		measured++
		if measured%loudnessLogEvery == 0 {
			im.logger.Info("loudness measured", "songs", measured)
		}
		runtimeYield()
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		// a rest as long as the work: the backfill of a big library takes a while and must leave the machine (a small box) half free
		case <-time.After(max(workerPause, took)):
		}
	}
}

// measureGain returns the gain of the MP3 file as a value for the database: NULL when it cannot be read or has no loudness.
func (im *Importer) measureGain(path string) any {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()
	r, err := loudness.Measure(f)
	if err != nil {
		return nil
	}
	return loudness.Gain(r.LUFS, r.PeakDB)
}
