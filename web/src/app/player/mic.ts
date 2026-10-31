import { InjectionToken } from '@angular/core';

/** A reading is loud when its RMS is above this. */
export const LOUD_RMS = 0.02;
const READ_EVERY_MS = 100;
const FFT_SIZE = 2048;

/** Root mean square of a block of samples. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

export function isLoud(level: number): boolean {
  return level > LOUD_RMS;
}

interface AnalyserLike {
  fftSize: number;
  getFloatTimeDomainData(buffer: Float32Array): void;
}

interface MicContext {
  state?: string;
  resume?(): Promise<void>;
  createMediaStreamSource(stream: MediaStream): { connect(node: unknown): void; disconnect(): void };
  createAnalyser(): AnalyserLike;
  close(): Promise<void>;
}

export interface MicEnv {
  /** Microphones need a secure context (HTTPS or localhost). */
  secure: boolean;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createContext(): MicContext;
}

export function browserMicEnv(): MicEnv {
  const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  return {
    secure: typeof window !== 'undefined' && window.isSecureContext,
    getUserMedia: devices?.getUserMedia ? devices.getUserMedia.bind(devices) : undefined,
    createContext: () => new AudioContext() as unknown as MicContext,
  };
}

/** Counts the loud 100 ms readings of the microphone while a song plays (for the score). */
export class MicMeter {
  /** undefined until init() has answered. */
  available?: boolean;

  private stream?: MediaStream;
  private ctx?: MicContext;
  private analyser?: AnalyserLike;
  private source?: { connect(node: unknown): void; disconnect(): void };
  private timer?: ReturnType<typeof setInterval>;
  private loud = 0;
  private asked?: Promise<boolean>;

  constructor(private readonly env: MicEnv = browserMicEnv()) {}

  /** A microphone could be used here (a secure context with getUserMedia); nothing is asked of the user. */
  capable(): boolean {
    return this.env.secure && !!this.env.getUserMedia;
  }

  /** Asks for the microphone once; false when there is none, or it is not allowed. */
  init(): Promise<boolean> {
    this.asked ??= this.open();
    return this.asked;
  }

  private async open(): Promise<boolean> {
    if (!this.env.secure || !this.env.getUserMedia) return (this.available = false);
    try {
      this.stream = await this.env.getUserMedia({ audio: true });
      this.ctx = this.env.createContext();
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.source.connect(this.analyser);
      return (this.available = true);
    } catch {
      return (this.available = false);
    }
  }

  /** Starts counting for a new song. */
  begin(): void {
    this.end();
    this.loud = 0;
    const analyser = this.analyser;
    if (!analyser) return;
    const buffer = new Float32Array(analyser.fftSize);
    this.timer = setInterval(() => {
      // a context made before the page was used starts asleep and reads silence until it is woken
      if (this.ctx?.state === 'suspended') void this.ctx.resume?.().catch(() => undefined);
      analyser.getFloatTimeDomainData(buffer);
      if (isLoud(rms(buffer))) this.loud++;
    }, READ_EVERY_MS);
  }

  /** Stops counting and returns the loud readings of the song. */
  end(): number {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    return this.loud;
  }

  dispose(): void {
    this.end();
    this.loud = 0;
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.analyser = this.source = this.stream = this.ctx = undefined;
    this.asked = undefined; // a later init asks again
    this.available = undefined;
  }
}

/** The microphone of the app; tests replace it. */
export const MIC_METER = new InjectionToken<MicMeter>('kantahe microphone', { providedIn: 'root', factory: () => new MicMeter() });
