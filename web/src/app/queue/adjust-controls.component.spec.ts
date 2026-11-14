import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthTokenSchema, VocalsState } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { AdjustControlsComponent } from './adjust-controls.component';
import { device, fakeSession, Format, PlayStatus, song, stateOf, StateInit } from './testing';

// The volume and the guide vocals of the device that plays, adjusted from the Queue page of any device (kantahe-der). The player itself has no such buttons.

const ME = 'dev-me';
const MP3 = song('01052', 'Hello', 'Adele', Format.MP3, false, { hasVocals: true });
const PLAIN_MP3 = song('01053', 'Plain', 'Adele', Format.MP3);
const MIDI = song('01054', 'Skyfall', 'Adele', Format.MIDI);

/** The state of a TV that plays; this device (ME) is a phone. */
const tempoOf = (init: StateInit, tempoPct: number): StateInit => ({ ...init, now: { ...init.now!, tempoPct } });
const tv = (over: Parameters<typeof device>[2] = {}) =>
  device('tv', 'Living room TV', { mp3VolumePct: 100, midiVolumePct: 100, vocalsOn: false, vocalsPct: 60, vocalsState: VocalsState.OFF, ...over });
const playing = (s = MP3, tvOver: Parameters<typeof device>[2] = {}): StateInit => ({
  status: PlayStatus.PLAYING,
  player: 'tv',
  devices: [device(ME, 'Phone', { isCaller: true }), tv(tvOver)],
  now: { song: s, positionMs: 0, positionAtMs: 1000 },
  serverTimeMs: 1000,
});

