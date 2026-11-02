import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthTokenSchema, BackgroundMode, DeviceType, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { device, stateOf } from '../queue/testing';
import { MyDevicesComponent } from './my-devices.component';
import { fakeMe } from './testing';

async function setup(opts: { failFirst?: boolean } = {}) {
  const mine = [
    device('me', 'This browser', { isCaller: true, type: DeviceType.WEB, midiMode: MidiMode.AUTO }),
    device('tv', 'Living room TV', { type: DeviceType.ANDROID_TV, online: false, midiMode: MidiMode.AUTO }),
  ];
  const server = fakeMe({ devices: mine });
  if (opts.failFirst) server.failNext(new ConnectError('down', Code.Unavailable));
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] });
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
  const row = (name: string) => Array.from(el.querySelectorAll('li.device')).find((li) => li.textContent?.includes(name)) as HTMLElement;
  const button = (within: ParentNode, text: string) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text))!;
  return { fixture, el, server, settle, row, button, nav };
}

describe('MyDevicesComponent', () => {
  afterEach(() => TestBed.inject(StateStore).stop());

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
