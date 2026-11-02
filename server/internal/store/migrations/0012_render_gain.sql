-- The gain in dB that brings a server-rendered MIDI song to the common loudness (internal/loudness). The audio is the same for the same song
-- content (sha256) and SoundFont (tag), so the row never goes stale: another SoundFont or another song is another key. A row means the render
-- was measured; a NULL gain is a render that is silent (it plays, with no gain).
CREATE TABLE render_gain (
    sha256  TEXT NOT NULL,
    tag     TEXT NOT NULL,
    gain_db REAL,
    PRIMARY KEY (sha256, tag)
) WITHOUT ROWID;
