import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { BackgroundMode, Device, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { SONG_CACHE } from '../player/cache/song-cache';
import { ToastService } from '../core/toast';
import { TYPES } from '../queue/devices.component';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

/** A size for people: megabytes up to a gigabyte, then gigabytes; one decimal only when it is not a whole number. */
function formatBytes(bytes: number): string {
  const [value, unit] = bytes >= GIB ? [bytes / GIB, 'GB'] : [bytes / MIB, 'MB'];
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

const MODES: { value: MidiMode; label: string; explain: string }[] = [
  { value: MidiMode.AUTO, label: 'Auto', explain: 'Chooses by the memory of the device and steps down by itself if the sound stutters.' },
  { value: MidiMode.FULL, label: 'Full', explain: 'The full sound: all voices, with reverb and chorus. Needs a device with plenty of memory.' },
  { value: MidiMode.LOW_POWER, label: 'Low power', explain: 'Lighter on a weak device: 32 voices, no reverb or chorus, a lower sample rate.' },
  { value: MidiMode.SERVER, label: 'Server', explain: 'The server makes the sound and the device only plays it like an MP3. Needs the server to be able to do that.' },
];

const modeLabel = (m: MidiMode) => MODES.find((x) => x.value === m)?.label ?? 'Auto';

const BACKGROUNDS: { value: BackgroundMode; label: string; explain: string }[] = [
  { value: BackgroundMode.AUTO, label: 'Auto', explain: 'On, unless this device is weak or uses a lighter sound mode.' },
  { value: BackgroundMode.ON, label: 'On', explain: 'Always show the moving pictures behind the lyrics on this device, even if it is weak. There is never any sound from them.' },
  { value: BackgroundMode.OFF, label: 'Off', explain: 'A plain background behind the lyrics. Easier on a weak device.' },
];

type VolumeKind = 'mp3' | 'midi';
/** A device offline for longer than this can be removed with one button. */
const STALE_DAYS = 30;
/** The pause after the last move of a volume range before it is sent. */
const VOLUME_PAUSE_MS = 300;

@Component({
  selector: 'app-my-devices',
  template: `
    <h2>My devices</h2>
    @if (loadError()) {
      <p class="error" role="alert">{{ loadError() }} <button type="button" (click)="load()">Try again</button></p>
    }
    <ul class="devices">
      @for (d of devices(); track d.id) {
        <li class="device">
          <!-- one line per device; its settings open under it (this device's start open, the others closed) -->
          <span class="name">{{ d.name }}</span>
          @if (d.isCaller) {
            <span>(this device)</span>
          }
          <span class="muted">{{ type(d).label }}</span>
          <span class="muted">{{ online(d) ? 'online' : 'offline' }}</span>
          <span class="muted">MIDI: {{ effective(d) }}</span>
          <button type="button" class="toggle-settings" [attr.aria-expanded]="isOpen(d)" [attr.aria-label]="'Settings for ' + d.name" (click)="toggle(d)">
            Settings
          </button>
          @if (isOpen(d)) {
            <span class="mode">
              <label [for]="'mode-' + d.id" class="what">MIDI mode</label>
              <select class="midi-mode" [id]="'mode-' + d.id" [attr.aria-label]="'MIDI mode of ' + d.name" (change)="setMode(d, $event)">
                @for (m of modes; track m.value) {
                  <option [value]="m.value" [selected]="m.value === mode(d)">{{ m.label }}</option>
                }
              </select>
              <span class="explain">{{ explain(d) }}</span>
              <span class="effective">Now using: {{ effective(d) }}</span>
            </span>
            <span class="mode background">
              <label [for]="'background-' + d.id" class="what">Background video</label>
              <select [id]="'background-' + d.id" [attr.aria-label]="'Background video of ' + d.name" (change)="setBackground(d, $event)">
                @for (b of backgrounds; track b.value) {
                  <option [value]="b.value" [selected]="b.value === background(d)">
                    {{ b.label }}
                  </option>
                }
              </select>
              <span class="explain">{{ explainBackground(d) }}</span>
              <span class="effective">Now using: {{ effectiveBackground(d) }}</span>
            </span>
            <span class="volumes" role="group" [attr.aria-label]="'Volume of ' + d.name">
              @for (v of volumeKinds; track v.kind) {
                <span class="volume">
                  <label [for]="v.kind + '-volume-' + d.id" class="what">{{ v.label }}</label>
                  <input
                    [id]="v.kind + '-volume-' + d.id"
                    [class]="'volume-' + v.kind"
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    [attr.aria-label]="v.label + ' of ' + d.name"
                    [value]="volume(d, v.kind)"
                    (input)="setVolume(d, v.kind, $event)"
                  />
                  <span class="effective">{{ volume(d, v.kind) }} %</span>
                </span>
              }
            </span>
            @if (d.isCaller && cacheShown) {
              <span class="mode cache">
                <label class="what"><input type="checkbox" [checked]="cacheOn()" (change)="toggleCache($event)" /> Keep played songs on this device</label>
                <span class="explain"
                  >{{ cacheText() }} A song is then played from this device and not downloaded again; the oldest are removed to make room, and room is always
                  left for other apps.</span
                >
                @if (clearingCache()) {
                  <span class="ask" role="group">
                    <span>{{ clearQuestion() }}</span>
                    <button class="danger primary" type="button" (click)="clearCache()">Yes, clear</button>
                    <button class="quiet" type="button" (click)="clearingCache.set(false)">Cancel</button>
                  </span>
                } @else {
                  <button type="button" class="clear-cache danger" [disabled]="!cacheStats()?.count" (click)="clearingCache.set(true)">Clear song cache</button>
                }
              </span>
            }
            @if (confirming() === d.id) {
              <span class="ask" role="group">
                <span>Sign out "{{ d.name }}"?{{ d.isCaller ? ' This is the device you are using; you will have to sign in again.' : '' }}</span>
                <button class="danger primary" type="button" (click)="revoke(d)">Yes, sign out</button>
                <button class="quiet" type="button" (click)="confirming.set(undefined)">Cancel</button>
              </span>
            } @else {
              <button class="danger" type="button" [attr.aria-label]="'Sign out ' + d.name" (click)="confirming.set(d.id)">Sign out</button>
            }
          }
        </li>
      }
    </ul>
    @if (stale().length > 0) {
      <p class="bulk">
        @if (clearingStale()) {
          <span class="ask" role="group">
            <span
              >Sign out {{ stale().length }} {{ stale().length === 1 ? 'device' : 'devices' }} that {{ stale().length === 1 ? 'has' : 'have' }} been offline for
              more than 30 days?</span
            >
            <button class="danger primary" type="button" [disabled]="removingStale()" (click)="removeStale()">Yes, sign out all {{ stale().length }}</button>
            <button class="quiet" type="button" [disabled]="removingStale()" (click)="clearingStale.set(false)">Cancel</button>
          </span>
        } @else {
          <button class="danger" type="button" (click)="clearingStale.set(true)">Remove devices offline for 30 days ({{ stale().length }})</button>
        }
      </p>
    }
  `,
  styles: `
    .devices {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      padding: 1rem 0;
      border-bottom: 1px solid var(--line);
    }
    /* the question before a sign-out: its words and its two buttons are a row that wraps, with room between them */
    .ask {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
      flex-basis: 100%;
    }
    .name {
      font-weight: 600;
    }
    .toggle-settings {
      margin-left: auto;
    }
    .bulk {
      margin: 1rem 0 0;
    }
    .muted,
    .explain,
    .effective {
      color: var(--muted);
      font-size: 0.875rem;
    }
    .mode {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex-basis: 100%;
    }
    /* two selects in a row of the list: each says what it sets */
    .what {
      font-weight: 600;
      font-size: 0.875rem;
    }
    /* the switch of the song cache: the label is the target, at least as tall as the other controls */
    .cache .what {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 2.75rem;
    }
    .cache input[type='checkbox'] {
      width: 1.5rem;
      height: 1.5rem;
    }
    select {
      min-height: 2.75rem;
      max-width: 14rem;
    }
    /* the two volumes: a row each, the range takes the room, the value is read beside it */
    .volumes {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex-basis: 100%;
    }
    .volume {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
    }
    .volume input[type='range'] {
      flex: 1 1 10rem;
      min-height: 2.75rem;
      max-width: 20rem;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class MyDevicesComponent {
  private readonly authClient = injectClient(AuthService);
  private readonly session = injectClient(SessionService);
  private readonly auth = inject(AuthStore);
  private readonly store = inject(StateStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly cache = inject(SONG_CACHE);

  protected readonly modes = MODES;
  protected readonly backgrounds = BACKGROUNDS;
  protected readonly volumeKinds: { kind: VolumeKind; label: string }[] = [
    { kind: 'mp3', label: 'MP3 songs volume' },
    { kind: 'midi', label: 'MIDI songs volume' },
  ];
  /** Volumes moved here: shown at once, sent after a short pause, and kept when the server accepts them (put back when it refuses). */
  private readonly moved = signal<Map<string, number>>(new Map());
  private readonly volumeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  protected readonly listed = signal<Device[]>([]);
  protected readonly confirming = signal<string | undefined>(undefined);
  /** Modes chosen here and accepted by the server, for devices the live state does not show. */
  private readonly chosen = signal<Map<string, MidiMode>>(new Map());
  /** The same for the background video choice, and what the server resolved from it. */
  private readonly chosenBackground = signal<Map<string, { mode: BackgroundMode; effective: boolean }>>(new Map());
  private gone = false;

  /** The song cache of this browser: only offered where the browser can keep files. */
  protected readonly cacheShown = this.cache.supported();
  protected readonly cacheOn = signal(this.cache.enabled());
  protected readonly cacheStats = signal<{ count: number; bytes: number; capBytes: number } | undefined>(undefined);
  protected readonly clearingCache = signal(false);

  /** This device first, then the others in the order the server lists them. */
  protected readonly devices = computed(() => [...this.listed()].sort((a, b) => Number(b.isCaller) - Number(a.isCaller)));

  /** Devices whose settings were opened or closed by hand: this device starts open, the others closed. */
  private readonly flipped = signal<ReadonlySet<string>>(new Set());

  protected isOpen(d: Device): boolean {
    return this.flipped().has(d.id) !== d.isCaller;
  }

  protected toggle(d: Device): void {
    this.flipped.update((s) => {
      const next = new Set(s);
      if (!next.delete(d.id)) next.add(d.id);
      return next;
    });
  }

  /** Devices that are offline and were last seen more than 30 days ago (a device with no last-seen time is left alone), never this one. */
  protected readonly stale = computed(() => {
    const cutoff = BigInt(Math.floor(Date.now() / 1000) - STALE_DAYS * 24 * 60 * 60);
    return this.devices().filter((d) => !d.isCaller && d.id !== this.auth.deviceId() && !this.online(d) && d.lastSeenUnix > 0n && d.lastSeenUnix < cutoff);
  });
  protected readonly clearingStale = signal(false);
  protected readonly removingStale = signal(false);

  /** Signs the stale devices out, one call each; the first refusal stops it, is shown, and the list is read again. */
  protected async removeStale(): Promise<void> {
    this.removingStale.set(true);
    try {
      for (const d of this.stale()) await this.authClient.revokeDevice({ deviceId: d.id });
    } catch (e) {
      this.toast.show(problem(e, {}), 'error');
    } finally {
      this.removingStale.set(false);
      this.clearingStale.set(false);
      await this.load();
    }
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.gone = true;
      for (const t of this.volumeTimers.values()) clearTimeout(t);
    });
    void this.load();
    if (this.cacheShown) void this.refreshCache();
  }

  /** Why the list could not be loaded, shown on the page with a way to try again (a toast would be gone before it was read). */
  protected readonly loadError = signal('');

  protected async load(): Promise<void> {
    this.loadError.set('');
    try {
      const res = await this.authClient.listMyDevices({});
      if (!this.gone) this.listed.set(res.devices);
    } catch (e) {
      if (!this.gone) this.loadError.set(problem(e, {}));
    }
  }

  private async refreshCache(): Promise<void> {
    const stats = await this.cache.stats();
    if (!this.gone) this.cacheStats.set(stats);
  }

  protected toggleCache(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.cache.setEnabled(on);
    this.cacheOn.set(on);
  }

  protected cacheText(): string {
    const s = this.cacheStats();
    if (!s || s.count === 0) return `Nothing is kept yet (up to ${formatBytes(s?.capBytes ?? 2 * GIB)}).`;
    return `${s.count} ${s.count === 1 ? 'song' : 'songs'}, ${formatBytes(s.bytes)} of up to ${formatBytes(s.capBytes)}.`;
  }

  protected clearQuestion(): string {
    const count = this.cacheStats()?.count ?? 0;
    return count === 1 ? 'Delete the kept song from this device?' : `Delete the ${count} kept songs from this device?`;
  }

  protected async clearCache(): Promise<void> {
    await this.cache.clear();
    this.clearingCache.set(false);
    await this.refreshCache();
    this.toast.show('Song cache cleared');
  }

  private live(d: Device): Device | undefined {
    return this.store.state()?.devices.find((x) => x.id === d.id);
  }

  protected type(d: Device) {
    return TYPES[d.type] ?? { icon: '', label: 'Unknown' };
  }

  protected online(d: Device): boolean {
    return this.live(d)?.online ?? d.online;
  }

  protected mode(d: Device): MidiMode {
    return this.chosen().get(d.id) ?? this.live(d)?.midiMode ?? d.midiMode;
  }

  protected explain(d: Device): string {
    return MODES.find((m) => m.value === this.mode(d))?.explain ?? '';
  }

  protected effective(d: Device): string {
    return modeLabel(this.live(d)?.effectiveMidiMode ?? d.effectiveMidiMode);
  }

  /** What the user chose; a server that does not know the field says "unspecified", which is Auto. */
  protected background(d: Device): BackgroundMode {
    const mode = this.chosenBackground().get(d.id)?.mode ?? this.live(d)?.backgroundMode ?? d.backgroundMode;
    return mode === BackgroundMode.UNSPECIFIED ? BackgroundMode.AUTO : mode;
  }

  protected explainBackground(d: Device): string {
    return BACKGROUNDS.find((b) => b.value === this.background(d))?.explain ?? '';
  }

  protected effectiveBackground(d: Device): string {
    const live = this.live(d);
    const on = live ? live.effectiveBackground : (this.chosenBackground().get(d.id)?.effective ?? d.effectiveBackground);
    return on ? 'On' : 'Off';
  }

  protected async setBackground(d: Device, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const before = this.background(d);
    const mode = Number(select.value) as BackgroundMode;
    try {
      const res = await this.session.setBackgroundMode({ deviceId: d.id, mode });
      this.chosenBackground.update((m) =>
        new Map(m).set(d.id, {
          mode: res.device?.backgroundMode ?? mode,
          effective: res.device?.effectiveBackground ?? false,
        }),
      );
    } catch (e) {
      select.value = String(before);
      this.toast.show(problem(e, {}), 'error');
    }
  }

  /** The volume in percent: what was just moved here, else the live state, else the list; 100 when the server sends none. */
  protected volume(d: Device, kind: VolumeKind): number {
    const moved = this.moved().get(`${d.id}:${kind}`);
    if (moved !== undefined) return moved;
    const live = this.live(d);
    const value = kind === 'mp3' ? (live ?? d).mp3VolumePct : (live ?? d).midiVolumePct;
    return value ?? 100;
  }

  protected setVolume(d: Device, kind: VolumeKind, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    const key = `${d.id}:${kind}`;
    const before = this.volume(d, kind);
    this.moved.update((m) => new Map(m).set(key, value));
    clearTimeout(this.volumeTimers.get(key));
    this.volumeTimers.set(
      key,
      setTimeout(() => void this.sendVolume(d, kind, key, value, before), VOLUME_PAUSE_MS),
    );
  }

  private async sendVolume(d: Device, kind: VolumeKind, key: string, value: number, before: number): Promise<void> {
    this.volumeTimers.delete(key);
    try {
      await this.session.setVolume(kind === 'mp3' ? { deviceId: d.id, mp3Pct: value } : { deviceId: d.id, midiPct: value });
      // accepted: the value stays as shown (like the MIDI mode chosen here, it wins over a list that was read before)
    } catch (e) {
      if (this.moved().get(key) === value) this.moved.update((m) => new Map(m).set(key, before));
      this.toast.show(problem(e, {}), 'error');
    }
  }

  protected async setMode(d: Device, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const before = this.mode(d);
    const mode = Number(select.value) as MidiMode;
    try {
      const res = await this.session.setMidiMode({ deviceId: d.id, mode });
      this.chosen.update((m) => new Map(m).set(d.id, res.device?.midiMode ?? mode));
    } catch (e) {
      select.value = String(before);
      this.toast.show(problem(e, {}), 'error');
    }
  }

  protected async revoke(d: Device): Promise<void> {
    try {
      await this.authClient.revokeDevice({ deviceId: d.id });
    } catch (e) {
      this.toast.show(problem(e, {}), 'error');
      return;
    }
    this.confirming.set(undefined);
    if (d.id === this.auth.deviceId()) {
      this.auth.signOut();
      await this.router.navigateByUrl('/login');
    } else {
      await this.load();
    }
  }
}
