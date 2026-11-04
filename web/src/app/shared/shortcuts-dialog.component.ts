import { afterNextRender, Component, effect, ElementRef, inject, Injector, untracked } from '@angular/core';
import { KeyboardShortcuts, SHORTCUTS } from '../core/shortcuts';

/** The list of keyboard shortcuts as a modal dialog (opened with ?). Escape closes it and the focus goes back to where it was. */
@Component({
  selector: 'app-shortcuts-dialog',
  template: `
    @if (shortcuts.helpOpen()) {
      <div class="backdrop"></div>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" (keydown)="onKey($event)">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Keys</th>
              <th scope="col">What it does</th>
              <th scope="col">Where</th>
            </tr>
          </thead>
          <tbody>
            @for (s of list; track s.keys) {
              <tr>
                <td>
                  <kbd>{{ s.keys }}</kbd>
                </td>
                <td>{{ s.does }}</td>
                <td>{{ s.where }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="hint">They can be turned off in Me › Appearance and account.</p>
        <button type="button" class="primary close" (click)="close()">Close</button>
      </div>
    }
  `,
  styles: `
    /* above the tab bar of a phone (z-index 20) and the menus (25) */
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
      width: min(34rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      overscroll-behavior-y: contain;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      background: var(--panel);
      box-shadow: 0 8px 30px rgb(0 0 0 / 0.4);
    }
    h2 {
      margin: 0 0 0.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.375rem 0.5rem;
      text-align: left;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    kbd {
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--field-line);
      border-radius: 0.35rem;
      font: inherit;
      font-weight: 600;
      white-space: nowrap;
    }
    .hint {
      margin: 0.75rem 0;
    }
  `,
})
export class ShortcutsDialogComponent {
  protected readonly shortcuts = inject(KeyboardShortcuts);
  protected readonly list = SHORTCUTS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private before: Element | null = null;

  constructor() {
    effect(() => {
      const open = this.shortcuts.helpOpen();
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
    this.shortcuts.helpOpen.set(false);
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Tab') {
      // the only control is Close: the focus stays in the dialog
      e.preventDefault();
      this.host.nativeElement.querySelector<HTMLButtonElement>('button.close')?.focus();
    }
  }
}
