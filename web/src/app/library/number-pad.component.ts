import { Component, inject, OnDestroy, signal } from '@angular/core';
import { Code } from '@connectrpc/connect';
import { CatalogService } from '../../gen/kantahe/v1/catalog_pb';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { injectClient } from '../core/api';
import { problem } from '../core/errors';
import { FormatBadgeComponent } from './format-badge.component';
import { LibraryActions } from './library-actions';

const LOOKUP_DELAY_MS = 150;
const MAX_DIGITS = 20;

@Component({
  selector: 'app-number-pad',
  imports: [FormatBadgeComponent],
  host: { '(window:keydown)': 'onKey($event)' },
  template: `
    <output class="digits" aria-live="polite" aria-label="Song number">{{ digits() }}</output>
    <div class="result" aria-live="polite">
      @if (status() === 'looking') {
        <p>Looking…</p>
      } @else if (status() === 'missing') {
        <p>No song with this number</p>
      } @else if (status() === 'error') {
        <p class="error">{{ message() }}</p>
      } @else if (digits() === '') {
        <p class="hint">Type the number of a song on the keys, or on the keyboard.</p>
      } @else if (found(); as s) {
        <p class="found">
          <span class="num">{{ s.number }}</span>
          <strong>{{ s.title }}</strong>
          <span>{{ s.artist }}</span>
          <app-format-badge [format]="s.format" />
        </p>
      }
    </div>
    <div class="keys" role="group" aria-label="Number pad">
      @for (d of top; track d) {
        <button type="button" (click)="press(d)">{{ d }}</button>
      }
      <button type="button" aria-label="Clear" (click)="clear()">C</button>
      <button type="button" (click)="press('0')">0</button>
      <button type="button" aria-label="Backspace" (click)="backspace()">⌫</button>
    </div>
    <button type="button" class="add" [disabled]="!found()" (click)="add()">Add to queue</button>
  `,
  styles: `
    :host {
      display: block;
      max-width: 20rem;
      margin: 0 auto;
    }
    .digits {
      display: block;
      min-height: 3rem;
      font-size: 2rem;
      letter-spacing: 0.15em;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .result {
      min-height: 3.5rem;
      text-align: center;
    }
    .found {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
      align-items: center;
    }
    .num {
      color: var(--muted);
    }
    .keys {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .keys button {
      min-height: 3.5rem;
      font-size: 1.5rem;
    }
    .add {
      width: 100%;
    }
  `,
})
export class NumberPadComponent implements OnDestroy {
  private readonly catalog = injectClient(CatalogService);
  private readonly actions = inject(LibraryActions);

  protected readonly top = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  protected readonly digits = signal('');
  protected readonly status = signal<'idle' | 'looking' | 'found' | 'missing' | 'error'>('idle');
  protected readonly found = signal<Song | undefined>(undefined);
  protected readonly message = signal('');

  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private lookingUp?: AbortController;

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.lookingUp?.abort();
    this.generation++;
  }

  protected press(d: string): void {
    if (this.digits().length < MAX_DIGITS) this.change(this.digits() + d);
  }

  protected backspace(): void {
    this.change(this.digits().slice(0, -1));
  }

  protected clear(): void {
    this.change('');
  }

  protected async add(): Promise<void> {
    const song = this.found();
    if (song && (await this.actions.add(song))) this.clear();
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (/^[0-9]$/.test(e.key)) this.press(e.key);
    else if (e.key === 'Backspace') this.backspace();
    else if (e.key === 'Escape' || e.key === 'Delete') this.clear();
    else if (e.key === 'Enter' && !(target instanceof HTMLButtonElement)) void this.add(); // on a button, Enter clicks it
  }

  private change(digits: string): void {
    this.digits.set(digits);
    clearTimeout(this.timer);
    this.lookingUp?.abort();
    const mine = ++this.generation;
    this.found.set(undefined);
    this.message.set('');
    if (digits === '') {
      this.status.set('idle');
      return;
    }
    this.status.set('looking');
    this.timer = setTimeout(() => void this.lookup(digits, mine), LOOKUP_DELAY_MS);
  }

  private async lookup(digits: string, mine: number): Promise<void> {
    const request = new AbortController();
    this.lookingUp = request;
    try {
      const res = await this.catalog.getSong({ number: digits }, { signal: request.signal });
      if (mine !== this.generation) return;
      this.actions.adopt(res.song ? [res.song] : []);
      this.found.set(res.song);
      this.status.set(res.song ? 'found' : 'missing');
    } catch (e) {
      if (mine !== this.generation) return;
      const message = problem(e, { [Code.NotFound]: '' });
      this.status.set(message === '' ? 'missing' : 'error');
      this.message.set(message);
    }
  }
}
