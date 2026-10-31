import { PlayStatus, State } from '../../gen/kantahe/v1/session_pb';

/**
 * Server time minus the local clock (performance.now) at the moment the state arrived.
 * Adding it to performance.now() gives the server's clock, whatever the device clock says.
 */
export function serverOffset(state: State, receivedAtPerfMs: number): number {
  return Number(state.serverTimeMs) - receivedAtPerfMs;
}

/** Where the current song is now: a playing song moves on with the server clock, a paused one stays. */
export function positionNow(state: State, offsetMs: number, perfNowMs: number): number {
  const now = state.now;
  if (!now) return 0;
  const position = Number(now.positionMs);
  if (state.status !== PlayStatus.PLAYING) return position;
  return position + Math.max(0, perfNowMs + offsetMs - Number(now.positionAtMs));
}
