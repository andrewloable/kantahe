import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { AuthTokenSchema, Format, VocalsState } from '../../gen/kantahe/v1/common_pb';
import { PlayStatus } from '../../gen/kantahe/v1/session_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { device, song, stateOf, StateInit } from '../queue/testing';
import { AUDIO_CONTEXT, CAN_PLAY_FLAC, CAN_SYNTHESIZE, ENGINES } from './engines/engine';
import { MIC_METER } from './mic';
import { PlayerController } from './player.controller';
import { asMic, FakeMic, fakeEngines, fakePlayerServer, playbackOf } from './testing';

// The guide vocals as server state per device (kantahe-der): the player follows vocals_on and vocals_pct of its own device, tells the server what it
// plays, and stops the amateur guide when the server says it was cancelled. A server without these fields (1.4.0) is covered by the older specs.

const ME = 'me';
const UNTIL = 5000;
const MP3_SONG = song('21628', 'Hello', 'Adele', Format.MP3);
const NEXT_SONG = song('21630', 'Easy On Me', 'Adele', Format.MP3);

/** This device's row as a new server sends it: the vocals choice is set. */
const mine = (on: boolean, pct = 60) => device(ME, 'This browser', { isCaller: true, vocalsOn: on, vocalsPct: pct });

const playing = (on: boolean, pct = 60, s = MP3_SONG, now: { guideCancelled?: boolean } = {}): StateInit => ({
  status: PlayStatus.PLAYING,
  player: ME,
  devices: [mine(on, pct), device('tv', 'Living room TV')],
  now: { song: s, positionMs: 0, positionAtMs: 1000, ...now },
  serverTimeMs: 1000,
});

