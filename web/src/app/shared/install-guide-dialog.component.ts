import { afterNextRender, Component, effect, ElementRef, inject, Injector, untracked } from '@angular/core';
import { InstallPrompt } from '../core/install';

/** How to put Kantahe on an iPhone's home screen (Safari has no install button): three steps in a modal dialog. */
@Component({
  selector: 'app-install-guide-dialog',
  template: `
    @if (install.guideOpen()) {
      <div class="backdrop"></div>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" (keydown)="onKey($event)">
        <h2 id="install-title">Install Kantahe</h2>
        <ol>
          <li>Tap the <strong>Share</strong> button.</li>
          <li>Choose <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>.</li>
        </ol>
        <p class="hint">Kantahe then opens from your home screen like an app.</p>
        <button type="button" class="primary close" (click)="close()">Close</button>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      z-index: 40;
      inset: 0;
      background: rgb(0 0 0 / 0.45);
    }
    .dialog {
      position: fixed;
      z-index: 41;
      left: 50%;
      top: 1rem;
      transform: translateX(-50%);
      width: min(28rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      background: var(--panel);
      box-shadow: 0 8px 30px rgb(0 0 0 / 0.4);
    }
    h2 {
      margin: 0 0 0.5rem;
    }
    ol {
      margin: 0 0 0.5rem;
      padding-left: 1.5rem;
    }
    .hint {
      margin: 0.5rem 0 0.75rem;
    }
  `,
})
export class InstallGuideDialogComponent {
  protected readonly install = inject(InstallPrompt);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private before: Element | null = null;

  constructor() {
    effect(() => {
      const open = this.install.guideOpen();
      untracked(() => {
        if (open) {
          this.before = document.activeElement;
          afterNextRender(() => this.host.nativeElement.querySelector<HTMLButtonElement>('button.close')?.focus(), { injector: this.injector });
        } else if (this.before) {
          (this.before as HTMLElement).focus?.();
          this.before = null;
        }
      });
    });
  }

  protected close(): void {
    this.install.guideOpen.set(false);
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // the only control is Close
      this.host.nativeElement.querySelector<HTMLButtonElement>('button.close')?.focus();
    }
  }
}
