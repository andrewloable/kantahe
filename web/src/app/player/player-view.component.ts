import { Component, computed, inject, input, viewChild } from '@angular/core';
import { ControlAction } from '../../gen/kantahe/v1/session_pb';
import { FormatBadgeComponent } from '../library/format-badge.component';
import { clock } from '../queue/now-playing.component';
import { PlayerController } from './player.controller';
import { LyricsViewComponent } from './lyrics-view/lyrics-view.component';
import { ScoreScreenComponent } from './score/score-screen.component';

/** The full-screen player: lyrics, song, progress and controls; on a device that is not the player, a pointer to the one that is. */
@Component({
  selector: 'app-player-view',
  imports: [LyricsViewComponent, FormatBadgeComponent, ScoreScreenComponent],
  providers: [PlayerController],
  template: `
    <main class="stage" [class.embedded]="embedded()">
      @if (!c.state()) {
        <p role="status">Connecting…</p>
      } @else if (c.isPlayer()) {
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
              <h1>{{ s.title }}</h1>
              <p>
                <span>{{ s.artist }}</span>
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
      min-height: 100vh;
      padding: 1.5rem 1rem;
      background: #0a0e22;
      color: var(--text);
      text-align: center;
    }
    /* inside the app the native Close sits at the top and the native controls at the bottom, over the page */
    .stage.embedded {
      padding-top: 4.5rem;
      padding-bottom: 6rem;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
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
      width: min(40rem, 90%);
    }
    .controls {
      display: flex;
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
  `,
})
export class PlayerViewComponent {
  protected readonly c = inject(PlayerController);
  /** Inside the app's WebView: the same player without anything around it. */
  readonly embedded = input(false);

  protected readonly Action = ControlAction;
  private readonly score = viewChild(ScoreScreenComponent);
  /** While the score covers the screen, nothing behind it can be reached. */
  protected readonly scoreOpen = computed(() => this.score()?.open() ?? false);
  protected readonly clock = clock;
  protected readonly song = computed(() => this.c.state()?.now?.song);
  protected readonly duration = computed(() => Number(this.song()?.durationMs ?? 0n));
  protected readonly shown = computed(() =>
    this.duration() > 0 ? Math.min(this.c.timeMs(), this.duration()) : this.c.timeMs(),
  );
}
