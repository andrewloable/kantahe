import { afterNextRender, Component, ElementRef, inject, Injector, input, signal } from '@angular/core';

/** One entry of an action menu. */
export interface MenuItem {
  label: string;
  run: () => void;
  /** Deletes or removes something: drawn in the danger colour. */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * A "More actions" button (three dots) and the menu it opens: the rarer actions of a row, so that the row stays one line on a phone.
 * Keyboard: the menu opens with the focus on its first item; ArrowDown, ArrowUp, Home and End move; Escape closes it and gives the
 * focus back to the button; Tab or a click elsewhere closes it.
 */
@Component({
  selector: 'app-action-menu',
  host: { '(document:click)': 'outside($event)' },
  template: `
    <button type="button" class="more" aria-haspopup="menu" [attr.aria-expanded]="open()" [attr.aria-label]="label()" title="More actions" (click)="toggle()">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    </button>
    @if (open()) {
      <ul class="list" role="menu" [style.transform]="shift() ? 'translateX(' + shift() + 'px)' : null" [attr.aria-label]="label()">
        @for (item of items(); track item.label) {
          <li role="none">
            <button type="button" role="menuitem" tabindex="-1" [class.danger]="item.danger" [disabled]="item.disabled" (click)="choose(item)" (keydown)="onKey($event)">{{ item.label }}</button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }
    .more {
      min-width: 2.75rem;
      padding: 0.25rem;
      border: 0;
      background: transparent;
      color: inherit;
    }
    .list {
      position: absolute;
      top: 100%;
      right: 0;
      /* above the tab bar of a phone (z-index 20) */
      z-index: 25;
      /* never wider than the window (large text): it is moved inside it when it opens (shift) */
      min-width: min(12rem, calc(100vw - 1rem));
      max-width: calc(100vw - 1rem);
      margin: 0.25rem 0 0;
      padding: 0.25rem;
      list-style: none;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 0.5rem;
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
    }
    [role='menuitem'] {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 0;
      background: transparent;
      color: var(--text);
      font-weight: 400;
      text-align: left;
    }
    [role='menuitem']:hover:not(:disabled) {
      background: var(--paper);
    }
    [role='menuitem'].danger {
      color: var(--danger);
    }
  `,
})
export class ActionMenuComponent {
  /** The name of the button and of the menu, with what it is for: "More actions for Hello". */
  readonly label = input.required<string>();
  readonly items = input.required<MenuItem[]>();
  protected readonly open = signal(false);
  /** The menu opens leftwards from the button; where that would leave the window it is moved sideways, 8 px inside the edge. */
  protected readonly shift = signal(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.shift.set(0);
    this.open.set(true);
    afterNextRender(
      () => {
        const list = this.host.nativeElement.querySelector('.list');
        if (list) {
          const r = list.getBoundingClientRect();
          const width = document.documentElement.clientWidth;
          if (r.left < 8) this.shift.set(8 - r.left);
          else if (r.right > width - 8) this.shift.set(width - 8 - r.right);
        }
        this.entries()[0]?.focus();
      },
      { injector: this.injector },
    );
  }

  protected choose(item: MenuItem): void {
    if (item.disabled) return;
    this.close();
    item.run();
  }

  protected onKey(e: KeyboardEvent): void {
    const entries = this.entries();
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => {
      e.preventDefault();
      entries[(i + entries.length) % entries.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(entries.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Tab') this.open.set(false);
  }

  protected outside(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  private close(): void {
    this.open.set(false);
    this.host.nativeElement.querySelector<HTMLButtonElement>('button.more')?.focus();
  }

  private entries(): HTMLButtonElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
  }
}
