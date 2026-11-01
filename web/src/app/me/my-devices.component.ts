import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { BackgroundMode, Device, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { TYPES } from '../queue/devices.component';

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
          <span class="name">{{ d.name }}</span>
          @if (d.isCaller) {
            <span>(this device)</span>
          }
          <span class="muted">{{ type(d).label }}</span>
          <span class="muted">{{ online(d) ? 'online' : 'offline' }}</span>
          <span class="mode">
            <label [for]="'mode-' + d.id" class="what">MIDI mode</label>
            <select [id]="'mode-' + d.id" [attr.aria-label]="'MIDI mode of ' + d.name" (change)="setMode(d, $event)">
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
                <option [value]="b.value" [selected]="b.value === background(d)">{{ b.label }}</option>
              }
            </select>
            <span class="explain">{{ explainBackground(d) }}</span>
            <span class="effective">Now using: {{ effectiveBackground(d) }}</span>
          </span>
          @if (confirming() === d.id) {
            <span class="ask" role="group">
              <span>Sign out "{{ d.name }}"?{{ d.isCaller ? ' This is the device you are using; you will have to sign in again.' : '' }}</span>
              <button type="button" (click)="revoke(d)">Yes, sign out</button>
              <button type="button" (click)="confirming.set(undefined)">Cancel</button>
            </span>
          } @else {
            <button type="button" [attr.aria-label]="'Sign out ' + d.name" (click)="confirming.set(d.id)">Sign out</button>
          }
        </li>
      }
    </ul>
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
    select {
      min-height: 2.75rem;
      max-width: 14rem;
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

  protected readonly modes = MODES;
  protected readonly backgrounds = BACKGROUNDS;
  protected readonly listed = signal<Device[]>([]);
  protected readonly confirming = signal<string | undefined>(undefined);
  /** Modes chosen here and accepted by the server, for devices the live state does not show. */
  private readonly chosen = signal<Map<string, MidiMode>>(new Map());
  /** The same for the background video choice, and what the server resolved from it. */
  private readonly chosenBackground = signal<Map<string, { mode: BackgroundMode; effective: boolean }>>(new Map());
  private gone = false;

  protected readonly devices = computed(() => this.listed());

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.gone = true));
    void this.load();
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
      this.chosenBackground.update((m) => new Map(m).set(d.id, { mode: res.device?.backgroundMode ?? mode, effective: res.device?.effectiveBackground ?? false }));
    } catch (e) {
      select.value = String(before);
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
