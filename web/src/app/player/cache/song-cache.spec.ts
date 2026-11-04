import { TestBed } from '@angular/core/testing';
import { CacheLimits, DEFAULT_LIMITS, GIB, MIB } from './cache-policy';
import { SONG_CACHE_ENV, SongCache, SongCacheEnv } from './song-cache';

const URL_A = 'http://srv/media/song/00001?sig=1';

const pathOf = (request: RequestInfo): string => new URL(request instanceof Request ? request.url : String(request), 'http://page/').pathname;

class FakeCache {
  files = new Map<string, Uint8Array>();
  failPuts = 0; // the next puts throw QuotaExceededError
  async put(request: RequestInfo, response: Response): Promise<void> {
    if (this.failPuts > 0) {
      this.failPuts--;
      await response.arrayBuffer().catch(() => undefined);
      throw new DOMException('full', 'QuotaExceededError');
    }
    this.files.set(pathOf(request), new Uint8Array(await response.arrayBuffer()));
  }
  async match(request: RequestInfo): Promise<Response | undefined> {
    const b = this.files.get(pathOf(request));
    return b ? new Response(b.slice()) : undefined;
  }
  async delete(request: RequestInfo): Promise<boolean> {
    return this.files.delete(pathOf(request));
  }
  async keys(): Promise<Request[]> {
    return [...this.files.keys()].map((p) => new Request('http://page' + p));
  }
}

interface Setup {
  cache: SongCache;
  fake: FakeCache;
  store: Map<string, string>;
  fetched: string[];
  blobs: Map<string, Blob>;
  revoked: string[];
  tick: () => number;
  env: SongCacheEnv;
  /** What the server has: url → file (length false: no Content-Length header; status for an error). */
  server: Map<string, { bytes: number; length?: boolean; status?: number }>;
  other: { usage: number; quota: number | undefined };
}

function setup(limits: CacheLimits = { ...DEFAULT_LIMITS, reserveMinBytes: 0, reserveFraction: 0 }, withCaches = true): Setup {
  const fake = new FakeCache();
  const store = new Map<string, string>();
  const fetched: string[] = [];
  const blobs = new Map<string, Blob>();
  const revoked: string[] = [];
  const server = new Map<string, { bytes: number; length?: boolean; status?: number }>();
  const other = { usage: 0, quota: 100 * GIB as number | undefined };
  let clock = 1000;
  let deleted = false;
  const env: SongCacheEnv = {
    caches: withCaches
      ? ({
          open: async () => fake,
          delete: async () => {
            deleted = true;
            fake.files.clear();
            return true;
          },
        } as unknown as CacheStorage)
      : undefined,
    estimate: withCaches
      ? async () => {
          let used = other.usage;
          for (const b of fake.files.values()) used += b.length;
          return { quota: other.quota, usage: used };
        }
      : undefined,
    fetch: async (url) => {
      fetched.push(url);
      const f = server.get(url);
      if (!f) return new Response('no', { status: 404 });
      return new Response(new Uint8Array(f.bytes).fill(f.bytes % 251), { status: f.status ?? 200, headers: f.length === false ? {} : { 'content-length': String(f.bytes) } });
    },
    createObjectURL: (b) => {
      const u = 'blob:' + blobs.size;
      blobs.set(u, b);
      return u;
    },
    revokeObjectURL: (u) => revoked.push(u),
    now: () => clock,
    read: (k) => store.get(k),
    write: (k, v) => void store.set(k, v),
    remove: (k) => void store.delete(k),
    limits,
  };
  void deleted;
  return { cache: new SongCache(env), fake, store, fetched, blobs, revoked, tick: () => (clock += 10), env, server, other };
}

const INDEX = 'kantahe.songcache.index';

