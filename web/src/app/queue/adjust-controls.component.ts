import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Format, VocalsState } from '../../gen/kantahe/v1/common_pb';
import { SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';

/** The volume buttons move the volume by this many percent, between 0 and MAX_VOLUME (as on Me > My devices). */
const VOLUME_STEP = 5;
const MAX_VOLUME = 200;
/** The vocals level moves by this many percent, between 0 and MAX_VOCALS. */
const VOCALS_STEP = 10;
const MAX_VOCALS = 100;
/** The speed of the song moves by this many percent, between 75 and 125 (the server says the same). */
const TEMPO_STEP = 5;
const MIN_TEMPO = 75;
const MAX_TEMPO = 125;
/** The pause after the last press before the new level is sent. */
const PAUSE_MS = 300;

/**
 * What the singer adjusts about the song that is on, from any device and never on the player itself (so that nothing moves on the screen
 * while someone sings): the volume of the device that plays and its guide vocals. It acts on the player device, also when that is this one.
 */
@Component({
  selector: 'app-adjust-controls',
  template: `
    @if (target(); as t) {
      <div class="adjust" role="group" [attr.aria-label]="'Adjust ' + t.name">
        <span class="row">
          <button type="button" (click)="changeVolume(-1)">Volume down</button>
          <span class="level" role="status" aria-live="polite">{{ volumeKind() === 'midi' ? 'MIDI' : 'MP3' }} volume {{ volumePct() }}%</span>
          <button type="button" (click)="changeVolume(1)">Volume up</button>
        </span>
        @if (tempoShown()) {
          <span class="row">
            <button type="button" [disabled]="tempoPct() <= MIN_TEMPO" (click)="changeTempo(-1)">Slower</button>
            <span class="level" role="status" aria-live="polite">Tempo {{ tempoPct() }}%</span>
            <button type="button" [disabled]="tempoPct() >= MAX_TEMPO" (click)="changeTempo(1)">Faster</button>
            @if (tempoPct() !== 100) {
              <button type="button" (click)="setTempo(100)">Normal speed</button>
            }
          </span>
        }
        @if (vocalsShown()) {
          <span class="row">
            <button type="button" class="vocals" [attr.aria-pressed]="vocalsMode() !== 'off'" (click)="toggleVocals()">{{ vocalsLabel() }}</button>
            @if (vocalsMode() !== 'off') {
              <button type="button" (click)="changeVocals(-1)">Vocals quieter</button>
              <span class="level" role="status" aria-live="polite">Vocals volume {{ vocalsPct() }}%</span>
              <button type="button" (click)="changeVocals(1)">Vocals louder</button>
            }
          </span>
        }
      </div>
    }
  `,
  styles: `
    .adjust {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin: 0.5rem 0;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .adjust button {
      min-height: 2.75rem;
    }
    .level {
      min-width: 9rem;
      text-align: center;
    }
  `,
})
export class AdjustControlsComponent {
  protected readonly MIN_TEMPO = MIN_TEMPO;
  protected readonly MAX_TEMPO = MAX_TEMPO;
  private readonly store = inject(StateStore);
  private readonly session = injectClient(SessionService);
  private readonly toast = inject(ToastService);

  private readonly state = this.store.state;
  /** The device that plays, while a song is current. */
  protected readonly target = computed(() => {
    const s = this.state();
    return s?.now && s.playerDeviceId ? s.devices.find((d) => d.id === s.playerDeviceId) : undefined;
  });
  private readonly song = computed(() => this.state()?.now?.song);
  protected readonly volumeKind = computed<'mp3' | 'midi'>(() => (this.song()?.format === Format.MIDI ? 'midi' : 'mp3'));

  /** What was just chosen with the buttons, shown at once: "<device>:<what>" -> percent; dropped when the state shows it or the server refuses it. */
  private readonly moved = signal<Record<string, number>>({});
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  private key(what: string): string {
    if (what === 'tempo') return 'tempo'; // the tempo belongs to the song, not to a device
    return `${this.target()?.id}:${what}`;
  }

  private live(what: 'mp3' | 'midi' | 'vocals'): number | undefined {
    const t = this.target();
    return what === 'mp3' ? t?.mp3VolumePct : what === 'midi' ? t?.midiVolumePct : t?.vocalsPct;
  }

  /** The speed of the song, shown at once when it was just chosen; a server that sends none (an older one) has no tempo and no controls. */
  protected readonly tempoShown = computed(() => (this.state()?.now?.tempoPct ?? 0) > 0);
  protected readonly tempoPct = computed(() => this.moved()['tempo'] ?? (this.state()?.now?.tempoPct || 100));

  protected readonly volumePct = computed(() => this.moved()[this.key(this.volumeKind())] ?? this.live(this.volumeKind()) ?? 100);
  protected readonly vocalsPct = computed(() => this.moved()[this.key('vocals')] ?? this.live('vocals') ?? 60);

  /** Only a song with a vocals track, only an MP3 song, and only on a server that keeps the choice (it sends vocals_on). */
  protected readonly vocalsShown = computed(() => !!this.song()?.hasVocals && this.song()?.format !== Format.MIDI && this.target()?.vocalsOn !== undefined);
  /** What the player really plays (the guide plays although the choice is off); a player that has not reported yet is shown by the choice. */
  protected readonly vocalsMode = computed<'off' | 'loading' | 'on'>(() => {
    const t = this.target();
    switch (t?.vocalsState) {
      case VocalsState.ON:
        return 'on';
      case VocalsState.LOADING:
        return 'loading';
      case VocalsState.OFF:
        return 'off';
      default:
        return t?.vocalsOn ? 'on' : 'off';
    }
  });
  protected readonly vocalsLabel = computed(() => {
    const mode = this.vocalsMode();
    return mode === 'on' ? 'Vocals: on' : mode === 'loading' ? 'Vocals: loading…' : 'Vocals: off';
  });

  constructor() {
    effect(() => {
      // the state shows what the buttons chose: from now on it is the truth (another device may change it)
      const t = this.target();
      const live = { mp3: t?.mp3VolumePct, midi: t?.midiVolumePct, vocals: t?.vocalsPct, tempo: this.state()?.now?.tempoPct };
      untracked(() => {
        const m = this.moved();
        const next = { ...m };
        let changed = false;
        for (const key of Object.keys(m)) {
          const [id, what] = (key === 'tempo' ? ['', 'tempo'] : key.split(':')) as [string, keyof typeof live];
          if ((what === 'tempo' || id === t?.id) && live[what] === m[key]) {
            delete next[key];
            changed = true;
          }
        }
        if (changed) this.moved.set(next);
      });
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach((t) => clearTimeout(t)));
  }

  protected changeVolume(direction: 1 | -1): void {
    const kind = this.volumeKind();
    this.step(kind, this.volumePct(), direction * VOLUME_STEP, MAX_VOLUME, (deviceId, pct) =>
      this.session.setVolume(kind === 'mp3' ? { deviceId, mp3Pct: pct } : { deviceId, midiPct: pct }),
    );
  }

  protected changeTempo(direction: 1 | -1): void {
    const now = this.tempoPct();
    const pct = Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, now + direction * TEMPO_STEP));
    if (pct !== now) this.setTempo(pct);
  }

  /** Shown at once, sent after a short pause (a held button is one change). */
  protected setTempo(pct: number): void {
    const key = 'tempo';
    const before = this.moved()[key];
    this.moved.update((m) => ({ ...m, [key]: pct }));
    clearTimeout(this.timers.get(key));
    this.timers.set(
      key,
      setTimeout(() => void this.commit(key, pct, before, () => this.session.setTempo({ pct })), PAUSE_MS),
    );
  }

  protected changeVocals(direction: 1 | -1): void {
    this.step('vocals', this.vocalsPct(), direction * VOCALS_STEP, MAX_VOCALS, (deviceId, pct) => this.session.setVocals({ deviceId, pct }));
  }

  private step(what: string, now: number, by: number, max: number, send: (deviceId: string, pct: number) => Promise<unknown>): void {
    const deviceId = this.target()?.id;
    if (!deviceId) return;
    const pct = Math.min(max, Math.max(0, now + by));
    if (pct === now) return;
    const key = this.key(what);
    const before = this.moved()[key];
    this.moved.update((m) => ({ ...m, [key]: pct }));
    clearTimeout(this.timers.get(key));
    this.timers.set(
      key,
      setTimeout(() => void this.commit(key, pct, before, () => send(deviceId, pct)), PAUSE_MS),
    );
  }

  private async commit(key: string, pct: number, before: number | undefined, send: () => Promise<unknown>): Promise<void> {
    this.timers.delete(key);
    try {
      await send();
    } catch (e) {
      // refused: the level that the state shows comes back
      if (this.moved()[key] === pct) {
        this.moved.update((m) => {
          const rest = { ...m };
          delete rest[key];
          return before === undefined ? rest : { ...rest, [key]: before };
        });
      }
      this.toast.show(problem(e, {}), 'error');
    }
  }

  protected toggleVocals(): void {
    const deviceId = this.target()?.id;
    if (!deviceId) return;
    // while the voice plays (also the guide that plays by itself) a press switches it off; while it is off, on
    const on = this.vocalsMode() === 'off';
    this.session.setVocals({ deviceId, on }).catch((e) => this.toast.show(problem(e, {}), 'error'));
  }
}
