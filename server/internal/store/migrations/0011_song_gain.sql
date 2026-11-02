-- The gain in dB that brings a song to the common loudness (internal/loudness), and whether it was measured: NULL with loudness_done = 1 is a
-- song that cannot be measured (silence, unreadable), 0 is one still waiting. Only songs with audio of their own (MP3) are measured.
ALTER TABLE songs ADD COLUMN gain_db REAL;
ALTER TABLE songs ADD COLUMN loudness_done INTEGER NOT NULL DEFAULT 0;
