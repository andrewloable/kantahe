-- Full-text index of the displayed title and artist. The FTS rowid is the
-- rowid of the songs row, so rows can be replaced and deleted without a scan.
CREATE VIRTUAL TABLE songs_fts USING fts5(number UNINDEXED, title, artist, tokenize = 'unicode61 remove_diacritics 2');

-- First letter (A-Z, else #) of the displayed title and artist, for A-Z browsing.
ALTER TABLE songs ADD COLUMN title_letter  TEXT NOT NULL DEFAULT '#';
ALTER TABLE songs ADD COLUMN artist_letter TEXT NOT NULL DEFAULT '#';
