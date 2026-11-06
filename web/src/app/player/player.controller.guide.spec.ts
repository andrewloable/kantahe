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
import { asMic, FakeMic, fakeEngines, fakePlayerServer, playbackOf } from './testing';
import { VocalsPrefs } from './vocals-prefs';

// Amateur singer mode (docs/PLAN.md, "Amateur singer mode"): the server gives a song with a vocals track Playback.guideVocalsUntilMs, the start of the
// third lyric line. From 0 ms to there the vocals play by themselves, then they fade out over FADE_MS, unless the singer chose otherwise.

const ME = 'me';
const UNTIL = 5000;
const FADE_MS = 300;
const MP3_SONG = song('21628', 'Hello', 'Adele', Format.MP3);
const NEXT_SONG = song('21630', 'Easy On Me', 'Adele', Format.MP3);

const playing = (s = MP3_SONG): StateInit => ({
  status: PlayStatus.PLAYING,
  player: ME,
  devices: [device(ME, 'This browser', { isCaller: true }), device('tv', 'Living room TV')],
  now: { song: s, positionMs: 0, positionAtMs: 1000 },
  serverTimeMs: 1000,
});

const playbackWith = (number: string, s = MP3_SONG, until: number | null = UNTIL) =>
  playbackOf({
    kind: PlaybackKind.AUDIO,
    audioUrl: `/media/song/${number}?sig=a`,
    vocalsUrl: `/media/vocals/${number}?sig=v`,
    song: s,
    guideVocalsUntilMs: until === null ? undefined : BigInt(until),
  });

