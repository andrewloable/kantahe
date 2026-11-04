import { Component, signal } from '@angular/core';
import { Format, LyricTiming } from '../../gen/kantahe/v1/common_pb';
import { readStore, removeStore, writeStore } from '../core/storage';
import { FormatBadgeComponent } from './format-badge.component';

const KEY = 'kantahe.legend.hidden';

/** One line under a list of songs that says what the small W, L and V badges mean; it can be hidden, and that is remembered in this browser. */
@Component({
  selector: 'app-badge-legend',
  imports: [FormatBadgeComponent],
  template: `
    @if (hidden()) {
      <button type="button" class="quiet" (click)="show()">What do W, L and V mean?</button>
    } @else {
      <p class="legend">
        <!-- the words say it all: the badges are only for the eye -->
        <span class="samples" aria-hidden="true">
          <app-format-badge [format]="Format.UNSPECIFIED" [timing]="LyricTiming.WORD" />
        </span>
        word-by-word lyrics ·
        <span class="samples" aria-hidden="true">
          <app-format-badge [format]="Format.UNSPECIFIED" [timing]="LyricTiming.LINE" />
        </span>
        line-by-line lyrics ·
        <span class="samples" aria-hidden="true">
          <app-format-badge [format]="Format.UNSPECIFIED" [vocals]="true" />
        </span>
        separate vocals
        <button type="button" class="quiet" (click)="hide()">Hide</button>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      margin: 0.5rem 0;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.5rem;
      margin: 0;
      color: var(--muted);
      font-size: 0.875rem;
    }
    .samples {
      display: inline-flex;
    }
  `,
})
export class BadgeLegendComponent {
  protected readonly Format = Format;
  protected readonly LyricTiming = LyricTiming;
  protected readonly hidden = signal(readStore(KEY) === '1');

  protected hide(): void {
    writeStore(KEY, '1');
    this.hidden.set(true);
  }

  protected show(): void {
    removeStore(KEY);
    this.hidden.set(false);
  }
}
