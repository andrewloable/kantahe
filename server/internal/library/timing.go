package library

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// timingLogEvery is how many songs the backfill reads between two progress lines.
const timingLogEvery = 500

// ProcessLyricTiming reads how the lyrics are timed (by line or by word) of the songs that were imported before the column existed: those
// with metadata and no timing, one at a time with a pause between, like the loudness pass. A song whose file cannot be read, or that has no
// lyrics, gets 9 so that it is not tried again. It gives way (true) as soon as a song waits for its metadata, which comes first. Nothing is
// ever hidden or failed because of the timing.
func (im *Importer) ProcessLyricTiming(ctx context.Context) (interrupted bool, err error) {
	read := 0
	for {
		var waiting int
		if err := im.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM (SELECT 1 FROM songs WHERE metadata_done = 0 AND deleted = 0 LIMIT 1)`).Scan(&waiting); err != nil {
			return false, err
		}
		if waiting > 0 {
			return true, nil
		}
		var number, path, sha string
		var format int
		err := im.db.QueryRowContext(ctx, `SELECT number, path, sha256, format FROM songs WHERE lyric_timing = 0 AND metadata_done = 1 AND deleted = 0 AND failed = 0 ORDER BY number LIMIT 1`).
			Scan(&number, &path, &sha, &format)
		if errors.Is(err, sql.ErrNoRows) {
			if read >= timingLogEvery {
				im.logger.Info("lyric timing read", "songs", read)
			}
			return false, nil
		}
		if err != nil {
			return false, err
		}
		began := time.Now()
		md := parseFile(path, Format(format))
		value := md.timing
		if md.failedReason != "" || value == 0 {
			value = 9
		}
		if err := im.db.WriteTx(ctx, func(tx *sql.Tx) error {
			// only if the song still has this content: a replaced file is read again by the metadata pass
			_, err := tx.ExecContext(ctx, `UPDATE songs SET lyric_timing = ? WHERE number = ? AND sha256 = ? AND deleted = 0 AND lyric_timing = 0`, value, number, sha)
			return err
		}); err != nil {
			return false, err
		}
		read++
		if read%timingLogEvery == 0 {
			im.logger.Info("lyric timing read", "songs", read)
		}
		runtimeYield()
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		case <-time.After(max(workerPause, time.Since(began))):
		}
	}
}
