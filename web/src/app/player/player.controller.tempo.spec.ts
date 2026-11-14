import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { AuthTokenSchema, Format } from '../../gen/kantahe/v1/common_pb';
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

// The tempo of the current song (kantahe-vaz): the player plays at NowPlaying.tempo_pct without a button of its own, and a change shows nothing.

const ME = 'me';
const MP3_SONG = song('21628', 'Hello', 'Adele', Format.MP3);
const NEXT_SONG = song('21630', 'Easy On Me', 'Adele', Format.MP3);

const playing = (tempoPct: number, s = MP3_SONG, on = false): StateInit => ({
  status: PlayStatus.PLAYING,
  player: ME,
  devices: [device(ME, 'This browser', { isCaller: true, vocalsOn: on, vocalsPct: 60 }), device('tv', 'Living room TV')],
  now: { song: s, positionMs: 0, positionAtMs: 1000, tempoPct },
  serverTimeMs: 1000,
});

describe('PlayerController: tempo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function start(init: StateInit) {
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
    TestBed.inject(PlayerController);
    TestBed.tick();
    const flush = async (ms = 20) => {
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(ms);
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(0);
    };
    server.handlers.playback = (req: { number: string }) =>
      playbackOf({ kind: PlaybackKind.AUDIO, audioUrl: `/media/song/${req.number}?sig=a`, vocalsUrl: `/media/vocals/${req.number}?sig=v`, song: req.number === NEXT_SONG.number ? NEXT_SONG : MP3_SONG });
    const push = async (i: StateInit) => {
      server.push(stateOf(i));
      await flush();
    };
    await push(init);
    return { server, fake, push, flush, inst: () => fake.created[0].engine, voc: () => fake.created[1].engine };
  }

  it('a song that starts at tempo 75 is given the rate before it plays, and a change reaches it at once', async () => {
    const { fake, push, inst } = await start(playing(75));
    expect(inst().setRate).toHaveBeenCalledWith(0.75);
    expect(inst().setRate.mock.invocationCallOrder[0]).toBeLessThan(inst().play.mock.invocationCallOrder[0]);
    await push(playing(125));
    expect(inst().setRate).toHaveBeenLastCalledWith(1.25);
    await push(playing(100));
    expect(inst().setRate).toHaveBeenLastCalledWith(1);
    expect(fake.created).toHaveLength(1); // no new engine, no reload
    expect(inst().load).toHaveBeenCalledTimes(1);
  });

  it('a state with no tempo (an older server) plays at normal speed', async () => {
    const { inst } = await start(playing(0));
    expect(inst().setRate).toHaveBeenLastCalledWith(1);
  });

  it('controller_applies_rate_to_vocals_too (regression): the voice made later and the voice playing both follow the rate', async () => {
    const { push, voc, inst } = await start(playing(75, MP3_SONG, true));
    expect(voc().setRate).toHaveBeenCalledWith(0.75);
    await push(playing(125, MP3_SONG, true));
    expect(inst().setRate).toHaveBeenLastCalledWith(1.25);
    expect(voc().setRate).toHaveBeenLastCalledWith(1.25);
  });

  it('the next song starts at normal speed again', async () => {
    const { fake, push } = await start(playing(75));
    await push(playing(100, NEXT_SONG));
    const next = fake.created[1].engine;
    expect(next.setRate).toHaveBeenLastCalledWith(1);
  });

  it('a change of tempo shows nothing: no message', async () => {
    const { push } = await start(playing(100));
    const toast = TestBed.inject(ToastService);
    const before = toast.toasts().length;
    await push(playing(80));
    await push(playing(120));
    expect(toast.toasts().length).toBe(before);
  });

  it('the position that is reported stays in song time: nothing is scaled by the player', async () => {
    const { server, push, inst, flush } = await start(playing(75));
    inst().time = 30_000;
    await flush(1100);
    const last = server.calls.position.at(-1);
    expect(Number(last?.positionMs)).toBe(30_000);
    await push(playing(75));
  });
});
