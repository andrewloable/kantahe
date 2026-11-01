import { computed, effect, inject, Injectable, OnDestroy, signal, untracked } from '@angular/core';
import { CatalogService, Playback, PlaybackKind } from '../../gen/kantahe/v1/catalog_pb';
import { Format, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { ControlAction, PlayStatus, ScoreMode, SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { deviceMemoryMb } from './device-report';
import { DropoutMonitor } from './dropouts';
import { CAN_PLAY_FLAC, CAN_SYNTHESIZE, Engine, ENGINES, MidiOptions } from './engines/engine';
import { MIC_METER } from './mic';

const REPORT_POSITION_MS = 1000;
const MIN_RETRY_MS = 500;
const ERROR_RETRY_MS = 2000;
const SKIP_AFTER_ERROR_MS = 3000;
/** After this many songs in a row that will not load, the player stops skipping them. */
const MAX_AUTO_SKIPS = 3;
const LOW_POWER: MidiOptions = { sampleRate: 22050, voiceCap: 32, effects: false };
const FULL_POWER: MidiOptions = { effects: true };

export type PlayerPhase = 'idle' | 'preparing' | 'loading' | 'ready' | 'error';

/**
 * The player: while this device is the user's player it loads the current song, plays it with the
 * right engine, follows play/pause from the state and reports position, end, memory, dropouts and
 * microphone to the server. Provide it where it is used (one per player page).
 */
/** Shown when a MIDI song reaches a page that cannot run the synthesizer and the server has no rendered audio for it. */
const NO_SYNTH = 'This page cannot play MIDI songs: they need HTTPS, or a server that renders audio.';

@Injectable()
export class PlayerController implements OnDestroy {
  private readonly store = inject(StateStore);
  private readonly auth = inject(AuthStore);
  private readonly engines = inject(ENGINES);
  private readonly canPlayFlac = inject(CAN_PLAY_FLAC);
  private readonly canSynthesize = inject(CAN_SYNTHESIZE);
  private readonly mic = inject(MIC_METER);
  private readonly toast = inject(ToastService);
  private readonly catalog = injectClient(CatalogService);
  private readonly session = injectClient(SessionService);

  readonly state = this.store.state;
  readonly phase = signal<PlayerPhase>('idle');
  readonly playback = signal<Playback | undefined>(undefined);
  readonly error = signal('');
  /** The browser would not start sound by itself; a tap (unlock) does. */
  readonly needsGesture = signal(false);
  /** The playback position for the lyrics, in ms. */
  readonly timeMs = signal(0);

  readonly lyrics = computed(() => this.playback()?.lyrics);
  readonly isPlayer = computed(() => {
    const id = this.auth.deviceId();
    return !!id && this.state()?.playerDeviceId === id;
  });
  readonly playing = computed(() => this.state()?.status === PlayStatus.PLAYING);
  readonly playerName = computed(() => {
    const id = this.state()?.playerDeviceId;
    return this.state()?.devices.find((d) => d.id === id)?.name ?? '';
  });

  private engine?: Engine;
  private number?: string;
  private generation = 0;
  private readonly loaded = signal(false);
  private wantPlay = false;
  private finishedNow?: unknown;
  /** The song that just ended, while the server shows its score screen with that song still as the current one. */
  private finishedNumber?: string;
  private failures = 0;
  private micOn = false;
  private dropoutReported = false;
  private deviceReported = false;
  private micAsked = false;
  private capableReported = false;
  /** The song for which this device was already switched to the synthesizer (once per song). */
  private synthFallbackFor?: string;
  /** The song for which this device was already switched to server-rendered audio (once per song, no loop). */
  private renderFallbackFor?: string;
  /** The song for which this device was just switched to server-rendered audio and the user has not been told yet. */
  private renderSwitchedFor?: string;

  private reportTimer?: ReturnType<typeof setInterval>;
  private skipTimer?: ReturnType<typeof setTimeout>;
  private cancelWait?: () => void;
  private dropouts?: DropoutMonitor;
  private frame = 0;
  private clockEngine?: Engine;
  private readonly onVisibility = () => this.restartClock();

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibility);
    effect(() => {
      const player = this.isPlayer();
      const now = this.state()?.now;
      untracked(() => this.follow(player, now));
    });
    effect(() => {
      const playing = this.playing();
      this.loaded();
      untracked(() => this.applyStatus(playing));
    });
    effect(() => {
      const player = this.isPlayer();
      const mode = this.state()?.settings?.scoreMode;
      untracked(() => this.reportDeviceFacts(player, mode));
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.stop();
    this.mic.dispose();
  }

  /** Play, Pause, Skip or Play here, from any device; the state that follows shows the result. */
  async control(action: ControlAction): Promise<void> {
    try {
      await this.session.control({ action });
    } catch (e) {
      this.toast.show(problem(e, {}), 'error');
    }
  }

  /** A tap from the user: starts the sound the browser would not start by itself. */
  async unlock(): Promise<void> {
    await this.play();
  }

  private follow(player: boolean, now: { song?: { number: string } } | undefined): void {
    const number = now?.song?.number;
    if (!player || !number) {
      this.stop();
      return;
    }
    // The score screen keeps the finished song as the current one, in a new message each time: it must not be played
    // again (and reported as ended again) until the score is over.
    const scoreShowing = !!this.state()?.score;
    if (this.number === number || now === this.finishedNow || (scoreShowing && number === this.finishedNumber)) return;
    this.begin(number);
  }

  private begin(number: string): void {
    this.stop();
    this.number = number;
    this.phase.set('preparing');
    this.error.set('');
    void this.prepare(number, this.generation);
  }

  private async prepare(number: string, mine: number): Promise<void> {
    let playback: Playback | undefined;
    while (mine === this.generation) {
      let wait = ERROR_RETRY_MS;
      try {
        const res = (await this.catalog.getPlayback({ number })).playback;
        if (mine !== this.generation) return;
        if (res?.ready) {
          if (this.mustLeaveRender(number, res)) {
            await this.leaveRender(number);
            continue;
          }
          if (this.mustUseRender(number, res)) {
            await this.useRender(number);
            continue;
          }
          if (res.kind === PlaybackKind.AUDIO && this.renderSwitchedFor === number) {
            // the server really renders: only now is "switched" true
            this.renderSwitchedFor = undefined;
            this.toast.show('This page cannot run the synthesizer (it needs HTTPS). Switched to server-rendered audio.');
          }
          playback = res;
          break;
        }
        wait = Math.max(res?.retryAfterMs ?? 0, MIN_RETRY_MS);
      } catch {
        if (mine !== this.generation) return;
      }
      this.phase.set('preparing');
      if (!(await this.sleep(wait))) return;
    }
    if (!playback || mine !== this.generation) return;
    await this.load(number, mine, playback);
  }

  /** A server-rendered MIDI song (FLAC) in a browser that cannot play FLAC, not yet tried for this song. */
  private mustLeaveRender(number: string, playback: Playback): boolean {
    return (
      playback.kind === PlaybackKind.AUDIO &&
      playback.song?.format === Format.MIDI &&
      this.synthFallbackFor !== number &&
      !this.canPlayFlac()
    );
  }

  /** A MIDI song for the synthesizer on a page that has none (no AudioWorklet: plain HTTP from a LAN address). */
  private mustUseRender(number: string, playback: Playback): boolean {
    // a device that is already in Server mode and still gets MIDI has a server that cannot render: switching again changes nothing
    return playback.kind === PlaybackKind.MIDI_SYNTH && !this.canSynthesize() && this.renderFallbackFor !== number && !this.inServerMode();
  }

  private inServerMode(): boolean {
    const id = this.auth.deviceId();
    return this.state()?.devices.find((d) => d.id === id)?.midiMode === MidiMode.SERVER;
  }

  /** Switches this device to server-rendered audio, so that the next GetPlayback comes as audio (when the server can render). */
  private async useRender(number: string): Promise<void> {
    this.renderFallbackFor = number;
    const deviceId = this.auth.deviceId();
    if (!deviceId) return;
    try {
      await this.session.setMidiMode({ deviceId, mode: MidiMode.SERVER });
    } catch {
      return; // nothing was changed: the song ends in the clear error below
    }
    this.renderSwitchedFor = number; // told to the user when the rendered audio arrives (prepare)
  }

  /** Switches this device to the built-in synthesizer, so that the next GetPlayback comes as MIDI. */
  private async leaveRender(number: string): Promise<void> {
    this.synthFallbackFor = number;
    const deviceId = this.auth.deviceId();
    if (!deviceId) return;
    try {
      await this.session.setMidiMode({ deviceId, mode: MidiMode.LOW_POWER });
    } catch {
      return; // the song is played as it is; nothing was changed
    }
    this.toast.show('This device cannot play the server\u2019s audio. Switched to the built-in synthesizer.');
  }

  private async load(number: string, mine: number, playback: Playback): Promise<void> {
    this.playback.set(playback);
    if (playback.kind === PlaybackKind.MIDI_SYNTH && !this.canSynthesize()) {
      this.fail(NO_SYNTH); // nothing can play it here: the synthesizer is not even tried
      return;
    }
    this.phase.set('loading');
    const engine = this.makeEngine(playback);
    this.engine = engine; // from here on stop() can dispose it, even while it loads
    try {
      await engine.load(playback);
    } catch {
      if (mine === this.generation) this.fail();
      return;
    }
    if (mine !== this.generation) return;
    engine.onEnded(() => void this.songEnded(number, mine));
    try {
      await this.session.ready({ number });
    } catch {
      if (mine === this.generation) this.stop(); // the state tells who plays now
      return;
    }
    if (mine !== this.generation) return;
    const now = this.state()?.now;
    if (now?.song?.number === number && now.positionMs > 0n) engine.seek(this.store.positionMs()); // a takeover or reload resumes
    this.timeMs.set(engine.timeMs());
    this.failures = 0;
    if (this.state()?.settings?.scoreMode === ScoreMode.MICROPHONE) {
      await this.mic.init();
      if (mine !== this.generation) return;
      if (this.mic.available) {
        this.mic.begin();
        this.micOn = true;
      }
    }
    this.phase.set('ready');
    this.loaded.set(true);
    this.applyStatus(this.playing());
  }

  private makeEngine(playback: Playback): Engine {
    if (playback.kind === PlaybackKind.AUDIO) return this.engines.mp3();
    return this.engines.midi(playback.effectiveMidiMode === MidiMode.LOW_POWER ? LOW_POWER : FULL_POWER);
  }

  private applyStatus(playing: boolean): void {
    const engine = this.engine;
    if (!engine || !this.loaded() || playing === this.wantPlay) return;
    this.wantPlay = playing;
    if (playing) {
      void this.play();
    } else {
      engine.pause();
      this.stopTimers();
      this.timeMs.set(engine.timeMs());
    }
  }

  private async play(): Promise<void> {
    const engine = this.engine;
    if (!engine) return;
    try {
      await engine.play();
    } catch (e) {
      // a pause that came while play was starting makes the browser abort the play: not a failure
      if (engine !== this.engine || !this.wantPlay) return;
      const name = (e as { name?: string }).name;
      if (name === 'NotAllowedError') this.needsGesture.set(true);
      else if (name !== 'AbortError') this.fail();
      return;
    }
    if (engine !== this.engine || !this.wantPlay) return;
    this.needsGesture.set(false);
    this.startTimers(engine);
  }

  private startTimers(engine: Engine): void {
    if (this.reportTimer) return;
    this.reportTimer = setInterval(() => {
      const number = this.number;
      if (number) void this.session.reportPosition({ number, positionMs: BigInt(Math.round(engine.timeMs())) }).catch(() => undefined);
    }, REPORT_POSITION_MS);
    if (engine.audioClock) {
      this.dropouts = new DropoutMonitor({ audioClock: () => engine.audioClock?.() ?? 0, onDropout: () => this.dropout() });
      this.dropouts.start();
    }
    this.clockEngine = engine;
    this.restartClock();
  }

  private stopTimers(): void {
    if (this.reportTimer) clearInterval(this.reportTimer);
    this.reportTimer = undefined;
    this.dropouts?.stop();
    this.dropouts = undefined;
    this.clockEngine = undefined;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** The lyrics clock redraws on every frame, but only while the page can be seen. */
  private restartClock(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const engine = this.clockEngine;
    if (!engine || document.visibilityState === 'hidden') return;
    const tick = () => {
      this.timeMs.set(engine.timeMs());
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private async songEnded(number: string, mine: number): Promise<void> {
    if (mine !== this.generation || number !== this.number) return;
    const loud = this.micOn ? this.mic.end() : 0;
    this.micOn = false;
    this.finishedNow = this.state()?.now;
    this.finishedNumber = number;
    this.stop();
    try {
      await this.session.ended({ number, loudReadings: loud });
    } catch {
      // the state that follows tells what the server made of it
    }
  }

  private fail(message = 'This song could not be played.'): void {
    this.disposeEngine();
    this.stopTimers();
    this.loaded.set(false);
    this.wantPlay = false;
    this.phase.set('error');
    this.error.set(message);
    if (++this.failures <= MAX_AUTO_SKIPS) {
      this.skipTimer = setTimeout(() => void this.session.control({ action: ControlAction.SKIP }).catch(() => undefined), SKIP_AFTER_ERROR_MS);
    }
  }

  /** Lets go of everything about the current song. */
  private stop(): void {
    this.generation++;
    this.cancelWait?.();
    clearTimeout(this.skipTimer);
    this.stopTimers();
    if (this.micOn) this.mic.end();
    this.micOn = false;
    this.dropoutReported = false;
    this.disposeEngine();
    this.number = undefined;
    this.loaded.set(false);
    this.wantPlay = false;
    this.needsGesture.set(false);
    this.playback.set(undefined);
    this.phase.set('idle');
  }

  private disposeEngine(): void {
    const engine = this.engine;
    this.engine = undefined;
    if (!engine) return;
    engine.pause();
    engine.dispose();
  }

  private sleep(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), ms);
      this.cancelWait = () => {
        clearTimeout(timer);
        resolve(false);
      };
    });
  }

  private reportDeviceFacts(player: boolean, mode: ScoreMode | undefined): void {
    if (!player) return;
    if (!this.deviceReported) {
      this.deviceReported = true;
      this.reportDevice(0);
    }
    if (mode === ScoreMode.MICROPHONE) {
      if (this.micAsked) return;
      this.micAsked = true;
      void this.mic.init().then((ok) => this.reportMic(ok));
    } else if (this.micAsked) {
      // the score no longer listens: let the microphone go (its indicator stays on otherwise)
      this.micAsked = false;
      this.mic.dispose();
    } else if (!this.capableReported) {
      // microphone scoring is only offered for a device that says it could listen
      this.capableReported = true;
      this.reportMic(this.mic.capable());
    }
  }

  /** The server steps the mode down once per report, so a stutter that goes on is told once per song. */
  private dropout(): void {
    if (this.dropoutReported) return;
    this.dropoutReported = true;
    this.reportDevice(1);
  }

  private reportDevice(dropouts: number): void {
    void this.session.reportDevice({ memoryMb: deviceMemoryMb(), dropouts }).catch(() => undefined);
  }

  private reportMic(available: boolean): void {
    void this.session.reportMic({ available }).catch(() => undefined);
  }
}

