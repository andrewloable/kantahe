import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthTokenSchema, BackgroundMode, Device, DeviceType, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { SONG_CACHE } from '../player/cache/song-cache';
import { asSongCache, FakeSongCache } from '../player/testing';
import { ToastService } from '../core/toast';
import { device, stateOf } from '../queue/testing';
import { MyDevicesComponent } from './my-devices.component';
import { fakeMe } from './testing';

const DAY = 24 * 60 * 60;
/** Seconds since the epoch, as the server's last_seen_unix is: `days` ago. */
const daysAgo = (days: number) => BigInt(Math.floor(Date.now() / 1000) - days * DAY);

async function setup(opts: { failFirst?: boolean; cache?: FakeSongCache; more?: Device[] } = {}) {
  const cache = opts.cache ?? new FakeSongCache();
  const mine = [
    device('me', 'This browser', { isCaller: true, type: DeviceType.WEB, midiMode: MidiMode.AUTO }),
    device('tv', 'Living room TV', { type: DeviceType.ANDROID_TV, online: false, midiMode: MidiMode.AUTO }),
    ...(opts.more ?? []),
  ];
  const server = fakeMe({ devices: mine });
  if (opts.failFirst) server.failNext(new ConnectError('down', Code.Unavailable));
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }, { provide: SONG_CACHE, useValue: asSongCache(cache) }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'me' }));
  // the live state knows who is online and what the server made of each setting
  TestBed.inject(StateStore).state.set(
    stateOf({
      devices: [
        device('me', 'This browser', { isCaller: true, online: true, midiMode: MidiMode.AUTO, effectiveMidiMode: MidiMode.FULL }),
        device('tv', 'Living room TV', { type: DeviceType.ANDROID_TV, online: true, midiMode: MidiMode.AUTO, effectiveMidiMode: MidiMode.SERVER }),
      ],
    }),
  );
  const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(MyDevicesComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  /** The line of a device as it is on screen (a collapsed device shows its summary only). */
  const peek = (name: string) => Array.from(el.querySelectorAll('li.device')).find((li) => li.textContent?.includes(name)) as HTMLElement;
  /** The device with its settings open: the other tests are about the settings, so this opens them first. */
  const row = (name: string) => {
    const li = peek(name);
    const toggle = li.querySelector<HTMLButtonElement>('button.toggle-settings');
    if (toggle?.getAttribute('aria-expanded') === 'false') {
      toggle.click();
      fixture.detectChanges();
    }
    return li;
  };
  const button = (within: ParentNode, text: string) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text))!;
  return { fixture, el, server, settle, row, peek, button, nav, cache };
}