describe('PlayerController: amateur singer guide vocals', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** A player device on a song whose playback says `until`; `configure` runs for every engine made (set its start time there). */
  async function start(until: number | null = UNTIL, init: StateInit = playing(), configure?: (n: number, e: { time: number }) => void) {
    const server = fakePlayerServer();
    const fake = fakeEngines();
    let made = 0;
    if (configure) fake.hooks.configure = (engine) => configure(++made, engine);
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
    const prefs = TestBed.inject(VocalsPrefs);
    TestBed.tick();
    const flush = async (ms = 20) => {
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(ms);
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(0);
    };
    server.handlers.playback = (req: { number: string }) => playbackWith(req.number, req.number === NEXT_SONG.number ? NEXT_SONG : MP3_SONG, until);
    server.push(stateOf(init));
    await flush();
    return { server, fake, player, prefs, flush, inst: () => fake.created[0].engine, voc: () => fake.created[1].engine };
  }

  /** Where the song is now: the instrumental is the clock, then the time passes (the guide looks every 50 ms). */
  async function at(t: { inst: () => { time: number }; flush: (ms?: number) => Promise<void> }, ms: number) {
    t.inst().time = ms;
    await t.flush(60);
  }

  const lastVolume = (e: { setVolume: { mock: { calls: number[][] } } }) => e.setVolume.mock.calls.at(-1)?.[0] as number;

  it('guide_starts_vocals_at_0: a song with a guide window plays its vocals from the start, without any press', async () => {
    const t = await start();
    expect(t.fake.created).toHaveLength(2);
    expect(t.voc().load).toHaveBeenCalledTimes(1);
    expect(t.voc().play).toHaveBeenCalledTimes(1);
    expect(t.player.vocalsState()).toBe('on');
    expect(t.prefs.on(), "the singer's own choice is not touched").toBe(false);
  });

  it('guide_stops_at_the_third_line: the voice fades out over 300 ms and is gone at the start of the third line', async () => {
    const t = await start();
    await at(t, UNTIL - FADE_MS - 400);
    const full = lastVolume(t.voc());
    expect(full).toBeGreaterThan(0);
    expect(t.player.vocalsState()).toBe('on');
    // the level goes down, never up, as the third line comes closer
    const levels: number[] = [];
    for (const left of [250, 150, 50]) {
      await at(t, UNTIL - left);
      levels.push(lastVolume(t.voc()));
      expect(t.player.vocalsState()).toBe('on');
    }
    expect(levels[0], 'the fade has begun').toBeLessThan(full);
    expect(levels[1]).toBeLessThan(levels[0]);
    expect(levels[2]).toBeLessThan(levels[1]);
    expect(levels[2]).toBeGreaterThan(0);
    await at(t, UNTIL);
    expect(t.voc().pause).toHaveBeenCalled();
    expect(t.player.vocalsState()).toBe('off');
    expect(t.prefs.on()).toBe(false);
    expect(t.prefs.pct(), 'the fade does not touch the singer’s vocals volume').toBe(60);
  });

  it('guide_fade_does_not_touch_the_level: pressing Vocals after the guide plays them at the normal level again', async () => {
    const t = await start();
    const full = lastVolume(t.voc());
    await at(t, UNTIL + 500);
    expect(t.player.vocalsState()).toBe('off');
    t.player.setVocals(true);
    await t.flush();
    const again = t.fake.created[2].engine; // a new vocals engine for the press
    expect(lastVolume(again)).toBe(full);
    expect(t.prefs.on()).toBe(true);
  });

  it("guide_keeps_the_singers_on: the singer's own choice keeps the voice playing past the window, at the full level", async () => {
    const t = await start();
    const full = lastVolume(t.voc());
    t.prefs.on.set(true); // chosen on an earlier song or by the button while the guide plays
    await at(t, UNTIL + 2000);
    expect(t.player.vocalsState()).toBe('on');
    expect(lastVolume(t.voc())).toBe(full);
    expect(t.voc().pause).not.toHaveBeenCalled();
  });

  it('press_off_during_guide_wins: the singer switches the voice off at 2 s; it stays off and the next song is guided again', async () => {
    const t = await start();
    await at(t, 2000);
    t.player.setVocals(false);
    await t.flush();
    expect(t.player.vocalsState()).toBe('off');
    expect(t.prefs.on()).toBe(false);
    await at(t, 3000);
    expect(t.player.vocalsState(), 'not started again inside the window').toBe('off');
    expect(t.fake.created, 'no new vocals engine').toHaveLength(2);
  });

  it('resend_of_the_same_state_is_not_a_press: asking for what already plays (the app resends it with the volume buttons) leaves the guide alone', async () => {
    const t = await start();
    await at(t, 2000);
    t.player.setVocals(true);
    await at(t, UNTIL + 500);
    expect(t.player.vocalsState(), 'the guide still ended by itself').toBe('off');
    expect(t.prefs.on()).toBe(false);
  });

  it('no_guide_without_window: guideVocalsUntilMs 0 (mode off, or fewer than three lines) is the old behaviour', async () => {
    for (const none of [0, null]) {
      TestBed.resetTestingModule();
      const t = await start(none);
      expect(t.fake.created, String(none)).toHaveLength(1);
      expect(t.player.vocalsState()).toBe('off');
    }
  });

  it('next_song_resets: a press in one song does not stop the guide of the next', async () => {
    const t = await start();
    await at(t, 2000);
    t.player.setVocals(false);
    await t.flush();
    t.server.push(stateOf(playing(NEXT_SONG)));
    await t.flush(200);
    const second = t.fake.created.at(-1)!.engine;
    expect(t.player.vocalsState()).toBe('on');
    expect(second.play).toHaveBeenCalled();
  });

  it('remote_device_does_nothing: a device that is not the player makes no vocals engine', async () => {
    const init = { ...playing(), player: 'tv' };
    const t = await start(UNTIL, init);
    expect(t.fake.created).toHaveLength(0);
    expect(t.player.vocalsState()).toBe('off');
  });

  it('reload_after_the_window: a player that takes over a song already past the window starts no guide', async () => {
    const init = { ...playing(), now: { song: MP3_SONG, positionMs: 9000, positionAtMs: 1000 } };
    const t = await start(UNTIL, init, (n, e) => {
      if (n === 1) e.time = 9000; // what the instrumental reports after the seek
    });
    expect(t.fake.created).toHaveLength(1);
    expect(t.player.vocalsState()).toBe('off');
  });
});
