const CHECK_EVERY_MS = 2000;
/** Audio that fell this far behind the wall clock in one window counts as a dropout. */
const TOLERANCE_MS = 100;

export interface DropoutOptions {
  /** Seconds of audio produced so far (AudioContext.currentTime). */
  audioClock: () => number;
  /** Milliseconds, defaults to performance.now. */
  wallClock?: () => number;
  onDropout: () => void;
  /** False while nobody sees the page; the browser may put the audio to sleep then. */
  isActive?: () => boolean;
}

/** Every 2 s compares how much audio was produced with how much time passed. */
export class DropoutMonitor {
  private timer?: ReturnType<typeof setInterval>;
  private lastAudio = 0;
  private lastWall = 0;

  constructor(private readonly o: DropoutOptions) {}

  private wall(): number {
    return (this.o.wallClock ?? (() => performance.now()))();
  }

  start(): void {
    if (this.timer) return;
    this.lastAudio = this.o.audioClock();
    this.lastWall = this.wall();
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private check(): void {
    const audio = this.o.audioClock();
    const wall = this.wall();
    const active = (this.o.isActive ?? (() => document.visibilityState !== 'hidden'))();
    const late = wall - this.lastWall - (audio - this.lastAudio) * 1000;
    this.lastAudio = audio;
    this.lastWall = wall;
    if (active && late > TOLERANCE_MS + 1e-6) this.o.onDropout();
  }
}
