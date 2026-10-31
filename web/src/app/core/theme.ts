import { Injectable, signal } from '@angular/core';
import { readStore, removeStore, writeStore } from './storage';

export type ThemeMode = 'auto' | 'light' | 'dark';

const KEY = 'kantahe.theme';
const MODES: ThemeMode[] = ['auto', 'light', 'dark'];

/**
 * The look of the app: Auto follows the system, Light and Dark override it. The choice is kept in this browser and
 * shows as data-theme on the page (Auto has none, so the stylesheet's own media query decides).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('auto');

  /** Reads the stored choice and shows it; called once when the app starts. */
  apply(): void {
    const stored = readStore(KEY);
    this.show(MODES.includes(stored as ThemeMode) ? (stored as ThemeMode) : 'auto');
  }

  set(mode: ThemeMode): void {
    if (mode === 'auto') removeStore(KEY);
    else writeStore(KEY, mode);
    this.show(mode);
  }

  private show(mode: ThemeMode): void {
    this.mode.set(mode);
    const root = document.documentElement;
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
  }
}
