import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema, Format } from '../../gen/kantahe/v1/common_pb';
import { ControlAction, PlayStatus, ScoreSchema } from '../../gen/kantahe/v1/session_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { device, song, stateOf, StateInit } from '../queue/testing';
import { ENGINES } from './engines/engine';
import { MIC_METER } from './mic';
import { PlayerViewComponent } from './player-view.component';
import { asMic, fakeEngines, FakeMic, fakePlayerServer, playbackOf } from './testing';

const ME = 'me';
const SONG = song('21628', 'Hello', 'Adele', Format.MIDI);
const PLAYING: StateInit = {
  status: PlayStatus.PLAYING,
  player: ME,
  devices: [device(ME, 'This browser', { isCaller: true }), device('tv', 'Living room TV')],
  now: { song: SONG, positionMs: 0, positionAtMs: 1000 },
};

function setup() {
  const server = fakePlayerServer();
  const fake = fakeEngines();
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [{ provide: TRANSPORT, useValue: server.transport }, { provide: ENGINES, useValue: fake.engines }, { provide: MIC_METER, useValue: asMic(new FakeMic()) }],
  });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: ME }));
  TestBed.inject(StateStore);
  const fixture = TestBed.createComponent(PlayerViewComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ms = 30) => {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const push = async (init: StateInit) => {
    server.push(stateOf(init));
    await settle();
  };
  const button = (name: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  return { fixture, el, server, fake, settle, push, button };
}

describe('PlayerViewComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('says it is connecting until the first state arrives', async () => {
    const { el, settle } = setup();
    await settle();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Connecting');
  });

  it('on the player device: the song, the lyrics and the controls', async () => {
    const { el, push } = setup();
    await push(PLAYING);
    expect(el.textContent).toContain('Hello');
    expect(el.textContent).toContain('Adele');
    expect(el.textContent).toContain('MIDI');
    expect(el.querySelector('app-lyrics-view')).not.toBeNull();
    expect(el.querySelector('progress')).toBeNull(); // the length is not known for this fake song
  });

  it('Pause while playing, Play while paused, Skip; each sends its command', async () => {
    const { push, button, server, settle } = setup();
    await push(PLAYING);
    expect(button('Pause')).toBeDefined();
    button('Pause')!.click();
    await settle();
    await push({ ...PLAYING, status: PlayStatus.PAUSED });
    expect(button('Play')).toBeDefined();
    button('Play')!.click();
    button('Skip')!.click();
    await settle();
    expect(server.calls.control.map((c) => c.action)).toEqual([ControlAction.PAUSE, ControlAction.PLAY, ControlAction.SKIP]);
  });

  it('shows Preparing… while the song is made ready', async () => {
    const { el, push, server } = setup();
    server.handlers.playback = () => playbackOf({ ready: false, retryAfterMs: 5000 });
    await push(PLAYING);
    expect(Array.from(el.querySelectorAll('[role="status"]')).map((e) => e.textContent)).toContain('Preparing…');
  });

  it('shows why a song could not be played', async () => {
    const { el, push, fake, server } = setup();
    void server;
    fake.engines.midi = () => {
      const e = fake.engines.mp3();
      (e.load as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'));
      return e;
    };
    await push(PLAYING);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('could not be played');
  });

  it('asks for a tap when the browser will not start the sound, and the tap starts it', async () => {
    const { el, push, fake, button, settle } = setup();
    await push({ ...PLAYING, status: PlayStatus.PAUSED });
    fake.last().play.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    await push(PLAYING);
    expect(el.textContent).toContain('Tap to start the sound');
    button('Tap to start the sound')!.click();
    await settle();
    expect(fake.last().play.mock.calls.length).toBeGreaterThan(1);
    expect(el.textContent).not.toContain('Tap to start the sound');
  });

  it('the score of a song covers the player device', async () => {
    const { el, fixture, server, settle } = setup();
    const s = stateOf(PLAYING);
    s.score = create(ScoreSchema, { number: '21628', hasValue: true, value: 87, comment: 'You are a good singer.', fanfare: 2, untilMs: 9000n });
    server.push(s);
    await settle();
    await vi.advanceTimersByTimeAsync(1500);
    fixture.detectChanges();
    expect(el.querySelector('.overlay')).not.toBeNull();
    expect(el.textContent).toContain('87');
    // the controls behind the overlay cannot be reached by keyboard or screen reader
    expect(el.querySelector('.player-content')?.hasAttribute('inert')).toBe(true);
  });

  it('without a score the player is not inert', async () => {
    const { el, push } = setup();
    await push(PLAYING);
    expect(el.querySelector('.player-content')).not.toBeNull();
    expect(el.querySelector('.player-content')?.hasAttribute('inert')).toBe(false);
  });

  it('on another device there is no score overlay (a toast shows it)', async () => {
    const { el, push, server, settle } = setup();
    void push;
    const s = stateOf({ ...PLAYING, player: 'tv' });
    s.score = create(ScoreSchema, { number: '21628', hasValue: true, value: 87, untilMs: 9000n });
    server.push(s);
    await settle();
    expect(el.querySelector('.overlay')).toBeNull();
  });

  it('on another device: says which one plays and offers Play here', async () => {
    const { el, push, button, server, settle } = setup();
    await push({ ...PLAYING, player: 'tv' });
    expect(el.textContent).toContain('Playing on Living room TV');
    expect(el.querySelector('app-lyrics-view')).toBeNull();
    button('Play here')!.click();
    await settle();
    expect(server.calls.control.map((c) => c.action)).toEqual([ControlAction.PLAY_HERE]);
  });

  it('when no device plays it says so and offers Play here', async () => {
    const { el, push, button } = setup();
    await push({ ...PLAYING, player: '', status: PlayStatus.PAUSED });
    expect(el.textContent).toContain('No device is playing');
    expect(button('Play here')).toBeDefined();
  });

  it('every control has a text label', async () => {
    const { el, push } = setup();
    await push(PLAYING);
    for (const b of Array.from(el.querySelectorAll('button'))) expect((b.textContent ?? '').trim() || b.getAttribute('aria-label')).toBeTruthy();
  });
});
