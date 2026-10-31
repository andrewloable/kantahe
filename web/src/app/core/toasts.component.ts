import { Component, inject } from '@angular/core';
import { ToastService } from './toast';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class.error]="t.kind === 'error'" [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
          <span>{{ t.message }}</span>
          @if (t.action; as a) {
            <button type="button" class="action" (click)="toasts.act(t.id)">{{ a.label }}</button>
          }
          <button type="button" aria-label="Dismiss" (click)="toasts.dismiss(t.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 0 1rem;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      max-width: 28rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background: var(--ink);
      color: #fff;
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
    }
    .toast.error {
      background: #7a1010;
    }
    .toast button {
      min-height: 2rem;
      padding: 0 0.5rem;
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
  protected readonly toasts = inject(ToastService);
}
