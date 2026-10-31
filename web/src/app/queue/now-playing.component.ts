import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { ControlAction, PlayStatus, SessionService, SongSource, State } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { FormatBadgeComponent } from '../library/format-badge.component';

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
  imports: [FormatBadgeComponent],
  template: `
    <section class="card now" aria-label="Now playing">
      @if (now(); as n) {
        <h2>{{ n.song?.title }}</h2>
        <p class="meta">
          <span>{{ n.song?.artist }}</span>
          @if (n.song) {
            <app-format-badge [format]="n.song.format" />
          }
          <span class="source">{{ n.source === SongSource.RANDOM ? 'Picked at random' : 'From the queue' }}</span>
        </p>
        <p class="time">{{ clock(position()) }}@if (duration() > 0) { / {{ clock(duration()) }} }</p>
        @if (duration() > 0) {
          <progress aria-label="Song progress" [max]="duration() / 1000" [value]="position() / 1000"></progress>
        }
      } @else {
        <p>Nothing is playing. Add songs from the library.</p>
      }
      <p class="where" role="status">{{ where() }}</p>
      <div class="controls">
        @if (playing()) {
          <button type="button" (click)="send(Action.PAUSE)">Pause</button>
        } @else {
          <button type="button" (click)="send(Action.PLAY)">Play</button>
        }
        <button type="button" (click)="send(Action.SKIP)">Skip</button>
        @if (!isHere()) {
          <button type="button" (click)="send(Action.PLAY_HERE)">Play here</button>
        }
      </div>
      @if (upNext(); as u) {
        <p class="up-next">Up next: {{ u.song?.title }} — {{ u.song?.artist }}</p>
      }
    </section>
  `,
  styles: `
    h2 {
      margin: 0 0 0.25rem;
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
    .up-next {
      color: var(--muted);
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
  protected readonly upNext = computed(() => this.state()?.upNext);
  protected readonly playing = computed(() => this.state()?.status === PlayStatus.PLAYING);
  protected readonly duration = computed(() => Number(this.now()?.song?.durationMs ?? 0n));
  protected readonly position = signal(0);

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
    effect((onCleanup) => {
      const s = this.state();
      this.position.set(shown());
      if (!s?.now || s.status !== PlayStatus.PLAYING || !this.visible()) return;
      let frame = 0;
      const tick = () => {
        this.position.set(shown());
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
