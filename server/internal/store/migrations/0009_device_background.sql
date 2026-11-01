-- The user's choice of background video for a device: 1 auto, 2 on, 3 off (the proto BackgroundMode values). Old rows are auto.
ALTER TABLE devices ADD COLUMN background_mode INTEGER NOT NULL DEFAULT 1;
