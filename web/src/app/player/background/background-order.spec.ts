import { nextPass } from './background-order';

/** A small seeded generator (mulberry32), so that the 200 passes are the same in every run. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('nextPass', () => {
  it('without shuffle it is the order the server gave, every time', () => {
    expect(nextPass(['a', 'b', 'c'], false, undefined)).toEqual(['a', 'b', 'c']);
    expect(nextPass(['a', 'b', 'c'], false, 'c')).toEqual(['a', 'b', 'c']);
  });

  it('does not change the list it is given', () => {
    const list = ['a', 'b', 'c', 'd'];
    nextPass(list, true, undefined, seeded(1));
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  it('with shuffle every pass is a permutation of all videos and starts with another video than the last pass ended with', () => {
    const random = seeded(42);
    const ids = ['a', 'b', 'c', 'd', 'e'];
    let last: string | undefined;
    const firsts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pass = nextPass(ids, true, last, random);
      expect([...pass].sort()).toEqual(ids);
      if (last !== undefined) expect(pass[0], `pass ${i}`).not.toBe(last);
      firsts.add(pass[0]);
      last = pass[pass.length - 1];
    }
    expect(firsts.size, 'the shuffle really varies').toBeGreaterThan(2);
  });

  it('with two videos a shuffled pass never repeats the one that just played', () => {
    const random = seeded(7);
    let last = 'b';
    for (let i = 0; i < 50; i++) {
      const pass = nextPass(['a', 'b'], true, last, random);
      expect(pass[0]).not.toBe(last);
      last = pass[1];
    }
  });

  it('one video, or none, is returned as it is', () => {
    expect(nextPass(['a'], true, 'a', seeded(3))).toEqual(['a']);
    expect(nextPass([], true, undefined)).toEqual([]);
  });
});
