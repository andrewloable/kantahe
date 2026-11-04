/**
 * The rule of the song cache, as pure functions: may a file be kept, and which cached files go first to make room?
 * Nothing here reads the browser or the clock; the caller passes in what it measured.
 */

export const MIB = 1024 * 1024;
export const GIB = 1024 * MIB;

export interface CacheLimits {
  /** The cache never holds more than this. */
  capBytes: number;
  /** Free space that always stays, whatever the cache holds: room for the other apps of the device. At least this much ... */
  reserveMinBytes: number;
  /** ... and at least this share of the quota. */
  reserveFraction: number;
}

export const DEFAULT_LIMITS: CacheLimits = { capBytes: 2 * GIB, reserveMinBytes: 512 * MIB, reserveFraction: 0.1 };

export interface CacheEntry {
  key: string;
  bytes: number;
  /** When the file was last stored or played, in milliseconds since the epoch. */
  lastUsed: number;
}

/** What navigator.storage.estimate() says; usage includes the cache itself. */
export interface Space {
  quota: number;
  usage: number;
}

export type StorePlan = { ok: true; evict: string[] } | { ok: false; reason: 'too-big' | 'no-room' };

/** The free space that must remain after a store. */
export function reserveBytes(quota: number, limits: CacheLimits = DEFAULT_LIMITS): number {
  return Math.max(limits.reserveMinBytes, quota * limits.reserveFraction);
}

/**
 * Plans the storing of a file of `need` bytes: the keys to evict first (oldest last use first), or why it cannot be kept.
 * After the store the cache holds at most capBytes and the free space (quota minus usage) is at least the reserve. Entries in `keep` (the
 * song that plays, the one that is next) are never evicted; when nothing else is left to evict the file is not stored.
 */
export function planStore(entries: readonly CacheEntry[], space: Space, need: number, keep: ReadonlySet<string>, limits: CacheLimits = DEFAULT_LIMITS): StorePlan {
  if (need > limits.capBytes) return { ok: false, reason: 'too-big' };
  const reserve = reserveBytes(space.quota, limits);
  let cacheBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
  let free = space.quota - space.usage;
  const evictable = entries.filter((e) => !keep.has(e.key)).sort((a, b) => a.lastUsed - b.lastUsed || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const evict: string[] = [];
  for (const next of evictable) {
    if (cacheBytes + need <= limits.capBytes && free - need >= reserve) return { ok: true, evict };
    evict.push(next.key);
    cacheBytes -= next.bytes;
    free += next.bytes;
  }
  if (cacheBytes + need <= limits.capBytes && free - need >= reserve) return { ok: true, evict };
  return { ok: false, reason: 'no-room' };
}