describe('SongCache', () => {
  it('stores a file and gives it back for the same version', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    expect(await s.cache.store('audio', '00001', 'v1', URL_A)).toBe(true);
    const url = await s.cache.lookup('audio', '00001', 'v1');
    expect(url).toMatch(/^blob:/);
    expect((await s.blobs.get(url!)!.arrayBuffer()).byteLength).toBe(100);
    expect(await s.cache.stats()).toMatchObject({ count: 1, bytes: 100 });
  });

  it('does not give a file back for another version, and drops it', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    await s.cache.store('audio', '00001', 'v1', URL_A);
    expect(await s.cache.lookup('audio', '00001', 'v2')).toBeUndefined();
    expect((await s.cache.stats()).count).toBe(0);
    expect(s.fake.files.size).toBe(0);
  });

  it('keeps the audio and the vocals of one song apart', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 10 });
    s.server.set('http://srv/v', { bytes: 20 });
    await s.cache.store('audio', '00001', 'v1', URL_A);
    await s.cache.store('vocals', '00001', 'v1', 'http://srv/v');
    expect((await s.cache.stats()).count).toBe(2);
    expect(await s.cache.lookup('vocals', '00001', 'v1')).toMatch(/^blob:/);
  });

  it('never fetches when the version is empty', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    expect(await s.cache.store('audio', '00001', '', URL_A)).toBe(false);
    expect(s.fetched).toEqual([]);
    expect(await s.cache.lookup('audio', '00001', '')).toBeUndefined();
  });

  it('does not keep an error answer or an answer without a size', async () => {
    const s = setup();
    expect(await s.cache.store('audio', '00001', 'v1', 'http://srv/missing')).toBe(false);
    s.server.set(URL_A, { bytes: 100, length: false });
    expect(await s.cache.store('audio', '00001', 'v1', URL_A)).toBe(false);
    expect((await s.cache.stats()).count).toBe(0);
  });

  it('REGRESSION: a replaced file (new version) is stored again and the old one is gone', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    await s.cache.store('audio', '00001', 'v1', URL_A);
    s.server.set(URL_A, { bytes: 150 });
    expect(await s.cache.store('audio', '00001', 'v2', URL_A)).toBe(true);
    expect(s.fake.files.size).toBe(1); // the old file is gone
    const url = await s.cache.lookup('audio', '00001', 'v2');
    expect((await s.blobs.get(url!)!.arrayBuffer()).byteLength).toBe(150);
    expect(await s.cache.stats()).toMatchObject({ count: 1, bytes: 150 });
    expect(await s.cache.lookup('audio', '00001', 'v1')).toBeUndefined(); // the old version is never given back
  });

  it('does not fetch a file it already has', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    await s.cache.store('audio', '00001', 'v1', URL_A);
    expect(await s.cache.store('audio', '00001', 'v1', URL_A)).toBe(true);
    expect(s.fetched).toHaveLength(1);
  });

  it('fetches once when the same file is asked for twice at the same time', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    const [a, b] = await Promise.all([s.cache.store('audio', '00001', 'v1', URL_A), s.cache.store('audio', '00001', 'v1', URL_A)]);
    expect([a, b]).toEqual([true, true]);
    expect(s.fetched).toHaveLength(1);
  });

  describe('making room', () => {
    const limits = { ...DEFAULT_LIMITS, capBytes: 100, reserveMinBytes: 0, reserveFraction: 0 };
    const fill = async (s: Setup) => {
      s.server.set('a', { bytes: 60 });
      s.server.set('b', { bytes: 30 });
      s.server.set('c', { bytes: 40 });
      await s.cache.store('audio', '1', 'v', 'a');
      s.tick();
      await s.cache.store('audio', '2', 'v', 'b');
      s.tick();
    };

    it('evicts the oldest file to store a new one', async () => {
      const s = setup(limits);
      await fill(s);
      expect(await s.cache.store('audio', '3', 'v', 'c')).toBe(true);
      expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
      expect(await s.cache.lookup('audio', '2', 'v')).toMatch(/^blob:/);
      expect(await s.cache.lookup('audio', '3', 'v')).toMatch(/^blob:/);
    });

    it('counts a play as a use: the song played last is kept', async () => {
      const s = setup(limits);
      await fill(s);
      expect(await s.cache.lookup('audio', '1', 'v')).toMatch(/^blob:/); // a is older than b, but played now
      s.tick();
      expect(await s.cache.store('audio', '3', 'v', 'c')).toBe(true);
      expect(await s.cache.lookup('audio', '2', 'v')).toBeUndefined();
      expect(await s.cache.lookup('audio', '1', 'v')).toMatch(/^blob:/);
    });

    it('keeps pinned files: the next oldest goes instead', async () => {
      const s = setup(limits);
      await fill(s);
      s.cache.pin(['audio/1']);
      expect(await s.cache.store('audio', '3', 'v', 'c')).toBe(true);
      expect(await s.cache.lookup('audio', '1', 'v')).toMatch(/^blob:/);
      expect(await s.cache.lookup('audio', '2', 'v')).toBeUndefined();
    });

    it('does not store, and evicts nothing, when everything else is pinned', async () => {
      const s = setup(limits);
      await fill(s);
      s.cache.pin(['audio/1', 'audio/2']);
      expect(await s.cache.store('audio', '3', 'v', 'c')).toBe(false);
      expect((await s.cache.stats()).count).toBe(2);
    });

    it('keeps the free space above the reserve: no store when the device is nearly full and nothing may go', async () => {
      const s = setup({ ...DEFAULT_LIMITS, reserveMinBytes: 1000, reserveFraction: 0 });
      s.other.quota = 1500;
      s.other.usage = 900; // free 600: below the reserve already
      s.server.set(URL_A, { bytes: 100 });
      expect(await s.cache.store('audio', '1', 'v', URL_A)).toBe(false);
      expect(s.fake.files.size).toBe(0);
    });

    it('evicts to get back above the reserve', async () => {
      const s = setup({ ...DEFAULT_LIMITS, reserveMinBytes: 1000, reserveFraction: 0 });
      s.other.quota = 3000;
      s.other.usage = 0;
      s.server.set('a', { bytes: 1500 });
      s.server.set('b', { bytes: 600 });
      await s.cache.store('audio', '1', 'v', 'a'); // free 1500 after it: fine
      s.tick();
      expect(await s.cache.store('audio', '2', 'v', 'b')).toBe(true); // 3000 - 1500 - 600 = 900 < 1000: a must go
      expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
    });

    it('treats a missing quota as no room', async () => {
      const s = setup();
      s.other.quota = undefined;
      s.server.set(URL_A, { bytes: 100 });
      expect(await s.cache.store('audio', '1', 'v', URL_A)).toBe(false);
    });
  });

  describe('a full disk', () => {
    it('evicts the oldest file once and tries again', async () => {
      const s = setup();
      s.server.set('a', { bytes: 10 });
      s.server.set('b', { bytes: 10 });
      await s.cache.store('audio', '1', 'v', 'a');
      s.tick();
      s.fake.failPuts = 1;
      expect(await s.cache.store('audio', '2', 'v', 'b')).toBe(true);
      expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
      expect(await s.cache.lookup('audio', '2', 'v')).toMatch(/^blob:/);
    });

    it('gives up after the second failure and leaves nothing behind', async () => {
      const s = setup();
      s.server.set('a', { bytes: 10 });
      s.server.set('b', { bytes: 10 });
      await s.cache.store('audio', '1', 'v', 'a');
      s.tick();
      s.fake.failPuts = 2;
      expect(await s.cache.store('audio', '2', 'v', 'b')).toBe(false);
      expect(await s.cache.lookup('audio', '2', 'v')).toBeUndefined();
      expect(JSON.parse(s.store.get(INDEX) ?? '[]').map((r: { number: string }) => r.number)).not.toContain('2');
    });

    it('gives up at once when there is nothing it may evict', async () => {
      const s = setup();
      s.server.set('a', { bytes: 10 });
      s.fake.failPuts = 1;
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(false);
      expect(s.fetched).toHaveLength(1);
    });
  });

  describe('the index', () => {
    it('drops a row whose file is gone, and deletes a file that has no row', async () => {
      const s = setup();
      s.store.set(INDEX, JSON.stringify([{ kind: 'audio', number: '7', version: 'v', bytes: 5, lastUsed: 1 }]));
      s.fake.files.set('/kantahe-song-cache/audio/8', new Uint8Array(5));
      expect(await s.cache.stats()).toMatchObject({ count: 0, bytes: 0 });
      expect(s.fake.files.size).toBe(0);
      expect(JSON.parse(s.store.get(INDEX) ?? '[]')).toEqual([]);
    });

    it('ignores an index that is not what it wrote', async () => {
      const s = setup();
      s.store.set(INDEX, '{not json');
      expect((await s.cache.stats()).count).toBe(0);
      s.store.set(INDEX, JSON.stringify([{ kind: 'x', number: 1 }, null, 'a']));
      const t = setup();
      t.store.set(INDEX, s.store.get(INDEX)!);
      expect((await t.cache.stats()).count).toBe(0);
    });

    it('is found again by a new page', async () => {
      const s = setup();
      s.server.set(URL_A, { bytes: 100 });
      await s.cache.store('audio', '00001', 'v1', URL_A);
      const again = new SongCache(s.env);
      expect(await again.lookup('audio', '00001', 'v1')).toMatch(/^blob:/);
    });
  });

  it('discard deletes a file and its row (a kept file that would not play)', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    await s.cache.store('audio', '00001', 'v1', URL_A);
    await s.cache.discard('audio', '00001');
    expect(await s.cache.stats()).toMatchObject({ count: 0, bytes: 0 });
    expect(s.fake.files.size).toBe(0);
    await s.cache.discard('audio', '00009'); // a file that is not there is no error
  });

  it('release revokes the object URL', () => {
    const s = setup();
    s.cache.release('blob:9');
    expect(s.revoked).toEqual(['blob:9']);
  });

  it('clear removes every file and the index', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    await s.cache.store('audio', '00001', 'v1', URL_A);
    await s.cache.clear();
    expect(await s.cache.stats()).toMatchObject({ count: 0, bytes: 0 });
    expect(s.fake.files.size).toBe(0);
    expect(s.store.has(INDEX)).toBe(false);
    expect(await s.cache.lookup('audio', '00001', 'v1')).toBeUndefined();
  });

  it('reports the cap in its stats', async () => {
    expect((await setup().cache.stats()).capBytes).toBe(DEFAULT_LIMITS.capBytes);
  });

  describe('the free space the app reports', () => {
    const limits = { ...DEFAULT_LIMITS, reserveMinBytes: 512 * MIB, reserveFraction: 0 };
    const song = (s: Setup, url: string, mib: number) => s.server.set(url, { bytes: mib * MIB });

    it('changes nothing when the app reports none', async () => {
      const s = setup(limits);
      song(s, 'a', 10);
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(true);
    });

    it('REGRESSION: a value below the reserve stops all storing, although the browser says there is plenty of room', async () => {
      const s = setup(limits);
      s.cache.setNativeFreeBytes(300 * MIB);
      song(s, 'a', 10);
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(false);
      expect(s.fake.files.size).toBe(0);
    });

    it('the smaller of the two values counts: the browser may be the one that is short of room', async () => {
      const s = setup(limits);
      s.other.usage = 100 * GIB - 300 * MIB; // the browser's estimate leaves 300 MiB
      s.cache.setNativeFreeBytes(10 * GIB);
      song(s, 'a', 10);
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(false);
    });

    it('stores when both have room', async () => {
      const s = setup(limits);
      s.cache.setNativeFreeBytes(10 * GIB);
      song(s, 'a', 10);
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(true);
    });

    it('counts what it stored since the app last reported (the value is old by up to a minute)', async () => {
      const s = setup(limits);
      s.cache.setNativeFreeBytes(512 * MIB + 15 * MIB);
      song(s, 'a', 10);
      song(s, 'b', 10);
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(true);
      s.cache.pin(['audio/1']);
      expect(await s.cache.store('audio', '2', 'v', 'b')).toBe(false); // 527 - 10 stored = 517 free, minus 10 = 507 < 512
      s.cache.setNativeFreeBytes(512 * MIB + 15 * MIB); // a new report starts the count again
      expect(await s.cache.store('audio', '2', 'v', 'b')).toBe(true);
    });

    it('ignores a value that is not a number or is negative', async () => {
      const s = setup(limits);
      s.cache.setNativeFreeBytes(300 * MIB);
      s.cache.setNativeFreeBytes(Number.NaN);
      s.cache.setNativeFreeBytes(-1);
      song(s, 'a', 10);
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(false); // the 300 MiB still stands
      s.cache.setNativeFreeBytes(undefined); // the app has nothing to say any more
      expect(await s.cache.store('audio', '1', 'v', 'a')).toBe(true);
    });
  });

  describe('the switch', () => {
    it('is on until the user turns it off, and the choice is kept in the browser', async () => {
      const s = setup();
      expect(s.cache.enabled()).toBe(true);
      s.cache.setEnabled(false);
      expect(s.cache.enabled()).toBe(false);
      expect(s.store.get('kantahe.songcache.enabled')).toBe('false');
      expect(new SongCache(s.env).enabled()).toBe(false);
      s.cache.setEnabled(true);
      expect(new SongCache(s.env).enabled()).toBe(true);
    });

    it('REGRESSION: when it is off nothing is looked up or stored, but what is kept can be seen and cleared', async () => {
      const s = setup();
      s.server.set(URL_A, { bytes: 100 });
      await s.cache.store('audio', '00001', 'v1', URL_A);
      s.cache.setEnabled(false);
      expect(s.cache.supported()).toBe(true);
      expect(s.cache.available()).toBe(false);
      expect(await s.cache.lookup('audio', '00001', 'v1')).toBeUndefined();
      s.server.set('b', { bytes: 10 });
      expect(await s.cache.store('audio', '00002', 'v1', 'b')).toBe(false);
      expect(s.fetched).toEqual([URL_A]);
      // a page that starts with the switch off still sees what is kept, and can clear it
      const fresh = new SongCache(s.env);
      expect(await fresh.stats()).toMatchObject({ count: 1, bytes: 100 });
      await fresh.clear();
      expect(await fresh.stats()).toMatchObject({ count: 0 });
    });

    it('a browser without Cache Storage is not supported, whatever the switch says', () => {
      const s = setup(undefined, false);
      expect(s.cache.supported()).toBe(false);
      s.cache.setEnabled(true);
      expect(s.cache.available()).toBe(false);
    });
  });

  describe('where the browser has no Cache Storage', () => {
    it('is not available and does nothing, without errors', async () => {
      const s = setup(undefined, false);
      expect(s.cache.available()).toBe(false);
      expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
      expect(await s.cache.store('audio', '1', 'v', URL_A)).toBe(false);
      expect(await s.cache.stats()).toMatchObject({ count: 0, bytes: 0 });
      await s.cache.clear();
      expect(s.fetched).toEqual([]);
    });
  });

  it('never throws to the caller, whatever the browser does', async () => {
    const s = setup();
    s.server.set(URL_A, { bytes: 100 });
    s.env.fetch = async () => {
      throw new TypeError('offline');
    };
    expect(await s.cache.store('audio', '1', 'v', URL_A)).toBe(false);
    s.env.estimate = async () => {
      throw new Error('boom');
    };
    expect(await s.cache.store('audio', '1', 'v', URL_A)).toBe(false);
    expect(await s.cache.lookup('audio', '1', 'v')).toBeUndefined();
  });
});

describe('SONG_CACHE_ENV', () => {
  it('REGRESSION: downloads for the cache at low priority, so that they do not slow the song that is playing', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x'));
    await TestBed.inject(SONG_CACHE_ENV).fetch('http://x/a');
    expect(spy).toHaveBeenCalledWith('http://x/a', expect.objectContaining({ priority: 'low' }));
    spy.mockRestore();
  });
});
