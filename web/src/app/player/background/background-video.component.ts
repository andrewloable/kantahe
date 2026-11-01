import { Component, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { nextPass } from './background-order';
import { BackgroundStore } from './background.store';

/** The colour laid over the video so that the lyrics stay readable (proved in the spec against a pure white frame). */
export const SCRIM = { r: 10, g: 14, b: 34, a: 0.7 } as const;
const SCRIM_CSS = `rgba(${SCRIM.r}, ${SCRIM.g}, ${SCRIM.b}, ${SCRIM.a})`;

/** The next video starts when this many seconds of the current one are left; it is shown when it is playing. */
const PRELOAD_S = 1.5;
const FADE_MS = 600;
/** A video that has not started, or has stopped, for this long is skipped. */
const STALL_MS = 10_000;
/** Every video failing within this time stops the trying for BACKOFF_MS. */
const FAIL_WINDOW_MS = 60_000;
const BACKOFF_MS = 5 * 60_000;

/**
 * The moving pictures behind the lyrics: the administrator's videos one after another and round again, with no gap (a second
 * element loads the next video and takes over when it is playing). The layer is only a picture: it is hidden from assistive
 * technology, cannot be focused and does not take pointer events.
 *
 * VIDEO ONLY: no sound ever comes from it. Both elements are muted, at volume 0 and without controls when they are made, before
 * every change of source, and again whenever the browser reports a change of volume, whatever the file contains.
 *
 * It does nothing, and holds no decoder, while the device does not show the background (BackgroundStore.active); with no video to show
 * (the administrator switched them all off) there is no element at all.
 */
@Component({
  selector: 'app-background-video',
  template: `
    @if (store.active() && store.videos().length > 0) {
      <div class="layer" aria-hidden="true">
        <video #a class="v" [class.show]="front() === 'a'" muted playsinline preload="auto"></video>
        <video #b class="v" [class.show]="front() === 'b'" muted playsinline preload="auto"></video>
        <div class="scrim" [style.background]="scrim"></div>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    /* behind everything in the stage (which isolates its stacking), over the whole window, never in the way of the player */
    .layer {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      background: #0a0e22;
    }
    .v {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 600ms;
      pointer-events: none;
    }
    .v.show {
      opacity: 1;
    }
    .scrim {
      position: absolute;
      inset: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .v {
        transition: none;
      }
    }
  `,
})
export class BackgroundVideoComponent {
  protected readonly store = inject(BackgroundStore);
  /** The pictures move: true while a song plays, while nothing plays and on the score screen; false while a song is paused. */
  readonly playing = input(true);
  protected readonly scrim = SCRIM_CSS;
  /** Which of the two elements is shown. */
  protected readonly front = signal<'a' | 'b'>('a');

  private readonly a = viewChild<ElementRef<HTMLVideoElement>>('a');
  private readonly b = viewChild<ElementRef<HTMLVideoElement>>('b');

  private els?: [HTMLVideoElement, HTMLVideoElement];
  /** The element that is shown (or about to be) and the one being made ready behind it. */
  private cur?: HTMLVideoElement;
  private nxt?: HTMLVideoElement;
  /** The ids of the current pass over the list, the place of the playing one and of the one being made ready. */
  private pass: string[] = [];
  private pos = -1;
  private pendingPos = -1;
  private pendingId = '';
  private currentId?: string;
  private lastId?: string;

  private readonly off: (() => void)[] = [];
  private readonly stalls = new Map<HTMLVideoElement, ReturnType<typeof setTimeout>>();
  private readonly fades = new Set<ReturnType<typeof setTimeout>>();
  private backoffTimer?: ReturnType<typeof setTimeout>;
  private recent: number[] = [];
  private warned = false;
  private refetchedSinceSuccess = false;

  constructor() {
    effect(() => {
      const a = this.a()?.nativeElement;
      const b = this.b()?.nativeElement;
      untracked(() => (a && b ? this.attach(a, b) : this.detach()));
    });
    effect(() => {
      const playing = this.playing();
      untracked(() => this.setPlaying(playing));
    });
    effect(() => {
      const list = this.store.videos();
      this.store.shuffle();
      untracked(() => this.listChanged(list.length));
    });
    inject(DestroyRef).onDestroy(() => this.detach());
  }

  /** No sound, whatever the file holds: muted, volume 0, no controls. Called whenever anything could have changed it. */
  private silence(el: HTMLVideoElement): void {
    if (!el.muted) el.muted = true;
    if (!el.defaultMuted) el.defaultMuted = true;
    if (el.volume !== 0) el.volume = 0;
    el.removeAttribute('controls');
  }

  private attach(a: HTMLVideoElement, b: HTMLVideoElement): void {
    this.detach();
    this.els = [a, b];
    for (const el of this.els) {
      this.silence(el);
      el.disablePictureInPicture = true;
      el.disableRemotePlayback = true;
      this.on(el, 'timeupdate', () => this.onTime(el));
      this.on(el, 'playing', () => this.onPlaying(el));
      this.on(el, 'ended', () => this.onEnded(el));
      this.on(el, 'error', () => this.fail(el));
      this.on(el, 'waiting', () => this.playing() && this.armStall(el));
      this.on(el, 'stalled', () => this.playing() && this.armStall(el));
      this.on(el, 'volumechange', () => this.silence(el));
    }
    this.front.set('a');
    this.begin();
  }

  private on(el: HTMLVideoElement, type: string, fn: () => void): void {
    el.addEventListener(type, fn);
    this.off.push(() => el.removeEventListener(type, fn));
  }

  /** Lets go of everything: no listener, no timer, no source and no decoder. */
  private detach(): void {
    for (const off of this.off.splice(0)) off();
    for (const t of this.stalls.values()) clearTimeout(t);
    this.stalls.clear();
    for (const t of this.fades) clearTimeout(t);
    this.fades.clear();
    clearTimeout(this.backoffTimer);
    this.backoffTimer = undefined;
    if (this.els) for (const el of this.els) this.release(el);
    this.els = undefined;
    this.reset();
  }

  private reset(): void {
    this.cur = this.nxt = undefined;
    this.pass = [];
    this.pos = this.pendingPos = -1;
    this.currentId = undefined;
  }

  /** The element stops and its source goes, so that the decoder is freed. */
  private release(el: HTMLVideoElement): void {
    el.pause();
    el.loop = false;
    el.removeAttribute('src');
    el.load();
  }

  /** Starts the first video of a pass on the element A, when there is a list and nothing is playing or waiting to try again. */
  private begin(): void {
    if (!this.els || this.cur || this.backoffTimer !== undefined) return;
    const list = this.store.videos();
    if (!list.length) return;
    this.pass = nextPass(
      list.map((v) => v.id),
      this.store.shuffle(),
      this.lastId,
    );
    this.pos = this.pendingPos = 0;
    this.currentId = this.lastId = this.pass[0];
    this.cur = this.els[0];
    this.front.set('a');
    this.playOn(this.cur, this.urlOf(this.pass[0]));
  }

  private urlOf(id: string): string {
    return this.store.videos().find((v) => v.id === id)?.url ?? '';
  }

  private playOn(el: HTMLVideoElement, url: string): void {
    this.silence(el);
    el.loop = this.store.videos().length === 1; // one video is simply looped
    el.src = url;
    if (this.playing()) this.start(el); // a paused song leaves it loaded and waiting: that is not a stall
  }

  private start(el: HTMLVideoElement): void {
    this.armStall(el);
    const p = el.play() as Promise<void> | undefined;
    p?.catch?.(() => this.fail(el)); // the browser refused to play it
  }

  private armStall(el: HTMLVideoElement): void {
    clearTimeout(this.stalls.get(el));
    this.stalls.set(
      el,
      setTimeout(() => this.fail(el), STALL_MS),
    );
  }

  private disarmStall(el: HTMLVideoElement): void {
    clearTimeout(this.stalls.get(el));
    this.stalls.delete(el);
  }

  /** The next video to play: the next of the pass that is still in the list, or the first of a new pass. */
  private pick(): { id: string; pos: number } | undefined {
    const ids = this.store.videos().map((v) => v.id);
    if (!ids.length) return undefined;
    let pos = this.pos + 1;
    while (pos < this.pass.length && !ids.includes(this.pass[pos])) pos++;
    if (pos >= this.pass.length) {
      this.pass = nextPass(ids, this.store.shuffle(), this.currentId);
      pos = 0;
    }
    return { id: this.pass[pos], pos };
  }

  /** Starts the next video on the other element, behind the one that is shown; it takes over when it is playing. */
  private prepareNext(): void {
    if (!this.els || !this.cur || this.nxt) return;
    const next = this.pick();
    if (!next) return;
    this.nxt = this.cur === this.els[0] ? this.els[1] : this.els[0];
    this.pendingPos = next.pos;
    this.pendingId = next.id;
    this.playOn(this.nxt, this.urlOf(next.id));
  }

  private onTime(el: HTMLVideoElement): void {
    this.disarmStall(el);
    if (el !== this.cur || this.nxt || this.store.videos().length < 2) return;
    const left = el.duration - el.currentTime;
    if (Number.isFinite(left) && left < PRELOAD_S) this.prepareNext();
  }

  private onPlaying(el: HTMLVideoElement): void {
    this.disarmStall(el);
    this.succeeded();
    if (el === this.nxt) this.swap(el);
  }

  /** The video that was made ready is playing: show it, and let the old one go once the fade is over. */
  private swap(el: HTMLVideoElement): void {
    const old = this.cur;
    this.cur = el;
    this.nxt = undefined;
    this.pos = this.pendingPos;
    this.currentId = this.lastId = this.pendingId;
    this.silence(el);
    this.front.set(el === this.els?.[0] ? 'a' : 'b');
    if (!old) return;
    const t = setTimeout(() => {
      this.fades.delete(t);
      if (old !== this.cur && old !== this.nxt) this.release(old);
    }, FADE_MS);
    this.fades.add(t);
  }

  private onEnded(el: HTMLVideoElement): void {
    if (el === this.cur && !this.nxt) this.prepareNext();
  }

  private succeeded(): void {
    this.recent = [];
    this.refetchedSinceSuccess = false;
    this.warned = false;
  }

  /** A video that cannot be played (or has not started for too long) is skipped. */
  private fail(el: HTMLVideoElement): void {
    if (el !== this.cur && el !== this.nxt) return;
    this.disarmStall(el);
    const now = Date.now();
    this.recent = [...this.recent.filter((t) => now - t < FAIL_WINDOW_MS), now];
    // a refused address (an expired signature shows as a failure) is cured by a fresh list, asked for once per run of failures
    if (!this.refetchedSinceSuccess) {
      this.refetchedSinceSuccess = true;
      void this.store.refetch();
    }
    if (this.recent.length >= Math.max(this.store.videos().length, 1)) return this.giveUp();
    if (el === this.nxt) {
      this.release(el);
      this.nxt = undefined;
      this.pos = this.pendingPos; // the one that failed is passed over
    }
    this.prepareNext();
  }

  /** Every video failed within a minute: nothing more is tried for five minutes, and that is said once. */
  private giveUp(): void {
    if (!this.warned) {
      this.warned = true;
      console.warn('The background videos cannot be played; trying again in 5 minutes.');
    }
    if (this.els) for (const el of this.els) this.release(el);
    for (const t of this.stalls.values()) clearTimeout(t);
    this.stalls.clear();
    this.reset();
    this.backoffTimer = setTimeout(() => {
      this.backoffTimer = undefined;
      this.recent = [];
      this.begin();
    }, BACKOFF_MS);
  }

  /** The list changed (a refetch, a new order, shuffle on or off). The playing video goes on unless it was removed. */
  private listChanged(count: number): void {
    if (!this.els) return;
    if (count === 0) {
      for (const el of this.els) this.release(el);
      this.reset();
      return;
    }
    if (!this.cur) return this.begin();
    if (this.currentId && !this.store.videos().some((v) => v.id === this.currentId)) this.prepareNext();
  }

  /** A paused song pauses the pictures; playing again goes on. */
  private setPlaying(playing: boolean): void {
    for (const el of [this.cur, this.nxt]) {
      if (!el?.getAttribute('src')) continue;
      if (playing) this.start(el);
      else {
        this.disarmStall(el);
        el.pause();
      }
    }
  }
}
