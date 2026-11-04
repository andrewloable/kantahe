import { IDBFactory } from 'fake-indexeddb';
import { CacheLimits, DEFAULT_LIMITS, GIB, MIB } from './cache-policy';
import { SongCache, SongCacheEnv } from './song-cache';

// A page that is not a secure context (plain http:// from a LAN address) has no Cache Storage and no navigator.storage. IndexedDB is there, and
// the Flutter apps tell the page the free space of the device: with both, the cache works; without the free space it keeps nothing.

const INDEX = 'kantahe.songcache.index';
const limits: CacheLimits = { ...DEFAULT_LIMITS, reserveMinBytes: 512 * MIB, reserveFraction: 0 };

function setup(over: Partial<SongCacheEnv> = {}, lim: CacheLimits = limits) {
  const idb = new IDBFactory();
  const store = new Map<string, string>();
  const fetched: string[] = [];
  const blobs = new Map<string, Blob>();
  const server = new Map<string, number>(); // url → bytes
  let clock = 1000;
  const env: SongCacheEnv = {
    caches: undefined,
    estimate: undefined,
    indexedDB: idb,
    fetch: async (url) => {
      fetched.push(url);
      const n = server.get(url);
      if (n === undefined) return new Response('no', { status: 404 });
      return new Response(new Uint8Array(n).fill(n % 251), { headers: { 'content-length': String(n), 'content-type': 'audio/mpeg' } });
    },
    createObjectURL: (b) => {
      const u = 'blob:' + blobs.size;
      blobs.set(u, b);
      return u;
    },
    revokeObjectURL: () => undefined,
    now: () => clock,
    read: (k) => store.get(k),
    write: (k, v) => void store.set(k, v),
    remove: (k) => void store.delete(k),
    limits: lim,
    ...over,
  };
  const cache = new SongCache(env);
  return { cache, env, idb, store, fetched, blobs, server, tick: () => (clock += 10) };
}

