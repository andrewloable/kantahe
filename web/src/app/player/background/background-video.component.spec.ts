import { TestBed } from '@angular/core/testing';
import { BackgroundMode } from '../../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { StateStore } from '../../core/state.store';
import { device, stateOf } from '../../queue/testing';
import { BACKGROUND_REFETCH_MS } from './background.store';
import { BackgroundVideoComponent, SCRIM } from './background-video.component';
import { at, bgVideo, fakeBackground, send, stubMedia } from './testing';

const url = (id: string) => bgVideo(id).url;

function setup(opts: { ids?: string[]; shuffle?: boolean; active?: boolean; playing?: boolean } = {}) {
  const server = fakeBackground((opts.ids ?? ['v1', 'v2', 'v3']).map((id) => bgVideo(id)));
  server.shuffle = opts.shuffle ?? false;
  const media = stubMedia();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }, { provide: BACKGROUND_REFETCH_MS, useValue: 60_000 }] });
  TestBed.inject(AuthStore).deviceId.set('me');
  const stateStore = TestBed.inject(StateStore);
  const setActive = (on: boolean, mode = BackgroundMode.AUTO) =>
    stateStore.state.set(stateOf({ devices: [device('me', 'This browser', { isCaller: true, effectiveBackground: on, backgroundMode: mode })] }));
  const fixture = TestBed.createComponent(BackgroundVideoComponent);
  if (opts.playing === false) fixture.componentRef.setInput('playing', false);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ms = 5) => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(ms);
    }
  };
  /** Exactly this much time passes (settle lets three times as much pass). */
  const tick = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    TestBed.tick();
    fixture.detectChanges();
  };
  const videos = () => Array.from(el.querySelectorAll('video'));
  const src = (v: HTMLVideoElement) => v.getAttribute('src');
  setActive(opts.active ?? true);
  return { server, media, fixture, el, settle, tick, videos, src, setActive };
}

/** No sound can come from the element: muted (property and attribute), volume 0, no controls. */
function expectSilent(vs: HTMLVideoElement[], when: string) {
  expect(vs.length, when).toBe(2);
  for (const v of vs) {
    expect(v.muted, `${when}: muted`).toBe(true);
    expect(v.defaultMuted, `${when}: defaultMuted`).toBe(true);
    expect(v.hasAttribute('muted'), `${when}: muted attribute`).toBe(true);
    expect(v.volume, `${when}: volume`).toBe(0);
    expect(v.hasAttribute('controls'), `${when}: controls`).toBe(false);
  }
}

const near = (v: HTMLVideoElement) => at(v, 10, 9); // one second left

