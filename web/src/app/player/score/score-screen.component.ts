import { Component, computed, DestroyRef, effect, inject, InjectionToken, input, signal, untracked } from '@angular/core';
import { Score } from '../../../gen/kantahe/v1/session_pb';
import { ServerUrl } from '../../core/server-url';
import { StateStore } from '../../core/state.store';

const ROLL_EVERY_MS = 55;
const ROLL_FOR_MS = 1400;
/** The server clears the score at its time; if that never reaches us, close this long after it. */
const CLOSE_AFTER_MS = 2000;

export interface FanfareAudio {
  play(): Promise<void>;
  pause(): void;
}

/** Makes the player for one fanfare file; tests replace it. */
export const FANFARE_AUDIO = new InjectionToken<(url: string) => FanfareAudio>('kantahe fanfare audio', {
  providedIn: 'root',
  factory: () => (url) => new Audio(url),
});

const roll = () => Math.floor(Math.random() * 51) + 50;

/** The score after a song: a number that rolls for 1.4 s, lands, is coloured by tier, and a fanfare. */
@Component({
  selector: 'app-score-screen',
  template: `
    @if (open() && score(); as s) {
      <div class="overlay" role="dialog" aria-modal="true" aria-label="Score">
        <p class="number" [class]="tier()" aria-hidden="true">{{ s.hasValue ? shown() : '--' }}</p>
        @if (landed()) {
          @if (s.hasValue) {
            <p class="comment">{{ s.comment }}</p>
          } @else {
            <p class="comment">No score this time</p>
            @if (s.reason) {
              <p class="reason">{{ s.reason }}</p>
            }
          }
        }
      </div>
    }
    <div class="announce" role="status" aria-live="polite">{{ announcement() }}</div>
  `,
  styles: `
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgb(10 14 34 / 0.94);
      color: #ffffff;
      text-align: center;
    }
    .number {
      margin: 0;
      font-size: clamp(5rem, 22vw, 14rem);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .number.t1 {
      color: #7fd1ff;
    }
    .number.t2 {
      color: #ffd23f;
    }
    .number.t3 {
      color: #ff9f43;
    }
    .comment {
      margin: 0;
      font-size: clamp(1.5rem, 5vw, 3rem);
    }
    .reason {
      color: #aeb4d8;
    }
    .announce {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class ScoreScreenComponent {
  readonly score = input<Score | undefined>();

  private readonly makeAudio = inject(FANFARE_AUDIO);
  private readonly server = inject(ServerUrl);
  private readonly store = inject(StateStore);

  /** The number on screen while it rolls and after it has landed. */
  protected readonly shown = signal(0);
  protected readonly landed = signal(false);
  protected readonly tier = signal('');
  protected readonly announcement = signal('');
  private readonly expired = signal(false);
  /** The overlay is on screen. */
  readonly open = computed(() => !!this.score() && !this.expired());

  private rollTimer?: ReturnType<typeof setInterval>;
  private landTimer?: ReturnType<typeof setTimeout>;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private fanfare?: FanfareAudio;
  private shownKey?: string;

  constructor() {
    effect(() => {
      const s = this.score();
      untracked(() => this.show(s));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private show(s: Score | undefined): void {
    if (!s) {
      this.stop();
      this.expired.set(false);
      this.shownKey = undefined;
      this.landed.set(false);
      this.tier.set('');
      this.announcement.set('');
      return;
    }
    const key = `${s.number}:${s.untilMs}`;
    if (key === this.shownKey) return; // the same score pushed again
    this.shownKey = key;
    this.stop();
    const closeIn = Number(s.untilMs) + CLOSE_AFTER_MS - (performance.now() + this.store.offsetMs());
    this.expired.set(closeIn <= 0);
    if (closeIn <= 0) return; // far too old to be shown
    this.closeTimer = setTimeout(() => {
      this.expired.set(true);
      this.stop();
    }, closeIn);
    this.landed.set(false);
    this.tier.set('');
    this.announcement.set('');
    if (!s.hasValue) {
      this.land(s);
    } else if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.land(s);
    } else {
      this.shown.set(roll());
      this.rollTimer = setInterval(() => this.shown.set(roll()), ROLL_EVERY_MS);
      this.landTimer = setTimeout(() => this.land(s), ROLL_FOR_MS);
    }
  }

  private land(s: Score): void {
    this.clearTimers();
    this.landed.set(true);
    if (!s.hasValue) {
      this.announcement.set(`No score this time.${s.reason ? ' ' + s.reason : ''}`);
      return;
    }
    this.shown.set(s.value);
    this.tier.set(s.fanfare >= 1 && s.fanfare <= 3 ? `t${s.fanfare}` : '');
    this.announcement.set(`Score ${s.value}. ${s.comment}`);
    if (s.fanfare >= 1 && s.fanfare <= 3) {
      const audio = this.makeAudio(`${this.server.base()}/media/fanfare/${s.fanfare}.mp3`);
      this.fanfare = audio;
      // the browser may want a tap first (the score is shown anyway); old browsers return nothing from play()
      void Promise.resolve()
        .then(() => audio.play())
        .catch(() => undefined);
    }
  }

  private clearTimers(): void {
    if (this.rollTimer) clearInterval(this.rollTimer);
    if (this.landTimer) clearTimeout(this.landTimer);
    this.rollTimer = this.landTimer = undefined;
  }

  private stop(): void {
    this.clearTimers();
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = undefined;
    this.fanfare?.pause();
    this.fanfare = undefined;
  }
}
