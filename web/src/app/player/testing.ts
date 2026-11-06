import { create } from '@bufbuild/protobuf';
import { createRouterTransport } from '@connectrpc/connect';
import {
  CatalogService,
  GetBackgroundResponse,
  GetBackgroundResponseSchema,
  GetPlaybackRequest,
  GetPlaybackResponseSchema,
  Playback,
  PlaybackKind,
  PlaybackSchema,
} from '../../gen/kantahe/v1/catalog_pb';
import { Lyrics, MidiMode, Song } from '../../gen/kantahe/v1/common_pb';
import {
  ControlRequest,
  ControlResponseSchema,
  EndedRequest,
  EndedResponseSchema,
  GetStateResponseSchema,
  ReadyRequest,
  ReadyResponseSchema,
  ReportDeviceRequest,
  ReportDeviceResponseSchema,
  ReportMicRequest,
  ReportMicResponseSchema,
  ReportPositionRequest,
  ReportPositionResponseSchema,
  SessionService,
  SetMidiModeRequest,
  SetMidiModeResponseSchema,
  SetVolumeRequest,
  SetVolumeResponseSchema,
  State,
} from '../../gen/kantahe/v1/session_pb';
import { Engine, Engines, MidiOptions, Mp3Options } from './engines/engine';
import { CacheKind, SongCache } from './cache/song-cache';
import { MicMeter } from './mic';

export function playbackOf(
  over: Partial<{ kind: PlaybackKind; ready: boolean; retryAfterMs: number; mode: MidiMode; lyrics: Lyrics; audioUrl: string; song: Song; gainDb: number; vocalsUrl: string; audioVersion: string; vocalsVersion: string; guideVocalsUntilMs: bigint }> = {},
): Playback {
  return create(PlaybackSchema, {
    kind: over.kind ?? PlaybackKind.MIDI_SYNTH,
    ready: over.ready ?? true,
    retryAfterMs: over.retryAfterMs ?? 0,
    effectiveMidiMode: over.mode ?? MidiMode.FULL,
    midiUrl: '/media/song/1?sig=m',
    soundfontUrl: '/media/soundfont/1.sf2?sig=s',
    audioUrl: over.audioUrl ?? '/media/song/1?sig=a',
    lyrics: over.lyrics,
    song: over.song,
    gainDb: over.gainDb,
    vocalsUrl: over.vocalsUrl,
    audioVersion: over.audioVersion,
    vocalsVersion: over.vocalsVersion,
    guideVocalsUntilMs: over.guideVocalsUntilMs,
  });
}

/** A server whose WatchState the test drives with push(); every player report is recorded. */
export function fakePlayerServer() {
  const calls = {
    playback: [] as GetPlaybackRequest[],
    ready: [] as ReadyRequest[],
    position: [] as ReportPositionRequest[],
    ended: [] as EndedRequest[],
    device: [] as ReportDeviceRequest[],
    mic: [] as ReportMicRequest[],
    control: [] as ControlRequest[],
    mode: [] as SetMidiModeRequest[],
    volume: [] as SetVolumeRequest[],
    background: 0,
  };
  const pending: State[] = [];
  let wake: (() => void) | undefined;
  const handlers = {
    playback: ((): Playback => playbackOf()) as (req: GetPlaybackRequest) => Playback | Promise<Playback>,
    ready: (() => undefined) as (req: ReadyRequest) => void,
    control: (() => undefined) as (req: ControlRequest) => void,
    setMidiMode: (() => undefined) as (req: SetMidiModeRequest) => void,
    /** Throw to make SetVolume fail. */
    setVolume: (() => undefined) as (req: SetVolumeRequest) => void,
    /** The list of background videos; none and switched off until a test says otherwise. */
    background: (() => create(GetBackgroundResponseSchema, { enabled: false })) as () => GetBackgroundResponse | Promise<GetBackgroundResponse>,
  };
  const transport = createRouterTransport(({ service }) => {
    service(CatalogService, {
      async getPlayback(req) {
        calls.playback.push(req);
        return create(GetPlaybackResponseSchema, { playback: await handlers.playback(req) });
      },
      async getBackground() {
        calls.background++;
        return handlers.background();
      },
    });
    service(SessionService, {
      async *watchState(_req, ctx) {
        while (!ctx.signal.aborted) {
          const next = pending.shift();
          if (next) yield { state: next };
          else await new Promise<void>((resolve) => ((wake = resolve), ctx.signal.addEventListener('abort', () => resolve())));
        }
      },
      getState: () => create(GetStateResponseSchema, {}),
      ready(req) {
        calls.ready.push(req);
        handlers.ready(req);
        return create(ReadyResponseSchema, {});
      },
      reportPosition(req) {
        calls.position.push(req);
        return create(ReportPositionResponseSchema, {});
      },
      ended(req) {
        calls.ended.push(req);
        return create(EndedResponseSchema, {});
      },
      reportDevice(req) {
        calls.device.push(req);
        return create(ReportDeviceResponseSchema, {});
      },
      reportMic(req) {
        calls.mic.push(req);
        return create(ReportMicResponseSchema, {});
      },
      control(req) {
        calls.control.push(req);
        handlers.control(req);
        return create(ControlResponseSchema, {});
      },
      setMidiMode(req) {
        calls.mode.push(req);
        handlers.setMidiMode(req);
        return create(SetMidiModeResponseSchema, {});
      },
      setVolume(req) {
        calls.volume.push(req);
        handlers.setVolume(req);
        return create(SetVolumeResponseSchema, {});
      },
    });
  });
  return {
    transport,
    calls,
    handlers,
    push(s: State) {
      pending.push(s);
      wake?.();
    },
  };
}

