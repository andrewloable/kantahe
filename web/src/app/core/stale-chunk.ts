import { NavigationError } from '@angular/router';
import { readStore, writeStore } from './storage';

const KEY = 'kantahe.stale-chunk-reload';

/** A second failure for the same page within this time is a server that is down, not a stale page. */
const AGAIN_AFTER_MS = 30_000;

/** What Chrome, Firefox and Safari say when a lazy page cannot be fetched. */
const CHUNK_FAILED = /dynamically imported module|importing a module script failed/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_FAILED.test(error.message);
}

/**
 * A page that was left open while the server was updated asks for lazy files that no longer exist (the server
 * answers 404), and the router drops the click without a word. Reloading the page the person was going to fetches
 * the new files. Once per page within 30 s, and only when the browser can remember it did: a reload that fails
 * again must not turn into a loop.
 */
export function handleStaleChunk(error: NavigationError, reload: (url: string) => void, now = Date.now()): void {
  if (!isChunkLoadError(error.error)) return;
  const [url, at] = (readStore(KEY) ?? '').split('|');
  if (url === error.url && now - Number(at) < AGAIN_AFTER_MS) return;
  const mark = `${error.url}|${now}`;
  writeStore(KEY, mark);
  if (readStore(KEY) !== mark) return;
  reload(error.url);
}
