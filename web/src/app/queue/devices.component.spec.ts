import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { DevicesComponent } from './devices.component';
import { device, DeviceType, fakeSession, PlayStatus, stateOf } from './testing';

async function setup(devices = [device('me', 'Phone', { isCaller: true, type: DeviceType.ANDROID }), device('tv', 'Living room TV', { type: DeviceType.ANDROID_TV, online: false })], player = 'tv') {
  const server = fakeSession();
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'me' }));
  TestBed.tick();
  server.push(stateOf({ devices, player, status: PlayStatus.PLAYING }));
  const fixture = TestBed.createComponent(DevicesComponent);
  await vi.advanceTimersByTimeAsync(10);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement };
}

describe('DevicesComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('lists every device with its name and type', async () => {
    const { el } = await setup();
    const rows = Array.from(el.querySelectorAll('li'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Phone');
    expect(rows[0].textContent).toContain('Android');
    expect(rows[1].textContent).toContain('Living room TV');
    expect(rows[1].textContent).toContain('Android TV');
  });

  it('marks this device, the player, and who is online, in words as well as dots', async () => {
    const { el } = await setup();
    const [me, tv] = Array.from(el.querySelectorAll('li'));
    expect(me.textContent).toContain('(this device)');
    expect(tv.textContent).not.toContain('(this device)');
    expect(tv.textContent).toContain('playing');
    expect(me.textContent).not.toContain('playing');
    expect(me.textContent).toContain('online');
    expect(tv.textContent).toContain('offline');
    expect(me.querySelector('.dot')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says so when there are no devices yet', async () => {
    const { el } = await setup([], '');
    expect(el.textContent).toContain('No devices');
  });
});
