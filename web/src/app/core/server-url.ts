import { Injectable } from '@angular/core';
import { readStore, removeStore, writeStore } from './storage';

const KEY = 'kantahe.server';

/** An absolute http(s) address without credentials, query, fragment or trailing slash. */
export function validServerUrl(url: string): boolean {
  if (url !== url.trim() || url.endsWith('/')) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password && !u.search && !u.hash;
}

/** The server this app talks to: the page's own origin unless an address was stored (TV builds). */
@Injectable({ providedIn: 'root' })
export class ServerUrl {
  base(): string {
    const stored = readStore(KEY);
    return stored !== undefined && validServerUrl(stored) ? stored : window.location.origin;
  }

  set(url: string): void {
    if (!validServerUrl(url)) throw new Error('The server address must be an http(s) address without a trailing slash');
    writeStore(KEY, url);
  }

  clear(): void {
    removeStore(KEY);
  }
}
