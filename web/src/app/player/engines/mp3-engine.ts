import { Playback } from '../../../gen/kantahe/v1/catalog_pb';
import { Engine, mediaUrl } from './engine';

/** The small part of the Web Audio API this engine uses, so that tests can stand in for it. */
interface GainLike {
  gain: { value: number };
  connect(node: unknown): unknown;
}
export interface AudioContextLike {
  state: string;
  destination: unknown;
  createGain(): GainLike;
  createMediaElementSource(el: HTMLMediaElement): { connect(node: unknown): unknown };
  resume(): Promise<void>;
  close(): Promise<void>;
}

/** A context that has not started this soon is waiting for a tap (resume() then never answers). */
const RESUME_WAIT_MS = 1500;

const realContext = (): AudioContextLike | undefined => (typeof AudioContext === 'undefined' ? undefined : (new AudioContext() as unknown as AudioContextLike));

/**
 * Plays an audio file (an MP3, or MIDI the server rendered) through an audio element. At 100 percent the element plays on its own; at any
 * other volume the element feeds an audio context with a gain node (a boost needs one; the element's own volume can only lower).
 */
export class Mp3Engine implements Engine {
  private ended?: () => void;
  private disposed = false;
  private factor = 1;
  private ctx?: AudioContextLike;
  private gain?: GainLike;
  /** The element was asked for its media with CORS before it loaded, so a context may read it whatever the origin. */
  private corsReady = false;

  constructor(
    private readonly baseUrl: string,
    private readonly audio: HTMLAudioElement = new Audio(),
    private readonly makeContext: () => AudioContextLike | undefined = realContext,
  ) {
    audio.addEventListener('ended', () => {
      if (!this.disposed) this.ended?.();
    });
  }

  load(playback: Playback): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const done = (error?: Error) => {
        this.audio.removeEventListener('canplay', onReady);
        this.audio.removeEventListener('error', onError);
        if (error) reject(error);
        else resolve();
      };
      const onReady = () => done();
      const onError = () => done(new Error('The song could not be loaded.'));
      this.audio.addEventListener('canplay', onReady);
      this.audio.addEventListener('error', onError);
      this.audio.preload = 'auto';
      // a context reads the media only when it was asked for with CORS (the server answers it for any origin): set it before the address
      if (this.factor !== 1) {
        this.audio.crossOrigin = 'anonymous';
        this.corsReady = true;
      }
      this.audio.src = mediaUrl(this.baseUrl, playback.audioUrl);
      this.apply();
    });
  }

  setVolume(factor: number): void {
    this.factor = factor;
    this.apply();
  }

  /** Puts the volume where it can act: the gain node when there is one, else a new one when it is safe, else the element's own volume. */
  private apply(): void {
    if (this.disposed) return;
    if (this.gain) {
      this.gain.gain.value = this.factor;
      return;
    }
    if (this.factor === 1) {
      this.audio.volume = 1;
      return;
    }
    // a context given media from another origin without CORS plays silence: only the element's own volume is safe then
    if (!this.corsReady && !this.sameOrigin()) {
      this.audio.volume = Math.min(1, this.factor);
      return;
    }
    const ctx = this.makeContext();
    if (!ctx) {
      this.audio.volume = Math.min(1, this.factor);
      return;
    }
    this.ctx = ctx;
    const gain = ctx.createGain();
    gain.gain.value = this.factor;
    ctx.createMediaElementSource(this.audio).connect(gain);
    gain.connect(ctx.destination);
    this.gain = gain;
    this.audio.volume = 1;
  }

  private sameOrigin(): boolean {
    try {
      return new URL(this.audio.src, location.href).origin === location.origin;
    } catch {
      return false;
    }
  }

  async play(): Promise<void> {
    const ctx = this.ctx;
    if (ctx && ctx.state !== 'running') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([ctx.resume(), new Promise<void>((resolve) => (timer = setTimeout(resolve, RESUME_WAIT_MS)))]);
      clearTimeout(timer);
      if (ctx.state !== 'running') throw new DOMException('The browser needs a tap before it plays sound.', 'NotAllowedError');
    }
    // old browsers return nothing from play()
    return Promise.resolve(this.audio.play());
  }

  pause(): void {
    this.audio.pause();
  }

  seek(ms: number): void {
    this.audio.currentTime = ms / 1000;
  }

  timeMs(): number {
    return this.audio.currentTime * 1000;
  }

  onEnded(cb: () => void): void {
    this.ended = cb;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load(); // lets go of the file that was being fetched
    void this.ctx?.close();
  }
}
