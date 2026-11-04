import { inject, InjectionToken } from '@angular/core';
import { readStore, removeStore, writeStore } from '../../core/storage';
import { CacheEntry, CacheLimits, DEFAULT_LIMITS, planStore } from './cache-policy';
import { CacheStorageBackend, FileBackend, IndexedDbBackend } from './file-backend';

/** A song has two files that can be kept: its audio (an MP3, or MIDI the server rendered) and the guide vocals. */
export type CacheKind = 'audio' | 'vocals';

interface Row {
  kind: CacheKind;
  number: string;
  /** The server's audio_version / vocals_version of the file that is kept. */
  version: string;
  bytes: number;
  /** When the file was stored or last played, in ms since the epoch. */
  lastUsed: number;
}

/** What the cache needs from the browser, so that tests can stand in for it. */
export interface SongCacheEnv {
  /** Undefined where the browser has no Cache Storage (older TV browsers; any page that is not a secure context). */
  caches: CacheStorage | undefined;
  /** IndexedDB, for a page that has no Cache Storage (not a secure context); not used where Cache Storage exists. */
  indexedDB?: IDBFactory;
  /** navigator.storage.estimate; undefined where there is none (not a secure context). Without it only the app's number tells the free space. */
  estimate: (() => Promise<StorageEstimate>) | undefined;
  fetch(url: string): Promise<Response>;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  now(): number;
  read(key: string): string | undefined;
  write(key: string, value: string): void;
  remove(key: string): void;
  limits: CacheLimits;
}

export const SONG_CACHE_ENV = new InjectionToken<SongCacheEnv>('kantahe song cache environment', {
  providedIn: 'root',
  factory: () => ({
    caches: typeof caches === 'undefined' ? undefined : caches,
    indexedDB: typeof indexedDB === 'undefined' ? undefined : indexedDB,
    estimate: typeof navigator !== 'undefined' && navigator.storage?.estimate ? () => navigator.storage.estimate() : undefined,
    // low priority: this download is background work and must not take bandwidth from the song that streams from the same server
    fetch: (url) => fetch(url, { priority: 'low' }),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    now: () => Date.now(),
    read: readStore,
    write: writeStore,
    remove: removeStore,
    limits: DEFAULT_LIMITS,
  }),
});

const INDEX_KEY = 'kantahe.songcache.index';
const ENABLED_KEY = 'kantahe.songcache.enabled';

const keyOf = (kind: CacheKind, number: string): string => `${kind}/${number}`;

/**
 * The songs this device has played, kept on the device (Cache Storage, or IndexedDB on a page that has none) so that they need not be
 * downloaded again. Neither has metadata or an order, so an index in localStorage keeps each file's version, size and last use. Every method answers instead of
 * throwing: the player works exactly as it did without a cache whenever anything here fails.
 */
export class SongCache {
  private rows = new Map<string, Row>();
  private loaded?: Promise<void>;
  private pinned: ReadonlySet<string> = new Set();
  private readonly storing = new Map<string, Promise<boolean>>();
  /** The free bytes the app around the page reported (the Flutter apps read the real free disk), and the bytes stored since that report. */
  private native?: { free: number; stored: number };

  /** Where the files are: Cache Storage where there is one, else IndexedDB; undefined where there is neither. */
  private readonly backend?: FileBackend;

  constructor(private readonly env: SongCacheEnv) {
    this.backend = env.caches ? new CacheStorageBackend(env.caches) : env.indexedDB ? new IndexedDbBackend(env.indexedDB) : undefined;
  }

  /**
   * Whether this page can keep files: it has somewhere to put them and a way to tell how much room there is (the browser's estimate, or the number
   * the app around the page reports). Without one the margin for other apps cannot be checked, so nothing is kept.
   */
  supported(): boolean {
    return !!this.backend && (!!this.env.estimate || this.native !== undefined);
  }

  /** The user's switch "Keep played songs on this device" (on unless it was turned off); kept in the browser. */
  enabled(): boolean {
    return this.env.read(ENABLED_KEY) !== 'false';
  }

