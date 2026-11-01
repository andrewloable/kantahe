import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { ControlAction, PlayStatus } from '../../gen/kantahe/v1/session_pb';
import { FormatBadgeComponent } from '../library/format-badge.component';
import { clock } from '../queue/now-playing.component';
import { BackgroundVideoComponent } from './background/background-video.component';
import { PlayerController } from './player.controller';
import { LyricsViewComponent } from './lyrics-view/lyrics-view.component';
import { ScoreScreenComponent } from './score/score-screen.component';

/** How long the buttons stay after the last move, touch or key while a song plays. */
const IDLE_MS = 3000;

/** The full-screen player: lyrics, song, progress and controls; on a device that is not the player, a pointer to the one that is. */
@Component({
  selector: 'app-player-view',
  imports: [LyricsViewComponent, FormatBadgeComponent, ScoreScreenComponent, BackgroundVideoComponent],
  providers: [PlayerController],
  // any move, touch or key on the player shows its buttons again
  host: { '(mousemove)': 'wake()', '(pointerdown)': 'wake(false)', '(touchstart)': 'wake(false)', '(keydown)': 'wake(true)', '(focusin)': 'wake()' },
  template: `
    <main class="stage fill" [class.embedded]="embedded()" [class.idle]="idle()">
      @if (!embedded()) {
        <div class="topbar">
          <button type="button" (click)="leave('/library')">Back to Kantahe</button>
          @if (isAdmin()) {
            <button type="button" (click)="leave('/admin')">Admin</button>
          }
          @if (canFullscreen) {
            <button type="button" class="fs" (click)="toggleFullscreen()">{{ fullscreen() ? 'Exit full screen' : 'Full screen' }}</button>
          }
        </div>
      }
      @if (!c.state()) {
        <p role="status">Connecting…</p>
      } @else if (c.isPlayer()) {
        <app-background-video [playing]="videoPlaying()" />
        <app-score-screen [score]="c.state()?.score" />
        <div class="player-content" [attr.inert]="scoreOpen() ? '' : null">
          @if (c.phase() === 'preparing') {
            <p role="status">Preparing…</p>
          } @else if (c.phase() === 'loading') {
            <p role="status">Loading the song…</p>
          } @else if (c.phase() === 'error') {
            <p role="alert">{{ c.error() }}</p>
          }
          @if (song(); as s) {
            <header class="song">
              <h1 [attr.title]="s.title">{{ s.title }}</h1>
              <p>
                <span class="artist" [attr.title]="s.artist">{{ s.artist }}</span>
                <app-format-badge [format]="s.format" />
              </p>
            </header>
            <app-lyrics-view [lyrics]="c.lyrics()" [timeMs]="c.timeMs()" />
            <p class="time">
              {{ clock(shown()) }}
              @if (duration() > 0) {
                / {{ clock(duration()) }}
              }
            </p>
            @if (duration() > 0) {
              <progress
                aria-label="Song progress"
                [max]="duration() / 1000"
                [value]="shown() / 1000"
              ></progress>
            }
          } @else if (c.phase() === 'idle') {
            <p>Nothing is playing. Add songs from the library on another screen.</p>
          }
          @if (c.needsGesture()) {
            <button type="button" class="big" (click)="c.unlock()">Tap to start the sound</button>
          }
          @if (!embedded()) {
            <div class="controls">
              @if (c.playing()) {
                <button type="button" (click)="c.control(Action.PAUSE)">Pause</button>
              } @else {
                <button type="button" (click)="c.control(Action.PLAY)">Play</button>
              }
              <button type="button" (click)="c.control(Action.SKIP)">Skip</button>
            </div>
          }
        </div>
      } @else {
        <p class="elsewhere">
          {{ c.playerName() ? 'Playing on ' + c.playerName() : 'No device is playing' }}
        </p>
        <button type="button" class="big" (click)="c.control(Action.PLAY_HERE)">Play here</button>
      }
    </main>
  `,
  styles: `
    /* the stage is dark whatever the theme: it is read from a distance */
    .stage {
      --text: #ffffff;
      --muted: #aeb4d8;
      --sung: #ffd23f;
      position: relative;
      /* the background video (position: fixed, z-index -1) sits behind everything in here, over this background */
      isolation: isolate;
      min-height: 100vh;
      padding: 1.5rem 1rem;
      background: #0a0e22;
      color: var(--text);
      text-align: center;
    }
    /* the whole window: song at the top, the lyrics filling the middle, time and controls at the bottom */
    .stage.fill {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      /* a window too low for song, lyrics and controls scrolls: nothing is cut off */
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior-y: contain; /* a swipe at the end of its own scroll neither scrolls the page nor reloads it */
    }
    .player-content {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    app-lyrics-view {
      /* readable over a moving picture as well (the scrim does the main work) */
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
      flex: 1;
      /* the lyrics are what the screen is for: the title gives way first (about two lines of lyrics and the dots) */
      min-height: 7rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-size: clamp(1.75rem, 7vmin, 6rem);
    }
    .topbar {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      right: 0.75rem;
      /* above the score screen (z-index 10): leaving or going full screen works while a score shows */
      z-index: 20;
      display: flex;
      gap: 0.5rem;
    }
    .topbar .fs {
      margin-left: auto;
    }
    .topbar button {
      white-space: nowrap;
      padding: 0.5rem 0.75rem;
      background: transparent;
      border: 1px solid var(--muted);
      color: var(--text);
    }
    .topbar,
    .controls {
      transition: opacity 0.4s;
    }
    /* while a song plays and nobody touches anything, the buttons and the pointer get out of the way */
    .stage.idle {
      cursor: none;
    }
    .stage.idle .topbar,
    .stage.idle .controls {
      opacity: 0;
      pointer-events: none;
    }
    .stage.fill:not(.embedded) {
      padding-top: 3.75rem;
    }
    /* inside the app the native Close sits at the top and the native controls at the bottom, over the page */
    .stage.embedded {
      padding-top: 4.5rem;
      padding-bottom: 6rem;
    }
    /* a long title is cut to two lines and a long artist to one: the whole text is in the tooltip */
    h1 {
      margin: 0;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .artist {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .song p {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      align-items: center;
      margin: 0.25rem 0 2rem;
      color: var(--muted);
    }
    .time {
      color: var(--muted);
    }
    progress {
      align-self: center;
      width: min(40rem, 90%);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: center;
      margin-top: 1.5rem;
    }
    .controls button,
    .big {
      min-width: 8rem;
      min-height: 3.5rem;
      font-size: 1.25rem;
    }
    .elsewhere {
      font-size: 1.5rem;
    }
    /* a phone on its side: less air, one line of title */
    @media (max-height: 30rem) {
      .stage.fill:not(.embedded) {
        padding-top: 3.25rem;
        padding-bottom: 0.5rem;
      }
      h1 {
        -webkit-line-clamp: 1;
      }
      .song p {
        margin-bottom: 0.5rem;
      }
      .controls {
        margin-top: 0.5rem;
      }
    }
  `,
})
export class PlayerViewComponent {
  protected readonly c = inject(PlayerController);
  /** Inside the app's WebView: the same player without anything around it. */
  readonly embedded = input(false);

