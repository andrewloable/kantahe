import { inject, Injectable, InjectionToken } from '@angular/core';
import { ServerUrl } from '../../core/server-url';

/** What the fanfares need from the browser; tests replace it. */
export interface FanfareFetch {
  fetch(url: string): Promise<Response>;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export const FANFARE_FETCH = new InjectionToken<FanfareFetch>('kantahe fanfare fetch', {
  providedIn: 'root',
  factory: () => ({
    fetch: (url) => fetch(url),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  }),
});

const TIERS = [1, 2, 3];

/**
 * The three score fanfares (about 150 KB together), downloaded when the device becomes the player and kept in memory, so that a fanfare
 * still sounds when the connection is gone at the moment a score lands (kantahe-cnf.1). Not kept across a restart: an app that starts
 * without a connection cannot reach its server anyway.
 */
@Injectable({ providedIn: 'root' })
export class Fanfares {
  private readonly server = inject(ServerUrl);
  private readonly env = inject(FANFARE_FETCH);
  private base?: string;
  private readonly kept = new Map<number, string>();
  private readonly asking = new Set<number>();

  /** The address to play the fanfare of a tier from: the kept file when there is one for this server, else the server's. */
  url(tier: number): string {
    const base = this.server.base();
    return (base === this.base && this.kept.get(tier)) || `${base}/media/fanfare/${tier}.mp3`;
  }

  /** Fetches the fanfares not kept yet (and not being fetched); every failure is silent and is tried again on the next call. */
  prefetch(): void {
    const base = this.server.base();
    if (base !== this.base) {
      for (const url of this.kept.values()) this.env.revokeObjectURL(url);
      this.kept.clear();
      this.asking.clear();
      this.base = base;
    }
    for (const tier of TIERS) {
      if (this.kept.has(tier) || this.asking.has(tier)) continue;
      this.asking.add(tier);
      void this.keep(base, tier);
    }
  }

  private async keep(base: string, tier: number): Promise<void> {
    try {
      const res = await this.env.fetch(`${base}/media/fanfare/${tier}.mp3`);
      if (!res.ok) return;
      const url = this.env.createObjectURL(await res.blob());
      if (base === this.base) this.kept.set(tier, url);
      else this.env.revokeObjectURL(url); // the server changed while this was on its way
    } catch {
      // played from the server when its time comes, and asked for again on the next prefetch
    } finally {
      if (base === this.base) this.asking.delete(tier);
    }
  }
}
