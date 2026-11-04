/** Where the song cache keeps its files: Cache Storage in a secure context, IndexedDB everywhere else. Keys look like "audio/00001". */
export interface FileBackend {
  /** The keys of the files that are kept. */
  keys(): Promise<string[]>;
  /** Keeps the body of the response under the key (rejects with a QuotaExceededError when the device is full). */
  put(key: string, response: Response): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
  delete(key: string): Promise<void>;
  /** Deletes every file. */
  clear(): Promise<void>;
}

const CACHE_NAME = 'kantahe-songs-v1';
const PREFIX = '/kantahe-song-cache/';

/** The browser's Cache Storage: the files are Responses, read back as blobs. */
export class CacheStorageBackend implements FileBackend {
  constructor(private readonly caches: CacheStorage) {}

  private open(): Promise<Cache> {
    return this.caches.open(CACHE_NAME);
  }

  async keys(): Promise<string[]> {
    const out: string[] = [];
    for (const request of await (await this.open()).keys()) {
      const path = new URL(request.url, 'http://page/').pathname;
      if (path.startsWith(PREFIX)) out.push(path.slice(PREFIX.length));
    }
    return out;
  }

  async put(key: string, response: Response): Promise<void> {
    await (await this.open()).put(PREFIX + key, response);
  }

  async get(key: string): Promise<Blob | undefined> {
    return (await (await this.open()).match(PREFIX + key))?.blob();
  }

  async delete(key: string): Promise<void> {
    await (await this.open()).delete(PREFIX + key);
  }

  async clear(): Promise<void> {
    await this.caches.delete(CACHE_NAME);
  }
}

interface StoredFile {
  type: string;
  data: ArrayBuffer;
}

const DB_NAME = 'kantahe-songs';
const STORE = 'files';

/**
 * IndexedDB: the files are the bytes of the response and its content type. It exists on a page that is not a secure context (plain http:// from
 * a LAN address), where Cache Storage does not. A song is a few MB, so it is read into memory once to be written, and once to be played.
 */
export class IndexedDbBackend implements FileBackend {
  private db?: Promise<IDBDatabase>;

  constructor(private readonly factory: IDBFactory) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((e) => {
      this.db = undefined; // a later call may open it again
      throw e;
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = act(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async keys(): Promise<string[]> {
    return (await this.run('readonly', (s) => s.getAllKeys())).map(String);
  }

  async put(key: string, response: Response): Promise<void> {
    const file: StoredFile = { type: response.headers.get('content-type') ?? '', data: await response.arrayBuffer() };
    await this.run('readwrite', (s) => s.put(file, key));
  }

  async get(key: string): Promise<Blob | undefined> {
    const value = (await this.run('readonly', (st) => st.get(key))) as Partial<StoredFile> | undefined;
    // an ArrayBuffer from another realm (a test) is not `instanceof ArrayBuffer`: look at what it can do
    if (!value || typeof value.data?.byteLength !== 'number') return undefined;
    return new Blob([value.data], { type: value.type ?? '' });
  }

  async delete(key: string): Promise<void> {
    await this.run('readwrite', (s) => s.delete(key));
  }

  async clear(): Promise<void> {
    await this.run('readwrite', (s) => s.clear());
  }
}