async function setup(initial: StateInit = playing()) {
  const server = fakeSession();
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: ME }));
  const store = TestBed.inject(StateStore);
  TestBed.tick();
  server.push(stateOf(initial));
  const fixture = TestBed.createComponent(AdjustControlsComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  await settle(10);
  const push = async (i: StateInit) => {
    server.push(stateOf(i));
    await settle(10);
  };
  const button = (name: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  const all = () => Array.from(el.querySelectorAll('[role="status"]')).map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
  /** The levels of the volume and the vocals; the tempo has its own checks. */
  const status = () => all().filter((t) => !t?.startsWith('Tempo'));
  return { fixture, el, server, store, settle, push, button, status, all, toasts: TestBed.inject(ToastService) };
}

describe('AdjustControlsComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('shows_volume_for_the_song_kind: an MP3 song says MP3 volume, a MIDI song MIDI volume', async () => {
    const mp3 = await setup(playing(PLAIN_MP3, { mp3VolumePct: 60, midiVolumePct: 120 }));
    expect(mp3.status()).toEqual(['MP3 volume 60%']);
    TestBed.resetTestingModule();
    const midi = await setup(playing(MIDI, { mp3VolumePct: 60, midiVolumePct: 120 }));
    expect(midi.status()).toEqual(['MIDI volume 120%']);
  });

  it('volume_up_sends_SetVolume_for_the_player: the playing device, not this one; a pause after the last press, the last value', async () => {
    const { server, button, settle, status } = await setup(playing(PLAIN_MP3));
    button('Volume up')!.click();
    button('Volume up')!.click();
    button('Volume down')!.click();
    await settle(0);
    expect(status()).toEqual(['MP3 volume 105%']); // shown at once
    expect(server.calls.volume).toEqual([]);
    await settle(400);
    expect(server.calls.volume.map((r) => [r.deviceId, r.mp3Pct, r.midiPct])).toEqual([['tv', 105, undefined]]);
  });

  it('a MIDI song sends midi_pct, and the level stops at 0 and 200', async () => {
    const { server, button, settle, status } = await setup(playing(MIDI, { midiVolumePct: 195 }));
    for (let i = 0; i < 4; i++) button('Volume up')!.click();
    await settle(400);
    expect(status()).toEqual(['MIDI volume 200%']);
    expect(server.calls.volume.map((r) => [r.deviceId, r.midiPct, r.mp3Pct])).toEqual([['tv', 200, undefined]]);
  });

  it('when this device is the player the buttons act on this device', async () => {
    const init: StateInit = { ...playing(PLAIN_MP3), player: ME, devices: [device(ME, 'Phone', { isCaller: true, mp3VolumePct: 100 }), tv()] };
    const { server, button, settle } = await setup(init);
    button('Volume down')!.click();
    await settle(400);
    expect(server.calls.volume.map((r) => [r.deviceId, r.mp3Pct])).toEqual([[ME, 95]]);
  });

  it('nothing_without_a_player: no device plays, or no song is current, or this device is not listed', async () => {
    const none = await setup({ ...playing(), player: '' });
    expect(none.el.querySelector('button')).toBeNull();
    TestBed.resetTestingModule();
    const noSong = await setup({ ...playing(), now: undefined });
    expect(noSong.el.querySelector('button')).toBeNull();
  });

  it('vocals_controls_only_for_vocals_songs: a song without a vocals track, a MIDI song: volume only', async () => {
    const plain = await setup(playing(PLAIN_MP3));
    expect(plain.button('Vocals: off')).toBeUndefined();
    expect(plain.el.textContent).not.toMatch(/vocals/i);
    TestBed.resetTestingModule();
    const midi = await setup(playing(song('01054', 'Skyfall', 'Adele', Format.MIDI, false, { hasVocals: true })));
    expect(midi.el.textContent).not.toMatch(/vocals/i);
  });

  it('a server that does not keep the vocals choice (no vocals_on in the device) shows no vocals controls', async () => {
    const init: StateInit = { ...playing(), devices: [device(ME, 'Phone', { isCaller: true }), device('tv', 'TV', { mp3VolumePct: 100 })] };
    const { el, button } = await setup(init);
    expect(button('Volume up')).toBeDefined();
    expect(el.textContent).not.toMatch(/vocals/i);
  });

  it('vocals_button_shows_reported_state: off, loading…, on (aria-pressed), and the level only while they are not off', async () => {
    const { button, push, status, el } = await setup(playing(MP3, { vocalsState: VocalsState.OFF }));
    expect(button('Vocals: off')?.getAttribute('aria-pressed')).toBe('false');
    expect(button('Vocals quieter')).toBeUndefined();
    await push(playing(MP3, { vocalsOn: true, vocalsState: VocalsState.LOADING }));
    expect(button('Vocals: loading…')?.getAttribute('aria-pressed')).toBe('true');
    await push(playing(MP3, { vocalsOn: true, vocalsState: VocalsState.ON, vocalsPct: 40 }));
    expect(button('Vocals: on')?.getAttribute('aria-pressed')).toBe('true');
    expect(status()).toContain('Vocals volume 40%');
    expect(el.textContent).toContain('Vocals quieter');
    // the guide plays by itself although the choice is off: the button tells the truth
    await push(playing(MP3, { vocalsOn: false, vocalsState: VocalsState.ON }));
    expect(button('Vocals: on')).toBeDefined();
  });

  it('a player that has not reported yet is shown by the choice', async () => {
    const { button, push } = await setup(playing(MP3, { vocalsOn: true, vocalsState: VocalsState.UNSPECIFIED }));
    expect(button('Vocals: on')).toBeDefined();
    await push(playing(MP3, { vocalsOn: false, vocalsState: VocalsState.UNSPECIFIED }));
    expect(button('Vocals: off')).toBeDefined();
  });

  it('the vocals button sends SetVocals for the player: on when it reads off, off when it reads on or loading', async () => {
    const { server, button, push, settle } = await setup(playing(MP3, { vocalsState: VocalsState.OFF }));
    button('Vocals: off')!.click();
    await settle(10);
    await push(playing(MP3, { vocalsOn: false, vocalsState: VocalsState.ON })); // the guide plays by itself
    button('Vocals: on')!.click();
    await settle(10);
    expect(server.calls.vocals.map((r) => [r.deviceId, r.on, r.pct])).toEqual([['tv', true, undefined], ['tv', false, undefined]]);
  });

  it('the vocals level moves by 10, 0 to 100, with a pause before it is sent', async () => {
    const { server, button, settle, status } = await setup(playing(MP3, { vocalsOn: true, vocalsState: VocalsState.ON, vocalsPct: 60 }));
    button('Vocals quieter')!.click();
    button('Vocals quieter')!.click();
    await settle(0);
    expect(status()).toContain('Vocals volume 40%');
    expect(server.calls.vocals).toEqual([]);
    await settle(400);
    expect(server.calls.vocals.map((r) => [r.deviceId, r.on, r.pct])).toEqual([['tv', undefined, 40]]);
    for (let i = 0; i < 12; i++) button('Vocals louder')!.click();
    await settle(400);
    expect(status()).toContain('Vocals volume 100%');
    for (let i = 0; i < 12; i++) button('Vocals quieter')!.click();
    await settle(400);
    expect(status()).toContain('Vocals volume 0%');
  });

  it('a refused change shows an error and puts the old level back', async () => {
    const { server, button, settle, status, toasts } = await setup(playing(PLAIN_MP3, { mp3VolumePct: 100 }));
    server.failAdjust(() => new ConnectError('no', Code.Internal));
    button('Volume up')!.click();
    await settle(400);
    expect(toasts.toasts().some((t) => t.kind === 'error')).toBe(true);
    expect(status()).toEqual(['MP3 volume 100%']);
  });

  it('the state is the truth after a change: another device moving the level shows here', async () => {
    const { button, settle, push, status } = await setup(playing(PLAIN_MP3, { mp3VolumePct: 100 }));
    button('Volume up')!.click();
    await settle(400);
    await push(playing(PLAIN_MP3, { mp3VolumePct: 105 }));
    await push(playing(PLAIN_MP3, { mp3VolumePct: 80 }));
    expect(status()).toEqual(['MP3 volume 80%']);
  });

  it('the buttons are real buttons with names, and the level is announced politely', async () => {
    const { el, all } = await setup(playing(MP3, { vocalsOn: true, vocalsState: VocalsState.ON }));
    for (const b of Array.from(el.querySelectorAll('button'))) {
      expect(b.type).toBe('button');
      expect(b.textContent?.trim()).toBeTruthy();
    }
    expect(el.querySelectorAll('[role="status"][aria-live="polite"]').length).toBe(all().length);
  });

  describe('tempo', () => {
    it('shows the tempo and a Slower and a Faster button; Normal speed only while the tempo is not 100', async () => {
      const { button, all, push } = await setup(playing(PLAIN_MP3));
      expect(all()).toContain('Tempo 100%');
      expect(button('Slower')).toBeDefined();
      expect(button('Faster')).toBeDefined();
      expect(button('Normal speed')).toBeUndefined(); // normal_speed_only_when_not_100
      await push(tempoOf(playing(PLAIN_MP3), 85));
      expect(all()).toContain('Tempo 85%');
      expect(button('Normal speed')).toBeDefined();
    });

    it('slower_sends_SetTempo_95 and faster_sends_105, once after a pause with the last value', async () => {
      const { server, button, settle, all } = await setup(playing(PLAIN_MP3));
      button('Slower')!.click();
      await settle(0);
      expect(all()).toContain('Tempo 95%'); // shown at once
      expect(server.calls.tempo).toEqual([]);
      await settle(400);
      expect(server.calls.tempo.map((r) => r.pct)).toEqual([95]);
      button('Faster')!.click();
      button('Faster')!.click();
      await settle(400);
      expect(server.calls.tempo.map((r) => r.pct)).toEqual([95, 105]);
    });

    it('faster_disabled_at_125 and slower_disabled_at_75', async () => {
      const top = await setup(tempoOf(playing(PLAIN_MP3), 125));
      expect((top.button('Faster') as HTMLButtonElement).disabled).toBe(true);
      expect((top.button('Slower') as HTMLButtonElement).disabled).toBe(false);
      TestBed.resetTestingModule();
      const bottom = await setup(tempoOf(playing(PLAIN_MP3), 75));
      expect((bottom.button('Slower') as HTMLButtonElement).disabled).toBe(true);
      expect((bottom.button('Faster') as HTMLButtonElement).disabled).toBe(false);
    });

    it('Normal speed sends 100', async () => {
      const { server, button, settle } = await setup(tempoOf(playing(PLAIN_MP3), 80));
      button('Normal speed')!.click();
      await settle(400);
      expect(server.calls.tempo.map((r) => r.pct)).toEqual([100]);
    });

    it('an older server (its state has no tempo_pct) has no tempo controls: SetTempo would not exist there', async () => {
      const { el, button, all } = await setup(tempoOf(playing(PLAIN_MP3), 0));
      expect(all().some((t) => t?.startsWith('Tempo'))).toBe(false);
      expect(button('Slower')).toBeUndefined();
      expect(el.textContent).not.toMatch(/tempo/i);
      expect(button('Volume up')).toBeDefined();
    });

    it('a refused change shows an error and the old tempo comes back', async () => {
      const { server, button, settle, all, toasts } = await setup(playing(PLAIN_MP3));
      server.failAdjust(() => new ConnectError('no', Code.Internal));
      button('Faster')!.click();
      await settle(400);
      expect(toasts.toasts().some((t) => t.kind === 'error')).toBe(true);
      expect(all()).toContain('Tempo 100%');
    });
  });
});
