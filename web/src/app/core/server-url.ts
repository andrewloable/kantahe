import { inject, Injectable } from '@angular/core';
import { ENVIRONMENT } from './environment';
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

/**
 * What a person typed as the address of the server: a missing scheme means http, trailing slashes go.
 * undefined for anything that is not an http(s) address.
 */
export function normalizeServerUrl(input: string): string | undefined {
  let s = input.trim();
  if (s === '') return undefined;
  if (!s.includes('://')) s = `http://${s}`;
  s = s.replace(/\/+$/, '');
  return validServerUrl(s) ? s : undefined;
}

/**
 * The server this app talks to: the page's own origin unless an address was stored. A packaged TV app has no
 * server at its own origin, so there it has an address only once one was stored and base() is empty before.
 */
@Injectable({ providedIn: 'root' })
export class ServerUrl {
  private readonly env = inject(ENVIRONMENT);
  private auto = true;

  /**
   * Whether a single server found on the network may be connected to without asking. Off after clear() for the rest of
   * the run (a person who chose "Use another server" would be sent straight back); never stored.
   */
  autoConnect(): boolean {
    return this.auto;
  }

  private stored(): string | undefined {
    const stored = readStore(KEY);
    return stored !== undefined && validServerUrl(stored) ? stored : undefined;
  }

  /** Whether the app knows where its server is. */
  hasAddress(): boolean {
    return !this.env.isTv || this.stored() !== undefined;
  }

  base(): string {
    return this.stored() ?? (this.env.isTv ? '' : window.location.origin);
  }

  set(url: string): void {
    if (!validServerUrl(url)) throw new Error('The server address must be an http(s) address without a trailing slash');
    writeStore(KEY, url);
  }

  clear(): void {
    this.auto = false;
    removeStore(KEY);
  }
}
