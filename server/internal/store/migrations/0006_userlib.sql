-- Per-user favourites and playlists (PLAN.md section 2 rule 14); they go with the user.
CREATE TABLE favourites (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number     TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, number)
);

CREATE TABLE playlists (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX playlists_user ON playlists(user_id, created_at);

CREATE TABLE playlist_songs (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    pos         INTEGER NOT NULL,
    number      TEXT NOT NULL,
    PRIMARY KEY (playlist_id, pos)
);
