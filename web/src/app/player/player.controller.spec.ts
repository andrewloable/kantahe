import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { AuthTokenSchema, Format, LyricsSchema, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { ControlAction, PlayStatus, ScoreMode, UserSettingsSchema } from '../../gen/kantahe/v1/session_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { device, song, stateOf, StateInit } from '../queue/testing';
import { CAN_PLAY_FLAC, CAN_SYNTHESIZE, ENGINES } from './engines/engine';
import { MIC_METER } from './mic';
import { PlayerController } from './player.controller';
import { asMic, FakeEngine, FakeMic, fakeEngines, fakePlayerServer, playbackOf } from './testing';

const ME = 'me';
const SONG = song('21628', 'Hello', 'Adele');

const PLAYING: StateInit = {
  status: PlayStatus.PLAYING,
  player: ME,
  devices: [device(ME, 'This browser', { isCaller: true }), device('tv', 'Living room TV')],
  now: { song: SONG, positionMs: 0, positionAtMs: 1000 },
  serverTimeMs: 1000,
};

function setup(opts: { memory?: number; secure?: boolean; flac?: boolean; synth?: boolean } = {}) {
  const server = fakePlayerServer();
  const fake = fakeEngines();
  const mic = new FakeMic();
  localStorage.clear();
  if (opts.memory !== undefined) Object.defineProperty(navigator, 'deviceMemory', { value: opts.memory, configurable: true });
  TestBed.configureTestingModule({
    providers: [
      { provide: TRANSPORT, useValue: server.transport },
      { provide: ENGINES, useValue: fake.engines },
      { provide: CAN_PLAY_FLAC, useValue: () => opts.flac ?? true },
      { provide: CAN_SYNTHESIZE, useValue: () => opts.synth ?? true },
      { provide: MIC_METER, useValue: asMic(mic) },
      PlayerController,
    ],
  });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: ME }));
  const store = TestBed.inject(StateStore);
  const player = TestBed.inject(PlayerController);
  TestBed.tick();
  // lets the given time pass; effects are run before and after
  const flush = async (ms = 20) => {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  };
  const push = async (init: StateInit, settings?: ScoreMode) => {
    const s = stateOf(init);
    if (settings !== undefined) s.settings = create(UserSettingsSchema, { scoreMode: settings });
    server.push(s);
    await flush();
  };
  return { server, fake, mic, store, player, flush, push };
}

