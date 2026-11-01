import { inject, InjectionToken } from '@angular/core';
import { createClient, Transport } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { localIpv4 } from './local-ip';

/** The ports a server is looked for on: the default of the program and of plain HTTP. */
export const SWEEP_PORTS = [8080, 80];
/** How long a host has to answer. */
export const PROBE_MS = 800;
/** How many hosts are asked at the same time (a TV is not a server). */
export const MAX_PARALLEL = 64;
/**
 * How many probes make a batch. A connection to a host that does not exist keeps its socket after the probe is given
 * up, until the operating system gives up the connect (measured in Chromium on macOS: 75 s, and after 120 to 200 such
 * probes no new connection gets through until then; a Linux TV gives up in a few seconds). A browser holds at most
 * 256 sockets, so the sweep is cut into batches that stay well inside that; "Search again" asks the next one.
 */
export const BATCH = 100;

/** A server that answered GetServerInfo. */
export interface FoundServer {
  url: string;
  name: string;
  version: string;
  setupRequired: boolean;
}

export type Ask = (url: string, signal: AbortSignal) => Promise<{ name: string; version: string; setupRequired: boolean }>;
export type Progress = (done: number, total: number) => void;

/** The transport that asks a server we are not yet configured for; tests replace it. */
export const SERVER_PROBE = new InjectionToken<(baseUrl: string) => Transport>('kantahe server probe', {
  providedIn: 'root',
  factory: () => (baseUrl) => createConnectTransport({ baseUrl, useBinaryFormat: false }),
});

/** Every other host of the /24 of [ip] on every port, nearest the TV first, then by port (port 80 is written without it). */
export function candidates(ip: string): string[] {
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return [];
  const own = Number(m[2]);
  const hosts = Array.from({ length: 254 }, (_, i) => i + 1)
    .filter((h) => h !== own)
    .sort((a, b) => Math.abs(a - own) - Math.abs(b - own) || a - b);
  return hosts.flatMap((h) => SWEEP_PORTS.map((port) => (port === 80 ? `http://${m[1]}.${h}` : `http://${m[1]}.${h}:${port}`)));
}

/** The candidates in batches of BATCH. */
export function batches(ip: string): string[][] {
  const all = candidates(ip);
  return Array.from({ length: Math.ceil(all.length / BATCH) }, (_, i) => all.slice(i * BATCH, (i + 1) * BATCH));
}

/** One probe: whatever the host does, it is over after PROBE_MS (a host that ignores the signal is let go of too). */
async function probe(url: string, ask: Ask): Promise<FoundServer | undefined> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROBE_MS);
  try {
    const gone = new Promise<never>((_, reject) => abort.signal.addEventListener('abort', () => reject(new Error('no answer'))));
    const info = await Promise.race([ask(url, abort.signal), gone]);
    return { url, name: info.name, version: info.version, setupRequired: info.setupRequired };
  } catch {
    return undefined; // nobody home, or not a Kantahe server
  } finally {
    clearTimeout(timer);
  }
}

/** Asks every address of [urls], MAX_PARALLEL at a time; returns the servers that answered, in the order of [urls]. */
export async function probeAll(urls: string[], ask: Ask, progress?: Progress): Promise<FoundServer[]> {
  const results: (FoundServer | undefined)[] = new Array(urls.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      results[i] = await probe(urls[i], ask);
      progress?.(++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, urls.length) }, worker));
  return results.filter((r): r is FoundServer => r !== undefined);
}

/** What one search turned up, and whether more addresses are left to look at. */
export interface Found {
  servers: FoundServer[];
  more: boolean;
}

/**
 * Looks for servers on the network of this TV, one batch of addresses at a time; tests replace it. A new search
 * (next: false) starts with the nearest addresses; next: true asks the batch after the last one (and, after the last,
 * the nearest again). Finds nothing when the TV cannot tell its own address.
 */
export const FIND_SERVERS = new InjectionToken<(options: { next: boolean; progress?: Progress }) => Promise<Found>>('kantahe find servers', {
  providedIn: 'root',
  factory: () => {
    const makeTransport = inject(SERVER_PROBE);
    let parts: string[][] = [];
    let at = 0;
    return async ({ next, progress }) => {
      if (next && parts.length) {
        at = (at + 1) % parts.length;
      } else {
        const ip = await localIpv4();
        parts = ip ? batches(ip) : [];
        at = 0;
      }
      if (!parts.length) return { servers: [], more: false };
      const servers = await probeAll(parts[at], (url, signal) => createClient(AuthService, makeTransport(url)).getServerInfo({}, { signal }), progress);
      return { servers, more: at < parts.length - 1 };
    };
  },
});