describe('SongCache over IndexedDB (a page that is not a secure context)', () => {
  it('REGRESSION: without any source of free space nothing is kept, and the cache says it is not available', async () => {
    const s = setup();
    s.server.set('a', 10 * MIB);
    expect(s.cache.supported()).toBe(false);
    expect(s.cache.available()).toBe(false);
    expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(false);
    expect(s.fetched).toEqual([]);
    expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
  });

  it('works once the app has told the free space: store, then lookup gives the same bytes', async () => {
    const s = setup();
    s.cache.setNativeFreeBytes(10 * GIB);
    s.server.set('a', 1000);
    expect(s.cache.supported()).toBe(true);
    expect(await s.cache.store('audio', '1', 'v1', 'a')).toBe(true);
    const url = await s.cache.lookup('audio', '1', 'v1');
    expect(url).toMatch(/^blob:/);
    const blob = s.blobs.get(url!)!;
    expect(blob.size).toBe(1000);
    expect(blob.type).toBe('audio/mpeg');
    expect(await s.cache.stats()).toMatchObject({ count: 1, bytes: 1000 });
  });

  it('does not give a file of another version back, and deletes it', async () => {
    const s = setup();
    s.cache.setNativeFreeBytes(10 * GIB);
    s.server.set('a', 1000);
    await s.cache.store('audio', '1', 'v1', 'a');
    expect(await s.cache.lookup('audio', '1', 'v2')).toBeUndefined();
    expect((await s.cache.stats()).count).toBe(0);
    expect(await s.cache.lookup('audio', '1', 'v1')).toBeUndefined();
  });

  it('is found again by a new page (the files are in IndexedDB, the rows in localStorage)', async () => {
    const s = setup();
    s.cache.setNativeFreeBytes(10 * GIB);
    s.server.set('a', 1000);
    await s.cache.store('audio', '1', 'v1', 'a');
    const again = new SongCache(s.env);
    expect(await again.lookup('audio', '1', 'v1')).toBeUndefined(); // until the app has told the free space this page has no use for the cache
    again.setNativeFreeBytes(10 * GIB);
    expect(await again.lookup('audio', '1', 'v1')).toMatch(/^blob:/);
  });

  it('keeps the free space above the reserve: no room below it', async () => {
    const s = setup();
    s.cache.setNativeFreeBytes(300 * MIB);
    s.server.set('a', 10 * MIB);
    expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(false);
    expect((await s.cache.stats()).count).toBe(0);
  });

  it('evicts the oldest file to make room, and keeps a pinned one', async () => {
    const s = setup();
    s.cache.setNativeFreeBytes(512 * MIB + 25 * MIB);
    for (const [u, n] of [['a', 10], ['b', 10], ['c', 10]] as const) s.server.set(u, n * MIB);
    await s.cache.store('audio', '1', 'v', 'a');
    s.tick();
    await s.cache.store('audio', '2', 'v', 'b');
    s.tick();
    // 25 MiB over the reserve at the start, 20 MiB stored: the third does not fit until the oldest goes
    expect(await s.cache.store('audio', '3', 'v', 'c')).toBe(true);
    expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
    expect(await s.cache.lookup('audio', '2', 'v')).toMatch(/^blob:/);
    s.cache.pin(['audio/2', 'audio/3']);
    s.server.set('d', 10 * MIB);
    expect(await s.cache.store('audio', '4', 'v', 'd')).toBe(false); // everything else is pinned
  });

  it('drops a row whose file is gone, and deletes a file that has no row', async () => {
    const s = setup();
    s.cache.setNativeFreeBytes(10 * GIB);
    s.server.set('a', 1000);
    await s.cache.store('audio', '1', 'v', 'a');
    s.store.set(INDEX, JSON.stringify([{ kind: 'audio', number: '9', version: 'v', bytes: 5, lastUsed: 1 }])); // the row of 1 is lost, a row of 9 has no file
    const fresh = new SongCache(s.env);
    fresh.setNativeFreeBytes(10 * GIB);
    expect(await fresh.stats()).toMatchObject({ count: 0 });
    expect(await fresh.lookup('audio', '1', 'v')).toBeUndefined(); // the file of 1 was deleted
  });

  it('clear removes everything and discard removes one file', async () => {
    const s = setup();
    s.cache.setNativeFreeBytes(10 * GIB);
    s.server.set('a', 1000);
    s.server.set('b', 1000);
    await s.cache.store('audio', '1', 'v', 'a');
    await s.cache.store('audio', '2', 'v', 'b');
    await s.cache.discard('audio', '1');
    expect((await s.cache.stats()).count).toBe(1);
    await s.cache.clear();
    expect(await s.cache.stats()).toMatchObject({ count: 0 });
    const later = new SongCache(s.env);
    later.setNativeFreeBytes(10 * GIB);
    expect(await later.lookup('audio', '2', 'v')).toBeUndefined();
  });

  it('never throws when IndexedDB cannot be opened', async () => {
    const broken = {
      open: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as IDBFactory;
    const s = setup({ indexedDB: broken });
    s.cache.setNativeFreeBytes(10 * GIB);
    s.server.set('a', 1000);
    expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(false);
    expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
    expect(await s.cache.stats()).toMatchObject({ count: 0 });
    await s.cache.clear();
  });

  it('keeps using Cache Storage where there is one (a secure context): IndexedDB is not touched', async () => {
    const open = vi.fn();
    const put = vi.fn().mockResolvedValue(undefined);
    const cacheStorage = {
      open: async () => ({ put, match: async () => undefined, delete: async () => true, keys: async () => [] }),
      delete: async () => true,
    } as unknown as CacheStorage;
    const s = setup({ caches: cacheStorage, estimate: async () => ({ quota: 100 * GIB, usage: 0 }), indexedDB: { open } as unknown as IDBFactory });
    s.server.set('a', 1000);
    expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(true);
    expect(put).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });
});