describe('PlayerController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    Reflect.deleteProperty(navigator, 'deviceMemory');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('when this device is the player', () => {
    it('loads the song, tells the server it is ready once, and plays', async () => {
      const { server, fake, push, player } = setup();
      await push(PLAYING);
      expect(server.calls.playback.map((c) => c.number)).toEqual(['21628']);
      expect(fake.created.length).toBe(1);
      expect(fake.last().load).toHaveBeenCalledTimes(1);
      expect(server.calls.ready.map((c) => c.number)).toEqual(['21628']);
      expect(fake.last().play).toHaveBeenCalledTimes(1);
      expect(player.phase()).toBe('ready');
    });

    it('pauses when the state says paused, and plays again when it says playing', async () => {
      const { fake, push } = setup();
      await push(PLAYING);
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      expect(fake.last().pause).toHaveBeenCalled();
      const plays = fake.last().play.mock.calls.length;
      await push(PLAYING);
      expect(fake.last().play.mock.calls.length).toBe(plays + 1);
      expect(fake.created.length).toBe(1); // the same engine all along
    });

    it('starts a song that was loaded while paused only when told to play', async () => {
      const { fake, push } = setup();
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      expect(fake.last().load).toHaveBeenCalled();
      expect(fake.last().play).not.toHaveBeenCalled();
    });

    it('does nothing when another device is the player', async () => {
      const { server, fake, push, player } = setup();
      await push({ ...PLAYING, player: 'tv' });
      expect(server.calls.playback).toEqual([]);
      expect(fake.created).toEqual([]);
      expect(player.isPlayer()).toBe(false);
    });

    it('does nothing when no song is playing', async () => {
      const { server, push } = setup();
      await push({ ...PLAYING, now: undefined });
      expect(server.calls.playback).toEqual([]);
    });
  });

  describe('preparing', () => {
    it('shows Preparing while the song is not ready and asks again after retry_after_ms', async () => {
      const { server, fake, push, player, flush } = setup();
      let calls = 0;
      server.handlers.playback = () => (++calls === 1 ? playbackOf({ ready: false, retryAfterMs: 1500 }) : playbackOf());
      await push(PLAYING);
      expect(player.phase()).toBe('preparing');
      expect(server.calls.playback.length).toBe(1);
      expect(fake.created).toEqual([]);
      await flush(1400);
      expect(server.calls.playback.length).toBe(1);
      await flush(200);
      expect(server.calls.playback.length).toBe(2);
      expect(fake.created.length).toBe(1);
      expect(player.phase()).toBe('ready');
    });

    it('does not ask more often than every half second whatever the server says', async () => {
      const { server, push, flush } = setup();
      server.handlers.playback = () => playbackOf({ ready: false, retryAfterMs: 0 });
      await push(PLAYING);
      const first = server.calls.playback.length;
      await flush(300);
      expect(server.calls.playback.length).toBe(first);
      await flush(1000);
      expect(server.calls.playback.length).toBeGreaterThan(first);
    });

    it('stops asking when the song is skipped meanwhile', async () => {
      const { server, push, flush } = setup();
      server.handlers.playback = () => playbackOf({ ready: false, retryAfterMs: 1000 });
      await push(PLAYING);
      await push({ ...PLAYING, now: undefined });
      const n = server.calls.playback.length;
      await flush(5000);
      expect(server.calls.playback.length).toBe(n);
    });

    it('keeps trying when the server cannot be reached', async () => {
      const { server, fake, push, flush } = setup();
      let calls = 0;
      server.handlers.playback = () => {
        if (++calls === 1) throw new ConnectError('down', Code.Unavailable);
        return playbackOf();
      };
      await push(PLAYING);
      await flush(2500);
      expect(fake.created.length).toBe(1);
    });
  });

  describe('where it starts', () => {
    it('a fresh song starts from the beginning', async () => {
      const { fake, push } = setup();
      await push(PLAYING);
      expect(fake.last().seek).not.toHaveBeenCalled();
    });

    it('a takeover or reload resumes where the song was: 41.2 s plus the time since the state arrived', async () => {
      const { fake, server, push, flush } = setup();
      server.handlers.playback = async () => {
        await new Promise((r) => setTimeout(r, 500)); // loading takes a while
        return playbackOf();
      };
      await push({ ...PLAYING, now: { song: SONG, positionMs: 41200, positionAtMs: 1000 } });
      await flush(600);
      expect(fake.last().seek).toHaveBeenCalledTimes(1);
      const target = fake.last().seek.mock.calls[0][0] as number;
      expect(target).toBeGreaterThanOrEqual(41200 + 500);
      expect(target).toBeLessThan(41200 + 1000);
    });
  });

  describe('reports', () => {
    it('sends the position every second while playing, and not while paused', async () => {
      const { server, fake, push, flush } = setup();
      await push(PLAYING);
      fake.last().time = 5000;
      await flush(3500);
      expect(server.calls.position.length).toBe(3);
      expect(server.calls.position.every((p) => p.number === '21628')).toBe(true);
      expect(server.calls.position[0].positionMs).toBe(5000n);
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      const n = server.calls.position.length;
      await flush(5000);
      expect(server.calls.position.length).toBe(n);
      await push(PLAYING);
      await flush(2500);
      expect(server.calls.position.length).toBeGreaterThan(n);
    });

    it('rounds the position to whole milliseconds', async () => {
      const { server, fake, push, flush } = setup();
      await push(PLAYING);
      fake.last().time = 1234.567;
      await flush(1100);
      expect(server.calls.position[0].positionMs).toBe(1235n);
    });

    it('tells the server the memory of the device once, with no dropouts', async () => {
      const { server, push, flush } = setup({ memory: 2 });
      await push(PLAYING);
      await flush(500);
      expect(server.calls.device.map((d) => [d.memoryMb, d.dropouts])).toEqual([[2048, 0]]);
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      await push({ ...PLAYING, now: { song: song('3', 'Other', 'X'), positionMs: 0, positionAtMs: 1 } });
      expect(server.calls.device.length).toBe(1);
    });

    it('reports a dropout of the synth as soon as it is seen', async () => {
      const { server, fake, push, flush } = setup({ memory: 1 });
      await push(PLAYING);
      const engine = fake.last();
      engine.clock = 0;
      await flush(0);
      // 2 s pass but only 1.5 s of audio were produced
      engine.clock = 1.5;
      await flush(2000);
      expect(server.calls.device.some((d) => d.dropouts === 1 && d.memoryMb === 1024)).toBe(true);
    });

    it('regression: one dropout report per song, however long the stutter lasts (the server steps down once per report)', async () => {
      const { server, fake, push, flush } = setup({ memory: 1 });
      await push(PLAYING);
      const engine = fake.last();
      engine.clock = 0;
      await flush(0);
      engine.clock = 1.5; // 2 s pass, 1.5 s of sound
      await flush(2000);
      engine.clock = 3.0;
      await flush(2000);
      engine.clock = 4.5;
      await flush(2000);
      expect(server.calls.device.filter((d) => d.dropouts === 1).length).toBe(1);
      // the next song is judged again
      await push({ ...PLAYING, now: { song: song('3', 'Next', 'X'), positionMs: 0, positionAtMs: 2000 } });
      const next = fake.last();
      next.clock = 0;
      await flush(0);
      next.clock = 1.5;
      await flush(2000);
      expect(server.calls.device.filter((d) => d.dropouts === 1).length).toBe(2);
    });

    it('does not read dropouts from an MP3', async () => {
      const { server, push, flush } = setup();
      server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO });
      await push(PLAYING);
      await flush(10_000);
      expect(server.calls.device.every((d) => d.dropouts === 0)).toBe(true);
    });
  });

  describe('which engine', () => {
    it('MP3 audio uses the audio engine', async () => {
      const { server, fake, push } = setup();
      server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO });
      await push(PLAYING);
      expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
    });

    it('MIDI at full power: default sample rate, no limits, effects on', async () => {
      const { server, fake, push } = setup();
      server.handlers.playback = () => playbackOf({ mode: MidiMode.FULL });
      await push(PLAYING);
      expect(fake.created[0]).toMatchObject({ kind: 'midi', options: { effects: true } });
      expect(fake.created[0].options?.sampleRate).toBeUndefined();
      expect(fake.created[0].options?.voiceCap).toBeUndefined();
    });

    describe('a MIDI song the server renders (mode SERVER)', () => {
      const MIDI_SONG = song('21629', 'Skyfall', 'Adele', Format.MIDI);
      const MIDI_PLAYING: StateInit = { ...PLAYING, now: { song: MIDI_SONG, positionMs: 0, positionAtMs: 1000 } };
      const LYRICS = create(LyricsSchema, { number: '21629', source: 'kar', lines: [{ startMs: 0n, endMs: 500n, words: [{ text: 'Hel', startMs: 0n, endMs: 500n }] }] });
      const rendered = (over: Parameters<typeof playbackOf>[0] = {}) =>
        playbackOf({ kind: PlaybackKind.AUDIO, mode: MidiMode.SERVER, audioUrl: '/media/rendered/21629?sig=r', lyrics: LYRICS, ...over });

      it('is played by the audio engine, chosen by the kind of playback and not by the song format, and shows its lyrics', async () => {
        const { server, fake, push, player } = setup();
        server.handlers.playback = () => rendered();
        await push(MIDI_PLAYING);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
        expect(fake.last().load).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: '/media/rendered/21629?sig=r' }));
        expect(player.phase()).toBe('ready');
        expect(player.lyrics()?.lines.length).toBe(1);
        expect(fake.last().play).toHaveBeenCalledTimes(1);
      });

      it('shows Preparing until the render is ready, asking again after retry_after_ms, then plays it', async () => {
        const { server, fake, push, flush, player } = setup();
        let calls = 0;
        server.handlers.playback = () => (++calls === 1 ? rendered({ ready: false, retryAfterMs: 1000 }) : rendered());
        await push(MIDI_PLAYING);
        expect(player.phase()).toBe('preparing');
        expect(fake.created).toEqual([]);
        await flush(900);
        expect(calls).toBe(1);
        await flush(200);
        expect(calls).toBe(2);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
        expect(player.phase()).toBe('ready');
      });

      it('a MIDI song that the server could not render comes as MIDI again and uses the synth', async () => {
        const { server, fake, push } = setup();
        server.handlers.playback = () => playbackOf({ kind: PlaybackKind.MIDI_SYNTH, mode: MidiMode.LOW_POWER });
        await push(MIDI_PLAYING);
        expect(fake.created.map((c) => c.kind)).toEqual(['midi']);
      });
    });

    describe('a browser that cannot play FLAC', () => {
      const MIDI_SONG = song('21629', 'Skyfall', 'Adele', Format.MIDI);
      const MIDI_PLAYING: StateInit = { ...PLAYING, now: { song: MIDI_SONG, positionMs: 0, positionAtMs: 1000 } };
      const render = () => playbackOf({ kind: PlaybackKind.AUDIO, mode: MidiMode.SERVER, audioUrl: '/media/rendered/21629?sig=r', song: MIDI_SONG });
      const synth = () => playbackOf({ kind: PlaybackKind.MIDI_SYNTH, mode: MidiMode.LOW_POWER, song: MIDI_SONG });

      it('switches this device to the synthesizer once and plays the song with it', async () => {
        const { server, fake, push, flush } = setup({ flac: false });
        let switched = false;
        server.handlers.setMidiMode = () => void (switched = true);
        server.handlers.playback = () => (switched ? synth() : render());
        const toast = TestBed.inject(ToastService);
        await push(MIDI_PLAYING);
        await flush(100);
        expect(server.calls.mode).toHaveLength(1);
        expect(server.calls.mode[0]).toMatchObject({ deviceId: ME, mode: MidiMode.LOW_POWER });
        expect(server.calls.playback).toHaveLength(2);
        expect(fake.created.map((c) => c.kind)).toEqual(['midi']);
        expect(toast.toasts().map((t) => t.message)).toEqual(['This device cannot play the server\u2019s audio. Switched to the built-in synthesizer.']);
      });

      it('does nothing when FLAC plays', async () => {
        const { server, fake, push } = setup({ flac: true });
        server.handlers.playback = () => render();
        await push(MIDI_PLAYING);
        expect(server.calls.mode).toEqual([]);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
      });

      it('leaves MP3 songs alone', async () => {
        const { server, fake, push } = setup({ flac: false });
        server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO, song: SONG });
        await push(PLAYING); // SONG is an MP3
        expect(server.calls.mode).toEqual([]);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
      });

      it('asks only once per song when the server keeps answering with audio', async () => {
        const { server, fake, push, flush } = setup({ flac: false });
        server.handlers.playback = () => render();
        await push(MIDI_PLAYING);
        await flush(5000);
        expect(server.calls.mode).toHaveLength(1);
        expect(server.calls.playback).toHaveLength(2);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
      });

      it('plays what it has when the switch itself fails, and says nothing', async () => {
        const { server, fake, push, flush } = setup({ flac: false });
        server.handlers.setMidiMode = () => {
          throw new ConnectError('down', Code.Unavailable);
        };
        server.handlers.playback = () => render();
        await push(MIDI_PLAYING);
        await flush(100);
        expect(server.calls.mode).toHaveLength(1);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
        expect(TestBed.inject(ToastService).toasts()).toEqual([]);
      });
    });

    describe('a page that cannot run the synthesizer (not a secure context: plain HTTP from a LAN address)', () => {
      const MIDI_SONG = song('21629', 'Skyfall', 'Adele', Format.MIDI);
      const MIDI_PLAYING: StateInit = { ...PLAYING, now: { song: MIDI_SONG, positionMs: 0, positionAtMs: 1000 } };
      const render = () => playbackOf({ kind: PlaybackKind.AUDIO, mode: MidiMode.SERVER, audioUrl: '/media/rendered/21629?sig=r', song: MIDI_SONG });
      const synth = () => playbackOf({ kind: PlaybackKind.MIDI_SYNTH, mode: MidiMode.FULL, song: MIDI_SONG });
      const NO_SYNTH = 'This page cannot play MIDI songs: they need HTTPS, or a server that renders audio.';

      it('regression: switches this device to server audio once, tells the user, and plays the rendered song', async () => {
        const { server, fake, push, flush } = setup({ synth: false });
        let switched = false;
        server.handlers.setMidiMode = () => void (switched = true);
        server.handlers.playback = () => (switched ? render() : synth());
        await push(MIDI_PLAYING);
        await flush(100);
        expect(server.calls.mode).toHaveLength(1);
        expect(server.calls.mode[0]).toMatchObject({ deviceId: ME, mode: MidiMode.SERVER });
        expect(server.calls.playback).toHaveLength(2);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
        expect(TestBed.inject(ToastService).toasts().map((t) => t.message)).toEqual([
          'This page cannot run the synthesizer (it needs HTTPS). Switched to server-rendered audio.',
        ]);
      });

      it('regression: without server rendering it switches once, then says so clearly and does not loop', async () => {
        const { server, fake, player, push, flush } = setup({ synth: false });
        server.handlers.playback = () => synth(); // the server cannot render and keeps answering with MIDI
        await push(MIDI_PLAYING);
        await flush(5000);
        expect(server.calls.mode).toHaveLength(1);
        expect(server.calls.playback).toHaveLength(2);
        expect(fake.created).toEqual([]); // the synthesizer is not even tried
        expect(player.error()).toBe(NO_SYNTH);
      });

      it('regression: without server rendering no "Switched to server-rendered audio" toast is shown (nothing was switched to)', async () => {
        const { server, player, push, flush } = setup({ synth: false });
        server.handlers.playback = () => synth(); // the server cannot render and keeps answering with MIDI
        await push(MIDI_PLAYING);
        await flush(100); // short: a toast goes away by itself after a few seconds
        expect(player.error()).toBe(NO_SYNTH);
        expect(TestBed.inject(ToastService).toasts()).toEqual([]);
      });

      it('regression: a device that is already in Server mode is not switched again, and gets no toast, when the server still answers with MIDI', async () => {
        const { server, player, push, flush } = setup({ synth: false });
        server.handlers.playback = () => synth();
        await push({ ...MIDI_PLAYING, devices: [device(ME, 'This browser', { isCaller: true, midiMode: MidiMode.SERVER }), device('tv', 'Living room TV')] });
        await flush(100);
        expect(server.calls.mode).toEqual([]);
        expect(player.error()).toBe(NO_SYNTH);
        expect(TestBed.inject(ToastService).toasts()).toEqual([]);
      });

      it('a device that was already in Server mode is not told it switched when the server renders', async () => {
        const { server, fake, push, flush } = setup({ synth: false });
        server.handlers.playback = () => render();
        await push({ ...MIDI_PLAYING, devices: [device(ME, 'This browser', { isCaller: true, midiMode: MidiMode.SERVER }), device('tv', 'Living room TV')] });
        await flush(100);
        expect(server.calls.mode).toEqual([]);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
        expect(TestBed.inject(ToastService).toasts()).toEqual([]);
      });

      it('says so clearly when the switch itself fails', async () => {
        const { server, fake, player, push, flush } = setup({ synth: false });
        server.handlers.setMidiMode = () => {
          throw new ConnectError('down', Code.Unavailable);
        };
        server.handlers.playback = () => synth();
        await push(MIDI_PLAYING);
        await flush(100);
        expect(server.calls.mode).toHaveLength(1);
        expect(fake.created).toEqual([]);
        expect(player.error()).toBe(NO_SYNTH);
        expect(TestBed.inject(ToastService).toasts()).toEqual([]);
      });

      it('a page that can run the synthesizer is untouched', async () => {
        const { server, fake, push } = setup({ synth: true });
        server.handlers.playback = () => synth();
        await push(MIDI_PLAYING);
        expect(server.calls.mode).toEqual([]);
        expect(fake.created.map((c) => c.kind)).toEqual(['midi']);
      });

      it('MP3 songs are unaffected', async () => {
        const { server, fake, push } = setup({ synth: false });
        server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO, song: SONG });
        await push(PLAYING);
        expect(server.calls.mode).toEqual([]);
        expect(fake.created.map((c) => c.kind)).toEqual(['mp3']);
      });

      it('a browser that has neither the synthesizer nor FLAC ends with the clear error, not a loop', async () => {
        const { server, fake, player, push, flush } = setup({ synth: false, flac: false });
        let mode = MidiMode.FULL;
        server.handlers.setMidiMode = (req) => void (mode = req.mode);
        server.handlers.playback = () => (mode === MidiMode.SERVER ? render() : synth());
        await push(MIDI_PLAYING);
        await flush(5000);
        expect(server.calls.mode.map((c) => c.mode)).toEqual([MidiMode.SERVER, MidiMode.LOW_POWER]);
        expect(fake.created).toEqual([]);
        expect(player.error()).toBe(NO_SYNTH);
      });
    });

    describe('a change of the device mode', () => {
      const FIRST = song('21628', 'Hello', 'Adele', Format.MIDI);
      const SECOND = song('21629', 'Skyfall', 'Adele', Format.MIDI);
      const at = (s: typeof FIRST, mode: MidiMode): StateInit => ({
        ...PLAYING,
        devices: [device(ME, 'This browser', { isCaller: true, effectiveMidiMode: mode }), device('tv', 'Living room TV')],
        now: { song: s, positionMs: 0, positionAtMs: 1000 },
      });

      it('is not applied to the song that is playing; the next song uses the new mode', async () => {
        const { server, fake, push, flush } = setup();
        server.handlers.playback = () => playbackOf({ kind: PlaybackKind.MIDI_SYNTH, mode: MidiMode.FULL });
        await push(at(FIRST, MidiMode.FULL));
        expect(fake.created.map((c) => c.kind)).toEqual(['midi']);
        const synth = fake.created[0].engine;

        // dropouts made the server step this device down to server rendering: the state says so while the song plays
        server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO, mode: MidiMode.SERVER });
        await push(at(FIRST, MidiMode.SERVER));
        await flush(2000);
        expect(fake.created.map((c) => c.kind)).toEqual(['midi']);
        expect(server.calls.playback.length).toBe(1);
        expect(synth.dispose).not.toHaveBeenCalled();

        await push(at(SECOND, MidiMode.SERVER));
        expect(synth.dispose).toHaveBeenCalled();
        expect(server.calls.playback.map((c) => c.number)).toEqual(['21628', '21629']);
        expect(fake.created.map((c) => c.kind)).toEqual(['midi', 'mp3']);
      });
    });

    it('MIDI at low power: 22050 Hz, 32 voices, no effects', async () => {
      const { server, fake, push } = setup();
      server.handlers.playback = () => playbackOf({ mode: MidiMode.LOW_POWER });
      await push(PLAYING);
      expect(fake.created[0]).toMatchObject({ kind: 'midi', options: { sampleRate: 22050, voiceCap: 32, effects: false } });
    });
  });

  describe('play and pause that cross', () => {
    it('regression: a pause while play is still starting leaves no reports and no clock running', async () => {
      const { server, fake, push, flush } = setup();
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      fake.hooks.configure = (e) => e.play.mockImplementation(() => gate);
      await push(PLAYING);
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      release();
      await flush(5000);
      expect(server.calls.position).toEqual([]);
    });

    it('regression: the browser cutting a play short because of the pause is not a failed song', async () => {
      const { fake, push, player } = setup();
      fake.hooks.configure = (e) => e.play.mockRejectedValue(new DOMException('interrupted by pause', 'AbortError'));
      await push(PLAYING);
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      expect(player.phase()).toBe('ready');
      expect(player.error()).toBe('');
    });

    it('a refusal that arrives after the pause does not ask for a tap (nothing is meant to play)', async () => {
      const { fake, push, player } = setup();
      let refuse!: () => void;
      const gate = new Promise<void>((_, reject) => (refuse = () => reject(new DOMException('no gesture', 'NotAllowedError'))));
      fake.hooks.configure = (e) => e.play.mockImplementation(() => gate);
      await push(PLAYING);
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      refuse();
      await vi.advanceTimersByTimeAsync(50);
      expect(player.needsGesture()).toBe(false);
      expect(player.phase()).toBe('ready');
    });

    it('a real failure of play still fails the song', async () => {
      const { fake, push, player } = setup();
      fake.hooks.configure = (e) => e.play.mockRejectedValue(new Error('decode error'));
      await push(PLAYING);
      expect(player.phase()).toBe('error');
    });
  });

  describe('the end of a song', () => {
    it('tells the server with the loud readings of the microphone, and lets go of the engine', async () => {
      const { server, fake, mic, push } = setup();
      mic.loud = 37;
      await push(PLAYING, ScoreMode.MICROPHONE);
      expect(mic.begin).toHaveBeenCalledTimes(1);
      fake.last().finish();
      await vi.advanceTimersByTimeAsync(20);
      expect(server.calls.ended.map((e) => [e.number, e.loudReadings])).toEqual([['21628', 37]]);
      expect(fake.last().dispose).toHaveBeenCalled();
    });

    it('counts no readings when the score does not use the microphone', async () => {
      const { server, fake, mic, push } = setup();
      mic.loud = 37;
      await push(PLAYING, ScoreMode.RANDOM);
      expect(mic.begin).not.toHaveBeenCalled();
      fake.last().finish();
      await vi.advanceTimersByTimeAsync(20);
      expect(server.calls.ended.map((e) => e.loudReadings)).toEqual([0]);
    });

    it('stops reporting positions once the song is over', async () => {
      const { server, fake, push, flush } = setup();
      await push(PLAYING);
      fake.last().finish();
      await flush(100);
      const n = server.calls.position.length;
      await flush(5000);
      expect(server.calls.position.length).toBe(n);
    });

    it('the same state again does not start the song again, a new one for the same number does', async () => {
      const { server, fake, push } = setup();
      await push(PLAYING);
      fake.last().finish();
      await vi.advanceTimersByTimeAsync(20);
      TestBed.tick();
      expect(fake.created.length).toBe(1);
      await push({ ...PLAYING, now: undefined }); // score screen
      expect(fake.created.length).toBe(1);
      await push(PLAYING); // the same song comes round again
      expect(fake.created.length).toBe(2);
      expect(server.calls.ready.length).toBe(2);
    });

    it('regression: the score screen keeps the finished song as "now" (a new object each push): it is not loaded and ended again', async () => {
      const { server, fake, push } = setup();
      await push(PLAYING);
      fake.last().finish();
      await vi.advanceTimersByTimeAsync(20);
      // what the server sends while the score shows: the same song, in a fresh message, with the score
      await push({ ...PLAYING, score: { number: '21628', value: 80 } });
      await push({ ...PLAYING, score: { number: '21628', value: 80 } });
      expect(fake.created.length).toBe(1);
      expect(server.calls.ready.length).toBe(1);
      expect(server.calls.ended.length).toBe(1);
      // the score is over and the same song comes round again: that one is played
      await push(PLAYING);
      expect(fake.created.length).toBe(2);
    });

    it('goes on to the next song', async () => {
      const { server, fake, push } = setup();
      await push(PLAYING);
      fake.last().finish();
      await push({ ...PLAYING, now: { song: song('3', 'Next', 'X'), positionMs: 0, positionAtMs: 2000 } });
      expect(server.calls.playback.map((c) => c.number)).toEqual(['21628', '3']);
      expect(fake.created.length).toBe(2);
    });
  });

  describe('stopping', () => {
    it('another device taking over pauses and disposes the engine and stops the reports', async () => {
      const { server, fake, push, flush } = setup();
      await push(PLAYING);
      await flush(1200);
      const engine = fake.last();
      await push({ ...PLAYING, player: 'tv' });
      expect(engine.pause).toHaveBeenCalled();
      expect(engine.dispose).toHaveBeenCalledTimes(1);
      const n = server.calls.position.length;
      await flush(5000);
      expect(server.calls.position.length).toBe(n);
    });

    it('a skipped song is let go of before the next one is loaded', async () => {
      const { fake, push } = setup();
      await push(PLAYING);
      const first = fake.last();
      await push({ ...PLAYING, now: { song: song('3', 'Next', 'X'), positionMs: 0, positionAtMs: 2000 } });
      expect(first.dispose).toHaveBeenCalledTimes(1);
      expect(fake.created.length).toBe(2);
    });

    it('a song that is gone while it is loading is let go of when it has loaded', async () => {
      const { fake, push, flush, server } = setup();
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      server.handlers.playback = async () => {
        await gate;
        return playbackOf();
      };
      await push(PLAYING);
      await push({ ...PLAYING, now: undefined });
      release();
      await flush(50);
      expect(fake.created.length).toBe(0);
      expect(server.calls.ready.length).toBe(0);
    });

    it('destroying the controller lets go of everything', async () => {
      const { fake, mic, server, push, flush } = setup();
      await push(PLAYING, ScoreMode.MICROPHONE);
      TestBed.resetTestingModule();
      expect(fake.last().dispose).toHaveBeenCalled();
      expect(mic.dispose).toHaveBeenCalled();
      const n = server.calls.position.length;
      await flush(5000);
      expect(server.calls.position.length).toBe(n);
    });
  });

  describe('sound that needs a tap', () => {
    it('when the browser refuses to play, asks for a tap; the tap plays', async () => {
      const { fake, push, player } = setup();
      await push(PLAYING);
      const engine = fake.last();
      engine.play.mockRejectedValueOnce(new DOMException('no gesture', 'NotAllowedError'));
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      await push(PLAYING);
      expect(player.needsGesture()).toBe(true);
      await player.unlock();
      expect(player.needsGesture()).toBe(false);
      expect(engine.play).toHaveBeenCalled();
    });

    it('a refusal on the very first play is handled the same way', async () => {
      const { fake, push, player } = setup();
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      fake.last().play.mockRejectedValueOnce(new DOMException('no gesture', 'NotAllowedError'));
      await push(PLAYING);
      expect(player.needsGesture()).toBe(true);
    });
  });

  describe('a song that cannot be played', () => {
    function failing(setupResult: ReturnType<typeof setup>) {
      setupResult.server.handlers.playback = () => playbackOf();
      const orig = setupResult.fake.engines.midi;
      setupResult.fake.engines.midi = (options) => {
        const e = orig(options) as FakeEngine;
        e.load.mockRejectedValue(new Error('The song could not be loaded.'));
        return e;
      };
    }

    it('says so and moves on after a few seconds', async () => {
      const s = setup();
      failing(s);
      await s.push(PLAYING);
      expect(s.player.phase()).toBe('error');
      expect(s.player.error()).toMatch(/could not be (loaded|played)/i);
      expect(s.server.calls.control).toEqual([]);
      await s.flush(3000);
      expect(s.server.calls.control.map((c) => c.action)).toEqual([ControlAction.SKIP]);
    });

    it('gives up skipping after three in a row, so a broken device does not eat the queue', async () => {
      const s = setup();
      failing(s);
      for (let i = 0; i < 5; i++) {
        await s.push({ ...PLAYING, now: { song: song(String(100 + i), 'S', 'A'), positionMs: 0, positionAtMs: 1000 + i } });
        await s.flush(3500);
      }
      expect(s.server.calls.control.length).toBe(3);
    });

    it('a song that loads again resets the count', async () => {
      const s = setup();
      failing(s);
      await s.push(PLAYING);
      await s.flush(3500);
      s.fake.engines.midi = (options) => {
        const e = new FakeEngine();
        e.audioClock = () => e.clock;
        s.fake.created.push({ kind: 'midi', options, engine: e });
        return e;
      };
      await s.push({ ...PLAYING, now: { song: song('4', 'Fine', 'A'), positionMs: 0, positionAtMs: 2000 } });
      expect(s.player.phase()).toBe('ready');
    });
  });

  describe('the microphone', () => {
    it('without a microphone setting only says whether one could be used', async () => {
      const { server, mic, push } = setup();
      await push(PLAYING, ScoreMode.RANDOM);
      expect(server.calls.mic.map((m) => m.available)).toEqual([true]);
      expect(mic.init).not.toHaveBeenCalled();
    });

    it('reports no microphone when it cannot be used, and never asks for it', async () => {
      const { server, mic, push } = setup();
      mic.capableNow = false;
      await push(PLAYING, ScoreMode.MICROPHONE);
      expect(server.calls.mic.map((m) => m.available)).toEqual([false]);
    });

    it('in microphone mode asks for it and reports the answer once', async () => {
      const { server, mic, push, flush } = setup();
      await push(PLAYING, ScoreMode.MICROPHONE);
      await flush(500);
      expect(mic.opens).toBe(1);
      expect(server.calls.mic.map((m) => m.available)).toEqual([true]);
    });

    it('regression: the microphone is let go of when the score no longer uses it, and asked for again if it does', async () => {
      const { mic, push } = setup();
      await push(PLAYING, ScoreMode.MICROPHONE);
      expect(mic.opens).toBe(1);
      await push(PLAYING, ScoreMode.RANDOM);
      expect(mic.dispose).toHaveBeenCalled();
      await push(PLAYING, ScoreMode.MICROPHONE);
      expect(mic.opens).toBe(2);
    });

    it('a refused microphone is reported as unavailable', async () => {
      const { server, mic, push } = setup();
      mic.init.mockImplementation(async () => (mic.available = false));
      await push(PLAYING, ScoreMode.MICROPHONE);
      expect(server.calls.mic.map((m) => m.available)).toEqual([false]);
    });
  });

  describe('commands', () => {
    it('control sends the command', async () => {
      const { server, player } = setup();
      await player.control(ControlAction.PAUSE);
      expect(server.calls.control.map((c) => c.action)).toEqual([ControlAction.PAUSE]);
    });

    it('a command that fails is shown as an error', async () => {
      const { server, player } = setup();
      server.handlers.control = () => {
        throw new ConnectError('x', Code.Unavailable);
      };
      await player.control(ControlAction.SKIP);
      const toast = TestBed.inject(ToastService).toasts()[0];
      expect(toast.kind).toBe('error');
    });
  });

  describe('what it shows', () => {
    it('the lyrics of the song', async () => {
      const { server, push, player } = setup();
      server.handlers.playback = () => playbackOf({ lyrics: create(LyricsSchema, { number: '21628' }) });
      await push(PLAYING);
      expect(player.lyrics()?.number).toBe('21628');
    });

    it('the playback time while it plays', async () => {
      const { fake, push, player, flush } = setup();
      await push(PLAYING);
      fake.last().time = 12_345;
      await flush(100);
      expect(player.timeMs()).toBe(12_345);
    });

    it('says which device plays when it is not this one', async () => {
      const { push, player } = setup();
      await push({ ...PLAYING, player: 'tv' });
      expect(player.playerName()).toBe('Living room TV');
    });
  });
});
