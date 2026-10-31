import { Component, input } from '@angular/core';
import { PageWindow } from './page-window';

/** Previous / Next under a list that is shown a page at a time. */
@Component({
  selector: 'app-page-bar',
  template: `
    @if (win().hasPrev() || win().nextLoaded() || hasMore()) {
      <nav class="bar" aria-label="Pages">
        <button type="button" [attr.aria-disabled]="!win().hasPrev()" (click)="win().prev()">Previous</button>
        <span role="status">Page {{ win().current() + 1 }}@if (win().total(); as n) { of {{ n }} }</span>
        <button type="button" [attr.aria-disabled]="!win().nextLoaded() && (!hasMore() || win().busy())" (click)="win().next()">Next</button>
      </nav>
    }
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 0.75rem 0;
    }
    button[aria-disabled='true'] {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class PageBarComponent {
  readonly win = input.required<PageWindow<unknown>>();
  readonly hasMore = input(false);
}
