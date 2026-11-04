import { CacheEntry, DEFAULT_LIMITS, GIB, MIB, planStore, reserveBytes } from './cache-policy';

const entry = (key: string, mib: number, lastUsed: number): CacheEntry => ({ key, bytes: mib * MIB, lastUsed });
const none = new Set<string>();

describe('reserveBytes', () => {
  it('is 512 MiB on a small quota and 10 percent of a large one', () => {
    expect(reserveBytes(1 * GIB)).toBe(512 * MIB);
    expect(reserveBytes(5 * GIB)).toBe(512 * MIB);
    expect(reserveBytes(20 * GIB)).toBe(2 * GIB);
  });
});

describe('planStore', () => {
  const big = { quota: 100 * GIB, usage: 1 * GIB };

  it('stores without evicting when there is plenty of room', () => {
    expect(planStore([], { quota: 20 * GIB, usage: 1 * GIB }, 10 * MIB, none)).toEqual({ ok: true, evict: [] });
  });

  it('evicts the oldest entries until the cache cap holds', () => {
    const entries = [entry('a', 10, 1), entry('b', 20, 2), entry('c', 30, 3)];
    const plan = planStore(entries, big, 25 * MIB, none, { ...DEFAULT_LIMITS, capBytes: 60 * MIB });
    expect(plan).toEqual({ ok: true, evict: ['a', 'b'] });
  });

  it('evicts by last use, not by the order of the list', () => {
    const entries = [entry('c', 30, 3), entry('b', 20, 2), entry('a', 10, 1)];
    const plan = planStore(entries, big, 25 * MIB, none, { ...DEFAULT_LIMITS, capBytes: 60 * MIB });
    expect(plan).toEqual({ ok: true, evict: ['a', 'b'] });
  });

  it('breaks a tie on last use by the key, so that the plan is the same every time', () => {
    const entries = [entry('y', 30, 5), entry('x', 30, 5)];
    const plan = planStore(entries, big, 20 * MIB, none, { ...DEFAULT_LIMITS, capBytes: 70 * MIB });
    expect(plan).toEqual({ ok: true, evict: ['x'] });
  });

  it('evicts until the free space stays above the reserve (10 GiB quota: reserve 1 GiB)', () => {
    const space = { quota: 10 * GIB, usage: 9.5 * GIB };
    const entries = [entry('a', 400, 1), entry('b', 400, 2)];
    expect(planStore(entries, space, 100 * MIB, none)).toEqual({ ok: true, evict: ['a', 'b'] });
  });

  it('never evicts a protected entry: with nothing else to evict there is no room', () => {
    const space = { quota: 10 * GIB, usage: 9.5 * GIB };
    const entries = [entry('a', 400, 1), entry('b', 400, 2)];
    expect(planStore(entries, space, 100 * MIB, new Set(['a', 'b']))).toEqual({ ok: false, reason: 'no-room' });
  });

  it('skips a protected entry and evicts the next oldest one', () => {
    const entries = [entry('a', 30, 1), entry('b', 30, 2), entry('c', 30, 3)];
    const plan = planStore(entries, big, 20 * MIB, new Set(['a']), { ...DEFAULT_LIMITS, capBytes: 90 * MIB });
    expect(plan).toEqual({ ok: true, evict: ['b'] });
  });

  it('refuses a file larger than the whole cache, and evicts nothing for it', () => {
    expect(planStore([entry('a', 10, 1)], big, 3 * GIB, none)).toEqual({ ok: false, reason: 'too-big' });
  });

  it('allows a file that exactly fills the cap and exactly leaves the reserve', () => {
    const space = { quota: 10 * GIB, usage: 10 * GIB - (1 * GIB + 100 * MIB) };
    expect(planStore([], space, 100 * MIB, none, { ...DEFAULT_LIMITS, capBytes: 100 * MIB })).toEqual({ ok: true, evict: [] });
  });

  it('refuses one byte more than that', () => {
    const space = { quota: 10 * GIB, usage: 10 * GIB - (1 * GIB + 100 * MIB) };
    expect(planStore([], space, 100 * MIB + 1, none, { ...DEFAULT_LIMITS, capBytes: 200 * MIB })).toEqual({ ok: false, reason: 'no-room' });
  });

  it('copes with a usage above the quota and with no quota at all: no room', () => {
    expect(planStore([], { quota: 1 * GIB, usage: 2 * GIB }, 1 * MIB, none)).toEqual({ ok: false, reason: 'no-room' });
    expect(planStore([], { quota: 0, usage: 0 }, 1 * MIB, none)).toEqual({ ok: false, reason: 'no-room' });
  });

  it('does not change the list it is given', () => {
    const entries = [entry('b', 20, 2), entry('a', 10, 1)];
    planStore(entries, big, 25 * MIB, none, { ...DEFAULT_LIMITS, capBytes: 40 * MIB });
    expect(entries.map((e) => e.key)).toEqual(['b', 'a']);
  });
});
