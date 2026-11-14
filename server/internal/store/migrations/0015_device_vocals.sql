-- The guide-vocals choice of a device (the vocals track of an MP3 song), kept on the server so that any of the user's devices can change it:
-- on or off (off by default, as before) and how loud, 0 to 100 percent (60 by default, as before).
ALTER TABLE devices ADD COLUMN vocals_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE devices ADD COLUMN vocals_pct INTEGER NOT NULL DEFAULT 60;
-- Amateur singer mode: the guide was switched off for the current song (cleared when the song changes).
ALTER TABLE user_state ADD COLUMN guide_cancelled INTEGER NOT NULL DEFAULT 0;
