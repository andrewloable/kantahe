import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthTokenSchema, DeviceType, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { device, stateOf } from '../queue/testing';
import { MyDevicesComponent } from './my-devices.component';
import { fakeMe } from './testing';

async function setup() {
  const mine = [
    device('me', 'This browser', { isCaller: true, type: DeviceType.WEB, midiMode: MidiMode.AUTO }),
    device('tv', 'Living room TV', { type: DeviceType.ANDROID_TV, online: false, midiMode: MidiMode.AUTO }),
  ];
  const server = fakeMe({ devices: mine });
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
});
