import { TestBed } from '@angular/core/testing';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { ServerUrl } from '../core/server-url';
import { StateStore } from '../core/state.store';
import { device, stateOf } from '../queue/testing';
import { ENGINES } from './engines/engine';
import { EmbedPlayerPage } from './embed-player.page';
import { MIC_METER } from './mic';
import { PlayStatus } from '../../gen/kantahe/v1/session_pb';
import { asMic, fakeEngines, FakeMic, fakePlayerServer } from './testing';

interface KantaheBridge {
  setToken(token: string, deviceId: string, serverUrl?: string): void;
}
const bridge = () => (window as unknown as { kantahe?: KantaheBridge }).kantahe;

function setup() {
  const server = fakePlayerServer();
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [{ provide: TRANSPORT, useValue: server.transport }, { provide: ENGINES, useValue: fakeEngines().engines }, { provide: MIC_METER, useValue: asMic(new FakeMic()) }],
  });
  const fixture = TestBed.createComponent(EmbedPlayerPage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, server };
}

describe('EmbedPlayerPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'flutter_inappwebview');
    Reflect.deleteProperty(window, 'Kantahe');
  });

  it('waits for the app and makes no request before it has a token', async () => {
    const { el, server } = setup();
    await vi.advanceTimersByTimeAsync(5000);
    TestBed.tick();
    expect(el.textContent).toContain('Waiting for the app');
    expect(TestBed.inject(AuthStore).token()).toBeUndefined();
    expect(server.calls.playback).toEqual([]);
    expect(el.querySelector('app-player-view')).toBeNull();
  });

  it('window.kantahe.setToken stores the session in memory, uses the server address and starts the player', async () => {
    const { el, server, fixture } = setup();
    expect(bridge()).toBeDefined();
    bridge()!.setToken('secret-token', 'dev-1', 'https://k.example');
    const auth = TestBed.inject(AuthStore);
    expect(auth.token()).toBe('secret-token');
    expect(auth.deviceId()).toBe('dev-1');
    expect(TestBed.inject(ServerUrl).base()).toBe('https://k.example');
    // the token is kept in memory only: the app holds it, and it is never in the address
    expect(localStorage.getItem('kantahe.token')).toBeNull();
    expect(window.location.href).not.toContain('secret-token');
    server.push(stateOf({ status: PlayStatus.PAUSED, player: 'dev-1', devices: [device('dev-1', 'Phone', { isCaller: true })] }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(50);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(50);
    fixture.detectChanges();
    expect(el.querySelector('app-player-view')).not.toBeNull();
    expect(el.textContent).not.toContain('Waiting for the app');
  });

  it('ignores a server address that is not valid and keeps the page\'s own', () => {
    setup();
    bridge()!.setToken('t', 'd', 'javascript:alert(1)');
    expect(TestBed.inject(ServerUrl).base()).toBe(window.location.origin);
    expect(TestBed.inject(AuthStore).token()).toBe('t');
  });

  it('works without a server address too', () => {
    setup();
    bridge()!.setToken('t', 'd');
    expect(TestBed.inject(AuthStore).token()).toBe('t');
  });

  it('refuses an empty token or device id', () => {
    setup();
    bridge()!.setToken('', 'd');
    bridge()!.setToken('t', '');
    expect(TestBed.inject(AuthStore).token()).toBeUndefined();
  });

  it('tells the app it is ready, through the channel it has', () => {
    const callHandler = vi.fn();
    (window as unknown as Record<string, unknown>)['flutter_inappwebview'] = { callHandler };
    const postMessage = vi.fn();
    (window as unknown as Record<string, unknown>)['Kantahe'] = { postMessage };
    setup();
    expect(callHandler).toHaveBeenCalledWith('ready');
    expect(postMessage).toHaveBeenCalledWith('KantaheReady');
  });

  it('is ready without any channel as well (a plain browser)', () => {
    expect(() => setup()).not.toThrow();
  });

  it('is ready only after window.kantahe exists', () => {
    let hadBridge = false;
    (window as unknown as Record<string, unknown>)['flutter_inappwebview'] = { callHandler: () => (hadBridge = !!bridge()) };
    setup();
    expect(hadBridge).toBe(true);
  });

  it('removes window.kantahe when the page goes away', () => {
    const { fixture } = setup();
    fixture.destroy();
    expect(bridge()).toBeUndefined();
  });
});
