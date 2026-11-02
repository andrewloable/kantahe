import { TestBed } from '@angular/core/testing';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { ServerUrl } from '../core/server-url';
import { StateStore } from '../core/state.store';
import { device, song, stateOf } from '../queue/testing';
import { ENGINES } from './engines/engine';
import { EmbedPlayerPage } from './embed-player.page';
import { MIC_METER } from './mic';
import { PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { PlayStatus } from '../../gen/kantahe/v1/session_pb';
import { VocalsPrefs } from './vocals-prefs';
import { asMic, fakeEngines, FakeMic, fakePlayerServer, playbackOf } from './testing';

interface KantaheBridge {
  setToken(token: string, deviceId: string, serverUrl?: string): void;
  setVocals(on: unknown, pct: unknown): void;
}
const bridge = () => (window as unknown as { kantahe?: KantaheBridge }).kantahe;

function setup() {
  const server = fakePlayerServer();
  const fake = fakeEngines();
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [{ provide: TRANSPORT, useValue: server.transport }, { provide: ENGINES, useValue: fake.engines }, { provide: MIC_METER, useValue: asMic(new FakeMic()) }],
  });
  const fixture = TestBed.createComponent(EmbedPlayerPage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, server, fake };
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
  describe('guide vocals', () => {
    const MP3_SONG = song('21628', 'Hello', 'Adele', Format.MP3);
    const withVocals = () => playbackOf({ kind: PlaybackKind.AUDIO, audioUrl: '/media/song/21628?sig=a', vocalsUrl: '/media/vocals/21628?sig=v', song: MP3_SONG });
    const state = () => stateOf({ status: PlayStatus.PLAYING, player: 'dev-1', devices: [device('dev-1', 'Phone', { isCaller: true })], now: { song: MP3_SONG, positionMs: 0, positionAtMs: 1000 } });
    const settle = async (fixture: { detectChanges(): void }) => {
      for (let i = 0; i < 3; i++) {
        TestBed.tick();
        await vi.advanceTimersByTimeAsync(30);
        fixture.detectChanges();
      }
    };
    /** Signs the page in and plays a song with vocals. */
    async function playing() {
      const t = setup();
      t.server.handlers.playback = withVocals;
      bridge()!.setToken('t', 'dev-1');
      t.server.push(state());
      await settle(t.fixture);
      return t;
    }
    const messages = (post: ReturnType<typeof vi.fn>) => post.mock.calls.map((c) => c[0] as string).filter((m) => m.startsWith('KantaheVocals:'));
    /** The vocals engine (the second one made, after the instrumental) loads or fails when the returned function is called; install it before the song starts. */
    function deferredVocals(fake: ReturnType<typeof fakeEngines>, fail = false) {
      let finish: () => void = () => undefined;
      let made = 0;
      fake.hooks.configure = (engine) => {
        if (++made === 2) engine.load.mockImplementation(() => new Promise<void>((resolve, reject) => (finish = fail ? () => reject(new Error('no')) : resolve)));
      };
      return () => finish();
    }

    it('bridge_has_setVocals', () => {
      setup();
      expect(typeof bridge()!.setVocals).toBe('function');
    });

    it('setVocals_before_a_song_only_remembers: the next song with vocals starts them by itself', async () => {
      const t = setup();
      t.server.handlers.playback = withVocals;
      bridge()!.setVocals(true, 80);
      const prefs = TestBed.inject(VocalsPrefs);
      expect([prefs.on(), prefs.pct()]).toEqual([true, 80]);
      bridge()!.setToken('t', 'dev-1');
      t.server.push(state());
      await settle(t.fixture);
      expect(t.fake.created).toHaveLength(2);
      expect(t.fake.created[1].engine.load.mock.calls[0][0].audioUrl).toBe('/media/vocals/21628?sig=v');
      expect(t.fake.created[1].engine.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.8, 5));
    });

    it('setVocals_during_a_song_switches_the_vocals', async () => {
      const { fixture, fake } = await playing();
      expect(fake.created).toHaveLength(1);
      bridge()!.setVocals(true, 60);
      await settle(fixture);
      expect(fake.created).toHaveLength(2);
      expect(fake.created[1].engine.play).toHaveBeenCalled();
      bridge()!.setVocals(false, 60);
      await settle(fixture);
      expect(fake.created[1].engine.dispose).toHaveBeenCalled();
      expect(TestBed.inject(VocalsPrefs).on()).toBe(false);
    });

    it('setVocals_ignores_bad_arguments and rounds the level to a step of 10 between 0 and 100', () => {
      setup();
      const prefs = TestBed.inject(VocalsPrefs);
      for (const [on, pct] of [['yes', 60], [true, 'loud'], [true, NaN], [true, Infinity], [undefined, 60], [true, undefined]] as const) bridge()!.setVocals(on, pct);
      expect([prefs.on(), prefs.pct()]).toEqual([false, 60]);
      for (const [pct, want] of [[85, 90], [84, 80], [-5, 0], [500, 100], [0, 0], [100, 100]]) {
        bridge()!.setVocals(false, pct);
        expect(prefs.pct()).toBe(want);
      }
    });

    it('reports_state_to_the_app, once per change', async () => {
      const post = vi.fn();
      (window as unknown as Record<string, unknown>)['Kantahe'] = { postMessage: post };
      const callHandler = vi.fn();
      (window as unknown as Record<string, unknown>)['flutter_inappwebview'] = { callHandler };
      const t = setup();
      const finish = deferredVocals(t.fake);
      t.server.handlers.playback = withVocals;
      bridge()!.setToken('t', 'dev-1');
      t.server.push(state());
      await settle(t.fixture);
      expect(messages(post)).toEqual([]); // nothing to say before the switch is used
      bridge()!.setVocals(true, 60);
      await settle(t.fixture);
      finish();
      await settle(t.fixture);
      bridge()!.setVocals(false, 60);
      await settle(t.fixture);
      await settle(t.fixture);
      expect(messages(post)).toEqual(['KantaheVocals:loading:60', 'KantaheVocals:on:60', 'KantaheVocals:off:60']);
      expect(callHandler).toHaveBeenCalledWith('vocals', 'on', 60);
    });

    it('reports_a_failed_load', async () => {
      const post = vi.fn();
      (window as unknown as Record<string, unknown>)['Kantahe'] = { postMessage: post };
      const t = setup();
      const finish = deferredVocals(t.fake, true);
      t.server.handlers.playback = withVocals;
      bridge()!.setToken('t', 'dev-1');
      t.server.push(state());
      await settle(t.fixture);
      bridge()!.setVocals(true, 60);
      await settle(t.fixture);
      finish();
      await settle(t.fixture);
      expect(messages(post)).toEqual(['KantaheVocals:loading:60', 'KantaheVocals:failed:60', 'KantaheVocals:off:60']);
    });

    it('a level change is reported too', async () => {
      const post = vi.fn();
      (window as unknown as Record<string, unknown>)['Kantahe'] = { postMessage: post };
      await playing();
      bridge()!.setVocals(false, 70);
      TestBed.tick();
      expect(messages(post)).toEqual(['KantaheVocals:off:70']);
    });

    it('no_report_channel_is_harmless', async () => {
      const { fixture } = await playing();
      expect(() => bridge()!.setVocals(true, 60)).not.toThrow();
      await settle(fixture);
    });
  });
});
