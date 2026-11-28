import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, Injector, signal, viewChild, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../gen/kantahe/v1/catalog_pb';
import { Format, Song } from '../../gen/kantahe/v1/common_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { KeyboardShortcuts } from '../core/shortcuts';
import { fieldValue } from '../auth/form';
import { NumberPadComponent } from './number-pad.component';
import { Pager } from './paged';
import { LibraryActions } from './library-actions';
import { SongListComponent } from './song-list.component';

const SEARCH_DELAY_MS = 250;

type Tab = 'search' | 'number';
const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'number', label: 'Number' },
];

@Component({
  selector: 'app-library-page',
  imports: [SongListComponent, NumberPadComponent, RouterLink],
  host: { '(document:keydown)': 'onShortcut($event)' },
  template: `
    <div class="library">
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
            <!-- on a phone the field and the chips stick to the top while the results scroll under them (kantahe-du1.5) -->
            <div class="search-bar" #searchBar>
              <div class="field">
                <label for="search">Search songs</label>
                <input
                  id="search"
                  type="search"
                  autocomplete="off"
                  enterkeyhint="search"
                  [value]="query()"
                  (input)="onQuery($event)"
                  (focus)="onSearchFocus()"
                  (keydown.enter)="onEnter($event)"
                />
              </div>
              <div class="chips" role="group" aria-label="Format">
                @for (c of chips; track c.label) {
                  <button type="button" class="toggle" [attr.aria-pressed]="format() === c.format" (click)="setFormat(c.format)">{{ c.label }}</button>
                }
              </div>
            </div>
            <div class="results">
            @if (songs.error()) {
              <p class="error" role="alert">{{ songs.error() }} <button type="button" (click)="songs.retry()">Try again</button></p>
            }
            @if (emptyLibrary()) {
              <p class="empty-library" role="status">
                The library is empty.
                @if (isAdmin()) {
                  Add songs with <a data-inline-link routerLink="/admin/upload">Upload</a>, or put them in a watched folder on the server.
                } @else {
                  Ask your administrator to add songs.
                }
              </p>
            }
            <app-song-list [songs]="songs.items()" [allowDelete]="true" [emptyText]="emptyLibrary() ? '' : 'No songs found.'" [hasMore]="songs.hasMore()" [loading]="songs.loading()" [autoMore]="!songs.error()" [failed]="!!songs.error()" (more)="songs.more()" />
            </div>
          }
          @case ('number') {
            <app-number-pad />
          }
        }
      </div>
    </div>
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
      border: 0;
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
    /* A phone: the keyboard takes the lower half of the window. The field and the chips go to the top of the window when the field takes the
       focus and stay there, so the space between them and the keyboard shows results; the results area is at least a window high, so that the
       field can always reach the top (kantahe-du1.5) */
    @media (max-width: 40rem), (max-height: 30rem) {
      .search-bar {
        position: sticky;
        top: 0;
        z-index: 5;
        margin-top: -0.5rem;
        padding-top: 0.5rem;
        background: var(--paper);
      }
      .results {
        min-height: 100vh;
        min-height: 100dvh;
      }
    }
    /* a phone on its side: the keyboard leaves about 190 px, so the chips sit beside the field and the bar is one row (kantahe-du1.6) */
    @media (max-height: 30rem) and (min-width: 40.01rem) {
      .search-bar {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
      }
      .search-bar .field {
        flex: 1;
        margin-bottom: 0.5rem;
      }
      .search-bar .chips {
        flex-wrap: nowrap;
      }
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
  private readonly searchBar = viewChild<ElementRef<HTMLElement>>('searchBar');

  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('search');
  protected readonly query = signal('');
  private readonly auth = inject(AuthStore);
  private readonly shortcuts = inject(KeyboardShortcuts);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly isAdmin = computed(() => this.auth.user()?.admin === true);
  /** The search that was made asked for everything (no words, no format): when nothing comes back, the library itself is empty. */
  private readonly askedForEverything = signal(true);
  protected readonly emptyLibrary = computed(() => this.askedForEverything() && !this.songs.loading() && !this.songs.error() && this.songs.items().length === 0);
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
    // the keyboard of a phone opens after the focus (iOS) and changes the visible part of the window: bring the field up again then
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    const onResize = () => {
      if (document.activeElement?.id === 'search') this.bringSearchUp();
    };
    vv?.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => {
      vv?.removeEventListener('resize', onResize);
      clearTimeout(this.timer);
      this.songs.cancel();
    });
    void this.songs.reset();
  }

  /** A phone, upright (the tab bar layout) or on its side (a short window): there the keyboard covers the results. */
  private phone(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(max-width: 40rem), (max-height: 30rem)').matches;
  }

  /** On a phone, the field and the chips go to the top of the window, so that the results fill the space above the keyboard. */
  private bringSearchUp(): void {
    if (this.phone()) this.searchBar()?.nativeElement.scrollIntoView({ block: 'start' });
  }

  protected onSearchFocus(): void {
    requestAnimationFrame(() => this.bringSearchUp());
  }

  /** The Search key (Enter): search now, and take the focus off the field so that the phone's keyboard closes. */
  protected onEnter(e: Event): void {
    this.searchNow();
    (e.target as HTMLInputElement).blur();
  }

  protected select(t: Tab): void {
    this.tab.set(t);
  }

  /** / goes to the search box (from the Number tab: back to Search first). */
  protected onShortcut(e: KeyboardEvent): void {
    if (e.key !== '/' || !this.shortcuts.accepts(e)) return;
    e.preventDefault();
    this.tab.set('search');
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>('#search')?.focus(), { injector: this.injector });
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
    this.askedForEverything.set(this.activeQuery === '' && this.activeFormat === Format.UNSPECIFIED);
    // a page scrolled down the old results goes back to the first new result (the bar is stuck at the top of it)
    const bar = this.searchBar()?.nativeElement;
    if (bar && this.phone() && bar.parentElement && window.scrollY > bar.parentElement.getBoundingClientRect().top + window.scrollY) this.bringSearchUp();
    void this.songs.reset();
  }
}
