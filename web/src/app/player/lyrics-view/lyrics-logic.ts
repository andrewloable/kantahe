import { LyricLine, LyricWord } from '../../../gen/kantahe/v1/common_pb';

/** A line becomes active this long before its first word (the server uses the same rule). */
const LEAD_MS = 50;
const COUNT_IN_MS = 4000;
/** The count-in is only shown before a line that has at least this much time before it. */
const MIN_QUIET_MS = 5000;

/** Index of the last line that has started (with 50 ms of lead), -1 before the first. */
export function activeLine(lines: readonly LyricLine[], tMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (Number(lines[mid].startMs) <= tMs + LEAD_MS) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Which lines the two rows show: even lines on top, odd lines below, so the next line is already visible. */
export function rowsFor(active: number): { top: number; bottom: number } {
  const base = Math.max(active, 0);
  return { top: base % 2 === 0 ? base : base + 1, bottom: base % 2 === 1 ? base : base + 1 };
}

/** How much of a word has been sung, 0 to 1. */
export function wipe(word: Pick<LyricWord, 'startMs' | 'endMs'>, tMs: number): number {
  const start = Number(word.startMs);
  const end = Number(word.endMs);
  if (end <= start) return tMs >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (tMs - start) / (end - start)));
}

/**
 * Dots before a line that follows a quiet stretch: the first line (if it starts at 4 s or later), or a
 * line that starts 5 s or more after the previous one ended. 1 to 4 while the last 4 seconds run, with
 * the number of whole seconds still to go rounded up; 0 otherwise.
 */
export function countIn(lines: readonly LyricLine[], active: number, tMs: number): number {
  let next: LyricLine | undefined;
  if (active < 0) {
    next = lines[0];
    if (next && Number(next.startMs) < COUNT_IN_MS) return 0;
  } else {
    next = lines[active + 1];
    if (next && Number(next.startMs) - Number(lines[active].endMs) < MIN_QUIET_MS) return 0;
  }
  if (!next) return 0;
  const left = Number(next.startMs) - tMs;
  return left > 0 && left <= COUNT_IN_MS ? Math.ceil(left / 1000) : 0;
}

/** The scale that makes a row of contentWidth fit into containerWidth (never enlarges). */
export function fitScale(containerWidth: number, contentWidth: number): number {
  if (containerWidth <= 0 || contentWidth <= 0) return 1;
  return Math.min(1, containerWidth / contentWidth);
}
