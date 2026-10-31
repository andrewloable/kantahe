import { Playback } from '../../../gen/kantahe/v1/catalog_pb';
import { Engine, mediaUrl, MidiOptions } from './engine';

// The small part of spessasynth_lib this engine uses, so that tests can stand in for it.
interface SynthLike {
  soundBankManager: { addSoundBank(bank: ArrayBuffer, id: string): Promise<void> };
  isReady: Promise<unknown>;
  connect(node: unknown): unknown;
  setSystemParameter(parameter: string, value: number | boolean): void;
  destroy(): void;
}

interface SequencerLike {
  eventHandler: { addEvent(event: string, id: string, cb: () => void): void };
  loadNewSongList(songs: { binary: ArrayBuffer }[]): void;
  play(): void;
  pause(): void;
  currentTime: number;
  skipToFirstNoteOn: boolean;
}

interface ContextLike {
  state: string;
  currentTime: number;
  destination: unknown;
  audioWorklet: { addModule(url: string): Promise<void> };
  resume(): Promise<void>;
  close(): Promise<void>;
}

export interface SynthLib {
  WorkletSynthesizer: new (ctx: ContextLike) => SynthLike;
  Sequencer: new (synth: SynthLike) => SequencerLike;
}

export interface MidiDeps {
  createContext(sampleRate?: number): ContextLike;
  loadLib(): Promise<SynthLib>;
  fetchBuffer(url: string): Promise<ArrayBuffer>;
  workletUrl(): string;
}

const SONG_READY_TIMEOUT_MS = 20_000;
/** A context that has not started this soon is waiting for a tap (resume() then never answers). */
const RESUME_WAIT_MS = 1500;

const realDeps: MidiDeps = {
  createContext: (sampleRate) => new AudioContext(sampleRate ? { sampleRate } : undefined) as unknown as ContextLike,
  // loaded on demand: the synthesizer is large and MP3 songs never need it
  loadLib: async () => (await import('spessasynth_lib')) as unknown as SynthLib,
  fetchBuffer: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return res.arrayBuffer();
  },
  workletUrl: () => new URL('assets/spessasynth/spessasynth_processor.min.js', document.baseURI).href,
};

/** Plays MIDI with spessasynth and the SoundFont of the song. */
export class MidiEngine implements Engine {
  private ctx?: ContextLike;
  private synth?: SynthLike;
  private seq?: SequencerLike;
  private ended?: () => void;
  private disposed = false;
  private wantPlay = false;

  constructor(
    private readonly baseUrl: string,
    private readonly options: MidiOptions,
    private readonly deps: MidiDeps = realDeps,
  ) {}

  async load(playback: Playback): Promise<void> {
    const ctx = this.deps.createContext(this.options.sampleRate);
    this.ctx = ctx;
    try {
      const [lib, , soundFont, midi] = await Promise.all([
        this.deps.loadLib(),
        ctx.audioWorklet.addModule(this.deps.workletUrl()),
        this.deps.fetchBuffer(mediaUrl(this.baseUrl, playback.soundfontUrl)),
        this.deps.fetchBuffer(mediaUrl(this.baseUrl, playback.midiUrl)),
      ]);
      this.assertAlive();
      const synth = new lib.WorkletSynthesizer(ctx);
      this.synth = synth;
      synth.connect(ctx.destination);
      await synth.soundBankManager.addSoundBank(soundFont, 'main');
      await synth.isReady;
      this.assertAlive();
      if (this.options.voiceCap) synth.setSystemParameter('voiceCap', this.options.voiceCap);
      if (!this.options.effects) synth.setSystemParameter('effectsEnabled', false);
      const seq = new lib.Sequencer(synth);
      this.seq = seq;
      seq.skipToFirstNoteOn = false; // the quiet start plays in real time, so the count-in is seen
      seq.eventHandler.addEvent('songEnded', 'kantahe-end', () => {
        if (!this.disposed) this.ended?.();
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), SONG_READY_TIMEOUT_MS);
        seq.eventHandler.addEvent('songChange', 'kantahe-load', () => {
          clearTimeout(timer);
          resolve();
        });
        seq.loadNewSongList([{ binary: midi }]);
      });
      this.assertAlive();
    } catch (e) {
      const wasDisposed = this.disposed;
      this.dispose();
      throw wasDisposed ? e : new Error('The song could not be loaded.');
    }
  }

  async play(): Promise<void> {
    this.wantPlay = true;
    const ctx = this.ctx;
    if (!ctx) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([ctx.resume(), new Promise<void>((resolve) => (timer = setTimeout(resolve, RESUME_WAIT_MS)))]);
    clearTimeout(timer);
    if (ctx.state !== 'running') throw new DOMException('The browser needs a tap before it plays sound.', 'NotAllowedError');
    // a pause that came meanwhile wins
    if (this.wantPlay && !this.disposed) this.seq?.play();
  }

  pause(): void {
    this.wantPlay = false;
    this.seq?.pause();
  }

  seek(ms: number): void {
    if (this.seq) this.seq.currentTime = ms / 1000;
  }

  timeMs(): number {
    return (this.seq?.currentTime ?? 0) * 1000;
  }

  onEnded(cb: () => void): void {
    this.ended = cb;
  }

  audioClock(): number {
    return this.ctx?.currentTime ?? 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.seq?.pause();
    this.synth?.destroy();
    void this.ctx?.close();
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('The player was closed while the song was loading.');
  }
}
