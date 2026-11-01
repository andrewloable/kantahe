import { TestBed } from '@angular/core/testing';
import { BackgroundMode, DeviceType } from '../../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { ENVIRONMENT } from '../../core/environment';
import { StateStore } from '../../core/state.store';
import { device, stateOf } from '../../queue/testing';
import { BACKGROUND_REFETCH_MS, BackgroundStore } from './background.store';
import { bgVideo, fakeBackground } from './testing';

function setup(opts: { videos?: ReturnType<typeof bgVideo>[]; isTv?: boolean } = {}) {
  const server = fakeBackground(opts.videos ?? [bgVideo('v1'), bgVideo('v2'), bgVideo('v3')]);
  TestBed.configureTestingModule({
    providers: [
      { provide: TRANSPORT, useValue: server.transport },
      { provide: BACKGROUND_REFETCH_MS, useValue: 1000 },
      ...(opts.isTv ? [{ provide: ENVIRONMENT, useValue: { isTv: true, tvDeviceType: DeviceType.ANDROID_TV } }] : []),
    ],
  });
  TestBed.inject(AuthStore).deviceId.set('me');
  const stateStore = TestBed.inject(StateStore);
  const store = TestBed.inject(BackgroundStore);
  const setDevice = (over: Parameters<typeof device>[2] = {}) =>
    stateStore.state.set(stateOf({ devices: [device('me', 'This browser', { isCaller: true, ...over })] }));
  const settle = async (ms = 10) => {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
  };
  return { server, store, stateStore, setDevice, settle };
}

describe('BackgroundStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('off: no request is ever made and the list stays empty', async () => {
    const { server, store, setDevice, settle } = setup();
    setDevice({ effectiveBackground: false });
    await settle(5000);
    expect(store.active()).toBe(false);
    expect(server.calls).toBe(0);
    expect(store.videos()).toEqual([]);
  });

  it('turning on asks once and keeps the list as the server gave it, the URLs untouched', async () => {
    const { server, store, setDevice, settle } = setup();
    server.shuffle = true;
    setDevice({ effectiveBackground: true });
    await settle();
    expect(server.calls).toBe(1);
    expect(store.videos().map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
    expect(store.videos().map((v) => v.url)).toEqual(server.videos.map((v) => v.url));
    expect(store.shuffle()).toBe(true);
  });

  it('asks again after BACKGROUND_REFETCH_MS, and the same URL string comes back as long as the server gives it', async () => {
    const { server, store, setDevice, settle } = setup();
    setDevice({ effectiveBackground: true });
    await settle();
    const first = store.videos()[0].url;
    await settle(3000);
    expect(server.calls).toBe(4);
    expect(store.videos()[0].url).toBe(first);
  });

  it('turning off clears the list and stops asking', async () => {
    const { server, store, setDevice, settle } = setup();
    setDevice({ effectiveBackground: true });
    await settle();
    setDevice({ effectiveBackground: false });
    await settle(5000);
    expect(store.videos()).toEqual([]);
    expect(server.calls, 'no request after it was turned off').toBe(1);
  });

  it('an answer that arrives after it was turned off is thrown away', async () => {
    const { server, store, setDevice, settle } = setup();
    let release!: () => void;
    server.gate = new Promise<void>((resolve) => (release = resolve));
    setDevice({ effectiveBackground: true });
    await settle();
    setDevice({ effectiveBackground: false });
    await settle();
    release();
    await settle();
    expect(store.videos()).toEqual([]);
  });

  it('asks again when the state stream comes back', async () => {
    const { server, stateStore, setDevice, settle } = setup();
    setDevice({ effectiveBackground: true });
    stateStore.connected.set(true);
    await settle();
    const before = server.calls;
    stateStore.connected.set(false);
    await settle();
    expect(server.calls).toBe(before);
    stateStore.connected.set(true);
    await settle();
    expect(server.calls).toBe(before + 1);
  });

  it('a request that fails leaves the list as it is', async () => {
    const { server, store, setDevice, settle } = setup();
    setDevice({ effectiveBackground: true });
    await settle();
    server.fail = true;
    await settle(1500);
    expect(store.videos().map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
  });

  it('the administrator switching the background off gives an empty list', async () => {
    const { server, store, setDevice, settle } = setup();
    server.enabled = false;
    setDevice({ effectiveBackground: true });
    await settle();
    expect(store.videos()).toEqual([]);
  });

  describe('prefers-reduced-motion', () => {
    function reducedMotion(matches: boolean) {
      const listeners: ((e: { matches: boolean }) => void)[] = [];
      vi.stubGlobal('matchMedia', () => ({ matches, addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn) }));
      return (m: boolean) => listeners.forEach((l) => l({ matches: m }));
    }

    it('with Auto the background is off; with On it is on', async () => {
      reducedMotion(true);
      const { store, setDevice, settle } = setup();
      setDevice({ effectiveBackground: true, backgroundMode: BackgroundMode.AUTO });
      await settle();
      expect(store.active()).toBe(false);
      setDevice({ effectiveBackground: true, backgroundMode: BackgroundMode.ON });
      await settle();
      expect(store.active()).toBe(true);
    });

    it('an unset mode counts as Auto', async () => {
      reducedMotion(true);
      const { store, setDevice, settle } = setup();
      setDevice({ effectiveBackground: true, backgroundMode: BackgroundMode.UNSPECIFIED });
      await settle();
      expect(store.active()).toBe(false);
    });

    it('a packaged TV app is not affected', async () => {
      reducedMotion(true);
      const { store, setDevice, settle } = setup({ isTv: true });
      setDevice({ effectiveBackground: true, backgroundMode: BackgroundMode.AUTO });
      await settle();
      expect(store.active()).toBe(true);
    });

    it('follows the setting of the browser while the page is open', async () => {
      const change = reducedMotion(false);
      const { store, setDevice, settle } = setup();
      setDevice({ effectiveBackground: true, backgroundMode: BackgroundMode.AUTO });
      await settle();
      expect(store.active()).toBe(true);
      change(true);
      await settle();
      expect(store.active()).toBe(false);
    });
  });
});
