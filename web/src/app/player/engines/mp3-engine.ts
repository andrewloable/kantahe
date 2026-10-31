import { Playback } from '../../../gen/kantahe/v1/catalog_pb';
import { Engine, mediaUrl } from './engine';

/** Plays an audio file (an MP3, or MIDI the server rendered) through an audio element. */
export class Mp3Engine implements Engine {
  private ended?: () => void;
  private disposed = false;

  constructor(
    private readonly baseUrl: string,
    private readonly audio: HTMLAudioElement = new Audio(),
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
      this.audio.src = mediaUrl(this.baseUrl, playback.audioUrl);
    });
  }

  play(): Promise<void> {
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
  }
}
