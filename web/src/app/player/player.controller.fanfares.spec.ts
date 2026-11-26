import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { AuthTokenSchema, Format } from '../../gen/kantahe/v1/common_pb';
import { PlayStatus } from '../../gen/kantahe/v1/session_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { device, song, stateOf, StateInit } from '../queue/testing';
import { AUDIO_CONTEXT, CAN_PLAY_FLAC, CAN_SYNTHESIZE, ENGINES } from './engines/engine';
import { MIC_METER } from './mic';
import { PlayerController } from './player.controller';
import { Fanfares } from './score/fanfares';
import { asMic, FakeMic, fakeEngines, fakePlayerServer, playbackOf } from './testing';

// kantahe-cnf.1: the device that plays fetches the score fanfares ahead, so that a score still sounds when the connection is gone.

const ME = 'me';
const SONG = song('21628', 'Hello', 'Adele', Format.MP3);
const stateWith = (player: string): StateInit => ({
  status: PlayStatus.PLAYING,
  player,
  devices: [device(ME, 'This browser', { isCaller: true }), device('tv', 'Living room TV')],
  now: { song: SONG, positionMs: 0, positionAtMs: 1000 },
  serverTimeMs: 1000,
});

describe('PlayerController: fanfares', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function start(init: StateInit) {
    const server = fakePlayerServer();
    const fake = fakeEngines();
    const fanfares = { prefetch: vi.fn(), url: (t: number) => `/media/fanfare/${t}.mp3` };
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: TRANSPORT, useValue: server.transport },
        { provide: ENGINES, useValue: fake.engines },
        { provide: CAN_PLAY_FLAC, useValue: () => true },
        { provide: CAN_SYNTHESIZE, useValue: () => true },
        { provide: MIC_METER, useValue: asMic(new FakeMic()) },
        { provide: AUDIO_CONTEXT, useValue: () => undefined },
        { provide: Fanfares, useValue: fanfares },
        PlayerController,
      ],
    });
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: ME }));
    TestBed.inject(PlayerController);
    TestBed.tick();
    server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO, audioUrl: '/media/song/21628?sig=a', song: SONG });
    const push = async (i: StateInit) => {
      server.push(stateOf(i));
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(20);
      TestBed.tick();
    };
    await push(init);
    return { fanfares, push };
  }

  it('REGRESSION: the device that plays fetches the fanfares as soon as it is the player', async () => {
    const { fanfares } = await start(stateWith(ME));
    expect(fanfares.prefetch).toHaveBeenCalledTimes(1);
  });

  it('a device that is not the player fetches nothing, until it becomes the player', async () => {
    const { fanfares, push } = await start(stateWith('tv'));
    expect(fanfares.prefetch).not.toHaveBeenCalled();
    await push(stateWith(ME));
    expect(fanfares.prefetch).toHaveBeenCalledTimes(1);
  });
});
