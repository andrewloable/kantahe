-- Per-user playback state, queue and history (PLAN.md section 7). Everything
-- cascades with the user.
CREATE TABLE user_state (
    user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status           INTEGER NOT NULL DEFAULT 1,   -- 1 paused, 2 playing
    player_device_id TEXT NOT NULL DEFAULT '',
    now_number       TEXT NOT NULL DEFAULT '',
    now_source       INTEGER NOT NULL DEFAULT 0,   -- 1 queue, 2 random
    position_ms      INTEGER NOT NULL DEFAULT 0,
    score_mode       INTEGER NOT NULL DEFAULT 2,   -- 1 off, 2 random, 3 microphone
    score_level      INTEGER NOT NULL DEFAULT 1    -- 1 low, 2 middle, 3 high
);

CREATE TABLE queue_items (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id      TEXT NOT NULL,
    pos     INTEGER NOT NULL,
    number  TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);

CREATE TABLE history (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    number    TEXT NOT NULL,
    sung_at   INTEGER NOT NULL,
    skipped   INTEGER NOT NULL DEFAULT 0,
    has_score INTEGER NOT NULL DEFAULT 0,
    score     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX history_user ON history(user_id, id);
