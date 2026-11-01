import { computed, effect, inject, Injectable, InjectionToken, signal, untracked } from '@angular/core';
import { CatalogService } from '../../../gen/kantahe/v1/catalog_pb';
import { BackgroundMode } from '../../../gen/kantahe/v1/common_pb';
import { injectClient } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { ENVIRONMENT } from '../../core/environment';
import { StateStore } from '../../core/state.store';

/** How often the list of background videos is asked for again while they are on (the server keeps the URLs the same for hours). */
export const BACKGROUND_REFETCH_MS = new InjectionToken<number>('background refetch interval', { providedIn: 'root', factory: () => 10 * 60_000 });

export interface BackgroundVideo {
  id: string;
  /** The signed URL exactly as the server gave it: it is the same string for hours, which is what lets the browser keep the file. */
  url: string;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Knows whether this device shows the background videos and which ones. Nothing is requested while they are off.
 * The server decides (effective_background of this device); on the web a user who asks for less motion gets none
 * when the setting is Auto, and an explicit On wins.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundStore {
  private readonly catalog = injectClient(CatalogService);
  private readonly auth = inject(AuthStore);
  private readonly state = inject(StateStore);
  private readonly env = inject(ENVIRONMENT);
  private readonly refetchMs = inject(BACKGROUND_REFETCH_MS);

  /** The browser is asked for less motion. */
  readonly reducedMotion = signal(false);
  /** The videos in loop order, and whether the order is shuffled on every pass. Empty while off. */
  readonly videos = signal<BackgroundVideo[]>([]);
  readonly shuffle = signal(false);

  private readonly mine = computed(() => this.state.state()?.devices.find((d) => d.id === this.auth.deviceId()));
  /** This device shows the background videos now. */
  readonly active = computed(() => {
    const d = this.mine();
    if (!d?.effectiveBackground) return false;
    const auto = d.backgroundMode === BackgroundMode.AUTO || d.backgroundMode === BackgroundMode.UNSPECIFIED;
    return !(this.reducedMotion() && !this.env.isTv && auto);
  });

  private timer?: ReturnType<typeof setInterval>;
  /** Counts starts and stops, so that an answer that arrives after a stop is thrown away. */
  private generation = 0;

  constructor() {
    if (typeof matchMedia === 'function') {
      const q = matchMedia(REDUCED_MOTION);
      this.reducedMotion.set(q.matches);
      q.addEventListener?.('change', (e) => this.reducedMotion.set(e.matches));
    }
    effect(() => {
      const on = this.active();
      untracked(() => (on ? this.start() : this.stop()));
    });
    // the state stream came back: the list may have changed while it was down
    let wasConnected = this.state.connected();
    effect(() => {
      const connected = this.state.connected();
      const reconnected = connected && !wasConnected;
      wasConnected = connected;
      if (reconnected) untracked(() => void this.refetch()); // refetch does nothing while the videos are off
    });
  }

  private start(): void {
    this.stop();
    this.timer = setInterval(() => void this.refetch(), this.refetchMs);
    void this.refetch();
  }

  private stop(): void {
    this.generation++;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.videos.set([]);
    this.shuffle.set(false);
  }

  /** Asks the server for the list again; an answer that cannot be had leaves the list as it is. */
  async refetch(): Promise<void> {
    if (this.timer === undefined) return;
    const generation = this.generation;
    try {
      const res = await this.catalog.getBackground({});
      if (generation !== this.generation) return;
      this.videos.set(res.enabled ? res.videos.map((v) => ({ id: v.id, url: v.url })) : []);
      this.shuffle.set(res.shuffle);
    } catch {
      // the next beat tries again; the videos that are playing keep playing
    }
  }
}
