-- How loud a device plays MP3 songs and MIDI songs, in percent (0 to 200). Old rows are 100: nothing sounds different until someone changes it.
ALTER TABLE devices ADD COLUMN mp3_volume_pct INTEGER NOT NULL DEFAULT 100;
ALTER TABLE devices ADD COLUMN midi_volume_pct INTEGER NOT NULL DEFAULT 100;
