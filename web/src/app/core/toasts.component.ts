import { Component, inject, input } from '@angular/core';
import { ToastService } from './toast';

@Component({
  selector: 'app-toasts',
  template: `
    @if (inShell() === toasts.inShell()) {
      <div class="toasts" data-overlay="toast" [class.in-page]="inShell()" [class.centered]="centered()" aria-live="polite">
        @for (t of toasts.toasts(); track t.id) {
          <div class="toast" [class.error]="t.kind === 'error'" [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
            @if (t.kind === 'info') {
              <span class="mark" aria-hidden="true">✓</span>
            }
            <span class="text">{{ t.message }}</span>
            @if (t.action; as a) {
              <button type="button" class="action" (click)="toasts.act(t.id)">{{ a.label }}</button>
            }
            <button type="button" aria-label="Dismiss" (click)="toasts.dismiss(t.id)">×</button>
          </div>
        }
      </div>
    }
  `,
  styles: `
    /* A toast floats above the page and never moves or resizes anything else (owner decision 2026-11-28, kantahe-du1.1): every
       variant is fixed to the window. It may cover the page for the few seconds it shows. */
    .toasts {
      position: fixed;
      z-index: 40;
      left: 0;
      right: 0;
      bottom: calc(1rem + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.75rem;
      pointer-events: none;
    }
    /* a phone shows the tab bar at the bottom (shell.component.css): the toasts sit just above it, near the thumb */
    @media (max-width: 40rem) {
      .toasts.in-page {
        bottom: calc(4rem + env(safe-area-inset-bottom));
      }
    }
    /* on the player: at the top of the stage under its top bar, clear of the controls at the bottom; the embedded player moves it below
       the app's own Close button (--toast-top, player-view.component.ts) */
    .toasts.in-page.centered {
      top: var(--toast-top, 4rem);
      bottom: auto;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: max-content;
      max-width: min(28rem, 100%);
      padding: 0.375rem 0.375rem 0.375rem 0.875rem;
      border-radius: 0.75rem;
      background: var(--accent);
      color: var(--on-accent);
      font-weight: 600;
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.35);
      animation: toast-in 150ms ease-out;
    }
    .toast.error {
      background: #7a1010;
      color: #fff;
    }
    /* a slide only, no fade: a half-transparent toast is below the contrast it needs (axe caught one mid-entrance) */
    @keyframes toast-in {
      from {
        transform: translateY(0.5rem);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast {
        animation: none;
      }
    }
    .mark {
      font-size: 1.125rem;
      line-height: 1;
    }
    .text {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .toast button {
      flex: none;
      min-width: 2.75rem;
      min-height: 2.75rem;
      padding: 0 0.5rem;
      border: 0;
      background: transparent;
      color: inherit;
    }
    .toast .action {
      font-weight: 700;
      text-decoration: underline;
    }
  `,
})
export class ToastsComponent {
  /** The instance that lives in the page frame (the root instance shows the toasts only while the frame does not). */
  readonly inShell = input(false);
  /** Centred in the flow (the player's stage) instead of at the left edge of the page frame. */
  readonly centered = input(false);
  protected readonly toasts = inject(ToastService);
}
