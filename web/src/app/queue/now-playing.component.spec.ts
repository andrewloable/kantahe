import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthTokenSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { NowPlayingComponent } from './now-playing.component';
import { ControlAction, device, fakeSession, Format, PlayStatus, song, SongSource, stateOf, StateInit } from './testing';

const ME = 'dev-me';
const PLAYING_AT_41S: StateInit = {
  status: PlayStatus.PLAYING,
  player: ME,
  devices: [device(ME, 'This browser', { isCaller: true })],
  now: { song: song('01052', 'Hello', 'Adele', Format.MP3), positionMs: 41200, positionAtMs: 1000 },
  serverTimeMs: 1000,
};

async function setup(initial: StateInit = PLAYING_AT_41S) {
  const server = fakeSession();
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: ME }));
  const store = TestBed.inject(StateStore);
  TestBed.tick();
  server.push(stateOf(initial));
  const fixture = TestBed.createComponent(NowPlayingComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  await settle(10);
  const button = (name: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  return { fixture, el, server, store, settle, button, toasts: TestBed.inject(ToastService) };
}

describe('NowPlayingComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('shows the song, its badge and where it came from', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Hello');
    expect(el.textContent).toContain('Adele');
    expect(el.textContent).toContain('MP3');
    expect(el.textContent).toContain('From the queue');
  });

  it('says when a song was picked at random', async () => {
    const { el } = await setup({ ...PLAYING_AT_41S, now: { ...PLAYING_AT_41S.now!, source: SongSource.RANDOM } });
    expect(el.textContent).toContain('Picked at random');
  });

  it('progress follows the server clock: 41.2 s plus 2 s shows 0:43', async () => {
    const { el, settle } = await setup();
    expect(el.querySelector('.time')?.textContent).toContain('0:41');
    await settle(2000);
    expect(el.querySelector('.time')?.textContent).toContain('0:43');
  });

  it('shows the length of the song when it is known', async () => {
    const withLength = song('1', 'Hello', 'Adele');
    withLength.durationMs = 185000n;
    const { el } = await setup({ ...PLAYING_AT_41S, now: { song: withLength, positionMs: 41200, positionAtMs: 1000 } });
    expect(el.querySelector('.time')?.textContent).toContain('3:05');
    const bar = el.querySelector('progress')!;
    expect(bar.max).toBe(185);
    expect(Math.round(bar.value)).toBe(41);
    expect(bar.getAttribute('aria-label')).toBe('Song progress');
  });

  it('regression: never shows a position past the end of the song while waiting for the next state', async () => {
    const short = song('1', 'Short', 'A');
    short.durationMs = 60000n;
    const { el, settle } = await setup({ ...PLAYING_AT_41S, now: { song: short, positionMs: 59000, positionAtMs: 1000 } });
    await settle(10_000);
    expect(el.querySelector('.time')?.textContent).toContain('1:00 / 1:00');
    const bar = el.querySelector('progress')!;
    expect(bar.value).toBeLessThanOrEqual(bar.max);
  });

  it('a paused song does not move', async () => {
    const { el, settle } = await setup({ ...PLAYING_AT_41S, status: PlayStatus.PAUSED });
    await settle(5000);
    expect(el.querySelector('.time')?.textContent).toContain('0:41');
  });

  // the progress loop reads the position on every frame; nothing else does, so counting the reads
  // after the page has settled tells whether the loop is running
  async function frames(store: StateStore, settle: (ms: number) => Promise<void>): Promise<number> {
    const reads = vi.spyOn(store, 'positionMs');
    await settle(200);
    const n = reads.mock.calls.length;
    reads.mockRestore();
    return n;
  }

  it('only animates while the song plays and the page is visible', async () => {
    const paused = await setup({ ...PLAYING_AT_41S, status: PlayStatus.PAUSED });
    expect(await frames(paused.store, paused.settle)).toBe(0);
    TestBed.resetTestingModule();

    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const bg = await setup();
    expect(await frames(bg.store, bg.settle)).toBe(0);
    await bg.settle(5000);
    expect(bg.el.querySelector('.time')?.textContent).toContain('0:41'); // nobody sees it, nothing is redrawn
    hidden.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await bg.settle(100);
    expect(await frames(bg.store, bg.settle)).toBeGreaterThan(5);
    await bg.settle(3000);
    expect(bg.el.querySelector('.time')?.textContent).toContain('0:49');
    hidden.mockRestore();
  });

  it('stops animating when it is destroyed', async () => {
    const { fixture, store, settle } = await setup();
    expect(await frames(store, settle)).toBeGreaterThan(5);
    fixture.destroy();
    expect(await frames(store, async (ms) => void (await vi.advanceTimersByTimeAsync(ms)))).toBe(0);
  });

  it('Pause while playing, Play while paused', async () => {
    const playing = await setup();
    expect(playing.button('Pause')).toBeDefined();
    expect(playing.button('Play')).toBeUndefined();
    playing.button('Pause')!.click();
    await playing.settle(10);
    expect(playing.server.calls.control.map((c) => c.action)).toEqual([ControlAction.PAUSE]);
    TestBed.resetTestingModule();

    const paused = await setup({ ...PLAYING_AT_41S, status: PlayStatus.PAUSED });
    expect(paused.button('Play')).toBeDefined();
    expect(paused.button('Pause')).toBeUndefined();
    paused.button('Play')!.click();
    await paused.settle(10);
    expect(paused.server.calls.control.map((c) => c.action)).toEqual([ControlAction.PLAY]);
  });

  it('Skip', async () => {
    const { button, server, settle } = await setup();
    button('Skip')!.click();
    await settle(10);
    expect(server.calls.control.map((c) => c.action)).toEqual([ControlAction.SKIP]);
  });

  it('regression: pressing Skip twice while the first command is on its way sends one command', async () => {
    const { button, server, settle } = await setup();
    let release!: () => void;
    server.holdControl(new Promise<void>((resolve) => (release = resolve)));
    button('Skip')!.click();
    await settle(10);
    button('Skip')!.click();
    await settle(10);
    expect(server.calls.control.map((c) => c.action)).toEqual([ControlAction.SKIP]);
    release();
    await settle(10);
    button('Skip')!.click(); // once it has finished, Skip works again
    await settle(10);
    expect(server.calls.control.length).toBe(2);
  });

  it('another device plays: says which one and offers Play here', async () => {
    const { el, button, server, settle } = await setup({
      ...PLAYING_AT_41S,
      player: 'tv',
      devices: [device(ME, 'This browser', { isCaller: true }), device('tv', 'Living room TV')],
    });
    expect(el.textContent).toContain('Playing on Living room TV');
    button('Play here')!.click();
    await settle(10);
    expect(server.calls.control.map((c) => c.action)).toEqual([ControlAction.PLAY_HERE]);
  });

  it('regression: a player that is offline is not described as playing', async () => {
    const { el, button } = await setup({
      ...PLAYING_AT_41S,
      player: 'tv',
      devices: [device(ME, 'This browser', { isCaller: true }), device('tv', 'Living room TV', { online: false })],
    });
    expect(el.textContent).toContain('Living room TV is offline');
    expect(el.textContent).not.toContain('Playing on Living room TV');
    expect(button('Play here')).toBeDefined();
  });

  it('this device plays: no Play here button', async () => {
    const { el, button } = await setup();
    expect(el.textContent).toContain('Playing on this device');
    expect(button('Play here')).toBeUndefined();
  });

  it('no device plays: says so and still offers Play here', async () => {
    const { el, button } = await setup({ ...PLAYING_AT_41S, status: PlayStatus.PAUSED, player: '' });
    expect(el.textContent).toContain('No device is playing');
    expect(button('Play here')).toBeDefined();
  });

  it('shows the Up next line', async () => {
    const { el } = await setup({ ...PLAYING_AT_41S, upNext: { song: song('2', 'Skyfall', 'Adele'), source: SongSource.RANDOM } });
    expect(el.querySelector('.up-next')?.textContent).toContain('Up next');
    expect(el.querySelector('.up-next')?.textContent).toContain('Skyfall');
  });

  it('nothing playing yet', async () => {
    const { el } = await setup({ status: PlayStatus.PAUSED, devices: [device(ME, 'This browser', { isCaller: true })] });
    expect(el.textContent).toContain('Nothing is playing');
  });

  it('shows a failed command', async () => {
    const { button, server, settle, toasts } = await setup();
    server.failControl(() => new ConnectError('x', Code.Unavailable));
    button('Skip')!.click();
    await settle(10);
    expect(toasts.toasts()[0].kind).toBe('error');
  });

  it('every control has a text label', async () => {
    const { el } = await setup();
    for (const b of Array.from(el.querySelectorAll('button'))) expect((b.textContent ?? '').trim() || b.getAttribute('aria-label')).toBeTruthy();
  });
});
