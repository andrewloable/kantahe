import { Injectable, signal } from '@angular/core';

/** The most room (in pixels) the page keeps free for the app's buttons: a guard against a wrong number, not a layout rule. */
export const MAX_CONTROLS_HEIGHT = 600;

/**
 * Inside the app the buttons are the app's own, drawn over the bottom of the page. The app says how tall they are (they wrap to more rows on
 * a narrow screen or with more buttons), and the page keeps that much room below its time and progress bar.
 */
@Injectable({ providedIn: 'root' })
export class NativeControls {
  readonly height = signal(0);
}
