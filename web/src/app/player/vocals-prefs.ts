import { Injectable, signal } from '@angular/core';

/** The vocals volume moves by this many percent per press, between 0 and VOCALS_MAX. */
export const VOCALS_STEP = 10;
export const VOCALS_MAX = 100;
/** A guide track: quieter than the music, because both are normalized to the same loudness. */
export const VOCALS_DEFAULT = 60;

/**
 * What the singer chose about the guide vocals, kept in memory for as long as the page or app is open: it carries over from one song to the
 * next (a song without vocals simply ignores it) and over opening the player again. Nothing is stored in the browser or on the server.
 */
@Injectable({ providedIn: 'root' })
export class VocalsPrefs {
  readonly on = signal(false);
  readonly pct = signal(VOCALS_DEFAULT);
  /** What the player does with the vocals now and how many times they failed: the embedded page tells the app (the page has no buttons of its own). */
  readonly state = signal<'off' | 'loading' | 'on'>('off');
  readonly failures = signal(0);
}