export class FakeEngine implements Engine {
  time = 0;
  /** Seconds of audio produced; follows the (fake) wall clock unless a test sets it. */
  clockOverride?: number;
  endedCb?: () => void;
  load = vi.fn<Engine['load']>().mockResolvedValue(undefined);
  play = vi.fn<Engine['play']>().mockResolvedValue(undefined);
  pause = vi.fn();
  seek = vi.fn();
  dispose = vi.fn();
  setVolume = vi.fn();
  timeMs() {
    return this.time;
  }
  onEnded(cb: () => void) {
    this.endedCb = cb;
  }
  audioClock?: () => number;
  get clock(): number {
    return this.clockOverride ?? performance.now() / 1000;
  }
  set clock(v: number) {
    this.clockOverride = v;
  }
  finish() {
    this.endedCb?.();
  }
}

export function fakeEngines() {
  // the options of either kind of engine: MIDI settings, or the shared audio context of an MP3 engine
  const created: { kind: 'mp3' | 'midi'; options?: Partial<MidiOptions> & Mp3Options; engine: FakeEngine }[] = [];
  const hooks: { configure?: (engine: FakeEngine) => void } = {};
  const make = (kind: 'mp3' | 'midi', options?: MidiOptions | Mp3Options) => {
    const engine = new FakeEngine();
    if (kind === 'midi') engine.audioClock = () => engine.clock;
    hooks.configure?.(engine);
    created.push({ kind, options, engine });
    return engine;
  };
  const engines: Engines = { mp3: (options) => make('mp3', options), midi: (options) => make('midi', options) };
  return { engines, created, hooks, last: () => created[created.length - 1].engine };
}

export class FakeMic {
  capableNow = true;
  available?: boolean;
  loud = 0;
  /** How many times the microphone was really asked for. */
  opens = 0;
  private asked?: Promise<boolean>;
  // like the real meter: the microphone is asked for once, however often init is called
  init = vi.fn(() => (this.asked ??= (async () => (this.opens++, (this.available = this.capableNow)))()));
  begin = vi.fn();
  end = vi.fn(() => this.loud);
  dispose = vi.fn(() => {
    // like the real meter: after dispose the microphone can be asked for again
    this.asked = undefined;
    this.available = undefined;
  });
  capable() {
    return this.capableNow;
  }
}

export function asMic(m: FakeMic): MicMeter {
  return m as unknown as MicMeter;
}

/** A song cache that the test drives: what is "kept" is in `kept`; every call is recorded. */
export class FakeSongCache {
  /** "audio/00001@v1" → the object URL that lookup gives. */
  kept = new Map<string, string>();
  lookups: string[] = [];
  stores: { kind: CacheKind; number: string; version: string; url: string }[] = [];
  released: string[] = [];
  discarded: string[] = [];
  pinned: string[][] = [];
  /** What store answers; a test can make it slow or failing. */
  storeResult: () => Promise<boolean> = () => Promise.resolve(true);
  lookup = vi.fn(async (kind: CacheKind, number: string, version: string) => {
    this.lookups.push(`${kind}/${number}@${version}`);
    return this.kept.get(`${kind}/${number}@${version}`);
  });
  store = vi.fn((kind: CacheKind, number: string, version: string, url: string) => {
    this.stores.push({ kind, number, version, url });
    return this.storeResult();
  });
  release = vi.fn((url: string) => void this.released.push(url));
  discard = vi.fn(async (kind: CacheKind, number: string) => void this.discarded.push(`${kind}/${number}`));
  pin = vi.fn((keys: string[]) => void this.pinned.push([...keys]));
  available = () => this.supportedNow && this.enabledNow;
  /** For the settings: whether the browser can keep files, the switch, what is kept, and how often it was cleared. */
  supportedNow = true;
  enabledNow = true;
  statsNow = { count: 0, bytes: 0, capBytes: 2 * 1024 ** 3 };
  clears = 0;
  setNativeFreeBytes = vi.fn();
  supported = () => this.supportedNow;
  enabled = () => this.enabledNow;
  setEnabled = vi.fn((on: boolean) => void (this.enabledNow = on));
  stats = vi.fn(async () => ({ ...this.statsNow }));
  clear = vi.fn(async () => {
    this.clears++;
    this.statsNow = { ...this.statsNow, count: 0, bytes: 0 };
  });
}

export function asSongCache(c: FakeSongCache): SongCache {
  return c as unknown as SongCache;
}
