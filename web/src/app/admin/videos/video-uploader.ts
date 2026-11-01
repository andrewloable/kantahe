import { Client, Code, ConnectError } from '@connectrpc/connect';
import { Video } from '../../../gen/kantahe/v1/common_pb';
import { UploadService, UploadStatus } from '../../../gen/kantahe/v1/upload_pb';

export type UploadClient = Client<typeof UploadService>;

/** How an upload ended. A refusal is an answer of the server about the file; a failure is a connection that did not work. */
export type UploadResult =
  | { status: 'added'; video: Video }
  | { status: 'duplicate'; video: Video }
  | { status: 'refused'; reason: string }
  | { status: 'failed'; reason: string }
  | { status: 'cancelled' };

/** What is remembered between page loads about an unfinished upload, so that the same file resumes and an edited copy does not. */
export interface ResumeStore {
  get(key: string): { uploadId: string; lastModified: number } | undefined;
  set(key: string, value: { uploadId: string; lastModified: number }): void;
  remove(key: string): void;
}

export interface UploadOptions {
  signal?: AbortSignal;
  /** Bytes the server has, at most every 250 ms and always at the end. */
  onProgress?: (received: number, total: number) => void;
  /** The server already had this much of the file when the upload began (a resume). */
  onResume?: (received: number, total: number) => void;
  /** Where unfinished uploads are remembered (the browser's local storage by default). */
  store?: ResumeStore;
  /** The wait between retries (tests pass a quicker one). */
  sleep?: (ms: number) => Promise<void>;
}

/** A failed chunk is tried again this many times, after these waits. */
const RETRY_WAITS_MS = [500, 1000, 2000];
const PROGRESS_EVERY_MS = 250;
const DEFAULT_CHUNK = 4 * 1024 * 1024;
const NOT_RETRIED = new Set<Code>([Code.InvalidArgument, Code.NotFound, Code.PermissionDenied, Code.Unauthenticated, Code.Canceled]);

const KEY_PREFIX = 'kantahe.videoUpload.';

/** Remembers unfinished uploads in the local storage; a browser that will not store anything just does not resume across page loads. */
export const localResumeStore: ResumeStore = {
  get(key) {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + key);
      const v = raw ? (JSON.parse(raw) as { uploadId?: unknown; lastModified?: unknown }) : undefined;
      return v && typeof v.uploadId === 'string' && typeof v.lastModified === 'number' ? { uploadId: v.uploadId, lastModified: v.lastModified } : undefined;
    } catch {
      return undefined;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
    } catch {
      // storage is blocked: the upload still works
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(KEY_PREFIX + key);
    } catch {
      // nothing to forget
    }
  },
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The wording of a connection problem for the person who watches the upload. */
function describe(e: unknown): string {
  const err = ConnectError.from(e);
  return err.rawMessage || (err.code === Code.Unavailable ? 'the server could not be reached' : err.message);
}

/**
 * Sends one video in chunks of the size the server names, one call at a time, never holding more than one chunk of the file.
 * It resumes from what the server already has, tries a failed chunk again (500 ms, 1 s, 2 s), asks the server where it is when it
 * refused an offset, and on abort throws the upload away on the server. A refusal of the file is a result, not an exception.
 */
export async function uploadVideo(client: UploadClient, file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const { signal, onProgress, onResume, store = localResumeStore, sleep = wait } = opts;
  const key = `${file.name}|${file.size}`;
  const aborted = () => signal?.aborted === true;
  let uploadId = '';

  // the same name and size with another modification time is another file: what was sent of the old one must not be completed with this one
  const saved = store.get(key);
  if (saved && saved.lastModified !== file.lastModified) {
    await client.abortVideoUpload({ uploadId: saved.uploadId }).catch(() => undefined);
    store.remove(key);
  }

  const cancel = async (): Promise<UploadResult> => {
    if (uploadId) await client.abortVideoUpload({ uploadId }).catch(() => undefined);
    store.remove(key);
    return { status: 'cancelled' };
  };

  const begin = async () => {
    const res = await client.beginVideoUpload({ filename: file.name, sizeBytes: BigInt(file.size) }, { signal });
    if (res.status !== UploadStatus.REJECTED) {
      uploadId = res.uploadId;
      store.set(key, { uploadId, lastModified: file.lastModified });
    }
    return res;
  };

  let first;
  try {
    first = await begin();
  } catch (e) {
    return aborted() ? cancel() : { status: 'failed', reason: describe(e) };
  }
  if (first.status === UploadStatus.REJECTED) {
    store.remove(key);
    return { status: 'refused', reason: first.reason };
  }
  const chunkSize = first.chunkSize > 0 ? first.chunkSize : DEFAULT_CHUNK;
  let offset = Number(first.received);
  if (offset > 0) onResume?.(offset, file.size);

  let lastReport = 0;
  const report = (force = false) => {
    const now = Date.now();
    if (!force && now - lastReport < PROGRESS_EVERY_MS) return;
    lastReport = now;
    onProgress?.(offset, file.size);
  };
  report(true);

  while (offset < file.size) {
    if (aborted()) return cancel();
    // only this chunk is read from the file
    const content = new Uint8Array(await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer());
    let attempt = 0;
    for (;;) {
      try {
        const res = await client.uploadVideoChunk({ uploadId, offset: BigInt(offset), content }, { signal });
        offset = Number(res.received);
        break;
      } catch (e) {
        if (aborted()) return cancel();
        const err = ConnectError.from(e);
        if (err.code === Code.FailedPrecondition) {
          // the server has another number of bytes than we thought (a chunk whose answer was lost): ask it, and go on from there
          try {
            const again = await begin();
            if (again.status === UploadStatus.REJECTED) return { status: 'refused', reason: again.reason };
            offset = Number(again.received);
          } catch (e2) {
            return aborted() ? cancel() : { status: 'failed', reason: describe(e2) };
          }
          break;
        }
        if (NOT_RETRIED.has(err.code) || attempt >= RETRY_WAITS_MS.length) return { status: 'failed', reason: describe(e) };
        await sleep(RETRY_WAITS_MS[attempt++]);
      }
    }
    report();
  }
  report(true);

  try {
    const done = await client.completeVideoUpload({ uploadId }, { signal });
    store.remove(key);
    if (done.status === UploadStatus.REJECTED) return { status: 'refused', reason: done.reason };
    if (!done.video) return { status: 'failed', reason: 'the server did not say what was added' };
    return done.status === UploadStatus.DUPLICATE ? { status: 'duplicate', video: done.video } : { status: 'added', video: done.video };
  } catch (e) {
    return aborted() ? cancel() : { status: 'failed', reason: describe(e) };
  }
}
