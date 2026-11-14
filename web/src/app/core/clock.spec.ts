import { create } from '@bufbuild/protobuf';
import { NowPlayingSchema, PlayStatus, StateSchema } from '../../gen/kantahe/v1/session_pb';
import { positionNow, serverOffset } from './clock';

function state(status: PlayStatus, serverTimeMs: number, positionMs = 41200, positionAtMs = 1000) {
  return create(StateSchema, {
    status,
    serverTimeMs: BigInt(serverTimeMs),
    now: create(NowPlayingSchema, { positionMs: BigInt(positionMs), positionAtMs: BigInt(positionAtMs) }),
  });
}

describe('clock', () => {
  it('serverOffset is server time minus the local clock at receipt', () => {
    expect(serverOffset(state(PlayStatus.PLAYING, 1000), 250)).toBe(750);
  });

  it('a playing song advances with the server clock', () => {
    const s = state(PlayStatus.PLAYING, 1000);
    const offset = serverOffset(s, 0); // received at local 0 => offset 1000
    expect(positionNow(s, offset, 2000)).toBe(43200); // local 2000 = server 3000
  });

  it('a paused song stays where it is', () => {
    const s = state(PlayStatus.PAUSED, 1000);
    expect(positionNow(s, serverOffset(s, 0), 2000)).toBe(41200);
  });

  it('counts from position_at_ms, not from the time the state arrived', () => {
    const s = state(PlayStatus.PLAYING, 5000, 10000, 4000); // position was 10000 at server 4000
    expect(positionNow(s, serverOffset(s, 0), 0)).toBe(11000); // local 0 = server 5000
  });

  it('never goes backwards when the clocks disagree slightly', () => {
    const s = state(PlayStatus.PLAYING, 1000, 500, 1200); // position_at is ahead of the server time
    expect(positionNow(s, serverOffset(s, 0), 0)).toBe(500);
  });

  it('positionNow_at_tempo: a song at 75 percent moves 3000 ms of song in 4000 ms, at 125 percent 5000 ms, and 0 or unset means 100', () => {
    const at = (tempoPct?: number) => {
      const s = state(PlayStatus.PLAYING, 1000, 1000, 1000);
      if (tempoPct !== undefined) s.now!.tempoPct = tempoPct;
      return positionNow(s, serverOffset(s, 0), 4000); // 4000 ms after position_at_ms
    };
    expect(at(75)).toBe(4000);
    expect(at(125)).toBe(6000);
    expect(at(100)).toBe(5000);
    expect(at(0)).toBe(5000);
    expect(at()).toBe(5000);
  });

  it('a paused song at any tempo stays where it is', () => {
    const s = state(PlayStatus.PAUSED, 1000);
    s.now!.tempoPct = 75;
    expect(positionNow(s, serverOffset(s, 0), 9000)).toBe(41200);
  });

  it('is 0 with nothing playing', () => {
    const s = create(StateSchema, { status: PlayStatus.PAUSED, serverTimeMs: 1n });
    expect(positionNow(s, 0, 100)).toBe(0);
  });
});
