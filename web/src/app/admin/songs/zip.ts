import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';

export const MAX_ENTRIES = 10_000;
export const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const CHUNK = 1024 * 1024;

export interface ZipEntry {
  /** The file name without its folders. */
  name: string;
  bytes: Uint8Array;
  /** The song is bigger than the per-song limit: it was not unpacked and bytes is empty. */
  tooLarge?: boolean;
}

export interface ZipLimits {
  maxEntries?: number;
  maxBytes?: number;
  /** A song bigger than this is not kept in memory: its entry says tooLarge and unpacking stops. */
  maxEntryBytes?: number;
  /** How much of the archive is read at a time. */
  chunkSize?: number;
}

const isSong = (name: string) => /\.(kar|karmp3)$/i.test(name);

export function readBlob(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * The song files of a ZIP, one at a time. The archive is read in pieces and unpacked as it goes, and
 * a song is handed over as soon as it is complete, so only one song (not the whole archive) is in memory.
 * Only .kar and .karmp3 files count (any folder, any case); an archive with more than 10,000 entries
 * or more than 2 GB of song data is refused.
 */
export async function* extractSongs(file: Blob, limits: ZipLimits = {}): AsyncGenerator<ZipEntry> {
  const maxEntries = limits.maxEntries ?? MAX_ENTRIES;
  const maxBytes = limits.maxBytes ?? MAX_BYTES;
  const maxEntryBytes = limits.maxEntryBytes ?? Number.POSITIVE_INFINITY;
  const chunkSize = limits.chunkSize ?? CHUNK;
  const ready: ZipEntry[] = [];
  let failure: Error | undefined;
  let entries = 0;
  let total = 0;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = (f) => {
    if (failure) return;
    if (++entries > maxEntries) {
      failure = new Error(`The ZIP file has more than ${maxEntries} files.`);
      return;
    }
    const name = f.name.split('/').pop() ?? '';
    if (f.name.endsWith('/') || !isSong(name)) return; // folders and other files are skipped without being unpacked
    const parts: Uint8Array[] = [];
    let size = 0;
    let oversize = false;
    f.ondata = (err, data, final) => {
      if (failure || oversize) return;
      if (err) {
        failure = err;
        return;
      }
      total += data.length;
      size += data.length;
      if (total > maxBytes) {
        failure = new Error('The songs in the ZIP file are too large altogether.');
        return;
      }
      if (size > maxEntryBytes) {
        // too big to be sent anyway: let go of what was collected and stop unpacking this song
        oversize = true;
        parts.length = 0;
        ready.push({ name, bytes: new Uint8Array(0), tooLarge: true });
        f.terminate();
        return;
      }
      parts.push(data);
      if (final) {
        const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let at = 0;
        for (const p of parts) {
          bytes.set(p, at);
          at += p.length;
        }
        ready.push({ name, bytes });
      }
    };
    try {
      f.start();
    } catch (e) {
      failure = e instanceof Error ? e : new Error('This ZIP file uses a format that cannot be read.');
    }
  };

  const size = file.size;
  for (let at = 0; at < size; at += chunkSize) {
    const chunk = await readBlob(file.slice(at, Math.min(at + chunkSize, size)));
    try {
      unzip.push(chunk, at + chunkSize >= size);
    } catch (e) {
      // fflate says "invalid zip data" for a cut-off or damaged archive
      throw new Error('The ZIP file could not be read: it may be damaged or incomplete.', { cause: e });
    }
    if (failure) throw failure;
    while (ready.length > 0) yield ready.shift() as ZipEntry;
  }
  if (failure) throw failure;
  while (ready.length > 0) yield ready.shift() as ZipEntry;
}
