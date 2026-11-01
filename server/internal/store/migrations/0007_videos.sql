-- Background videos of the player (docs/PLAN.md section 4.2). The file is <data>/videos/<sha256>.mp4.
CREATE TABLE videos (
    id            TEXT PRIMARY KEY,
    sha256        TEXT NOT NULL UNIQUE,         -- the same content uploaded twice is a duplicate
    name          TEXT NOT NULL,                -- what the admin sees; renamable
    original_name TEXT NOT NULL,
    size          INTEGER NOT NULL,
    duration_ms   INTEGER NOT NULL,
    width         INTEGER NOT NULL,
    height        INTEGER NOT NULL,
    codec         TEXT NOT NULL,
    has_audio     INTEGER NOT NULL DEFAULT 0,
    faststart     INTEGER NOT NULL DEFAULT 0,   -- moov before mdat
    enabled       INTEGER NOT NULL DEFAULT 1,
    position      INTEGER NOT NULL,             -- place in the loop, 1..n
    created_at    INTEGER NOT NULL
);

CREATE INDEX videos_position ON videos(position);
