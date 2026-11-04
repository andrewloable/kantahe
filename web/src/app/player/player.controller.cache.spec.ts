import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { AuthTokenSchema, Format } from '../../gen/kantahe/v1/common_pb';
import { PlayStatus } from '../../gen/kantahe/v1/session_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { ServerUrl } from '../core/server-url';
import { StateStore } from '../core/state.store';
import { device, song, stateOf, StateInit } from '../queue/testing';
import { SONG_CACHE } from './cache/song-cache';
import { AUDIO_CONTEXT, CAN_PLAY_FLAC, CAN_SYNTHESIZE, ENGINES, mediaUrl } from './engines/engine';
import { MIC_METER } from './mic';
import { PlayerController } from './player.controller';
import { asMic, asSongCache, FakeEngine, FakeMic, FakeSongCache, fakeEngines, fakePlayerServer, playbackOf } from './testing';

const ME = 'me';
const MP3 = song('21628', 'Hello', 'Adele', Format.MP3);
const NEXT = song('21630', 'Easy On Me', 'Adele', Format.MP3);
const MIDI = song('21629', 'Skyfall', 'Adele', Format.MIDI);
const playing = (s = MP3): StateInit => ({
  status: PlayStatus.PLAYING,
  player: ME,
  devices: [device(ME, 'This browser', { isCaller: true })],
  now: { song: s, positionMs: 0, positionAtMs: 1000 },
  serverTimeMs: 1000,
});
const audio = (number = '21628', over: Parameters<typeof playbackOf>[0] = {}) =>
  playbackOf({ kind: PlaybackKind.AUDIO, audioUrl: `/media/song/${number}?sig=a`, audioVersion: 'v1', song: MP3, ...over });
const withVocals = (number = '21628') => audio(number, { vocalsUrl: `/media/vocals/${number}?sig=v`, vocalsVersion: 'w1' });

function setup() {
  const server = fakePlayerServer();
  const fake = fakeEngines();
  const cache = new FakeSongCache();
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      { provide: TRANSPORT, useValue: server.transport },
      { provide: ENGINES, useValue: fake.engines },
      { provide: CAN_PLAY_FLAC, useValue: () => true },
      { provide: CAN_SYNTHESIZE, useValue: () => true },
      { provide: MIC_METER, useValue: asMic(new FakeMic()) },
      { provide: AUDIO_CONTEXT, useValue: () => undefined },
      { provide: SONG_CACHE, useValue: asSongCache(cache) },
      PlayerController,
    ],
  });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: ME }));
  const player = TestBed.inject(PlayerController);
  TestBed.tick();
  const flush = async (ms = 20) => {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  };
  const push = async (init: StateInit) => {
    server.push(stateOf(init));
    await flush();
  };
  const absolute = (url: string) => mediaUrl(TestBed.inject(ServerUrl).base(), url);
  return { server, fake, cache, player, flush, push, absolute };
}

