-- Whether a .karmp3 has a vocals track (Kantahe Maker 1.1): the library extracts it next to the instrumental, as <data>/media/<sha>.vocals.mp3.
ALTER TABLE songs ADD COLUMN has_vocals INTEGER NOT NULL DEFAULT 0;

-- Before vocals were supported such a file was refused for its two MP3 entries and stored as failed. It is read again at the next start.
UPDATE songs SET metadata_done = 0, failed = 0, failed_reason = ''
WHERE deleted = 0 AND format = 1 AND failed <> 0 AND failed_reason = 'karmp3: the archive has more than one .mp3 entry';
