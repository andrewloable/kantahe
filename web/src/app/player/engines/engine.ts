import { inject, InjectionToken } from '@angular/core';
import { Playback } from '../../../gen/kantahe/v1/catalog_pb';
import { ServerUrl } from '../../core/server-url';
import { Mp3Engine } from './mp3-engine';
import { MidiEngine } from './midi-engine';

/** What the player needs from something that makes sound: an MP3 file or a MIDI synthesizer. */
export interface Engine {
  load(playback: Playback): Promise<void>;
  /** Rejects with NotAllowedError when the browser wants a tap before it plays sound. */
  play(): Promise<void>;
  pause(): void;
  seek(ms: number): void;
  timeMs(): number;
  onEnded(cb: () => void): void;
  /** Seconds of audio produced so far; only engines that can tell (the synth) have it. */
  audioClock?(): number;
  /** Releases the audio context, the media element and everything else; safe to call twice. */
  dispose(): void;
}

export interface MidiOptions {
  /** 22050 in low-power mode, otherwise the device default. */
  sampleRate?: number;
  /** The most voices at once; unset for the library default. */
  voiceCap?: number;
  /** Reverb and chorus. */
  effects: boolean;
}

export interface Engines {
  mp3(): Engine;
  midi(options: MidiOptions): Engine;
}

/** The engines of the app; tests replace them. */
export const ENGINES = new InjectionToken<Engines>('kantahe engines', {
  providedIn: 'root',
  factory: () => {
    const server = inject(ServerUrl);
    return { mp3: () => new Mp3Engine(server.base()), midi: (options) => new MidiEngine(server.base(), options) };
  },
});

/** Whether this browser plays FLAC in an audio element (the server's rendered MIDI songs are FLAC); tests replace it. */
export const CAN_PLAY_FLAC = new InjectionToken<() => boolean>('kantahe can play FLAC', {
  providedIn: 'root',
  factory: () => () => document.createElement('audio').canPlayType('audio/flac') !== '',
});

/**
 * Whether this page can run the MIDI synthesizer. It needs an AudioWorklet, which browsers offer only in a secure
 * context (HTTPS, localhost): on plain HTTP from a LAN address there is none. Tests replace it.
 */
export const CAN_SYNTHESIZE = new InjectionToken<() => boolean>('kantahe can synthesize', {
  providedIn: 'root',
  factory: () => () => typeof AudioContext !== 'undefined' && 'audioWorklet' in AudioContext.prototype,
});

/** A media address from the server: a path is put behind the server's base address. */
export function mediaUrl(base: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}