  setEnabled(on: boolean): void {
    this.env.write(ENABLED_KEY, String(on));
  }

  /** Whether files are looked up and kept now: the browser can, and the switch is on. */
  available(): boolean {
    return this.supported() && this.enabled();
  }

  /**
   * The app that shows this page (Flutter) can read the real free space of the device, which the browser's estimate may overstate. The smaller of
   * the two counts. The value is a minute old at most, so what is stored after it is counted off. undefined: the app has nothing to say.
   */
  setNativeFreeBytes(bytes: number | undefined): void {
    if (bytes === undefined) this.native = undefined;
    else if (Number.isFinite(bytes) && bytes >= 0) this.native = { free: Math.floor(bytes), stored: 0 };
  }

  /** The files that are never evicted: the song that plays now and the one that is next ("audio/00001", "vocals/00001"). */
  pin(keys: readonly string[]): void {
    this.pinned = new Set(keys);
  }

  release(objectUrl: string): void {
    this.env.revokeObjectURL(objectUrl);
  }

  /** An object URL of the kept file when it is the version asked for; else undefined (a file of another version is deleted). */
  async lookup(kind: CacheKind, number: string, version: string): Promise<string | undefined> {
    if (!this.available() || !version) return undefined;
    try {
      await this.load();
      const key = keyOf(kind, number);
      const row = this.rows.get(key);
      if (!row) return undefined;
      if (row.version !== version) {
        await this.remove(key);
        return undefined;
      }
      const file = await this.backend!.get(key);
      if (!file) {
        this.rows.delete(key);
        this.save();
        return undefined;
      }
      row.lastUsed = this.env.now();
      this.save();
      return this.env.createObjectURL(file);
    } catch {
      return undefined;
    }
  }

  /** Downloads the file and keeps it, making room by evicting the oldest files; false when it was not kept (never an error). */
  store(kind: CacheKind, number: string, version: string, url: string): Promise<boolean> {
    if (!this.available() || !version) return Promise.resolve(false);
    const key = keyOf(kind, number);
    const running = this.storing.get(`${key}@${version}`);
    if (running) return running;
    const job = this.download(kind, number, version, url).catch(() => false);
    const id = `${key}@${version}`;
    this.storing.set(id, job);
    void job.finally(() => this.storing.delete(id));
    return job;
  }

  /** Deletes one kept file (one that would not play), if there is one. */
  async discard(kind: CacheKind, number: string): Promise<void> {
    if (!this.supported()) return;
    try {
      await this.load();
      await this.remove(keyOf(kind, number));
    } catch {
      // nothing more can be done
    }
  }

  async clear(): Promise<void> {
    this.rows.clear();
    this.loaded = Promise.resolve();
    this.env.remove(INDEX_KEY);
    try {
      await this.backend?.clear();
    } catch {
      // nothing more can be done: the files stay until the browser removes them
    }
  }

  async stats(): Promise<{ count: number; bytes: number; capBytes: number }> {
    if (this.supported()) await this.load().catch(() => undefined);
    let bytes = 0;
    for (const r of this.rows.values()) bytes += r.bytes;
    return { count: this.rows.size, bytes, capBytes: this.env.limits.capBytes };
  }

  private async download(kind: CacheKind, number: string, version: string, url: string): Promise<boolean> {
    await this.load();
    const key = keyOf(kind, number);
    const have = this.rows.get(key);
    if (have?.version === version) return true;
    if (have) await this.remove(key); // an older version of the file
    let response = await this.env.fetch(url);
    for (let attempt = 0; attempt < 2; attempt++) {
      const need = Number(response.headers.get('content-length'));
      if (!response.ok || !(need > 0) || !(await this.makeRoom(need))) {
        void response.body?.cancel().catch(() => undefined);
        return false;
      }
      try {
        await this.backend!.put(key, response);
      } catch (e) {
        await this.forget(key);
        // a full disk: the oldest file goes, and the download is tried once more
        if (attempt === 1 || (e as { name?: string }).name !== 'QuotaExceededError' || !(await this.evictOldest())) return false;
        response = await this.env.fetch(url);
        continue;
      }
      this.rows.set(key, { kind, number, version, bytes: need, lastUsed: this.env.now() });
      if (this.native) this.native.stored += need;
      this.save();
      return true;
    }
    return false;
  }

