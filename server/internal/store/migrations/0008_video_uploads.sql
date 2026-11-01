-- Unfinished background video uploads (docs/PLAN.md section 4.2). The bytes received so far are the file <data>/videos/.upload-<id>.
CREATE TABLE video_uploads (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    filename   TEXT NOT NULL,                 -- the base name the client sent
    size       INTEGER NOT NULL,              -- the declared size of the whole file
    received   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
