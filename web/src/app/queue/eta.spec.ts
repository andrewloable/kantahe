import { create } from '@bufbuild/protobuf';
import { NowPlayingSchema, QueueItemSchema, StateSchema } from '../../gen/kantahe/v1/session_pb';
import { SongSchema } from '../../gen/kantahe/v1/common_pb';
import { CHANGE_MS, startsIn } from './eta';

// kantahe-cqc.7: when each queued song starts, roughly
const song = (ms: number) => create(SongSchema, { number: String(ms), durationMs: BigInt(ms) });
const item = (ms: number) => create(QueueItemSchema, { id: `q${ms}`, song: song(ms) });

describe('startsIn', () => {
  it('the rest of the current song, then each song before it, with an allowance for every change', () => {
    const state = create(StateSchema, { now: create(NowPlayingSchema, { song: song(200_000) }), queue: [item(180_000), item(240_000)] });
    expect(CHANGE_MS).toBe(10_000);
    expect(startsIn(state, 50_000)).toEqual([160_000, 350_000]);
  });

  it('nothing playing: the first song starts now', () => {
    const state = create(StateSchema, { queue: [item(180_000), item(60_000)] });
    expect(startsIn(state, 0)).toEqual([0, 190_000]);
  });

  it('an unknown duration makes that song and every later one unknown', () => {
    const state = create(StateSchema, { now: create(NowPlayingSchema, { song: song(200_000) }), queue: [item(180_000), item(0), item(60_000)] });
    expect(startsIn(state, 0)).toEqual([210_000, 400_000, undefined]);
  });

  it('a position past the end of the song counts as its end', () => {
    const state = create(StateSchema, { now: create(NowPlayingSchema, { song: song(100_000) }), queue: [item(60_000)] });
    expect(startsIn(state, 150_000)).toEqual([10_000]);
  });
});
