import { Component, DestroyRef, ElementRef, inject, signal, viewChildren } from '@angular/core';
import { CatalogService } from '../../gen/kantahe/v1/catalog_pb';
import { Format, Song } from '../../gen/kantahe/v1/common_pb';
import { injectClient } from '../core/api';
import { fieldValue } from '../auth/form';
import { AlphaBrowseComponent } from './alpha-browse.component';
import { NumberPadComponent } from './number-pad.component';
import { Pager } from './paged';
import { LibraryActions } from './library-actions';
import { SongListComponent } from './song-list.component';

const SEARCH_DELAY_MS = 250;

type Tab = 'search' | 'number' | 'browse';
const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'number', label: 'Number' },
  { id: 'browse', label: 'Browse' },
];

@Component({
  selector: 'app-library-page',
  imports: [SongListComponent, NumberPadComponent, AlphaBrowseComponent],
  template: `
    <main class="library">
      <h1>Library</h1>
      <div role="tablist" aria-label="Find a song">
        @for (t of tabs; track t.id) {
          <button
            #tabButton
            type="button"
            role="tab"
            [id]="'tab-' + t.id"
            [attr.aria-selected]="tab() === t.id"
            [attr.aria-controls]="'panel-' + t.id"
            [tabIndex]="tab() === t.id ? 0 : -1"
            (click)="select(t.id)"
            (keydown)="onKey($event, t.id)"
          >
            {{ t.label }}
          </button>
        }
      </div>
      <div role="tabpanel" [id]="'panel-' + tab()" [attr.aria-labelledby]="'tab-' + tab()">
        @switch (tab()) {
          @case ('search') {
            <div class="field">
              <label for="search">Search songs</label>
              <input id="search" type="search" autocomplete="off" [value]="query()" (input)="onQuery($event)" />
            </div>
            <div class="chips" role="group" aria-label="Format">
              @for (c of chips; track c.label) {
                <button type="button" class="toggle" [attr.aria-pressed]="format() === c.format" (click)="setFormat(c.format)">{{ c.label }}</button>
              }
            </div>
            @if (songs.error()) {
              <p class="error" role="alert">{{ songs.error() }} <button type="button" (click)="songs.retry()">Try again</button></p>
            }
            <app-song-list [songs]="songs.items()" [hasMore]="songs.hasMore()" [loading]="songs.loading()" [autoMore]="!songs.error()" [failed]="!!songs.error()" (more)="songs.more()" />
          }
          @case ('number') {
            <app-number-pad />
          }
          @case ('browse') {
            <app-alpha-browse />
          }
        }
      </div>
    </main>
  `,
  styles: `
    .library {
      /* a reading column: wider, the title and the buttons of a row are too far apart; left aligned in the frame */
      max-width: 48rem;
      padding: 1rem;
    }
    [role='tablist'] {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--line);
    }
    [role='tab'] {
      background: transparent;
      color: inherit;
      border-radius: 0.5rem 0.5rem 0 0;
    }
    [role='tab'][aria-selected='true'] {
      background: var(--accent);
      color: var(--on-accent);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    input[type='search'] {
      width: 100%;
      min-height: 2.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--field-line);
      border-radius: 0.5rem;
      background: transparent;
      color: inherit;
      font: inherit;
    }
  `,
})
export class LibraryPage {
  private readonly catalog = injectClient(CatalogService);
  private readonly actions = inject(LibraryActions);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('search');
  protected readonly query = signal('');
  protected readonly format = signal(Format.UNSPECIFIED);
  protected readonly chips = [
    { label: 'All', format: Format.UNSPECIFIED },
    { label: 'MP3', format: Format.MP3 },
    { label: 'MIDI', format: Format.MIDI },
  ];

  /**
   * The query and format of the list on screen. A page token only fits the search it came from, so the text
   * typed since (before the delay has passed) must not reach the next page's request.
   */
  private activeQuery = '';
  private activeFormat = Format.UNSPECIFIED;

  protected readonly songs = new Pager<Song>(
    async (pageToken, signal) => {
      const r = await this.catalog.searchSongs({ query: this.activeQuery, format: this.activeFormat, pageToken }, { signal });
      this.actions.adopt(r.songs);
      return { items: r.songs, next: r.nextPageToken };
    },
    (s) => s.number,
  );

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.songs.cancel();
    });
    void this.songs.reset();
  }

  protected select(t: Tab): void {
    this.tab.set(t);
  }

  protected onKey(e: KeyboardEvent, current: Tab): void {
    const i = TABS.findIndex((t) => t.id === current);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    this.tab.set(TABS[next].id);
    queueMicrotask(() => this.tabButtons()[next]?.nativeElement.focus());
  }

  protected onQuery(e: Event): void {
    this.query.set(fieldValue(e));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.searchNow(), SEARCH_DELAY_MS);
  }

  protected setFormat(f: Format): void {
    this.format.set(f);
    this.searchNow();
  }

  /** Starts a new search with what is typed and chosen now. */
  private searchNow(): void {
    clearTimeout(this.timer);
    this.activeQuery = this.query().trim();
    this.activeFormat = this.format();
    void this.songs.reset();
  }
}