describe('MyDevicesComponent', () => {
  afterEach(() => TestBed.inject(StateStore).stop());

  describe('collapsed devices (kantahe-tlf.3.7)', () => {
    const many = Array.from({ length: 13 }, (_, i) => device(`old${i}`, `Browser ${i}`, { online: false, lastSeenUnix: daysAgo(40 + i) }));

    it('REGRESSION: 15 devices are 15 summary lines and one open form, this device\'s; the others start closed', async () => {
      const { el, peek } = await setup({ more: many });
      expect(el.querySelectorAll('li.device')).toHaveLength(15);
      expect(el.querySelectorAll('select.midi-mode')).toHaveLength(1);
      expect(peek('This browser').querySelector('select.midi-mode')).not.toBeNull();
      expect(peek('Living room TV').querySelector('select')).toBeNull();
      expect(peek('Browser 3').querySelector('select')).toBeNull();
      expect(peek('This browser').querySelector('button.toggle-settings')?.getAttribute('aria-expanded')).toBe('true');
      expect(peek('Browser 3').querySelector('button.toggle-settings')?.getAttribute('aria-expanded')).toBe('false');
    });

    it('this device is listed first', async () => {
      const { el } = await setup({ more: many });
      expect(el.querySelector('li.device .name')?.textContent).toBe('This browser');
    });

    it('a summary says the name, the type, online or offline and the MIDI mode in use', async () => {
      const { peek } = await setup();
      const text = peek('Living room TV').textContent ?? '';
      expect(text).toContain('Android TV');
      expect(text).toContain('online');
      expect(text).toContain('MIDI: Server');
    });

    it('Settings for <name> opens and closes the settings of that device; the button says what it is for', async () => {
      const { peek, fixture } = await setup();
      const tv = peek('Living room TV');
      const toggle = tv.querySelector<HTMLButtonElement>('button.toggle-settings')!;
      expect(toggle.textContent?.trim()).toBe('Settings');
      expect(toggle.getAttribute('aria-label')).toBe('Settings for Living room TV');
      toggle.click();
      fixture.detectChanges();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(tv.querySelector('select')).not.toBeNull();
      toggle.click();
      fixture.detectChanges();
      expect(tv.querySelector('select')).toBeNull();
    });

    it('every setting is still reachable on a closed device after opening it (the mode of another device is still sent)', async () => {
      const { row, server, settle } = await setup({ more: many });
      const select = row('Browser 3').querySelector<HTMLSelectElement>('select.midi-mode')!;
      select.value = String(MidiMode.FULL);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(server.calls.midi).toEqual([{ deviceId: 'old3', mode: MidiMode.FULL }]);
    });
  });

  describe('removing devices offline for 30 days (kantahe-tlf.3.7)', () => {
    const stale = [
      device('s1', 'Old laptop', { online: false, lastSeenUnix: daysAgo(31) }),
      device('s2', 'Old phone', { online: false, lastSeenUnix: daysAgo(90) }),
      device('f1', 'Last week', { online: false, lastSeenUnix: daysAgo(7) }),
      device('u1', 'Never seen', { online: false, lastSeenUnix: 0n }),
    ];
    const removeButton = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('Remove devices offline for 30 days'));

    it('asks first, how many, and then signs out exactly the devices not seen for more than 30 days: never this device, an online one or one with no last-seen time', async () => {
      const { el, server, settle, fixture } = await setup({ more: stale });
      // the TV is online by the live state; this device is online too
      removeButton(el)!.click();
      fixture.detectChanges();
      expect(el.textContent).toContain('Sign out 2 devices that have been offline for more than 30 days?');
      expect(server.calls.revoke).toEqual([]);
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Yes, sign out all 2')!.click();
      await settle();
      expect(server.calls.revoke.sort()).toEqual(['s1', 's2']);
      expect(server.calls.listDevices).toBe(2); // the list is read again
    });

    it('Cancel sends nothing', async () => {
      const { el, server, settle, fixture } = await setup({ more: stale });
      removeButton(el)!.click();
      fixture.detectChanges();
      Array.from(el.querySelectorAll<HTMLButtonElement>('.bulk button')).find((b) => b.textContent?.trim() === 'Cancel')!.click();
      await settle();
      expect(server.calls.revoke).toEqual([]);
      expect(removeButton(el)).toBeDefined();
    });

    it('is not offered when no device qualifies', async () => {
      const { el } = await setup({ more: [stale[2], stale[3]] });
      expect(removeButton(el)).toBeUndefined();
    });

    it('a failing call stops the removal, says why and reads the list again', async () => {
      const { el, server, settle, fixture } = await setup({ more: stale });
      removeButton(el)!.click();
      fixture.detectChanges();
      server.failNext(new ConnectError('nope', Code.Internal));
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('Yes, sign out all'))!.click();
      await settle();
      expect(TestBed.inject(ToastService).toasts()[0].kind).toBe('error');
      expect(server.calls.listDevices).toBe(2);
    });
  });

  it('lists the devices with their type; this one is marked; online comes from the live state', async () => {
    const { row } = await setup();
    expect(row('This browser').textContent).toContain('(this device)');
    expect(row('This browser').textContent).toContain('Web');
    expect(row('Living room TV').textContent).toContain('Android TV');
    expect(row('Living room TV').textContent).toContain('online'); // the list said offline, the live state says online
    expect(row('Living room TV').textContent).not.toContain('offline');
  });

  it('falls back to the listed online flag for a device the live state does not know', async () => {
    const { fixture, row, settle } = await setup();
    TestBed.inject(StateStore).state.set(undefined);
    await settle();
    fixture.detectChanges();
    expect(row('Living room TV').textContent).toContain('offline');
  });

  it('MIDI mode: Auto, Full, Low power, Server, with a one-line explanation and the effective mode', async () => {
    const { row } = await setup();
    const select = row('Living room TV').querySelector<HTMLSelectElement>('select')!;
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual(['Auto', 'Full', 'Low power', 'Server']);
    expect(row('Living room TV').querySelector('.explain')?.textContent).toMatch(/memory/i);
    expect(row('Living room TV').textContent).toContain('Now using: Server');
    expect(row('This browser').textContent).toContain('Now using: Full');
  });

  it('changing the mode sends SetMidiMode for that device and shows the effective mode from the state', async () => {
    const { row, server, settle, fixture } = await setup();
    const select = row('This browser').querySelector<HTMLSelectElement>('select')!;
    select.value = String(MidiMode.LOW_POWER);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(server.calls.midi).toEqual([{ deviceId: 'me', mode: MidiMode.LOW_POWER }]);
    // the server answers through the live state
    TestBed.inject(StateStore).state.set(
      stateOf({ devices: [device('me', 'This browser', { isCaller: true, midiMode: MidiMode.LOW_POWER, effectiveMidiMode: MidiMode.LOW_POWER }), device('tv', 'Living room TV')] }),
    );
    fixture.detectChanges();
    expect(row('This browser').textContent).toContain('Now using: Low power');
    expect(row('This browser').querySelector('.explain')?.textContent).toMatch(/32 voices|lighter/i);
  });

  it('changing the mode of another device sends that device\'s id', async () => {
    const { row, server, settle } = await setup();
    const select = row('Living room TV').querySelector<HTMLSelectElement>('select')!;
    select.value = String(MidiMode.FULL);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(server.calls.midi).toEqual([{ deviceId: 'tv', mode: MidiMode.FULL }]);
  });

  describe('Volume', () => {
    const range = (li: HTMLElement, kind: 'mp3' | 'midi') => li.querySelector<HTMLInputElement>(`input.volume-${kind}`)!;
    const move = (input: HTMLInputElement, value: number) => {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    it('REGRESSION: each device has an MP3 and a MIDI volume range, 0 to 200 in steps of 5, with names, from the live state (100 when the server sends none)', async () => {
      const { row, fixture } = await setup();
      TestBed.inject(StateStore).state.set(
        stateOf({
          devices: [device('me', 'This browser', { isCaller: true, mp3VolumePct: 50, midiVolumePct: 150 }), device('tv', 'Living room TV', { type: DeviceType.ANDROID_TV })],
        }),
      );
      fixture.detectChanges();
      const mp3 = range(row('This browser'), 'mp3');
      const midi = range(row('This browser'), 'midi');
      expect([mp3.min, mp3.max, mp3.step, mp3.type]).toEqual(['0', '200', '5', 'range']);
      expect(mp3.getAttribute('aria-label')).toBe('MP3 songs volume of This browser');
      expect(midi.getAttribute('aria-label')).toBe('MIDI songs volume of This browser');
      expect([mp3.value, midi.value]).toEqual(['50', '150']);
      expect(row('This browser').textContent).toContain('50 %');
      expect(row('This browser').textContent).toContain('150 %');
      expect([range(row('Living room TV'), 'mp3').value, range(row('Living room TV'), 'midi').value]).toEqual(['100', '100']);
      expect(row('This browser').querySelector('label[for="mp3-volume-me"]')?.textContent).toContain('MP3 songs volume');
    });

    it('moving one shows the value at once and sends SetVolume once, after a short pause, with only that field', async () => {
      const { row, server, fixture } = await setup();
      const midi = range(row('Living room TV'), 'midi');
      move(midi, 120);
      fixture.detectChanges();
      expect(row('Living room TV').textContent).toContain('120 %');
      expect(server.calls.volume).toEqual([]);
      await wait(450);
      expect(server.calls.volume).toEqual([{ deviceId: 'tv', mp3: undefined, midi: 120 }]);
      fixture.detectChanges();
      expect(row('Living room TV').textContent, 'it stays shown once the server accepted it').toContain('120 %');
    });

    it('several moves in a row send one call with the last value', async () => {
      const { row, server } = await setup();
      const mp3 = range(row('This browser'), 'mp3');
      move(mp3, 90);
      move(mp3, 70);
      move(mp3, 60);
      await wait(450);
      expect(server.calls.volume).toEqual([{ deviceId: 'me', mp3: 60, midi: undefined }]);
    });

    it('a refusal puts the value back and says so', async () => {
      const { row, server, fixture } = await setup();
      server.failNext(new ConnectError('down', Code.Unavailable));
      const mp3 = range(row('This browser'), 'mp3');
      move(mp3, 30);
      await wait(450);
      fixture.detectChanges();
      expect(mp3.value).toBe('100');
      expect(row('This browser').textContent).toContain('100 %');
      expect(TestBed.inject(ToastService).toasts().length).toBeGreaterThan(0);
    });
  });

  describe('Background video', () => {
    const bgSelect = (li: HTMLElement) => li.querySelector<HTMLSelectElement>('.background select')!;

    it('a second select with Auto, On, Off, an explanation and what the server resolved', async () => {
      const { row } = await setup();
      const select = bgSelect(row('Living room TV'));
      expect(select.getAttribute('aria-label')).toBe('Background video of Living room TV');
      expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual(['Auto', 'On', 'Off']);
      expect(select.value).toBe(String(BackgroundMode.AUTO));
      expect(row('Living room TV').querySelector('.background .explain')?.textContent).toMatch(/unless this device is weak/i);
      // the MIDI select is still the first one and unchanged
      expect(Array.from(row('Living room TV').querySelector<HTMLSelectElement>('select')!.options).map((o) => o.textContent?.trim())).toEqual(['Auto', 'Full', 'Low power', 'Server']);
    });

    it('shows the stored choice and "Now using" from the live state', async () => {
      const { row, fixture } = await setup();
      TestBed.inject(StateStore).state.set(
        stateOf({
          devices: [
            device('me', 'This browser', { isCaller: true, backgroundMode: BackgroundMode.ON, effectiveBackground: true }),
            device('tv', 'Living room TV', { type: DeviceType.ANDROID_TV, backgroundMode: BackgroundMode.AUTO, effectiveBackground: false }),
          ],
        }),
      );
      fixture.detectChanges();
      expect(bgSelect(row('This browser')).value).toBe(String(BackgroundMode.ON));
      expect(row('This browser').querySelector('.background .effective')?.textContent).toBe('Now using: On');
      expect(row('Living room TV').querySelector('.background .effective')?.textContent).toBe('Now using: Off');
    });

    it('an unset mode from an older server counts as Auto', async () => {
      const { row } = await setup();
      expect(bgSelect(row('This browser')).value).toBe(String(BackgroundMode.AUTO));
    });

    it('changing it sends SetBackgroundMode for that device, and not the MIDI call', async () => {
      const { row, server, settle } = await setup();
      const select = bgSelect(row('Living room TV'));
      select.value = String(BackgroundMode.OFF);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(server.calls.background).toEqual([{ deviceId: 'tv', mode: BackgroundMode.OFF }]);
      expect(server.calls.midi).toEqual([]);
      expect(row('Living room TV').querySelector('.background .explain')?.textContent).toMatch(/plain background/i);
    });

    it('"Now using" follows the live state after a change', async () => {
      const { row, server, settle, fixture } = await setup();
      const select = bgSelect(row('This browser'));
      select.value = String(BackgroundMode.ON);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(server.calls.background).toEqual([{ deviceId: 'me', mode: BackgroundMode.ON }]);
      TestBed.inject(StateStore).state.set(
        stateOf({ devices: [device('me', 'This browser', { isCaller: true, backgroundMode: BackgroundMode.ON, effectiveBackground: true }), device('tv', 'Living room TV')] }),
      );
      fixture.detectChanges();
      expect(row('This browser').querySelector('.background .effective')?.textContent).toBe('Now using: On');
    });

    it('a refused change is shown and the select goes back', async () => {
      const { row, server, settle } = await setup();
      server.failNext(new ConnectError('nope', Code.InvalidArgument));
      const select = bgSelect(row('This browser'));
      select.value = String(BackgroundMode.OFF);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('nope');
      expect(select.value).toBe(String(BackgroundMode.AUTO));
    });
  });

  it('regression: a failed load shows an inline error with Try again (not only a toast), and Try again loads the list', async () => {
    const { el, settle, button } = await setup({ failFirst: true });
    expect(el.querySelector('[role="alert"]'), 'the error is on the page').not.toBeNull();
    expect(el.querySelectorAll('li.device')).toHaveLength(0);
    expect(TestBed.inject(ToastService).toasts(), 'no toast for the first load').toHaveLength(0);
    button(el, 'Try again').click();
    await settle();
    expect(el.querySelectorAll('li.device')).toHaveLength(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('a refused change is shown and the select goes back', async () => {
    const { row, server, settle } = await setup();
    server.failNext(new ConnectError('nope', Code.InvalidArgument));
    const select = row('This browser').querySelector<HTMLSelectElement>('select')!;
    select.value = String(MidiMode.SERVER);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('nope');
    expect(select.value).toBe(String(MidiMode.AUTO));
  });

  it('revoking another device asks first, then signs it out and refreshes the list', async () => {
    const { row, button, server, settle, el } = await setup();
    button(row('Living room TV'), 'Sign out').click();
    await settle();
    expect(row('Living room TV').textContent).toContain('Sign out "Living room TV"?');
    expect(server.calls.revoke).toEqual([]);
    button(row('Living room TV'), 'Yes, sign out').click();
    await settle();
    expect(server.calls.revoke).toEqual(['tv']);
    expect(server.calls.listDevices).toBe(2);
    expect(el.textContent).not.toContain('Living room TV');
    expect(TestBed.inject(AuthStore).token()).toBe('t');
  });

  it('revoking this device signs this browser out and goes to the sign-in page', async () => {
    const { row, button, server, settle, nav } = await setup();
    button(row('This browser'), 'Sign out').click();
    await settle();
    expect(row('This browser').textContent).toContain('This is the device you are using');
    button(row('This browser'), 'Yes, sign out').click();
    await settle();
    expect(server.calls.revoke).toEqual(['me']);
    expect(TestBed.inject(AuthStore).token()).toBeUndefined();
    expect(nav).toHaveBeenCalledWith('/login');
  });

  it('cancelling the question does nothing', async () => {
    const { row, button, server, settle } = await setup();
    button(row('Living room TV'), 'Sign out').click();
    await settle();
    button(row('Living room TV'), 'Cancel').click();
    await settle();
    expect(server.calls.revoke).toEqual([]);
    expect(row('Living room TV').textContent).not.toContain('Yes, sign out');
  });

  it('every control names its device', async () => {
    const { row } = await setup();
    const tv = row('Living room TV');
    expect(tv.querySelector('select')?.getAttribute('aria-label')).toBe('MIDI mode of Living room TV');
    expect(Array.from(tv.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'))).toContain('Sign out Living room TV');
  });

  describe('the song cache', () => {
    const kept = () => {
      const c = new FakeSongCache();
      c.statsNow = { count: 3, bytes: 12.5 * 1024 * 1024, capBytes: 2 * 1024 ** 3 };
      return c;
    };

    it('is on this device only, and says what is kept and the most it keeps', async () => {
      const { row } = await setup({ cache: kept() });
      expect(row('This browser').textContent).toContain('Keep played songs on this device');
      expect(row('This browser').textContent).toContain('3 songs, 12.5 MB of up to 2 GB');
      expect(row('Living room TV').textContent).not.toContain('Keep played songs');
    });

    it('is not offered where the browser cannot keep files', async () => {
      const c = kept();
      c.supportedNow = false;
      const { row } = await setup({ cache: c });
      expect(row('This browser').textContent).not.toContain('Keep played songs');
    });

    it('the switch is on by default and turning it off is remembered through the cache', async () => {
      const { row, cache, settle } = await setup({ cache: kept() });
      const box = row('This browser').querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(box.checked).toBe(true);
      box.checked = false;
      box.dispatchEvent(new Event('change'));
      await settle();
      expect(cache.setEnabled).toHaveBeenCalledWith(false);
    });

    it('Clear song cache asks first, then clears, and shows that nothing is kept', async () => {
      const { row, button, cache, settle } = await setup({ cache: kept() });
      button(row('This browser'), 'Clear song cache').click();
      await settle();
      expect(cache.clear).not.toHaveBeenCalled();
      expect(row('This browser').textContent).toContain('Delete the 3 kept songs from this device?');
      button(row('This browser'), 'Yes, clear').click();
      await settle();
      expect(cache.clear).toHaveBeenCalledTimes(1);
      expect(row('This browser').textContent).toContain('Nothing is kept');
    });

    it('REGRESSION: the question says "the kept song" for one song, not "1 kept songs"', async () => {
      const c = kept();
      c.statsNow = { count: 1, bytes: 1024 * 1024, capBytes: 2 * 1024 ** 3 };
      const { row, button, settle } = await setup({ cache: c });
      button(row('This browser'), 'Clear song cache').click();
      await settle();
      expect(row('This browser').textContent).toContain('Delete the kept song from this device?');
      expect(row('This browser').textContent).not.toContain('1 kept songs');
    });

    it('Cancel leaves the songs alone', async () => {
      const { row, button, cache, settle } = await setup({ cache: kept() });
      button(row('This browser'), 'Clear song cache').click();
      await settle();
      button(row('This browser'), 'Cancel').click();
      await settle();
      expect(cache.clear).not.toHaveBeenCalled();
      expect(row('This browser').textContent).toContain('3 songs');
    });

    it('there is nothing to clear when nothing is kept', async () => {
      const { row, button } = await setup({ cache: new FakeSongCache() });
      expect(row('This browser').textContent).toContain('Nothing is kept');
      expect(button(row('This browser'), 'Clear song cache').disabled).toBe(true);
    });
  });

  describe('layout', () => {
    const css = () => Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');

    it('regression: the sign-out question keeps its text and its two buttons apart and wraps on a narrow screen (they touched, with no space between)', async () => {
      await setup();
      // the rule of the question must make it a wrapping row with a gap between its parts
      expect(css()).toMatch(/\.ask[^{]*\{[^}]*display:\s*flex/);
      expect(css()).toMatch(/\.ask[^{]*\{[^}]*flex-wrap:\s*wrap/);
      expect(css()).toMatch(/\.ask[^{]*\{[^}]*gap:\s*[0-9.]+rem/);
    });

    it('regression: the parts of a device (name, setting, explanation, button) have room between them', async () => {
      await setup();
      expect(css()).toMatch(/\bli[^{]*\{[^}]*gap:\s*(0\.[7-9]|[1-9])[0-9.]*rem/);
      expect(css()).toMatch(/\.mode[^{]*\{[^}]*gap:\s*0\.[5-9][0-9.]*rem/);
    });
  });
});
