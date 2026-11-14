-- The speed of the current song in percent (100 = normal; 75 to 125). It belongs to the song that plays and starts again at 100 with the next one.
ALTER TABLE user_state ADD COLUMN tempo_pct INTEGER NOT NULL DEFAULT 100;
