import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema, Format, LyricTiming, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { GetBackgroundResponseSchema, PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { ControlAction, PlayStatus, ScoreSchema } from '../../gen/kantahe/v1/session_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { KeyboardShortcuts } from '../core/shortcuts';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { device, song, stateOf, StateInit } from '../queue/testing';
import { BackgroundVideoComponent } from './background/background-video.component';
import { bgVideo, stubMedia } from './background/testing';
import { CAN_SYNTHESIZE, ENGINES } from './engines/engine';
import { MIC_METER } from './mic';
import { NativeControls } from './native-controls';
import { PlayerViewComponent } from './player-view.component';
import { asMic, fakeEngines, FakeMic, fakePlayerServer, playbackOf } from './testing';

const ME = 'me';
const SONG = song('21628', 'Hello', 'Adele', Format.MIDI, false, { lyricTiming: LyricTiming.WORD });
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
    providers: [
      { provide: TRANSPORT, useValue: server.transport },
      { provide: ENGINES, useValue: fake.engines },
      { provide: CAN_SYNTHESIZE, useValue: () => true }, // the test browser has no AudioContext: the engines are fakes
      { provide: MIC_METER, useValue: asMic(new FakeMic()) },
      provideRouter([]),
    ],
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

  it('regression: the toasts of the player are in the flow of the stage under the top bar, not over its buttons, while the view lives', async () => {
    const { el, fixture, settle } = setup();
    await settle();
    const toasts = TestBed.inject(ToastService);
    expect(toasts.inShell()).toBe(true);
    toasts.show('The vocals could not be loaded. The song plays without them.', 'error');
    await settle();
    const host = el.querySelector('main.stage > app-toasts');
    expect(host, 'app-toasts is a child of the stage').not.toBeNull();
    expect(host!.textContent).toContain('The vocals could not be loaded');
    fixture.destroy();
    expect(toasts.inShell()).toBe(false);
  });

  describe('keyboard shortcuts (kantahe-tlf.4.7)', () => {
    const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) => {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(e);
      return e;
    };
    const actions = (server: ReturnType<typeof setup>['server']) => server.calls.control.map((c) => c.action);

    it('REGRESSION: Space and K play or pause, N skips (nothing happened on the keys before)', async () => {
      const { push, server, settle } = setup();
      await push(PLAYING);
      const space = press(' ');
      await settle();
      expect(actions(server)).toEqual([ControlAction.PAUSE]);
      expect(space.defaultPrevented, 'Space must not also scroll the page').toBe(true);
      press('k');
      press('K');
      press('n');
      await settle();
      expect(actions(server)).toEqual([ControlAction.PAUSE, ControlAction.PAUSE, ControlAction.PAUSE, ControlAction.SKIP]);
    });

    it('REGRESSION: while the score screen covers the player no shortcut acts (its controls are inert; N skipped the score away)', async () => {
      const { fixture, server, settle } = setup();
      const s = stateOf(PLAYING);
      s.score = create(ScoreSchema, { number: '21628', hasValue: true, value: 87, comment: 'You are a good singer.', fanfare: 2, untilMs: 9000n });
      server.push(s);
      await settle();
      await vi.advanceTimersByTimeAsync(1500);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.player-content')?.hasAttribute('inert')).toBe(true);
      for (const key of [' ', 'k', 'n', '+', '-', 'v', 'f']) press(key);
      await settle();
      expect(actions(server)).toEqual([]);
    });

    it('a paused song is started by the same key', async () => {
      const { push, server, settle } = setup();
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      press(' ');
      await settle();
      expect(actions(server)).toEqual([ControlAction.PLAY]);
    });

    it('+ and - change the volume of this device, = and _ too (no Shift needed), and a held key repeats', async () => {
      const { push, server, settle } = setup();
      await push(PLAYING);
      press('+');
      press('=', { repeat: true });
      press('-');
      press('_');
      await vi.advanceTimersByTimeAsync(600);
      await settle();
      expect(server.calls.volume.length).toBeGreaterThan(0);
    });

    it('F asks the browser for the full screen, when it can; without that ability it does nothing', async () => {
      const request = vi.fn(() => Promise.resolve());
      const root = document.documentElement as unknown as { requestFullscreen?: () => Promise<void> };
      root.requestFullscreen = request;
      Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
      try {
        const { push } = setup();
        await push(PLAYING);
        press('f');
        expect(request).toHaveBeenCalledTimes(1);
        TestBed.resetTestingModule();
        Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
        const without = setup();
        await without.push(PLAYING);
        press('f');
        expect(request).toHaveBeenCalledTimes(1);
      } finally {
        delete root.requestFullscreen;
        Object.defineProperty(document, 'fullscreenEnabled', { value: undefined, configurable: true });
      }
    });

    it('V asks the server to turn the guide vocals of this device on and off, for a song that has them, and does nothing for one that has not; nothing new is shown', async () => {
      const { el, push, server, settle } = setup();
      const MP3_SONG = song('21628', 'Hello', 'Adele', Format.MP3, false, { lyricTiming: LyricTiming.LINE, hasVocals: true });
      server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO, audioUrl: '/media/song/21628?sig=a', vocalsUrl: '/media/vocals/21628?sig=v', song: MP3_SONG });
      const mine = (on: boolean) => [device(ME, 'This browser', { isCaller: true, vocalsOn: on, vocalsPct: 60 }), device('tv', 'Living room TV')];
      await push({ ...PLAYING, devices: mine(false), now: { song: MP3_SONG, positionMs: 0, positionAtMs: 1000 } });
      const shown = el.textContent;
      press('v');
      await settle();
      expect(server.calls.vocals.map((r) => [r.deviceId, r.on])).toEqual([[ME, true]]);
      await push({ ...PLAYING, devices: mine(true), now: { song: MP3_SONG, positionMs: 0, positionAtMs: 1000 } });
      press('v');
      await settle();
      expect(server.calls.vocals.map((r) => r.on)).toEqual([true, false]);
      expect(el.textContent).toBe(shown);
      // a song without vocals: the key does nothing
      server.handlers.playback = () => playbackOf({ kind: PlaybackKind.AUDIO, audioUrl: '/media/song/21629?sig=a', song: song('21629', 'Plain', 'Adele', Format.MP3) });
      await push({ ...PLAYING, devices: mine(false), now: { song: song('21629', 'Plain', 'Adele', Format.MP3), positionMs: 0, positionAtMs: 1000 } });
      press('v');
      await settle();
      expect(server.calls.vocals).toHaveLength(2);
    });

    it('REGRESSION: typing in a field sends nothing, and neither do Ctrl, Alt or Meta with a key', async () => {
      const { push, server, settle } = setup();
      await push(PLAYING);
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      press('n', {}, input);
      press(' ', {}, input);
      press('n', { ctrlKey: true });
      press('n', { altKey: true });
      press('n', { metaKey: true });
      await settle();
      expect(actions(server)).toEqual([]);
      input.remove();
    });

    it('Space on a focused button presses that button only (it was a double action)', async () => {
      const { push, server, settle, button } = setup();
      await push(PLAYING);
      press(' ', {}, button('Skip')!);
      await settle();
      expect(actions(server)).toEqual([]);
    });

    it('does nothing when the shortcuts are turned off, inside the app (embedded), or on a device that is not the player', async () => {
      const { fixture, push, server, settle } = setup();
      await push({ ...PLAYING, player: 'tv' });
      press('n');
      expect(actions(server)).toEqual([]);
      await push(PLAYING);
      TestBed.inject(KeyboardShortcuts).setEnabled(false);
      press('n');
      expect(actions(server)).toEqual([]);
      TestBed.inject(KeyboardShortcuts).setEnabled(true);
      fixture.componentRef.setInput('embedded', true);
      await settle();
      press('n');
      await settle();
      expect(actions(server)).toEqual([]);
    });
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
    expect(el.querySelector('.timing-badge')?.textContent).toBe('W');
    expect(el.querySelector('.vocals-badge')).toBeNull();
    expect(el.querySelector('app-lyrics-view')).not.toBeNull();
    expect(el.querySelector('progress')).toBeNull(); // the length is not known for this fake song
  });

  it('regression: inside the app (embedded) the page has no Pause, Play or Skip of its own: the app has native ones', async () => {
    const { fixture, el, push, button } = setup();
    fixture.componentRef.setInput('embedded', true);
    await push(PLAYING);
    expect(el.textContent).toContain('Hello'); // the song and the lyrics are still there
    expect(el.querySelector('app-lyrics-view')).not.toBeNull();
    expect(button('Pause')).toBeUndefined();
    expect(button('Play')).toBeUndefined();
    expect(button('Skip')).toBeUndefined();
  });

  describe('room for the app\'s buttons', () => {
    const MP3_STATE: StateInit = { ...PLAYING, now: { song: song('21628', 'Hello', 'Adele', Format.MP3), positionMs: 0, positionAtMs: 1000 } };
    const stageStyle = (el: HTMLElement) => (el.querySelector('main.stage') as HTMLElement).style.getPropertyValue('--native-controls');

    it('embedded_view_gets_the_height: the page keeps the room the app says its buttons take', async () => {
      const { fixture, el, push, settle } = setup();
      fixture.componentRef.setInput('embedded', true);
      await push(MP3_STATE);
      TestBed.inject(NativeControls).height.set(220);
      await settle();
      expect(stageStyle(el)).toBe('220px');
      TestBed.inject(NativeControls).height.set(330);
      await settle();
      expect(stageStyle(el)).toBe('330px');
    });

    it('not_embedded_view_has_no_height: the page\'s own buttons need no room', async () => {
      const { el, push, settle } = setup();
      await push(MP3_STATE);
      TestBed.inject(NativeControls).height.set(220);
      await settle();
      expect(stageStyle(el)).toBe('');
    });
  });

  describe('no adjustments on the player (kantahe-der: they are made on the Queue page)', () => {
    const MP3_SONG = song('21628', 'Hello', 'Adele', Format.MP3, false, { lyricTiming: LyricTiming.LINE, hasVocals: true });
    const withVocals = () => playbackOf({ kind: PlaybackKind.AUDIO, audioUrl: '/media/song/21628?sig=a', vocalsUrl: '/media/vocals/21628?sig=v', song: MP3_SONG });
    const labels = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    const withState = (on: boolean): StateInit => ({
      ...PLAYING,
      devices: [device(ME, 'This browser', { isCaller: true, vocalsOn: on, vocalsPct: 60, mp3VolumePct: 80 }), device('tv', 'Living room TV')],
      now: { song: MP3_SONG, positionMs: 0, positionAtMs: 1000 },
    });

    it('player_has_no_volume_or_vocals_buttons: a vocals song, vocals off and on, a MIDI song: Pause, Skip and the top bar only, and no level text', async () => {
      const { el, server, push } = setup();
      server.handlers.playback = withVocals;
      for (const init of [withState(false), withState(true), PLAYING]) {
        await push(init);
        expect(labels(el).filter((l) => /volume|vocals|louder|quieter|tempo|slower|faster/i.test(l ?? ''))).toEqual([]);
        expect(Array.from(el.querySelectorAll('.controls button')).map((b) => b.textContent?.trim())).toEqual(['Pause', 'Skip']);
        expect(el.querySelector('.vocals, .level')).toBeNull();
        expect(el.querySelector('.controls [role="status"]')).toBeNull();
        expect(el.querySelector('.controls')?.textContent).not.toMatch(/volume|vocals|tempo|%/i);
      }
    });

    it('a device that is not the player shows Play here and nothing else', async () => {
      const { el, server, push } = setup();
      server.handlers.playback = withVocals;
      await push({ ...withState(false), player: 'tv' });
      expect(labels(el)).not.toContain('Skip');
      expect(el.textContent).not.toMatch(/volume|vocals/i);
    });

    it('embedded: nothing either, the app has its own buttons', async () => {
      const { fixture, el, server, push } = setup();
      fixture.componentRef.setInput('embedded', true);
      server.handlers.playback = withVocals;
      await push(withState(true));
      expect(el.querySelector('.vocals, .level, .controls')).toBeNull();
      expect(el.textContent).not.toMatch(/volume|vocals/i);
    });

    it('REGRESSION tempo_change_is_silent_on_the_player: no tempo button, no key, no text, no message, and faded controls stay faded', async () => {
      const { el, server, push, settle } = setup();
      server.handlers.playback = withVocals;
      const at = (tempoPct: number): StateInit => ({ ...withState(false), now: { song: MP3_SONG, positionMs: 0, positionAtMs: 1000, tempoPct } });
      await push(at(100));
      await vi.advanceTimersByTimeAsync(3500);
      await settle();
      const stage = () => el.querySelector('main.stage') as HTMLElement;
      expect(stage().classList.contains('idle')).toBe(true);
      const toasts = TestBed.inject(ToastService).toasts().length;
      const before = el.textContent;
      await push(at(80));
      await push(at(125));
      expect(stage().classList.contains('idle')).toBe(true);
      expect(TestBed.inject(ToastService).toasts().length).toBe(toasts);
      expect(el.textContent).toBe(before);
      expect(el.textContent).not.toMatch(/tempo|slower|faster|speed/i);
      // no key changes the tempo either
      for (const key of ['[', ']', 't', '<', '>']) document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await settle();
      expect(server.calls.control).toEqual([]);
    });

    it('REGRESSION remote_change_is_silent: while the buttons are faded, a change of volume or vocals from another device shows and wakes nothing', async () => {
      const { el, server, push, settle } = setup();
      server.handlers.playback = withVocals;
      await push(withState(false));
      await vi.advanceTimersByTimeAsync(3500);
      await settle();
      const stage = () => el.querySelector('main.stage') as HTMLElement;
      expect(stage().classList.contains('idle')).toBe(true);
      const toasts = TestBed.inject(ToastService).toasts().length;
      const before = el.textContent;
      await push(withState(true));
      await push({ ...withState(true), devices: [device(ME, 'This browser', { isCaller: true, vocalsOn: true, vocalsPct: 30, mp3VolumePct: 120 }), device('tv', 'Living room TV')] });
      expect(stage().classList.contains('idle')).toBe(true);
      expect(TestBed.inject(ToastService).toasts().length).toBe(toasts);
      expect(el.textContent).toBe(before);
    });
  });

  describe('full screen', () => {
    const doc = document as Document & { fullscreenEnabled: boolean; fullscreenElement: Element | null };
    let request: ReturnType<typeof vi.fn>;
    let exit: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      request = vi.fn().mockResolvedValue(undefined);
      exit = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => true });
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null, writable: true });
      document.documentElement.requestFullscreen = request as never;
      document.exitFullscreen = exit as never;
    });
    afterEach(() => {
      delete (document as unknown as Record<string, unknown>)['fullscreenEnabled'];
      delete (document as unknown as Record<string, unknown>)['fullscreenElement'];
    });

    it('a Full screen button fills the whole screen with the player', async () => {
      const { push, button } = setup();
      await push(PLAYING);
      button('Full screen')!.click();
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('in full screen the button leaves it again, and says so', async () => {
      const { push, button, fixture } = setup();
      await push(PLAYING);
      doc.fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
      fixture.detectChanges();
      button('Exit full screen')!.click();
      expect(exit).toHaveBeenCalledTimes(1);
    });

    it('is also offered on a device that is not the player (the screen still fills)', async () => {
      const { push, button } = setup();
      await push({ ...PLAYING, player: 'tv' });
      expect(button('Full screen')).toBeDefined();
    });

    it('inside the app there is none: the app is full screen already', async () => {
      const { fixture, push, button } = setup();
      fixture.componentRef.setInput('embedded', true);
      await push(PLAYING);
      expect(button('Full screen')).toBeUndefined();
    });

    it('a browser without full screen has no button', async () => {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => false });
      const { push, button } = setup();
      await push(PLAYING);
      expect(button('Full screen')).toBeUndefined();
    });
  });

  describe('buttons that get out of the way', () => {
    const chrome = (el: HTMLElement) => el.querySelector('main.stage')!.classList.contains('idle');

    it('while a song plays, the buttons fade after 3 seconds without a touch, a move or a key', async () => {
      const { el, push, settle } = setup();
      await push(PLAYING);
      expect(chrome(el)).toBe(false);
      await settle(3100);
      expect(chrome(el)).toBe(true);
    });

    it('moving the mouse, touching or pressing a key brings them back', async () => {
      const { el, push, settle, fixture } = setup();
      await push(PLAYING);
      await settle(3100);
      for (const ev of [new MouseEvent('mousemove', { bubbles: true }), new Event('touchstart', { bubbles: true }), new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })]) {
        await settle(3100);
        expect(chrome(el)).toBe(true);
        el.querySelector('main.stage')!.dispatchEvent(ev);
        fixture.detectChanges();
        expect(chrome(el), ev.type).toBe(false);
      }
    });

    it('regression: a keyboard user who rests on a button keeps the buttons (they faded under the focus ring and the focus was lost from sight)', async () => {
      const { el, push, settle, button } = setup();
      document.body.append(el);
      await push(PLAYING);
      button('Skip')!.focus();
      el.querySelector('main.stage')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      await settle(3100);
      expect(chrome(el)).toBe(false);
      await settle(3100);
      expect(chrome(el)).toBe(false);
      (document.activeElement as HTMLElement).blur();
      await settle(3100);
      expect(chrome(el)).toBe(true);
      el.remove();
    });

    it('a click leaves the focus on its button but the buttons still fade', async () => {
      const { el, push, settle, button } = setup();
      document.body.append(el);
      await push(PLAYING);
      button('Skip')!.focus();
      el.querySelector('main.stage')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await settle(3100);
      expect(chrome(el)).toBe(true);
      (document.activeElement as HTMLElement).blur();
      el.remove();
    });

    it('while paused they stay', async () => {
      const { el, push, settle } = setup();
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      await settle(5000);
      expect(chrome(el)).toBe(false);
    });

    it('inside the app nothing fades: the app has its own buttons', async () => {
      const { el, push, settle, fixture } = setup();
      fixture.componentRef.setInput('embedded', true);
      await push(PLAYING);
      await settle(5000);
      expect(chrome(el)).toBe(false);
    });
  });

  describe('the top bar on a phone', () => {
    it('regression: its buttons stay on one line each, so the bar is 44 px high and does not cover the song (two-line buttons made it 66 px at 390 px)', async () => {
      const { push } = setup();
      await push(PLAYING);
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
      expect(css).toMatch(/\.topbar[^{]*button[^{]*\{[^}]*white-space:\s*nowrap/);
      expect(css).toMatch(/\.topbar[^{]*button[^{]*\{[^}]*padding:\s*[^;]*0\.75rem/);
    });
  });

  describe('the progress bar', () => {
    it('regression: is centered under the time, not left in the flex column (it has a fixed width, so it sat at the left edge)', async () => {
      const { push } = setup();
      await push(PLAYING);
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
      expect(css).toMatch(/progress[^{]*\{[^}]*align-self:\s*center/);
    });

    it('REGRESSION (kantahe-ie6): draws its own dark track and accent fill, so an old WebView (Chromium 74, no color-scheme) shows no white bar', async () => {
      const { push } = setup();
      await push(PLAYING);
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
      expect(css).toMatch(/progress[^{]*\{[^}]*(-webkit-)?appearance:\s*none/);
      // without its native look the bar has no height of its own in the flex column: a full screen of lyrics squeezed it to nothing
      expect(css).toMatch(/progress[^{]*\{[^}]*flex-shrink:\s*0/);
      expect(css).toMatch(/progress[^{]*::-webkit-progress-bar[^{]*\{[^}]*background/);
      expect(css).toMatch(/progress[^{]*::-webkit-progress-value[^{]*\{[^}]*background:\s*var\(--fill\)/);
    });
  });

  describe('leaving the player page', () => {
    it('regression: while this device plays, leaving the page pauses the session (nothing makes sound any more)', async () => {
      const { fixture, push, server, settle } = setup();
      await push(PLAYING);
      fixture.destroy();
      await settle();
      expect(server.calls.control.map((c) => c.action)).toEqual([ControlAction.PAUSE]);
    });

    it('while paused, leaving sends nothing', async () => {
      const { fixture, push, server, settle } = setup();
      await push({ ...PLAYING, status: PlayStatus.PAUSED });
      fixture.destroy();
      await settle();
      expect(server.calls.control).toEqual([]);
    });

    it('on a device that is not the player, leaving sends nothing (another device plays)', async () => {
      const { fixture, push, server, settle } = setup();
      await push({ ...PLAYING, player: 'tv' });
      fixture.destroy();
      await settle();
      expect(server.calls.control).toEqual([]);
    });

    it('inside the app (embedded) the page does not pause when it goes: the app decides', async () => {
      const { fixture, push, server, settle } = setup();
      fixture.componentRef.setInput('embedded', true);
      await push(PLAYING);
      fixture.destroy();
      await settle();
      expect(server.calls.control).toEqual([]);
    });

    it('nothing is sent before the first state arrives', async () => {
      const { fixture, server, settle } = setup();
      await settle();
      fixture.destroy();
      await settle();
      expect(server.calls.control).toEqual([]);
    });
  });

  describe('back to Kantahe', () => {
    it('a Back to Kantahe button leaves the player for the library', async () => {
      const { push, button } = setup();
      await push(PLAYING);
      const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      button('Back to Kantahe')!.click();
      expect(nav).toHaveBeenCalledWith('/library');
    });

    it('an administrator also gets straight to the admin pages', async () => {
      const { push, button, fixture } = setup();
      TestBed.inject(AuthStore).setUser(create(UserSchema, { admin: true }));
      await push(PLAYING);
      fixture.detectChanges();
      const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      button('Admin')!.click();
      expect(nav).toHaveBeenCalledWith('/admin');
    });

    it('others have no Admin button', async () => {
      const { push, button } = setup();
      await push(PLAYING);
      expect(button('Admin')).toBeUndefined();
    });

    it('inside the app there is none: the app has its own Close', async () => {
      const { fixture, push, button } = setup();
      fixture.componentRef.setInput('embedded', true);
      await push(PLAYING);
      expect(button('Back to Kantahe')).toBeUndefined();
    });

    it('is there on a device that is not the player too', async () => {
      const { push, button } = setup();
      await push({ ...PLAYING, player: 'tv' });
      expect(button('Back to Kantahe')).toBeDefined();
    });
  });

  it('the stage fills the window: it is a column as tall as the screen with the lyrics growing in the middle', async () => {
    const { el, push } = setup();
    await push(PLAYING);
    expect(el.querySelector('main.stage')!.classList.contains('fill')).toBe(true);
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

  it('regression: there is one h1 in every state (nothing playing, another device, no device, a song here)', async () => {
    const { el, push, settle } = setup();
    await settle();
    expect(el.querySelectorAll('h1'), 'connecting').toHaveLength(1);
    for (const init of [{ ...PLAYING, player: 'tv' }, { ...PLAYING, player: '', status: PlayStatus.PAUSED }, PLAYING]) {
      await push(init);
      expect(el.querySelectorAll('h1'), JSON.stringify({ player: init.player })).toHaveLength(1);
    }
  });

  it('every control has a text label', async () => {
    const { el, push } = setup();
    await push(PLAYING);
    for (const b of Array.from(el.querySelectorAll('button'))) expect((b.textContent ?? '').trim() || b.getAttribute('aria-label')).toBeTruthy();
  });
  describe('background video', () => {
    const WITH_VIDEO: StateInit = {
      ...PLAYING,
      devices: [device(ME, 'This browser', { isCaller: true, effectiveBackground: true }), device('tv', 'Living room TV')],
    };
    const give = (server: ReturnType<typeof fakePlayerServer>) =>
      (server.handlers.background = () => create(GetBackgroundResponseSchema, { enabled: true, videos: [bgVideo('v1'), bgVideo('v2')] }));
    const input = (fixture: ReturnType<typeof setup>['fixture']) =>
      fixture.debugElement.query(By.directive(BackgroundVideoComponent)).componentInstance as BackgroundVideoComponent;

    it('the player device that shows the background has two video elements behind the lyrics, and asks for the list once', async () => {
      stubMedia();
      const { el, server, push } = setup();
      give(server);
      await push(WITH_VIDEO);
      expect(server.calls.background).toBe(1);
      expect(el.querySelectorAll('app-background-video video')).toHaveLength(2);
      expect(el.querySelector('app-lyrics-view')).not.toBeNull();
    });

    it('inside the app (embedded) the same layer is used', async () => {
      stubMedia();
      const { fixture, el, server, push } = setup();
      fixture.componentRef.setInput('embedded', true);
      give(server);
      await push(WITH_VIDEO);
      expect(el.querySelectorAll('app-background-video video')).toHaveLength(2);
    });

    it('a device whose background is off makes no request and has no video element', async () => {
      stubMedia();
      const { el, server, push } = setup();
      give(server);
      await push(PLAYING);
      expect(server.calls.background).toBe(0);
      expect(el.querySelector('video')).toBeNull();
    });

    it('a device that is only a remote shows no video, whatever its setting', async () => {
      stubMedia();
      const { el, server, push } = setup();
      give(server);
      await push({ ...WITH_VIDEO, player: 'tv' });
      expect(el.querySelector('.elsewhere')).not.toBeNull();
      expect(el.querySelector('video')).toBeNull();
    });

    it('moves while a song plays and stops while it is paused; the idle screen and the score screen move', async () => {
      stubMedia();
      const { fixture, server, push } = setup();
      give(server);
      await push(WITH_VIDEO);
      expect(input(fixture).playing()).toBe(true);
      await push({ ...WITH_VIDEO, status: PlayStatus.PAUSED });
      expect(input(fixture).playing(), 'paused with a song').toBe(false);
      await push({ ...WITH_VIDEO, status: PlayStatus.PAUSED, now: undefined });
      expect(input(fixture).playing(), 'nothing is playing: the idle screen').toBe(true);
      await push({ ...WITH_VIDEO, status: PlayStatus.PAUSED, score: { number: SONG.number, value: 85 } });
      expect(input(fixture).playing(), 'the score screen').toBe(true);
    });

    it('does not get in the way: the layer is fixed behind everything, takes no pointer events, and the buttons still work', async () => {
      stubMedia();
      const { el, server, push, button } = setup();
      give(server);
      await push(WITH_VIDEO);
      const layer = el.querySelector<HTMLElement>('app-background-video .layer')!;
      expect(getComputedStyle(layer).pointerEvents).toBe('none');
      expect(getComputedStyle(layer).position).toBe('fixed');
      expect(getComputedStyle(layer).zIndex).toBe('-1');
      expect(getComputedStyle(el.querySelector('main.stage')!).isolation).toBe('isolate');
      expect(el.querySelectorAll('app-background-video [tabindex], app-background-video button')).toHaveLength(0);
      button('Pause')!.click();
      await vi.advanceTimersByTimeAsync(30);
      expect(server.calls.control.at(-1)?.action).toBe(ControlAction.PAUSE);
    });
  });
});
