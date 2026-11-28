import { State } from '../../gen/kantahe/v1/session_pb';

/**
 * The time a song change takes besides the songs themselves: the score screen and the title card of the next song (a few seconds each
 * by default). One fixed allowance per change; the start times are estimates and are said with "about" (kantahe-cqc.7).
 */
export const CHANGE_MS = 10_000;

/**
 * Milliseconds until each queued song starts: the rest of the current song, then the songs before it, plus CHANGE_MS per change. With
 * nothing playing the first song starts now. A song whose duration is unknown (0), and every song after it, is undefined.
 */
export function startsIn(state: State, positionMs: number): (number | undefined)[] {
  const current = Number(state.now?.song?.durationMs ?? 0n);
  let at: number | undefined = state.now ? (current > 0 ? Math.max(0, current - positionMs) + CHANGE_MS : undefined) : 0;
  return state.queue.map((item) => {
    const here = at;
    const length = Number(item.song?.durationMs ?? 0n);
    at = at === undefined || length <= 0 ? undefined : at + length + CHANGE_MS;
    return here;
  });
}