describe('PlayerController: the song cache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('the audio file', () => {
    it('plays from the kept file when there is one, and does not store again', async () => {
      const t = setup();
      t.cache.kept.set('audio/21628@v1', 'blob:kept');
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      expect(t.cache.lookups).toEqual(['audio/21628@v1']);
      expect(t.fake.last().load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: 'blob:kept' }));
      expect(t.cache.stores).toEqual([]);
      expect(t.player.phase()).toBe('ready');
    });

    it('plays from the server when nothing is kept, and keeps the file after the song has loaded', async () => {
      const t = setup();
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      expect(t.fake.last().load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: '/media/song/21628?sig=a' }));
      expect(t.cache.stores).toEqual([{ kind: 'audio', number: '21628', version: 'v1', url: t.absolute('/media/song/21628?sig=a') }]);
    });

    it('does not ask the cache for a file whose server gave no version', async () => {
      const t = setup();
      t.server.handlers.playback = () => audio('21628', { audioVersion: '' });
      await t.push(playing());
      expect(t.cache.lookups).toEqual([]);
      expect(t.cache.stores).toEqual([]);
      expect(t.player.phase()).toBe('ready');
    });

    it('does not start keeping the file before the song has loaded', async () => {
      const t = setup();
      let release: () => void = () => undefined;
      t.fake.hooks.configure = (e: FakeEngine) => e.load.mockImplementation(() => new Promise<void>((r) => (release = r)));
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      expect(t.player.phase()).toBe('loading');
      expect(t.cache.stores).toEqual([]);
      release();
      await t.flush();
      expect(t.cache.stores).toHaveLength(1);
    });

    it('pins the files of the song that plays, before it keeps anything', async () => {
      const t = setup();
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      expect(t.cache.pinned[0]).toEqual(['audio/21628', 'vocals/21628']);
    });

    it('goes on playing when keeping the file fails', async () => {
      const t = setup();
      t.cache.storeResult = () => Promise.reject(new Error('disk'));
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      await t.flush(100);
      expect(t.player.phase()).toBe('ready');
      expect(t.player.error()).toBe('');
    });

    it('a kept file that will not play is dropped and the song is played from the server', async () => {
      const t = setup();
      t.cache.kept.set('audio/21628@v1', 'blob:kept');
      t.fake.hooks.configure = (e: FakeEngine) =>
        e.load.mockImplementation((pb) => (pb.audioUrl.startsWith('blob:') ? Promise.reject(new Error('bad file')) : Promise.resolve()));
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      expect(t.cache.discarded).toEqual(['audio/21628']);
      expect(t.cache.released).toEqual(['blob:kept']);
      expect(t.fake.created).toHaveLength(2);
      expect(t.fake.last().load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: '/media/song/21628?sig=a' }));
      expect(t.player.phase()).toBe('ready');
    });

    it('REGRESSION: a replaced file (a new version) is not taken from the cache, and the new file is kept', async () => {
      const t = setup();
      t.cache.kept.set('audio/21628@v1', 'blob:old');
      t.server.handlers.playback = () => audio('21628', { audioVersion: 'v2' });
      await t.push(playing());
      expect(t.fake.last().load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: '/media/song/21628?sig=a' }));
      expect(t.cache.stores[0]).toMatchObject({ number: '21628', version: 'v2' });
    });

    it('never asks the cache about a MIDI song played by the synthesizer', async () => {
      const t = setup();
      t.server.handlers.playback = () => playbackOf({ song: MIDI });
      await t.push(playing(MIDI));
      expect(t.cache.lookups).toEqual([]);
      expect(t.cache.stores).toEqual([]);
    });

    it('a song that ended while the kept file was looked up is not loaded, and its object URL is let go', async () => {
      const t = setup();
      let answer: (url: string) => void = () => undefined;
      t.cache.lookup.mockImplementation(() => new Promise<string | undefined>((r) => (answer = r)));
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      await t.push({ ...playing(), status: PlayStatus.PAUSED, now: undefined }); // nothing plays any more
      answer('blob:late');
      await t.flush();
      expect(t.cache.released).toEqual(['blob:late']);
      expect(t.fake.created).toHaveLength(0);
    });
  });

  describe('object URLs', () => {
    it('lets go of the kept file once when the song changes, and not again when the page goes away', async () => {
      const t = setup();
      t.cache.kept.set('audio/21628@v1', 'blob:one');
      t.server.handlers.playback = (req) => audio(req.number);
      await t.push(playing());
      expect(t.cache.released).toEqual([]);
      await t.push(playing(NEXT));
      expect(t.cache.released).toEqual(['blob:one']);
      TestBed.inject(PlayerController).ngOnDestroy();
      expect(t.cache.released).toEqual(['blob:one']);
    });

    it('lets go of the kept file when the page goes away while the song plays', async () => {
      const t = setup();
      t.cache.kept.set('audio/21628@v1', 'blob:one');
      t.server.handlers.playback = () => audio();
      await t.push(playing());
      t.player.ngOnDestroy();
      expect(t.cache.released).toEqual(['blob:one']);
    });
  });

  describe('the vocals', () => {
    async function withVocalsOn(setupMore?: (t: ReturnType<typeof setup>) => void) {
      const t = setup();
      setupMore?.(t);
      t.server.handlers.playback = () => withVocals();
      await t.push(playing());
      t.player.setVocals(true);
      await t.flush(100);
      return t;
    }

    it('plays from the kept vocals file when there is one', async () => {
      const t = await withVocalsOn((x) => x.cache.kept.set('vocals/21628@w1', 'blob:voc'));
      expect(t.fake.created[1].engine.load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: 'blob:voc' }));
      expect(t.cache.stores.filter((s) => s.kind === 'vocals')).toEqual([]);
    });

    it('keeps the vocals file after it has loaded from the server', async () => {
      const t = await withVocalsOn();
      expect(t.fake.created[1].engine.load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: '/media/vocals/21628?sig=v' }));
      expect(t.cache.stores.filter((s) => s.kind === 'vocals')).toEqual([
        { kind: 'vocals', number: '21628', version: 'w1', url: t.absolute('/media/vocals/21628?sig=v') },
      ]);
    });

    it('does not ask the cache without a vocals version', async () => {
      const t = setup();
      t.server.handlers.playback = () => audio('21628', { vocalsUrl: '/media/vocals/21628?sig=v' });
      await t.push(playing());
      t.player.setVocals(true);
      await t.flush(100);
      expect(t.cache.lookups.filter((l) => l.startsWith('vocals'))).toEqual([]);
      expect(t.cache.stores.filter((s) => s.kind === 'vocals')).toEqual([]);
    });

    it('a kept vocals file that will not play is dropped and the vocals come from the server', async () => {
      const t = setup();
      t.cache.kept.set('vocals/21628@w1', 'blob:voc');
      t.fake.hooks.configure = (e: FakeEngine) =>
        e.load.mockImplementation((pb) => (pb.audioUrl.startsWith('blob:') ? Promise.reject(new Error('bad')) : Promise.resolve()));
      t.server.handlers.playback = () => withVocals();
      await t.push(playing());
      t.player.setVocals(true);
      await t.flush(100);
      expect(t.cache.discarded).toEqual(['vocals/21628']);
      expect(t.cache.released).toContain('blob:voc');
      expect(t.player.vocalsState()).toBe('on');
    });

    it('lets go of the kept vocals file when they are switched off', async () => {
      const t = await withVocalsOn((x) => x.cache.kept.set('vocals/21628@w1', 'blob:voc'));
      t.player.setVocals(false);
      expect(t.cache.released).toEqual(['blob:voc']);
    });
  });

  describe('the song that is next', () => {
    const withNext = (over: Partial<StateInit> = {}): StateInit => ({ ...playing(), upNext: { song: NEXT }, ...over });
    const asked = (t: ReturnType<typeof setup>, number: string) => t.server.calls.playback.filter((c) => c.number === number).length;
    const answer = (t: ReturnType<typeof setup>) => (t.server.handlers.playback = (req) => audio(req.number));

    it('keeps the next song while the current one plays', async () => {
      const t = setup();
      answer(t);
      await t.push(withNext());
      await t.flush(100);
      expect(asked(t, '21630')).toBe(1);
      expect(t.cache.stores.filter((s) => s.number === '21630')).toEqual([
        { kind: 'audio', number: '21630', version: 'v1', url: t.absolute('/media/song/21630?sig=a') },
      ]);
    });

    it('REGRESSION: waits until the current song has been kept, so that the two downloads do not compete', async () => {
      const t = setup();
      let done: (ok: boolean) => void = () => undefined;
      t.cache.storeResult = () => new Promise<boolean>((r) => (done = r)); // the current song's file is still being downloaded
      answer(t);
      await t.push(withNext());
      await t.flush(100);
      expect(t.cache.stores.map((s) => s.number)).toEqual(['21628']);
      expect(asked(t, '21630')).toBe(0);
      t.cache.storeResult = () => Promise.resolve(true);
      done(true);
      await t.flush(100);
      expect(asked(t, '21630')).toBe(1);
      expect(t.cache.stores.map((s) => s.number)).toEqual(['21628', '21630']);
    });

    it('keeps the vocals of the next song too', async () => {
      const t = setup();
      t.server.handlers.playback = (req) => withVocals(req.number);
      await t.push(withNext());
      await t.flush(100);
      expect(t.cache.stores.filter((s) => s.number === '21630').map((s) => s.kind)).toEqual(['audio', 'vocals']);
    });

    it('pins the next song with the current one', async () => {
      const t = setup();
      answer(t);
      await t.push(withNext());
      await t.flush(100);
      expect(t.cache.pinned.at(-1)).toEqual(['audio/21628', 'vocals/21628', 'audio/21630', 'vocals/21630']);
    });

    it('asks once for the same song however often the state repeats', async () => {
      const t = setup();
      answer(t);
      await t.push(withNext());
      await t.push(withNext());
      await t.push(withNext({ serverTimeMs: 5000 }));
      await t.flush(100);
      expect(asked(t, '21630')).toBe(1);
    });

    it('does not wait for the song that plays: nothing is asked before it has loaded', async () => {
      const t = setup();
      let release: () => void = () => undefined;
      t.fake.hooks.configure = (e: FakeEngine) => e.load.mockImplementation(() => new Promise<void>((r) => (release = r)));
      answer(t);
      await t.push(withNext());
      expect(asked(t, '21630')).toBe(0);
      release();
      await t.flush(100);
      expect(asked(t, '21630')).toBe(1);
    });

    it('leaves a MIDI song alone', async () => {
      const t = setup();
      answer(t);
      await t.push(withNext({ upNext: { song: MIDI } }));
      await t.flush(100);
      expect(asked(t, '21629')).toBe(0);
    });

    it('is for the player device only', async () => {
      const t = setup();
      answer(t);
      await t.push(withNext({ player: 'tv', devices: [device(ME, 'This browser', { isCaller: true }), device('tv', 'TV')] }));
      await t.flush(100);
      expect(asked(t, '21630')).toBe(0);
    });

    it('does nothing when the user asked the browser to save data, or while the page is hidden', async () => {
      const t = setup();
      answer(t);
      Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
      await t.push(withNext());
      await t.flush(100);
      Reflect.deleteProperty(navigator, 'connection');
      expect(asked(t, '21630')).toBe(0);
      const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      await t.push(withNext({ serverTimeMs: 2000 }));
      await t.flush(100);
      hidden.mockRestore();
      expect(asked(t, '21630')).toBe(0);
    });

    it('is silent when the server cannot say, and tries the next song that comes', async () => {
      const t = setup();
      t.server.handlers.playback = (req) => {
        if (req.number === '21630') throw new Error('boom');
        return audio(req.number);
      };
      await t.push(withNext());
      await t.flush(100);
      expect(t.cache.stores.filter((s) => s.number === '21630')).toEqual([]);
      expect(t.player.phase()).toBe('ready');
      expect(t.player.error()).toBe('');
      await t.push(withNext({ upNext: { song: song('21640', 'Another', 'Adele', Format.MP3) } }));
      await t.flush(100);
      expect(asked(t, '21640')).toBe(1);
      expect(asked(t, '21630')).toBe(1);
    });

    it('keeps nothing of a song that is not ready or has no version', async () => {
      const t = setup();
      t.server.handlers.playback = (req) => (req.number === '21630' ? audio(req.number, { ready: false, retryAfterMs: 500 }) : audio(req.number));
      await t.push(withNext());
      await t.flush(100);
      expect(t.cache.stores.filter((s) => s.number === '21630')).toEqual([]);
    });

    it('REGRESSION: when it becomes the current song it plays from the kept file and is not kept again', async () => {
      const t = setup();
      answer(t);
      await t.push(withNext());
      await t.flush(100);
      t.cache.kept.set('audio/21630@v1', 'blob:next');
      await t.push(playing(NEXT));
      await t.flush(100);
      expect(t.fake.last().load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: 'blob:next' }));
      expect(t.cache.stores.filter((s) => s.number === '21630')).toHaveLength(1);
    });
  });
});
