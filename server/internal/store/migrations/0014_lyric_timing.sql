-- How the lyrics of a song are timed (Kantahe Maker 1.2.6 writes it in the .nfo row "Timing by"): 0 not read yet, 1 by line, 2 by word,
-- 9 the file has no lyrics. The metadata pass sets it for new and changed songs; a background pass fills it once for the songs that were
-- imported before this column existed, so that no song is hidden meanwhile.
ALTER TABLE songs ADD COLUMN lyric_timing INTEGER NOT NULL DEFAULT 0;
