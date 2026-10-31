// The two measurements of the page, kept free of the DOM so that node can test them.

/** A 2 s window in which the audio fell this far behind the wall clock is a dropout (the player uses the same). */
export const DROPOUT_TOLERANCE_MS = 100;

/**
 * Counts the windows between consecutive samples in which the audio clock advanced at least
 * DROPOUT_TOLERANCE_MS less than the wall clock. A sample is {wallMs, audioSec}: performance.now() and
 * audioContext.currentTime taken together, every 2 seconds.
 */
export function dropoutWindows(samples) {
  let n = 0;
  for (let i = 1; i < samples.length; i++) {
    const wall = samples[i].wallMs - samples[i - 1].wallMs;
    const audio = (samples[i].audioSec - samples[i - 1].audioSec) * 1000;
    if (wall - audio > DROPOUT_TOLERANCE_MS + 1e-6) n++;
  }
  return n;
}

/**
 * How far the lyrics the page saw were from the tempo map. An event is {expectedMs, actualMs}: the time of the
 * lyric computed from the MIDI tempo map, and the sequencer's playback time when its event fired.
 */
export function lyricDrift(events) {
  if (events.length === 0) return { count: 0, maxAbsMs: 0, meanAbsMs: 0 };
  const abs = events.map((e) => Math.abs(e.expectedMs - e.actualMs));
  return { count: abs.length, maxAbsMs: Math.max(...abs), meanAbsMs: abs.reduce((a, b) => a + b, 0) / abs.length };
}