describe('BackgroundVideoComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('off: no request and no video element; on: one request and two elements; off again: the sources go and load is called', async () => {
    const { server, media, el, settle, videos, src, setActive } = setup({ active: false });
    await settle(100);
    expect(server.calls).toBe(0);
    expect(el.querySelector('video')).toBeNull();
    setActive(true);
    await settle();
    expect(server.calls).toBe(1);
    const [a, b] = videos();
    expect(videos()).toHaveLength(2);
    expect(src(a)).toBe(url('v1'));
    setActive(false);
    await settle(100);
    expect(el.querySelector('video')).toBeNull();
    for (const v of [a, b]) {
      expect(src(v), 'the source is gone').toBeNull();
      expect(media.loaded, 'load was called so that the decoder is freed').toContain(v);
    }
    expect(server.calls, 'nothing is asked for while off').toBe(1);
  });

  it('three videos in order: the next starts when the current has under 1.5 s left, takes over when it is playing, and the old one goes after the fade', async () => {
    const { media, settle, videos, src } = setup();
    await settle();
    const [a, b] = videos();
    expect(src(a)).toBe(url('v1'));
    expect(src(b)).toBeNull();
    expect(a.classList.contains('show')).toBe(true);
    send(a, 'playing');
    at(a, 10, 5); // plenty left: nothing is prepared
    await settle();
    expect(src(b)).toBeNull();

    near(a);
    await settle();
    expect(src(b), 'the next video starts before the current ends').toBe(url('v2'));
    expect(media.played).toContain(b);
    expect(b.classList.contains('show'), 'but it is not shown before it is playing').toBe(false);
    expect(a.classList.contains('show')).toBe(true);

    send(b, 'playing');
    await settle();
    expect(b.classList.contains('show')).toBe(true);
    expect(a.classList.contains('show')).toBe(false);
    expect(src(a), 'the old one stays during the fade').toBe(url('v1'));
    await settle(700);
    expect(src(a), 'and goes after it').toBeNull();
    expect(media.loaded).toContain(a);

    // 3, then round again to 1 and 2
    near(b);
    await settle();
    expect(src(a)).toBe(url('v3'));
    send(a, 'playing');
    await settle(700);
    near(a);
    await settle();
    expect(src(b)).toBe(url('v1'));
    send(b, 'playing');
    await settle(700);
    near(b);
    await settle();
    expect(src(a)).toBe(url('v2'));
  });

  it('the address of each element is exactly the one the server gave, with no change', async () => {
    const { settle, videos, src } = setup();
    await settle();
    const [a, b] = videos();
    near(a);
    await settle();
    expect(src(a)).toBe(bgVideo('v1').url);
    expect(src(b)).toBe(bgVideo('v2').url);
    expect(src(a)).not.toMatch(/[&?](t|_|cb|nocache|v)=/);
  });

  it('VIDEO ONLY: both elements are muted (property and attribute), at volume 0 and without controls, when they are made and after every swap', async () => {
    const { settle, videos } = setup(); // the fake videos report has_audio: true
    await settle();
    const [a, b] = videos();
    expectSilent(videos(), 'at the start');
    send(a, 'playing');
    near(a);
    await settle();
    expectSilent(videos(), 'when the next one is made ready');
    send(b, 'playing');
    await settle(700);
    expectSilent(videos(), 'after the first swap');
    near(b);
    await settle();
    send(a, 'playing');
    await settle(700);
    expectSilent(videos(), 'after the second swap');
  });

  it('VIDEO ONLY: whatever turns the sound on is put right again at once', async () => {
    const { settle, videos } = setup();
    await settle();
    const [a, b] = videos();
    for (const v of [a, b]) {
      v.muted = false;
      v.volume = 1;
      v.setAttribute('controls', '');
      send(v, 'volumechange');
      expect(v.muted).toBe(true);
      expect(v.volume).toBe(0);
      expect(v.hasAttribute('controls')).toBe(false);
    }
  });

  it('one video: the loop attribute is set and no swap happens', async () => {
    const { settle, videos, src } = setup({ ids: ['v1'] });
    await settle();
    const [a, b] = videos();
    expect(a.loop).toBe(true);
    expect(a.hasAttribute('loop')).toBe(true);
    send(a, 'playing');
    near(a);
    await settle();
    expect(src(b)).toBeNull();
    expect(src(a)).toBe(url('v1'));
  });

  it('shuffle: a pass plays every video once', async () => {
    const { settle, videos, src } = setup({ shuffle: true });
    await settle();
    const [a, b] = videos();
    const seen = [src(a)];
    near(a);
    await settle();
    seen.push(src(b));
    send(b, 'playing');
    await settle(700);
    near(b);
    await settle();
    seen.push(src(a));
    expect([...seen].sort()).toEqual([url('v1'), url('v2'), url('v3')].sort());
  });

  describe('failures', () => {
    it('an error on the current video goes on to the next, and asks the server for a fresh list once', async () => {
      const { server, settle, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      expect(server.calls).toBe(1);
      send(a, 'error'); // an expired or refused address shows as an error
      await settle();
      expect(src(b)).toBe(url('v2'));
      expect(server.calls, 'one refetch at once').toBe(2);
      send(b, 'error'); // the failed element A is still the one on show, so the third video goes on to B again
      await settle();
      expect(src(b)).toBe(url('v3'));
      expect(server.calls, 'only one refetch for a run of failures').toBe(2);
    });

    it('a video that does not start within 10 s is skipped', async () => {
      const { settle, tick, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      send(a, 'waiting');
      await tick(9000);
      expect(src(b)).toBeNull();
      await tick(1500);
      expect(src(b)).toBe(url('v2'));
    });

    it('every video failing within a minute stops the trying for five minutes, says so once, then tries again', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { settle, tick, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      send(a, 'error'); // 1
      await settle();
      send(b, 'error'); // 2
      await settle();
      send(a, 'error'); // 3: all of them
      await settle();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(src(a)).toBeNull();
      expect(src(b)).toBeNull();
      await tick(4 * 60_000);
      expect(src(a) ?? src(b), 'nothing is tried for five minutes').toBeNull();
      await tick(61_000);
      expect(src(a), 'and then it is tried again').toBe(url('v1'));
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('a success clears the failures: errors spread over time do not stop it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { settle, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      send(a, 'error');
      await settle();
      send(b, 'playing'); // v2 plays
      await settle(700);
      send(b, 'error');
      await settle();
      expect(src(a), 'the third video is tried').toBe(url('v3'));
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('a paused song pauses the pictures, and playing again goes on', async () => {
    const { fixture, media, settle, videos } = setup();
    await settle();
    const [a] = videos();
    send(a, 'playing');
    const plays = media.played.length;
    fixture.componentRef.setInput('playing', false);
    await settle();
    expect(media.paused).toContain(a);
    fixture.componentRef.setInput('playing', true);
    await settle();
    expect(media.played.length).toBeGreaterThan(plays);
  });

  it('when the song starts paused the first video is loaded but not played', async () => {
    const { media, settle, videos, src } = setup({ playing: false });
    await settle();
    const [a] = videos();
    expect(src(a)).toBe(url('v1'));
    expect(media.played).toEqual([]);
  });

  // A paused song leaves the first video loaded but not playing. That is not a stall: nothing is skipped and nothing is given up.
  it('a video that waits because the song is paused is not taken for a stalled one, however long the pause lasts', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture, media, settle, tick, videos, src } = setup({ playing: false });
    await settle();
    const [a, b] = videos();
    await tick(5 * 60_000);
    expect(src(a), 'still the first video').toBe(url('v1'));
    expect(src(b)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    // and when the song plays, it plays
    fixture.componentRef.setInput('playing', true);
    await settle();
    expect(media.played).toContain(a);
    send(a, 'playing');
    await tick(60_000);
    expect(src(a)).toBe(url('v1'));
  });

  it('a "waiting" event while the song is paused does not start the stall clock either', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { settle, tick, videos, src } = setup({ playing: false });
    await settle();
    const [a, b] = videos();
    send(a, 'waiting');
    send(a, 'stalled');
    await tick(5 * 60_000);
    expect(src(a)).toBe(url('v1'));
    expect(src(b)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('VIDEO ONLY: no code path ever turns the sound on: muted is never set to false and the volume never above 0, through a whole run', async () => {
    const muted = vi.spyOn(HTMLMediaElement.prototype, 'muted', 'set');
    const volume = vi.spyOn(HTMLMediaElement.prototype, 'volume', 'set');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture, server, settle, tick, videos, setActive } = setup();
    await settle();
    const [a, b] = videos();
    send(a, 'playing');
    near(a); // a swap
    await settle();
    send(b, 'playing');
    await settle(700);
    near(b);
    await settle();
    send(a, 'error'); // a failure and its skip
    await settle();
    fixture.componentRef.setInput('playing', false); // a pause and a resume
    await settle();
    fixture.componentRef.setInput('playing', true);
    await settle();
    server.videos = [bgVideo('v2'), bgVideo('v3')]; // a changed list
    await tick(60_000);
    setActive(false); // off and on again
    await settle(100);
    setActive(true);
    await settle(100);
    expect(muted.mock.calls.length, 'the elements were silenced').toBeGreaterThan(0);
    expect(muted.mock.calls.every(([value]) => value === true)).toBe(true);
    expect(volume.mock.calls.every(([value]) => value === 0)).toBe(true);
  });

  it('turning the background off and on again several times leaves one set of listeners and no stray timers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { media, settle, tick, videos, src, setActive } = setup();
    await settle();
    for (let i = 0; i < 4; i++) {
      setActive(false);
      await settle(100);
      setActive(true);
      await settle(100);
    }
    const [a, b] = videos();
    expect(src(a)).toBe(url('v1'));
    const starts = media.played.filter((m) => m === a || m === b).length;
    send(a, 'playing');
    near(a);
    await settle();
    expect(src(b), 'one next video, once').toBe(url('v2'));
    expect(media.played.filter((m) => m === a || m === b).length, 'one play call for it').toBe(starts + 1);
    send(b, 'playing');
    await tick(5 * 60_000);
    expect(warn).not.toHaveBeenCalled();
  });

  describe('a changed list', () => {
    it('takes effect at the next swap: the playing video goes on, a removed one is passed over', async () => {
      const { server, settle, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      send(a, 'playing');
      server.videos = [bgVideo('v1'), bgVideo('v2')]; // v3 removed
      await settle(60_000);
      expect(src(a), 'the playing video is not interrupted').toBe(url('v1'));
      near(a);
      await settle();
      expect(src(b)).toBe(url('v2'));
      send(b, 'playing');
      await settle(700);
      near(b);
      await settle();
      expect(src(a), 'v3 is gone: the next pass starts again').toBe(url('v1'));
    });

    it('a video that is playing and gets removed is left at once', async () => {
      const { server, settle, tick, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      send(a, 'playing');
      server.videos = [bgVideo('v2'), bgVideo('v3')]; // v1 removed
      await tick(60_000);
      expect(src(b)).toBe(url('v2'));
    });

    it('a new address for the same video does not interrupt it (the URL changes when the server moves to the next window)', async () => {
      const { server, settle, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      send(a, 'playing');
      server.videos = [bgVideo('v1', { url: '/media/video/v1?u=u1&exp=1900021600&sig=new' }), bgVideo('v2'), bgVideo('v3')];
      await settle(60_000);
      expect(src(a)).toBe(url('v1'));
      expect(src(b)).toBeNull();
    });

    it('an empty list lets everything go', async () => {
      const { server, settle, videos, src } = setup();
      await settle();
      const [a, b] = videos();
      send(a, 'playing');
      server.videos = [];
      await settle(60_000);
      expect(src(a)).toBeNull();
      expect(src(b)).toBeNull();
    });
  });

  it('with no video to show there is no element at all; two appear when a video is added and go when the last is switched off', async () => {
    const { server, settle, tick, videos, el } = setup({ ids: [] });
    await settle();
    expect(videos()).toHaveLength(0);
    expect(el.querySelector('.layer')).toBeNull();
    server.videos = [bgVideo('v1')];
    await tick(60_000);
    expect(videos()).toHaveLength(2);
    expect(videos()[0].getAttribute('src')).toBe(url('v1'));
    server.videos = [];
    await tick(60_000);
    expect(videos(), 'the administrator switched every video off').toHaveLength(0);
  });

  it('the scrim keeps the lyrics readable over a pure white frame: text, muted text and the highlight reach 3:1', () => {
    // a pure white frame under the scrim
    const over = (c: number, base: number) => SCRIM.a * c + (1 - SCRIM.a) * base;
    const bg = [SCRIM.r, SCRIM.g, SCRIM.b].map((c) => over(c, 255));
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (fg: number[]) => (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
    for (const [name, rgb] of [
      ['--text #ffffff', [255, 255, 255]],
      ['--muted #aeb4d8', [0xae, 0xb4, 0xd8]],
      ['--sung #ffd23f', [0xff, 0xd2, 0x3f]],
    ] as const) {
      expect(ratio([...rgb]), name).toBeGreaterThanOrEqual(3);
    }
  });

  it('the layer is hidden from assistive technology, cannot be focused and does not take pointer events', async () => {
    const { el, settle } = setup();
    await settle();
    const layer = el.querySelector<HTMLElement>('.layer')!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelectorAll('[tabindex], button, a, input, select, textarea')).toHaveLength(0);
    expect(getComputedStyle(layer).pointerEvents).toBe('none');
    for (const v of Array.from(el.querySelectorAll('video'))) expect(getComputedStyle(v).pointerEvents).toBe('none');
    expect(el.querySelector<HTMLElement>('.scrim')!.style.background).toContain('rgba(');
  });
});
