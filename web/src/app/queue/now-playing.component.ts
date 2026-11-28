import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { ControlAction, PlayStatus, SessionService, SongSource, State } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { FormatBadgeComponent } from '../library/format-badge.component';
import { AdjustControlsComponent } from './adjust-controls.component';

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Where the song plays, for the now-playing card and the bar of the shell. */
export function whereText(state: State | undefined, deviceId: string | undefined): string {
  const id = state?.playerDeviceId ?? '';
  if (!id) return 'No device is playing';
  const playing = state?.status === PlayStatus.PLAYING;
  if (id === deviceId) return playing ? 'Playing on this device' : 'Paused on this device';
  const device = state?.devices.find((d) => d.id === id);
  const name = device?.name ?? 'another device';
  // Play from here takes over when the player has gone away (the server decides the same way)
  if (device && !device.online) return `${name} is offline`;
  return playing ? `Playing on ${name}` : `Paused on ${name}`;
}

@Component({
  selector: 'app-now-playing',
  imports: [FormatBadgeComponent, AdjustControlsComponent],
  template: `
    <section class="card now" aria-label="Now playing">
      @if (now(); as n) {
        <h2 [attr.title]="n.song?.title">{{ n.song?.title }}</h2>
        <p class="meta">
          <span>{{ n.song?.artist }}</span>
          @if (n.song) {
            <app-format-badge [format]="n.song.format" [timing]="n.song.lyricTiming" [vocals]="n.song.hasVocals" />
          }
          <span class="source">{{ n.source === SongSource.RANDOM ? 'Picked at random' : 'From the queue' }}</span>
        </p>
        @if (startsIn() > 0) {
          <!-- the player shows the song's title card; it starts in a moment (kantahe-2d3) -->
          <p class="time">Starting in {{ startsIn() }}</p>
        } @else {
          <p class="time">{{ clock(position()) }}@if (duration() > 0) { / {{ clock(duration()) }} }</p>
        }
        @if (duration() > 0) {
          <progress aria-label="Song progress" [max]="duration() / 1000" [value]="position() / 1000"></progress>
        }
      } @else {
        <p>Nothing is playing. Add songs from the library.</p>
      }
      <p class="where" role="status">{{ where() }}</p>
      <div class="controls">
        @if (playing()) {
          <button type="button" [class.primary]="isHere()" (click)="send(Action.PAUSE)">Pause</button>
        } @else {
          <button type="button" [class.primary]="isHere()" (click)="send(Action.PLAY)">Play</button>
        }
        <button type="button" (click)="send(Action.SKIP)">Skip</button>
        <!-- one primary: taking the song here while another device plays, else Play or Pause -->
        @if (!isHere()) {
          <button class="primary" type="button" (click)="send(Action.PLAY_HERE)">Play here</button>
        }
        <!-- the fine controls fold away so that the queue starts on the first screen (kantahe-du1.7) -->
        @if (adjustable()) {
          <button type="button" class="fold" aria-controls="adjust-panel" [attr.aria-expanded]="adjustOpen()" (click)="adjustOpen.set(!adjustOpen())">
            {{ adjustLabel() }}
          </button>
        }
      </div>
      @if (adjustable() && adjustOpen()) {
        <div id="adjust-panel">
          <app-adjust-controls />
        </div>
      }
      <!-- the head of the queue is listed right below; a random pick is said here -->
      @if (upNext(); as u) {
        <p class="up-next" [attr.title]="u.song?.title + ' — ' + u.song?.artist">Up next: {{ u.song?.title }} — {{ u.song?.artist }}</p>
      }
    </section>
  `,
  styles: `
    /* the card sits in the column of the page, like the list below it (the .card class of the sign-in pages would centre it at 26rem) */
    .now {
      max-width: none;
      margin: 0 0 1.5rem;
    }
    /* a long title is cut to two lines and the whole text is in the tooltip */
    h2 {
      margin: 0 0 0.25rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      margin: 0;
      color: var(--muted);
    }
    progress {
      width: 100%;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .fold::after {
      content: ' ▾';
    }
    .fold[aria-expanded='true']::after {
      content: ' ▴';
    }
    .up-next {
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class NowPlayingComponent {
  private readonly store = inject(StateStore);
  private readonly auth = inject(AuthStore);
  private readonly client = injectClient(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly Action = ControlAction;
  protected readonly SongSource = SongSource;
  protected readonly clock = clock;

  protected readonly state = this.store.state;
  protected readonly now = computed(() => this.state()?.now);
  /** The next song when it is a random pick: the head of the queue is the first row of the list below. */
  protected readonly upNext = computed(() => {
    const u = this.state()?.upNext;
    return u?.source === SongSource.RANDOM ? u : undefined;
  });
  /** Volume, tempo and vocals act on the device that plays, while a song is current (AdjustControlsComponent shows nothing otherwise). */
  protected readonly adjustable = computed(() => {
    const s = this.state();
    return !!s?.now && !!s.playerDeviceId && s.devices.some((d) => d.id === s.playerDeviceId);
  });
  protected readonly adjustOpen = signal(false);
  protected readonly adjustLabel = computed(() => {
    const song = this.now()?.song;
    return song?.hasVocals && song.format !== Format.MIDI ? 'Volume, tempo and vocals' : 'Volume and tempo';
  });
  protected readonly playing = computed(() => this.state()?.status === PlayStatus.PLAYING);
  protected readonly duration = computed(() => Number(this.now()?.song?.durationMs ?? 0n));
  protected readonly position = signal(0);
  /** Whole seconds until the song starts after its title card on the player (kantahe-2d3); 0 when it plays or has no card. */
  protected readonly startsIn = signal(0);

  private readonly playerId = computed(() => this.state()?.playerDeviceId ?? '');
  protected readonly isHere = computed(() => this.playerId() !== '' && this.playerId() === this.auth.deviceId());
  protected readonly where = computed(() => whereText(this.state(), this.auth.deviceId()));

  private readonly visible = signal(document.visibilityState !== 'hidden');

  constructor() {
    const onVisibility = () => this.visible.set(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));

    // the position follows the server clock; it is redrawn on every frame, but only while it moves
    // (a song is playing) and somebody can see it
    // the extrapolation runs on until the next state arrives, so it must stop at the end of the song
    const shown = () => {
      const ms = this.store.positionMs();
      const length = this.duration();
      return length > 0 ? Math.min(ms, length) : ms;
    };
    const startsIn = () => {
      const at = Number(this.state()?.now?.startsAtMs ?? 0n);
      const left = at > 0 ? at - (performance.now() + this.store.offsetMs()) : 0;
      return left > 0 ? Math.ceil(left / 1000) : 0;
    };
    effect((onCleanup) => {
      const s = this.state();
      this.position.set(shown());
      this.startsIn.set(startsIn());
      if (!s?.now || s.status !== PlayStatus.PLAYING || !this.visible()) return;
      let frame = 0;
      const tick = () => {
        this.position.set(shown());
        this.startsIn.set(startsIn());
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }

  /** Commands on their way: the same one pressed again meanwhile (a double tap on Skip) is dropped. */
  private readonly sending = new Set<ControlAction>();

  protected async send(action: ControlAction): Promise<void> {
    if (this.sending.has(action)) return;
    this.sending.add(action);
    try {
      await this.client.control({ action });
    } catch (e) {
      this.toast.show(problem(e, {}), 'error');
    } finally {
      this.sending.delete(action);
    }
  }
}
