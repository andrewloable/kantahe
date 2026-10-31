import { inject, Injectable, InjectionToken } from '@angular/core';

/** What the Back key does; tests replace it. */
export interface BackActions {
  back(): void;
  /** Close the app: Back was pressed on the first page. */
  exit(): void;
  canGoBack(): boolean;
}

interface TvWindow extends Window {
  tizen?: {
    application?: { getCurrentApplication(): { exit(): void } };
    tvinputdevice?: { registerKey(name: string): void };
  };
}

export const BACK_ACTIONS = new InjectionToken<BackActions>('kantahe back actions', {
  providedIn: 'root',
  factory: () => {
    const win = window as TvWindow;
    return {
      back: () => win.history.back(),
      canGoBack: () => win.history.length > 1,
      exit: () => {
        try {
          win.tizen?.application?.getCurrentApplication().exit();
        } catch {
          // not on Tizen
        }
        win.close(); // webOS closes the app with the window
      },
    };
  },
});

/** The key codes of the Back button: Tizen 10009, webOS 461. */
const BACK_CODES = new Set([10009, 461]);
const MEDIA_KEYS = ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'];

/** Asks Tizen to deliver the media keys of the remote to the page; other platforms already do, or have no API. */
export function registerMediaKeys(win: Window): void {
  const input = (win as TvWindow).tizen?.tvinputdevice;
  if (!input) return;
  for (const name of MEDIA_KEYS) {
    try {
      input.registerKey(name);
    } catch {
      // a remote without that key: the others still count
    }
  }
}

/**
 * The Back key of the remote. An element marked data-back-closes (an overlay that closes on Escape) is closed
 * first, the last one in the page when there are several; else the app goes back, and from the first page leaves.
 */
@Injectable({ providedIn: 'root' })
export class BackKeys {
  private readonly actions = inject(BACK_ACTIONS);
  private doc?: Document;
  private readonly onKey = (e: KeyboardEvent) => {
    if (!BACK_CODES.has(e.keyCode) || !this.doc) return;
    e.preventDefault();
    const overlays = this.doc.querySelectorAll('[data-back-closes]');
    const top = overlays[overlays.length - 1];
    if (top) top.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    else if (this.actions.canGoBack()) this.actions.back();
    else this.actions.exit();
  };

  attach(doc: Document): void {
    this.detach();
    this.doc = doc;
    doc.addEventListener('keydown', this.onKey);
  }

  detach(): void {
    this.doc?.removeEventListener('keydown', this.onKey);
    this.doc = undefined;
  }
}
