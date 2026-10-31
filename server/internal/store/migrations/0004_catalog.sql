-- What users see and sort by: the displayed title and artist (admin edit, else
-- file metadata, else the file name) and accent-folded lower-case sort keys.
-- The importer's syncSong keeps them current.
ALTER TABLE songs ADD COLUMN display_title  TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN display_artist TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN title_key      TEXT NOT NULL DEFAULT '';
ALTER TABLE songs ADD COLUMN artist_key     TEXT NOT NULL DEFAULT '';

CREATE INDEX songs_title_key  ON songs(title_key);
CREATE INDEX songs_artist_key ON songs(artist_key);

-- Rows that exist before this migration get usable values until the importer
-- refreshes them: the file's own metadata, else the file name.
UPDATE songs SET
    display_title  = CASE WHEN file_title <> '' THEN file_title ELSE original_name END,
    display_artist = file_artist,
    title_key      = lower(CASE WHEN file_title <> '' THEN file_title ELSE original_name END),
    artist_key     = lower(file_artist);