describe('PlayerController: the vocals choice from the server', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function start(init: StateInit, guide = false) {
    const server = fakePlayerServer();
    const fake = fakeEngines();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: TRANSPORT, useValue: server.transport },
        { provide: ENGINES, useValue: fake.engines },
        { provide: CAN_PLAY_FLAC, useValue: () => true },
        { provide: CAN_SYNTHESIZE, useValue: () => true },
        { provide: MIC_METER, useValue: asMic(new FakeMic()) },
        { provide: AUDIO_CONTEXT, useValue: () => undefined },
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
    server.handlers.playback = (req: { number: string }) =>
      playbackOf({
        kind: PlaybackKind.AUDIO,
        audioUrl: `/media/song/${req.number}?sig=a`,
        vocalsUrl: `/media/vocals/${req.number}?sig=v`,
        song: req.number === NEXT_SONG.number ? NEXT_SONG : MP3_SONG,
        guideVocalsUntilMs: guide ? BigInt(UNTIL) : undefined,
      });
    const push = async (i: StateInit) => {
      server.push(stateOf(i));
      await flush();
    };
    await push(init);
    return { server, fake, player, flush, push, inst: () => fake.created[0].engine, voc: () => fake.created[1].engine };
  }

  it('remote_on_starts_the_voice: vocals_on of this device turns the voice on and off, with nothing pressed here', async () => {
    const { fake, player, push } = await start(playing(false));
    expect(fake.created).toHaveLength(1);
    expect(player.vocalsState()).toBe('off');
    await push(playing(true));
    expect(fake.created).toHaveLength(2);
    expect(player.vocalsState()).toBe('on');
    expect(fake.created[1].engine.play).toHaveBeenCalledTimes(1);
    await push(playing(false));
    expect(player.vocalsState()).toBe('off');
    expect(fake.created[1].engine.dispose).toHaveBeenCalled();
  });

  it('a choice that was on before the song loaded starts the voice with the song', async () => {
    const { fake, player } = await start(playing(true));
    expect(fake.created).toHaveLength(2);
    expect(player.vocalsState()).toBe('on');
  });

  it('remote_level: vocals_pct sets the voice level, as a share of the song volume', async () => {
    const { push, voc } = await start(playing(true, 60));
    expect(voc().setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.6, 5));
    await push(playing(true, 30));
    expect(voc().setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.3, 5));
  });

  it('own_button_sends_SetVocals: the shortcut asks the server; the voice follows the state, not the press', async () => {
    const { server, fake, player, push } = await start(playing(false));
    player.setVocals(true);
    await vi.advanceTimersByTimeAsync(50);
    expect(server.calls.vocals.map((r) => ({ deviceId: r.deviceId, on: r.on, pct: r.pct }))).toEqual([{ deviceId: ME, on: true, pct: undefined }]);
    expect(fake.created).toHaveLength(1); // nothing yet: the server's state is the truth
    await push(playing(true));
    expect(player.vocalsState()).toBe('on');
  });

  it('reports_state: what the player really plays goes to the server once per change, in order', async () => {
    const { server, fake, push } = await start(playing(false));
    // the voice takes a while to load
    let release: () => void = () => undefined;
    fake.hooks.configure = (engine) => engine.load.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    await push(playing(true));
    release();
    await vi.advanceTimersByTimeAsync(20);
    await push(playing(false));
    const seen = server.calls.device.map((r) => r.vocalsState).filter((s, i, all) => i === 0 || s !== all[i - 1]);
    expect(seen).toEqual([VocalsState.OFF, VocalsState.LOADING, VocalsState.ON, VocalsState.OFF]);
  });

  it('nothing is reported while this device is not the player', async () => {
    const { server } = await start({ ...playing(false), player: 'tv' });
    expect(server.calls.device.filter((r) => r.vocalsState !== VocalsState.UNSPECIFIED)).toEqual([]);
  });

  it('guide_cancelled_stops_the_guide (regression): the voice goes off at once and stays off; the next song is guided again', async () => {
    const { server, fake, flush, push, inst, voc } = await start(playing(false), true);
    expect(fake.created).toHaveLength(2); // the guide plays by itself
    inst().time = 2000;
    await flush(60);
    expect(voc().dispose).not.toHaveBeenCalled();
    await push(playing(false, 60, MP3_SONG, { guideCancelled: true }));
    await flush(60);
    expect(voc().dispose).toHaveBeenCalled();
    inst().time = 3000;
    await flush(200);
    expect(fake.created).toHaveLength(2); // not started again
    // the next song starts clean
    await push(playing(false, 60, NEXT_SONG));
    await flush(60);
    expect(server.calls.playback.at(-1)?.number).toBe(NEXT_SONG.number);
    expect(fake.created.filter((c) => c.engine !== inst()).length).toBeGreaterThanOrEqual(2);
  });

  it('a takeover mid-song of a song whose guide was cancelled does not start the guide', async () => {
    const { fake } = await start(playing(false, 60, MP3_SONG, { guideCancelled: true }), true);
    expect(fake.created).toHaveLength(1);
  });

  it('a failed voice switches the choice off on the server too', async () => {
    const t = await start(playing(false));
    t.fake.hooks.configure = (engine) => engine.load.mockRejectedValue(new Error('no'));
    await t.push(playing(true));
    await vi.advanceTimersByTimeAsync(50);
    expect(t.server.calls.vocals.map((r) => r.on)).toEqual([false]);
  });

  it('remote_change_is_silent: a change from another device shows no message', async () => {
    const { push } = await start(playing(false));
    const toast = TestBed.inject(ToastService);
    const before = toast.toasts().length;
    await push(playing(true, 40));
    await push(playing(false, 80));
    expect(toast.toasts().length).toBe(before);
  });

  it('old_server_fallback: a state without the new fields keeps the in-memory choice and sends nothing', async () => {
    const t = await start({ ...playing(false), devices: [device(ME, 'This browser', { isCaller: true })] });
    t.player.setVocals(true);
    await t.flush();
    expect(t.player.vocalsState()).toBe('on');
    expect(t.server.calls.vocals).toEqual([]);
  });
});