  protected readonly Action = ControlAction;
  /** The browser can fill the screen with the page (the app's WebView is full screen already). */
  protected readonly canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  protected readonly fullscreen = signal(typeof document !== 'undefined' && !!document.fullscreenElement);

  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly auth = inject(AuthStore);
  protected readonly isAdmin = computed(() => this.auth.user()?.admin === true);
  /** The buttons are hidden: a song plays and nothing was touched for IDLE_MS. */
  protected readonly idle = signal(false);
  private idleTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // a song that starts playing starts the count; a pause brings everything back
    effect(() => {
      const playing = this.c.playing();
      untracked(() => (playing ? this.wake() : this.stopIdle()));
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.idleTimer);
      // Leaving the page ends the sound, so a device that was playing is paused: songs stop only on Pause, and the
      // other devices must not keep showing "playing" for a screen that is silent. Inside the app (embedded) the
      // app decides. A closed tab does not get here: the server's 30 second rule pauses it then (PLAN section 7).
      if (!this.embedded() && this.c.isPlayer() && this.c.playing()) void this.c.control(ControlAction.PAUSE);
    });
    const onChange = () => this.fullscreen.set(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('fullscreenchange', onChange));
  }

  /** The last thing the user did was press a key (not a click or a touch): the focus on a button is theirs to keep in sight. */
  private keyboard = false;

  /** Any move, touch or key shows the buttons again for IDLE_MS. */
  protected wake(keyboard = this.keyboard): void {
    this.keyboard = keyboard;
    this.idle.set(false);
    clearTimeout(this.idleTimer);
    if (this.embedded()) return; // the app has its own buttons
    this.idleTimer = setTimeout(() => {
      // a keyboard user resting on a button keeps it in sight; a click or touch leaves focus on a button too, and those fade
      const f = document.activeElement;
      if (this.keyboard && f && this.host.contains(f)) return this.wake();
      if (this.c.playing() && !this.embedded()) this.idle.set(true);
    }, IDLE_MS);
  }

  private stopIdle(): void {
    clearTimeout(this.idleTimer);
    this.idle.set(false);
  }

  protected leave(url: string): void {
    void this.router.navigateByUrl(url);
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined); // refused: the page stays as it is
  }
  private readonly score = viewChild(ScoreScreenComponent);
  /** While the score covers the screen, nothing behind it can be reached. */
  protected readonly scoreOpen = computed(() => this.score()?.open() ?? false);
  protected readonly clock = clock;
  /** The background video moves while a song plays, while nothing plays and while the score shows; a paused song pauses it. */
  protected readonly videoPlaying = computed(() => {
    const s = this.c.state();
    return !s?.now || !!s.score || s.status === PlayStatus.PLAYING;
  });
  protected readonly song = computed(() => this.c.state()?.now?.song);
  protected readonly duration = computed(() => Number(this.song()?.durationMs ?? 0n));
  protected readonly shown = computed(() =>
    this.duration() > 0 ? Math.min(this.c.timeMs(), this.duration()) : this.c.timeMs(),
  );
}
