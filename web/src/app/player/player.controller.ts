import { computed, effect, inject, Injectable, OnDestroy, signal, untracked } from '@angular/core';
import { clone, create } from '@bufbuild/protobuf';
import { CatalogService, Playback, PlaybackKind, PlaybackSchema } from '../../gen/kantahe/v1/catalog_pb';
import { Format, MidiMode } from '../../gen/kantahe/v1/common_pb';
import { ControlAction, PlayStatus, ScoreMode, SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { problem } from '../core/errors';
import { ServerUrl } from '../core/server-url';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { SONG_CACHE } from './cache/song-cache';
import { deviceMemoryMb } from './device-report';
import { DropoutMonitor } from './dropouts';
import { AUDIO_CONTEXT, CAN_PLAY_FLAC, CAN_SYNTHESIZE, Engine, ENGINES, MidiOptions, mediaUrl } from './engines/engine';
import { AudioContextLike } from './engines/mp3-engine';
import { MIC_METER } from './mic';
import { VOCALS_MAX, VOCALS_STEP, VocalsPrefs } from './vocals-prefs';

const REPORT_POSITION_MS = 1000;
const MIN_RETRY_MS = 500;
const ERROR_RETRY_MS = 2000;
const SKIP_AFTER_ERROR_MS = 3000;
/** After this many songs in a row that will not load, the player stops skipping them. */
const MAX_AUTO_SKIPS = 3;
const LOW_POWER: MidiOptions = { sampleRate: 22050, voiceCap: 32, effects: false };
const FULL_POWER: MidiOptions = { effects: true };
/** The volume buttons move the volume by this many percent, between 0 and MAX_VOLUME. */
const VOLUME_STEP = 5;
const MAX_VOLUME = 200;
/** The pause after the last press of a volume button before it is sent (as on Me > My devices). */
const VOLUME_PAUSE_MS = 300;
/** The guide vocals follow the instrumental, the clock of the song: how often they are compared, how far apart they may be, and how often they are put right. */
const DRIFT_CHECK_MS = 500;
const DRIFT_LIMIT_MS = 150;
const RESEEK_PAUSE_MS = 1000;
/** Amateur singer mode: the guide vocals fade out over this long, ending at the start of the third lyric line; the guide looks at the song's time this often. */
const GUIDE_FADE_MS = 300;
const GUIDE_TICK_MS = 50;

type VolumeKind = 'mp3' | 'midi';

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
  private readonly prefs = inject(VocalsPrefs);
  private readonly cache = inject(SONG_CACHE);
  private readonly server = inject(ServerUrl);
  private readonly makeAudioContext = inject(AUDIO_CONTEXT);
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

  /** Volumes chosen with the buttons here, shown and applied at once; dropped when the server's state shows them or refuses them. */
  private readonly moved = signal<Partial<Record<VolumeKind, number>>>({});
  private readonly volumeTimers = new Map<VolumeKind, ReturnType<typeof setTimeout>>();
  /** The volume the buttons change: the MIDI volume for a MIDI song (also when the server rendered it), else the MP3 volume; none when no song is current. */
  readonly volume = computed<{ kind: VolumeKind; pct: number } | undefined>(() => {
    const song = this.state()?.now?.song;
    if (!song) return undefined;
    const kind: VolumeKind = song.format === Format.MIDI ? 'midi' : 'mp3';
    return { kind, pct: this.volumePct(kind) };
  });

  /**
   * The singer's voice of a .karmp3 that has a vocals track, as a second audio engine next to the instrumental. It is made when the switch
   * first goes on (lazy) and thrown away when it goes off or the song ends; the instrumental stays the clock, the lyrics follow it.
   */
  private vocals?: Engine;
  /** The one audio context of a song with vocals: the instrumental and the vocals both play through it, so they are heard together. */
  private sharedContext?: AudioContextLike;
  private vocalsGeneration = 0;
  private vocalsLoaded = false;
  private instrumentalPlaying = false;
  private driftTimer?: ReturnType<typeof setInterval>;
  private lastReseek = -Infinity;
  /** Amateur singer mode: watches the song's time while the guide vocals play by themselves. */
  private guideTimer?: ReturnType<typeof setInterval>;
  /** Whether the switch is offered: only the player device, only for an MP3 song whose server sent a vocals URL. */
  readonly hasVocals = computed(() => {
    const playback = this.playback();
    return this.isPlayer() && !!playback?.vocalsUrl && playback.kind === PlaybackKind.AUDIO && playback.song?.format !== Format.MIDI;
  });
  readonly vocalsState = signal<'off' | 'loading' | 'on'>('off');
  readonly vocalsPct = computed(() => this.prefs.pct());

  /** The song that is next, whose files this device is keeping ahead of time (pinned in the cache with the current song). */
  private aheadNumber?: string;
  /** Songs already asked for ahead of time in this page's life: each only once. */
  private readonly askedAhead = new Set<string>();
  /** The keeping of the current song's files; the next song waits for it, so that the two downloads do not compete. */
  private keepingNow?: Promise<void>;
  private engine?: Engine;
  /** The object URLs of the kept files this song plays from (audio, vocals); let go of when the file is no longer used. */
  private audioBlob?: string;
  private vocalsBlob?: string;
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
      const state = this.vocalsState();
      untracked(() => this.prefs.state.set(state));
    });
    effect(() => {
      // the song has loaded (the phase is only 'ready' on the player device): the song that is next is kept ahead of time
      const ready = this.phase() === 'ready';
      const next = this.state()?.upNext?.song;
      untracked(() => this.keepAhead(ready ? next : undefined));
    });
    effect(() => {
      // the device's volume changed (from any device): the song that plays gets it at once
      const factor = this.volumeFactor(this.playback());
      const vocalsPct = this.prefs.pct();
      untracked(() => {
        this.engine?.setVolume(factor);
        this.vocals?.setVolume((vocalsPct / 100) * factor);
      });
    });
    effect(() => {
      // the server's state shows what the buttons chose: from now on the state is the truth (another device may change it)
      const live = { mp3: this.livePct('mp3'), midi: this.livePct('midi') };
      untracked(() => {
        const m = this.moved();
        for (const kind of ['mp3', 'midi'] as const) {
          if (m[kind] !== undefined && m[kind] === live[kind]) this.moved.update((all) => ({ ...all, [kind]: undefined }));
        }
      });
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
    for (const t of this.volumeTimers.values()) clearTimeout(t);
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
    this.cache.pin(this.pinned(number));
    // the file kept on this device, if it is still the server's file; the song plays from it instead of from the network
    let kept = playback.kind === PlaybackKind.AUDIO && playback.audioVersion ? await this.cache.lookup('audio', number, playback.audioVersion) : undefined;
    if (mine !== this.generation) {
      if (kept) this.cache.release(kept);
      return;
    }
    let engine = this.startEngine(playback, kept);
    try {
      await engine.load(this.sourceOf(playback, kept));
    } catch {
      if (mine !== this.generation) return;
      if (!kept) {
        this.fail();
        return;
      }
      // the kept file would not play: it is deleted and the song is played from the server instead
      this.disposeEngine();
      void this.cache.discard('audio', number);
      kept = undefined;
      engine = this.startEngine(playback, undefined);
      try {
        await engine.load(playback);
      } catch {
        if (mine === this.generation) this.fail();
        return;
      }
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
    if (now?.song?.number === number && now.positionMs > 0n) {
      engine.seek(this.store.positionMs()); // a takeover or reload resumes
      this.syncVocals();
    }
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
    // played from the server: keep the file for next time (the song does not wait for it, and a failure changes nothing)
    if (!kept && playback.kind === PlaybackKind.AUDIO && playback.audioVersion) {
      this.keepNow(this.cache.store('audio', number, playback.audioVersion, mediaUrl(this.server.base(), playback.audioUrl)));
    }
    // the choice made on an earlier song (or while this one loaded): the vocals start by themselves, and the song is not waiting for them
    // amateur singer mode: or the song has a guide window and its time has not run out (a takeover mid-song may be past it): the voice plays by itself
    if (this.hasVocals() && (this.prefs.on() || this.guideActive())) void this.startVocals();
    if (this.guideActive()) this.watchGuide();
  }

  /** The song time, in ms, at which the guide vocals of amateur singer mode end (the server sends the start of the third lyric line); 0: no guide. */
  private guideUntilMs(): number {
    return this.hasVocals() ? Number(this.playback()?.guideVocalsUntilMs ?? 0n) : 0;
  }

  /**
   * Whether the guide starts now: this song has a window and the instrumental's time is inside it. It is looked at once, when the song has loaded, so
   * a press of the singer's during the window (which ends the watch in stopVocals) is not undone: the next song is looked at afresh.
   */
  private guideActive(): boolean {
    const until = this.guideUntilMs();
    return until > 0 && (this.engine?.timeMs() ?? 0) < until;
  }

  /**
   * While the guide plays by itself: at the end of the window the voice fades out (its volume goes to 0 over GUIDE_FADE_MS, reaching 0 at the
   * start of the third line) and is let go of. The singer's own choice (VocalsPrefs.on) is never changed, and the voice stays when it is on.
   */
  private watchGuide(): void {
    clearInterval(this.guideTimer);
    this.guideTimer = setInterval(() => this.guideTick(), GUIDE_TICK_MS);
  }

  private guideTick(): void {
    const until = this.guideUntilMs();
    const engine = this.engine;
    if (!engine || until <= 0) {
      this.endGuideWatch();
      return;
    }
    if (this.prefs.on()) {
      // the singer wants the voice for the whole song: the guide has nothing to end (a fade already begun is undone)
      this.endGuideWatch();
      this.vocals?.setVolume(this.vocalsFactor());
      return;
    }
    const left = until - engine.timeMs();
    if (left <= 0) {
      this.stopVocals(); // also ends the watch
      return;
    }
    if (left < GUIDE_FADE_MS) this.vocals?.setVolume(this.vocalsFactor() * (left / GUIDE_FADE_MS));
  }

  private endGuideWatch(): void {
    clearInterval(this.guideTimer);
    this.guideTimer = undefined;
  }

  /**
   * How loud this device plays the song: the MIDI volume for a MIDI song (also when the server rendered it to audio), else the MP3 volume, in
   * percent of the song's own level, times the song's measured gain. A server that sends none (older) means 100 and no gain.
   */
  private volumeFactor(playback: Playback | undefined): number {
    const format = playback?.song?.format ?? this.state()?.now?.song?.format;
    // the device's own level, and the gain the server measured to bring this song to the common loudness (dB; absent: none known)
    return (this.volumePct(format === Format.MIDI ? 'midi' : 'mp3') / 100) * 10 ** ((playback?.gainDb ?? 0) / 20);
  }

  /** This device's volume of the kind in percent: what the buttons just chose, else the state, else 100 (an older server sends none). */
  private volumePct(kind: VolumeKind): number {
    return this.moved()[kind] ?? this.livePct(kind) ?? 100;
  }

  private livePct(kind: VolumeKind): number | undefined {
    const mine = this.state()?.devices.find((d) => d.id === this.auth.deviceId());
    return kind === 'midi' ? mine?.midiVolumePct : mine?.mp3VolumePct;
  }

  /** The volume buttons: one step up or down for the song that is current; shown at once, sent after a short pause. */
  changeVolume(direction: 1 | -1): void {
    const v = this.volume();
    if (!v) return;
    const pct = Math.min(MAX_VOLUME, Math.max(0, v.pct + direction * VOLUME_STEP));
    if (pct === v.pct) return;
    this.moved.update((m) => ({ ...m, [v.kind]: pct }));
    clearTimeout(this.volumeTimers.get(v.kind));
    this.volumeTimers.set(
      v.kind,
      setTimeout(() => void this.sendVolume(v.kind, pct), VOLUME_PAUSE_MS),
    );
  }

  private async sendVolume(kind: VolumeKind, pct: number): Promise<void> {
    this.volumeTimers.delete(kind);
    const deviceId = this.auth.deviceId();
    if (!deviceId) return;
    try {
      await this.session.setVolume(kind === 'mp3' ? { deviceId, mp3Pct: pct } : { deviceId, midiPct: pct });
      // accepted: the state that follows shows it, and then the chosen value is dropped (see the effect in the constructor)
    } catch (e) {
      if (this.moved()[kind] === pct) this.moved.update((m) => ({ ...m, [kind]: undefined }));
      this.toast.show(problem(e, {}), 'error');
    }
  }

  /** The files that are never evicted: those of the song that plays and of the one that is next. */
  private pinned(current: string): string[] {
    const numbers = this.aheadNumber ? [current, this.aheadNumber] : [current];
    return numbers.flatMap((n) => [`audio/${n}`, `vocals/${n}`]);
  }

  /**
   * Keeps the files of the song that is next while the current one plays, so that it starts from this device. Once per song, never for a MIDI
   * song, not while the page is hidden or the user asked the browser to save data; every failure is silent.
   */
  private keepAhead(next: { number: string; format: Format } | undefined): void {
    const current = this.number;
    this.aheadNumber = next && next.format !== Format.MIDI && next.number !== current ? next.number : undefined;
    if (!current || !this.aheadNumber || !this.cache.available() || this.askedAhead.has(this.aheadNumber)) return;
    if (document.visibilityState === 'hidden' || (navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
    const number = this.aheadNumber;
    this.askedAhead.add(number);
    this.cache.pin(this.pinned(current));
    void this.fetchAhead(number, current);
  }

  /** Remembers a download of the current song's file (whatever it ends in) for the next song to wait for. */
  private keepNow(job: Promise<boolean>): void {
    const done = job.then(
      () => undefined,
      () => undefined,
    );
    this.keepingNow = Promise.all([this.keepingNow, done]).then(() => undefined);
  }

  private async fetchAhead(number: string, current: string): Promise<void> {
    try {
      await this.keepingNow;
      if (this.number !== current) return;
      const playback = (await this.catalog.getPlayback({ number })).playback;
      if (!playback?.ready || playback.kind !== PlaybackKind.AUDIO || this.number !== current) return;
      const base = this.server.base();
      if (playback.audioVersion) await this.cache.store('audio', number, playback.audioVersion, mediaUrl(base, playback.audioUrl));
      if (playback.vocalsUrl && playback.vocalsVersion) await this.cache.store('vocals', number, playback.vocalsVersion, mediaUrl(base, playback.vocalsUrl));
    } catch {
      // the song is simply fetched when it is its turn
    }
  }

  /** Makes the engine for the song and sets it up (volume, and the kept file's object URL to let go of); from here on stop() can dispose it. */
  private startEngine(playback: Playback, kept: string | undefined): Engine {
    const engine = this.makeEngine(playback);
    engine.setVolume(this.volumeFactor(playback)); // before the song loads: an MP3 then asks for its media with CORS when it needs a gain node
    this.engine = engine;
    this.audioBlob = kept;
    return engine;
  }

  /** What the engine loads: the playback, with the kept file's object URL in place of the server's address when there is one. */
  private sourceOf(playback: Playback, kept: string | undefined): Playback {
    if (!kept) return playback;
    const copy = clone(PlaybackSchema, playback);
    copy.audioUrl = kept;
    return copy;
  }

  private makeEngine(playback: Playback): Engine {
    if (playback.kind === PlaybackKind.AUDIO) {
      if (!playback.vocalsUrl || playback.song?.format === Format.MIDI) return this.engines.mp3();
      // a song with vocals: its instrumental goes through the context the vocals will share, from the start (a path cannot change later)
      this.sharedContext = this.makeAudioContext();
      return this.engines.mp3({ context: this.sharedContext });
    }
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
      this.instrumentalPlaying = false;
      this.vocals?.pause();
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
    this.instrumentalPlaying = true;
    this.startTimers(engine);
    this.playVocals();
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
    clearInterval(this.driftTimer);
    this.driftTimer = undefined;
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
    this.keepingNow = undefined;
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
    this.instrumentalPlaying = false;
    this.stopVocals();
    if (engine) {
      engine.pause();
      engine.dispose();
    }
    // after both tracks let go of it
    void this.sharedContext?.close();
    this.sharedContext = undefined;
    if (this.audioBlob) this.cache.release(this.audioBlob);
    this.audioBlob = undefined;
  }

  /** The vocals switch: on starts the voice at the instrumental's position, off lets it go. The choice is remembered for the next song. */
  setVocals(on: boolean): void {
    if (!this.hasVocals()) {
      this.prefs.on.set(on); // no song with vocals now: only the choice is kept, for the next one
      return;
    }
    if (on === (this.vocalsState() !== 'off')) return; // also what the app resends with its volume buttons: not a press
    this.prefs.on.set(on);
    if (!on) {
      this.stopVocals();
      return;
    }
    this.vocalsState.set('loading');
    void this.startVocals();
  }

  /** The vocals volume buttons: one step of VOCALS_STEP percent, 0 to VOCALS_MAX; the song's own volume still applies on top. */
  changeVocalsVolume(direction: 1 | -1): void {
    const pct = Math.min(VOCALS_MAX, Math.max(0, this.prefs.pct() + direction * VOCALS_STEP));
    this.prefs.pct.set(pct);
    this.vocals?.setVolume(this.vocalsFactor());
  }

  /** The vocals' volume as a factor: their own percent of the song's volume. */
  private vocalsFactor(): number {
    return (this.prefs.pct() / 100) * this.volumeFactor(this.playback());
  }

  private async startVocals(): Promise<void> {
    const engine = this.engine;
    const playback = this.playback();
    const url = playback?.vocalsUrl;
    const number = this.number;
    if (this.vocals || !engine || !this.loaded() || !url || !number) return; // a song that is still loading calls this again when it is ready
    const mine = ++this.vocalsGeneration;
    this.vocalsState.set('loading');
    // the file kept on this device, if it is still the server's file
    const version = playback.vocalsVersion;
    const kept = version ? await this.cache.lookup('vocals', number, version) : undefined;
    if (mine !== this.vocalsGeneration) {
      if (kept) this.cache.release(kept); // switched off, or the song changed, while it was looked up
      return;
    }
    let vocals = this.makeVocals(kept);
    try {
      await vocals.load(create(PlaybackSchema, { audioUrl: kept ?? url }));
    } catch {
      if (mine !== this.vocalsGeneration) return;
      if (!kept) {
        this.vocalsFailed();
        return;
      }
      // the kept file would not play: it is deleted and the vocals come from the server instead
      this.disposeVocals();
      void this.cache.discard('vocals', number);
      vocals = this.makeVocals(undefined);
      try {
        await vocals.load(create(PlaybackSchema, { audioUrl: url }));
      } catch {
        if (mine === this.vocalsGeneration) this.vocalsFailed();
        return;
      }
    }
    if (mine !== this.vocalsGeneration) {
      vocals.dispose(); // switched off, or the song changed, while it loaded
      return;
    }
    this.vocalsLoaded = true;
    this.vocalsState.set('on');
    if (this.instrumentalPlaying) this.playVocals();
    else vocals.seek(engine.timeMs());
    if (!this.vocalsBlob && version) this.keepNow(this.cache.store('vocals', number, version, mediaUrl(this.server.base(), url)));
  }

  /** Makes the vocals engine, sets its volume and remembers the kept file's object URL to let go of. */
  private makeVocals(kept: string | undefined): Engine {
    const vocals = this.engines.mp3({ context: this.sharedContext });
    this.vocals = vocals;
    this.vocalsBlob = kept;
    vocals.setVolume(this.vocalsFactor());
    return vocals;
  }

  /** Lets go of the vocals engine that is in the making (not the generation: the caller goes on with another). */
  private disposeVocals(): void {
    const vocals = this.vocals;
    this.vocals = undefined;
    if (this.vocalsBlob) this.cache.release(this.vocalsBlob);
    this.vocalsBlob = undefined;
    vocals?.pause();
    vocals?.dispose();
  }

  /** Starts the voice at the instrumental's position; a voice that cannot play is dropped, the song is not touched. */
  private playVocals(): void {
    const vocals = this.vocals;
    const engine = this.engine;
    if (!vocals || !engine || !this.vocalsLoaded) return;
    const mine = this.vocalsGeneration;
    vocals.seek(engine.timeMs());
    vocals.play().then(
      () => {
        if (mine === this.vocalsGeneration && this.instrumentalPlaying && !this.driftTimer) this.driftTimer = setInterval(() => this.checkDrift(), DRIFT_CHECK_MS);
      },
      (e: unknown) => {
        // a pause that came while play was starting makes the browser abort the play: not a failure
        if (mine === this.vocalsGeneration && (e as { name?: string }).name !== 'AbortError') this.vocalsFailed();
      },
    );
  }

  /** Puts the voice where the instrumental is, after the instrumental was moved. */
  private syncVocals(): void {
    if (this.vocals && this.vocalsLoaded && this.engine) this.vocals.seek(this.engine.timeMs());
  }

  /** The two clocks of a long song slowly part: the voice is moved back when it is more than DRIFT_LIMIT_MS away, at most once per RESEEK_PAUSE_MS. */
  private checkDrift(): void {
    const vocals = this.vocals;
    const engine = this.engine;
    if (!vocals || !engine || !this.vocalsLoaded) return;
    const at = engine.timeMs();
    const now = Date.now();
    if (Math.abs(vocals.timeMs() - at) > DRIFT_LIMIT_MS && now - this.lastReseek >= RESEEK_PAUSE_MS) {
      vocals.seek(at);
      this.lastReseek = now;
    }
  }

  private stopVocals(): void {
    this.vocalsGeneration++;
    this.endGuideWatch();
    clearInterval(this.driftTimer);
    this.driftTimer = undefined;
    const vocals = this.vocals;
    this.vocals = undefined;
    this.vocalsLoaded = false;
    this.vocalsState.set('off');
    vocals?.pause();
    vocals?.dispose();
    if (this.vocalsBlob) this.cache.release(this.vocalsBlob);
    this.vocalsBlob = undefined;
  }

  /** The voice could not be loaded or played: it is switched off, with a short message, and the song goes on. */
  private vocalsFailed(): void {
    this.prefs.on.set(false);
    this.prefs.failures.update((n) => n + 1);
    this.stopVocals();
    this.toast.show('The vocals could not be loaded. The song plays without them.', 'error');
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

