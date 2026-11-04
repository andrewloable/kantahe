import { inject, Injectable, signal } from '@angular/core';
import { ENVIRONMENT } from './environment';
import { readStore, removeStore, writeStore } from './storage';

const KEY = 'kantahe.shortcuts.off';

/** The keyboard shortcuts of the web app: what the dialog and the Help page list. */
export interface Shortcut {
  keys: string;
  does: string;
  where: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: 'Space or K', does: 'Play or pause', where: 'Player' },
  { keys: 'N', does: 'Skip to the next song', where: 'Player' },
  { keys: 'F', does: 'Full screen on or off', where: 'Player' },
  { keys: '+ and −', does: 'Volume up and down', where: 'Player' },
  { keys: 'V', does: 'Guide vocals on or off', where: 'Player, for songs that have them' },
  { keys: '/', does: 'Go to the search box', where: 'Library' },
  { keys: '?', does: 'Show this list', where: 'Everywhere' },
];

/**
 * Single-key shortcuts (WCAG 2.1.4): they work only where their page is, never while typing, never with Ctrl, Alt or Meta, never on a
 * TV, and a switch in Me > Appearance and account turns them all off.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcuts {
  private readonly tv = inject(ENVIRONMENT).isTv;
  readonly enabled = signal(readStore(KEY) !== '1');
  /** The dialog with the list is open: nothing else reacts to keys then. */
  readonly helpOpen = signal(false);

  setEnabled(on: boolean): void {
    if (on) removeStore(KEY);
    else writeStore(KEY, '1');
    this.enabled.set(on);
  }

  /** Whether this key press is for the shortcuts. A held key counts once, except for the volume (repeatVolume). */
  accepts(e: KeyboardEvent, repeatVolume = false): boolean {
    if (this.tv || !this.enabled() || this.helpOpen()) return false;
    if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return false;
    if (e.repeat && !repeatVolume) return false;
    const target = e.target instanceof Element ? e.target : undefined;
    if (target?.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])')) return false;
    // Space on a focused button or link presses it: that is the control's own, not ours
    if (e.key === ' ' && target?.closest('button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"]')) return false;
    return true;
  }
}
