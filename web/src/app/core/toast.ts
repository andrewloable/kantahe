import { Injectable, signal } from '@angular/core';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
  action?: ToastAction;
}

const SHOW_MS = { info: 4000, error: 6000 };
const MAX_TOASTS = 4;

/** Short messages that fade away by themselves ("Added Hello"), optionally with one action ("Undo"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  /** The page frame (the shell) shows the toasts in its own flow; the root of the app then shows none. */
  readonly inShell = signal(false);
  private next = 1;

  show(message: string, kind: Toast['kind'] = 'info', action?: ToastAction): void {
    const id = this.next++;
    this.toasts.update((all) => [...all, { id, message, kind, action }].slice(-MAX_TOASTS));
    setTimeout(() => this.dismiss(id), SHOW_MS[kind] + (action ? 2000 : 0));
  }

  dismiss(id: number): void {
    this.toasts.update((all) => all.filter((t) => t.id !== id));
  }

  /** Runs the toast's action and removes the toast. */
  act(id: number): void {
    const toast = this.toasts().find((t) => t.id === id);
    this.dismiss(id);
    toast?.action?.run();
  }
}
