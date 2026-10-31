CREATE TABLE songs (
    number          TEXT PRIMARY KEY,
    format          INTEGER NOT NULL,            -- 1 mp3, 2 midi (the proto Format values)
    source          INTEGER NOT NULL,            -- 1 upload, 2 watched folder
    path            TEXT NOT NULL UNIQUE,
    sha256          TEXT NOT NULL,
    size            INTEGER NOT NULL,
    mtime           INTEGER NOT NULL,
    original_name   TEXT NOT NULL,
    songbook_number TEXT NOT NULL DEFAULT '',
    file_title      TEXT NOT NULL DEFAULT '',
    file_artist     TEXT NOT NULL DEFAULT '',
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    failed          INTEGER NOT NULL DEFAULT 0,
    failed_reason   TEXT NOT NULL DEFAULT '',
    metadata_done   INTEGER NOT NULL DEFAULT 0,
    media_path      TEXT NOT NULL DEFAULT '',
    deleted         INTEGER NOT NULL DEFAULT 0,  -- deleted rows are kept so that numbers are never reused
    created_at      INTEGER NOT NULL
);

CREATE INDEX songs_sha256 ON songs(sha256);

CREATE TABLE song_edits (
    number TEXT PRIMARY KEY REFERENCES songs(number),
    title  TEXT,
    artist TEXT
);