  /** Evicts what the policy says must go for `need` more bytes; false when the file cannot be kept. */
  private async makeRoom(need: number): Promise<boolean> {
    let quota: number;
    let usage: number;
    if (this.env.estimate) {
      const est = await this.env.estimate();
      quota = est.quota ?? 0;
      usage = est.usage ?? 0;
      // the free space is the smaller of the browser's (quota minus usage) and the device's: the same as a usage that is at least quota minus the device's
      if (this.native) usage = Math.max(usage, quota - (this.native.free - this.native.stored));
    } else if (this.native) {
      // no estimate (not a secure context): the free space is the app's number alone, and the cache is all the usage there is
      const held = this.entries().reduce((sum, e) => sum + e.bytes, 0);
      usage = held;
      quota = this.native.free - this.native.stored + held;
    } else {
      return false;
    }
    const plan = planStore(this.entries(), { quota, usage }, need, this.pinned, this.env.limits);
    if (!plan.ok) return false;
    for (const key of plan.evict) {
      if (this.native) this.native.stored -= this.rows.get(key)?.bytes ?? 0; // what is deleted is free again
      await this.remove(key);
    }
    return true;
  }

  private async evictOldest(): Promise<boolean> {
    const oldest = this.entries()
      .filter((e) => !this.pinned.has(e.key))
      .sort((a, b) => a.lastUsed - b.lastUsed)[0];
    if (!oldest) return false;
    await this.remove(oldest.key);
    return true;
  }

  private entries(): CacheEntry[] {
    return [...this.rows.entries()].map(([key, r]) => ({ key, bytes: r.bytes, lastUsed: r.lastUsed }));
  }

  /** Deletes the file and its row. */
  private async remove(key: string): Promise<void> {
    this.rows.delete(key);
    this.save();
    await this.forget(key);
  }

  /** Deletes the file only. */
  private async forget(key: string): Promise<void> {
    try {
      await this.backend!.delete(key);
    } catch {
      // the row is gone; a file left behind is deleted by the next reconcile
    }
  }

  private save(): void {
    if (this.rows.size === 0) this.env.remove(INDEX_KEY);
    else this.env.write(INDEX_KEY, JSON.stringify([...this.rows.values()]));
  }

  /** Reads the index once and makes it agree with the files that are kept. */
  private load(): Promise<void> {
    return (this.loaded ??= this.reconcile());
  }

  private async reconcile(): Promise<void> {
    this.rows = new Map(this.readIndex().map((r) => [keyOf(r.kind, r.number), r]));
    const present = new Set<string>();
    for (const key of await this.backend!.keys()) {
      if (this.rows.has(key)) present.add(key);
      else await this.backend!.delete(key);
    }
    for (const key of [...this.rows.keys()]) if (!present.has(key)) this.rows.delete(key);
    this.save();
  }

  private readIndex(): Row[] {
    try {
      const parsed: unknown = JSON.parse(this.env.read(INDEX_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (r): r is Row =>
          !!r &&
          (r.kind === 'audio' || r.kind === 'vocals') &&
          typeof r.number === 'string' &&
          typeof r.version === 'string' &&
          typeof r.bytes === 'number' &&
          typeof r.lastUsed === 'number',
      );
    } catch {
      return [];
    }
  }
}

/** The song cache of the app; tests replace it (with a fake, or with a SongCache over a fake environment). */
export const SONG_CACHE = new InjectionToken<SongCache>('kantahe song cache', { providedIn: 'root', factory: () => new SongCache(inject(SONG_CACHE_ENV)) });
