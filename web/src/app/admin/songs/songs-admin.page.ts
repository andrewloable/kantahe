import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { CatalogService, SongSort } from '../../../gen/kantahe/v1/catalog_pb';
import { Format, LyricTiming, Song } from '../../../gen/kantahe/v1/common_pb';
import { UploadService, UploadStatus } from '../../../gen/kantahe/v1/upload_pb';
import { injectClient } from '../../core/api';
import { ServerUrl } from '../../core/server-url';
import { fromServer, problem } from '../../core/errors';
import { fieldValue } from '../../auth/form';
import { FormatBadgeComponent } from '../../library/format-badge.component';
import { BrokenSongsComponent } from './broken-songs.component';
import { PageBarComponent } from '../../library/page-bar.component';
import { Pager } from '../../library/paged';
import { PageWindow } from '../../library/page-window';
import { mediaUrl } from '../../player/engines/engine';
import { FileDownloader } from './file-downloader';
import { ActionMenuComponent, MenuItem } from '../../shared/action-menu.component';

const SEARCH_DELAY_MS = 250;

/** The columns the list can be sorted by, and the order the server is asked for. */
const SORTS = {
  number: { label: 'Number', sort: SongSort.NUMBER },
  title: { label: 'Title', sort: SongSort.TITLE },
  artist: { label: 'Artist', sort: SongSort.ARTIST },
  format: { label: 'Format', sort: SongSort.FORMAT },
  timing: { label: 'Lyrics', sort: SongSort.LYRIC_TIMING },
  vocals: { label: 'Vocals', sort: SongSort.VOCALS },
} as const;
type SortKey = keyof typeof SORTS;
const SORT_KEYS = Object.keys(SORTS) as SortKey[];
/** The most songs one removal takes (the server's limit). */
const MAX_SELECTED = 1000;

@Component({
  selector: 'app-songs-admin-page',
  imports: [BrokenSongsComponent, FormatBadgeComponent, PageBarComponent, ActionMenuComponent],
  template: `
    <h2>Songs</h2>
    <div class="field">
      <label for="admin-search">Search songs</label>
      <input id="admin-search" type="search" autocomplete="off" [value]="query()" (input)="onQuery($event)" />
    </div>
    <div class="filters" role="group" aria-label="Filter the songs">
      <div class="field">
        <label for="filter-format">Format</label>
        <select id="filter-format" (change)="setFormat($event)">
          <option value="0" [selected]="format() === Format.UNSPECIFIED">All</option>
          <option [value]="Format.MP3" [selected]="format() === Format.MP3">MP3</option>
          <option [value]="Format.MIDI" [selected]="format() === Format.MIDI">MIDI</option>
        </select>
      </div>
      <div class="field">
        <label for="filter-vocals">Vocals</label>
        <select id="filter-vocals" (change)="setVocals($event)">
          <option value="any" [selected]="vocals() === 'any'">Any</option>
          <option value="with" [selected]="vocals() === 'with'">With vocals</option>
          <option value="without" [selected]="vocals() === 'without'">Without vocals</option>
        </select>
      </div>
      <div class="field">
        <label for="filter-timing">Lyrics</label>
        <select id="filter-timing" (change)="setTiming($event)">
          <option value="any" [selected]="timing() === 'any'">Any</option>
          <option value="word" [selected]="timing() === 'word'">By word</option>
          <option value="line" [selected]="timing() === 'line'">By line</option>
        </select>
      </div>
      @if (filtered()) {
        <button type="button" class="clear-filters quiet" (click)="clearFilters()">Clear filters</button>
      }
    </div>
    <!-- where the table turns into blocks the header row is hidden: this is the way to sort there -->
    <div class="sort-phone" role="group" aria-label="Sort the songs">
      <div class="field">
        <label for="sort-by">Sort by</label>
        <select id="sort-by" (change)="setSortKey($event)">
          <option value="" [selected]="sortKey() === ''">Best match</option>
          @for (k of sortKeys; track k) {
            <option [value]="k" [selected]="sortKey() === k">{{ sorts[k].label }}</option>
          }
        </select>
      </div>
      <button type="button" id="sort-direction" [disabled]="sortKey() === ''" (click)="toggleDirection()">{{ descending() ? 'Descending' : 'Ascending' }}</button>
    </div>
    <p>
      <button type="button" (click)="rescan()" [disabled]="scanning()">Rescan</button>
      @if (scanResult()) {
        <span role="status">{{ scanResult() }}</span>
      }
      @if (scanError()) {
        <span class="error" role="alert">{{ scanError() }}</span>
      }
    </p>
    <app-broken-songs />
    @if (pager.error()) {
      <p class="error" role="alert">{{ pager.error() }} <button type="button" (click)="pager.retry()">Try again</button></p>
    }
    @if (selectedCount() > 0) {
      <section class="selection" aria-label="Chosen songs">
        <p role="status">{{ selectedCount() }} {{ selectedCount() === 1 ? 'song' : 'songs' }} selected</p>
        @if (selectedLimit()) {
          <p class="hint">At most {{ maxSelected }} songs can be chosen at once.</p>
        }
        @if (selAsk(); as ask) {
          <div class="confirm" role="alert">
            @if (ask === 'files') {
              <span>Delete {{ selectedCount() }} {{ selectedCount() === 1 ? 'song' : 'songs' }} and their files? This cannot be undone.</span>
              <button class="danger primary" type="button" (click)="removeSelected(true)" [disabled]="selBusy()">Yes, delete</button>
            } @else {
              <span>Take {{ selectedCount() }} {{ selectedCount() === 1 ? 'song' : 'songs' }} off the list? The files stay where they are.</span>
              <button class="danger primary" type="button" (click)="removeSelected(false)" [disabled]="selBusy()">Yes, remove</button>
            }
            <button class="quiet" type="button" (click)="selAsk.set(undefined)" [disabled]="selBusy()">Cancel</button>
          </div>
        } @else {
          <div class="buttons">
            <button class="danger" type="button" (click)="selAsk.set('list')">Remove from list</button>
            <button class="danger" type="button" (click)="selAsk.set('files')">Delete files too</button>
            <button class="quiet" type="button" (click)="clearSelection()">Clear selection</button>
          </div>
        }
        @if (selError()) {
          <p class="error" role="alert">{{ selError() }}</p>
        }
      </section>
    }
    @if (selResult()) {
      <p class="selection-result" role="status">{{ selResult() }}</p>
    }
    <table role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th scope="col" role="columnheader" class="pick">
            <input id="select-page" type="checkbox" [checked]="allOnPage()" [indeterminate]="someOnPage()" (change)="togglePage($event)" />
            <label for="select-page" class="sr-only">Select all songs on this page</label>
          </th>
          @for (k of sortKeys; track k) {
            <th scope="col" role="columnheader" [attr.aria-sort]="ariaSort(k)">
              <button type="button" class="sort" [attr.aria-label]="sorts[k].label + ', sort'" (click)="sortBy(k)">
                {{ sorts[k].label }}<span aria-hidden="true" class="arrow">{{ arrow(k) }}</span>
              </button>
              <!-- the column's name while the button is hidden (narrow layout), so the header is never empty -->
              <span class="narrow-label">{{ sorts[k].label }}</span>
            </th>
          }
          <th scope="col" role="columnheader">Actions</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        @for (s of win.rows(); track s.number) {
          <tr role="row">
            <td role="cell" class="pick">
              <input type="checkbox" [checked]="selected().has(s.number)" [attr.aria-label]="'Select song ' + s.number" (change)="toggle(s.number, $event)" />
            </td>
            <td role="cell" class="number">{{ s.number }}</td>
            <td role="cell">{{ s.title }}</td>
            <td role="cell">{{ s.artist }}</td>
            <td role="cell"><app-format-badge [format]="s.format" /></td>
            <td role="cell"><app-format-badge [format]="Format.UNSPECIFIED" [timing]="s.lyricTiming" /></td>
            <td role="cell"><app-format-badge [format]="Format.UNSPECIFIED" [vocals]="s.hasVocals" /></td>
            <td role="cell" class="actions" [class.one-line]="deleting() !== s.number && !rowNote()[s.number] && !rowError()[s.number]">
              @if (deleting() === s.number) {
                <span>Take "{{ s.title }}" off the list, or delete its file too?</span>
                <button class="danger" type="button" (click)="remove(s, true)">Remove from list</button>
                <button class="danger" type="button" (click)="remove(s, false)">Delete file too</button>
                <button class="quiet" type="button" (click)="deleting.set(undefined)">Cancel</button>
              } @else {
                <button type="button" [attr.aria-label]="'Edit ' + s.title" (click)="edit(s)">Edit</button>
                <!-- wide: the buttons; narrow (a phone): Edit and a More menu, so a song is not four buttons tall -->
                <span class="wide-only">
                  <button class="danger" type="button" [attr.aria-label]="'Delete ' + s.title" (click)="deleting.set(s.number)">Delete</button>
                  <button class="quiet" type="button" [attr.aria-label]="'Download ' + s.title" [disabled]="fileBusy() === s.number" (click)="download(s)">Download</button>
                  <button class="quiet" type="button" [attr.aria-label]="'Replace file: ' + s.title" [disabled]="fileBusy() === s.number" (click)="pickReplacement(s)">Replace file</button>
                </span>
                <app-action-menu class="narrow-only" [label]="'More actions for ' + s.title" [items]="menus().get(s.number) ?? []" />
              }
              @if (rowNote()[s.number]) {
                <span role="status">{{ rowNote()[s.number] }}</span>
              }
              @if (rowError()[s.number]) {
                <span class="error" role="alert">{{ rowError()[s.number] }}</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
    @if (pager.loading()) {
      <p role="status">Loading…</p>
    } @else if (pager.loaded() && pager.items().length === 0 && !pager.error()) {
      <p>{{ filtered() ? 'No songs match these filters.' : 'No songs found.' }}</p>
    }
    <app-page-bar [win]="win" [hasMore]="pager.hasMore()" />
    <!-- the one file picker that the Replace file buttons open -->
    <input id="replace-file" type="file" accept=".kar,.karmp3" hidden (change)="replacementChosen($event)" />
    @if (editing(); as e) {
      <div class="backdrop" aria-hidden="true" (click)="editing.set(undefined)"></div>
      <div class="dialog" role="dialog" aria-modal="true" data-back-closes [attr.aria-label]="'Edit song ' + e.number" (keydown.escape)="editing.set(undefined)">
        <h3>Edit song {{ e.number }}</h3>
        <div class="field">
          <label for="edit-title">Title</label>
          <input id="edit-title" type="text" [value]="title()" (input)="title.set(value($event))" />
        </div>
        <div class="field">
          <label for="edit-artist">Artist</label>
          <input id="edit-artist" type="text" [value]="artist()" (input)="artist.set(value($event))" />
        </div>
        <p class="hint">Empty a field to go back to what the song file says.</p>
        @if (editError()) {
          <p class="error" role="alert">{{ editError() }}</p>
        }
        <div class="buttons">
          <button class="primary" type="button" (click)="save(e)" [disabled]="saving()">Save</button>
          <button class="quiet" type="button" (click)="editing.set(undefined)">Cancel</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.4rem;
      text-align: left;
      border-bottom: 1px solid var(--line);
    }
    /* a long word in a title or an artist breaks instead of making the table wider than the page (a wide font makes it likelier) */
    td {
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    /* the buttons alone (no question, no message) stay on one line where the table has room (a desktop): a wrapping cell let the title
       columns take the room; on a tablet they may wrap, so that the table never gets wider than the window */
    @container (min-width: 60rem) {
      .actions.one-line {
        flex-wrap: nowrap;
      }
      /* and do not shrink: a squeezed button broke its label onto two lines */
      .actions.one-line button {
        flex-shrink: 0;
        white-space: nowrap;
      }
    }
    /* the checkbox of a row: a 44 px target, the box centred in it */
    .pick input[type='checkbox'] {
      width: 2.75rem;
      height: 2.75rem;
      margin: 0;
    }
    .pick {
      width: 1%;
    }
    .selection {
      margin: 0.75rem 0;
    }
    .selection .confirm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .filters .field {
      margin: 0;
    }
    .filters select,
    .sort-phone select {
      min-height: 2.75rem;
    }
    /* a column header that sorts: a plain button that looks like the header, at least as tall as the other controls */
    th button.sort {
      min-height: 2.75rem;
      padding: 0 0.25rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }
    th .arrow {
      display: inline-block;
      min-width: 1em;
      margin-left: 0.25rem;
    }
    /* the sort select is for the narrow layout, where the header row is hidden */
    .sort-phone {
      display: none;
    }
    .narrow-label,
    .narrow-only {
      display: none;
    }
    .wide-only {
      display: contents;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    /* the buttons of a dialog or a section: a gap between them and room above them */
    .buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    /* on a phone each song is a block: number and title, artist, format, then the buttons; the header row stays for screen readers */
    /* the width of the page's own box, in rem: with a larger text size a table that needs 44rem no longer fits, and the blocks come sooner */
    @container (max-width: 44rem) {
      .sort-phone {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      .sort-phone .field {
        margin: 0;
      }
      /* the header row is hidden here, and so are its buttons: invisible controls must not take the focus or be read out */
      thead th button.sort {
        visibility: hidden;
      }
      .narrow-label {
        display: inline;
      }

      .wide-only {
        display: none;
      }
      .narrow-only {
        display: inline-flex;
      }
      table,
      tbody,
      tr,
      td {
        display: block;
      }
      thead {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      tr {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--line);
      }
      td {
        padding: 0.15rem 0;
        border-bottom: 0;
        overflow-wrap: anywhere;
      }
      td.number {
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }
    }
    /* above the tab bar of a phone (z-index 20): the dialog is modal */
    .backdrop {
      position: fixed;
      z-index: 40;
      inset: 0;
      background: rgb(0 0 0 / 0.45);
    }
    /* the dialog fits a phone on its side and one with the keyboard open: it starts near the top and scrolls inside */
    .dialog {
      position: fixed;
      z-index: 41;
      left: 50%;
      top: 1rem;
      transform: translateX(-50%);
      width: min(28rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      overscroll-behavior-y: contain;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      background: var(--panel);
      box-shadow: 0 8px 30px rgb(0 0 0 / 0.4);
    }
    .confirm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .hint {
      color: var(--muted);
      font-size: 0.875rem;
    }
  `,
})
export class SongsAdminPage {
  private readonly catalog = injectClient(CatalogService);
  private readonly admins = injectClient(AdminService);
  private readonly uploads = injectClient(UploadService);
  private readonly downloader = inject(FileDownloader);
  private readonly serverUrl = inject(ServerUrl);

  protected readonly query = signal('');
  protected readonly Format = Format;
  protected readonly sorts = SORTS;
  protected readonly sortKeys = SORT_KEYS;
  /** The filters: all songs unless chosen. They are sent to the server, which pages the list. */
  protected readonly format = signal<Format>(Format.UNSPECIFIED);
  protected readonly vocals = signal<'any' | 'with' | 'without'>('any');
  protected readonly timing = signal<'any' | 'word' | 'line'>('any');
  protected readonly filtered = computed(() => this.format() !== Format.UNSPECIFIED || this.vocals() !== 'any' || this.timing() !== 'any');
  /** The column the list is sorted by ('' while a text search keeps its best-match order), and the direction. */
  protected readonly sortKey = signal<SortKey | ''>('');
  protected readonly descending = signal(false);
  protected readonly pager = new Pager<Song>(
    async (pageToken, signal) => {
      const key = this.sortKey();
      const r = await this.catalog.searchSongs(
        {
          query: this.query().trim(),
          format: this.format(),
          hasVocals: this.vocals() === 'any' ? undefined : this.vocals() === 'with',
          lyricTiming: this.timing() === 'word' ? LyricTiming.WORD : this.timing() === 'line' ? LyricTiming.LINE : LyricTiming.UNSPECIFIED,
          sort: key === '' ? SongSort.UNSPECIFIED : SORTS[key].sort,
          descending: key !== '' && this.descending(),
          pageToken,
        },
        { signal },
      );
      return { items: r.songs, next: r.nextPageToken };
    },
    (s) => s.number,
  );

  /** One page of rows at a time: thousands of songs must not become thousands of table rows. */
  protected readonly win = new PageWindow<Song>({
    items: this.pager.items,
    hasMore: this.pager.hasMore,
    loading: this.pager.loading,
    auto: () => !this.pager.error(),
    more: () => void this.pager.more(),
  });

  protected readonly editing = signal<Song | undefined>(undefined);
  protected readonly title = signal('');
  protected readonly artist = signal('');
  protected readonly editError = signal('');
  protected readonly saving = signal(false);
  protected readonly deleting = signal<string | undefined>(undefined);
  protected readonly rowError = signal<Record<string, string>>({});
  /** What the last Download or Replace of a row said ("Replaced 00001."). */
  protected readonly rowNote = signal<Record<string, string>>({});
  /** The number of the song whose Download or Replace call is running: its buttons are off. */
  protected readonly fileBusy = signal<string | undefined>(undefined);
  /** The More menu of each row in the narrow layout: the same actions as the wide buttons. */
  protected readonly menus = computed(() => {
    const busy = this.fileBusy();
    return new Map(
      this.win.rows().map((s): [string, MenuItem[]] => [
        s.number,
        [
          { label: 'Delete', danger: true, run: () => this.deleting.set(s.number) },
          { label: 'Download', disabled: busy === s.number, run: () => void this.download(s) },
          { label: 'Replace file', disabled: busy === s.number, run: () => this.pickReplacement(s) },
        ],
      ]),
    );
  });
  private replacing?: Song;
  /** The songs chosen with the checkboxes: kept across pages and searches, cleared after a removal. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly maxSelected = MAX_SELECTED;
  protected readonly selectedLimit = signal(false);
  protected readonly selAsk = signal<'list' | 'files' | undefined>(undefined);
  protected readonly selBusy = signal(false);
  protected readonly selResult = signal('');
  protected readonly selError = signal('');
  /** The songs of the page on show that are chosen: none, some or all of them. */
  protected readonly onPageChosen = computed(() => this.win.rows().filter((s) => this.selected().has(s.number)).length);
  protected readonly allOnPage = computed(() => this.win.rows().length > 0 && this.onPageChosen() === this.win.rows().length);
  protected readonly someOnPage = computed(() => this.onPageChosen() > 0 && !this.allOnPage());
  protected readonly scanning = signal(false);
  protected readonly scanResult = signal('');
  protected readonly scanError = signal('');
  protected readonly value = fieldValue;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.pager.cancel();
    });
    void this.pager.reset();
    // the cursor goes into the title when the edit window opens
    effect(() => {
      if (this.editing()) untracked(() => setTimeout(() => document.getElementById('edit-title')?.focus()));
    });
  }

  protected onQuery(e: Event): void {
    this.query.set(fieldValue(e));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.pager.reset(), SEARCH_DELAY_MS);
  }

  protected setFormat(e: Event): void {
    this.format.set(Number(fieldValue(e)) as Format);
    void this.pager.reset();
  }

  protected setVocals(e: Event): void {
    this.vocals.set(fieldValue(e) as 'any' | 'with' | 'without');
    void this.pager.reset();
  }

  protected setTiming(e: Event): void {
    this.timing.set(fieldValue(e) as 'any' | 'word' | 'line');
    void this.pager.reset();
  }

  protected clearFilters(): void {
    this.format.set(Format.UNSPECIFIED);
    this.vocals.set('any');
    this.timing.set('any');
    void this.pager.reset();
  }

  /** A header: ascending the first time, descending when it is the column already sorted by. */
  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) this.descending.update((d) => !d);
    else {
      this.sortKey.set(key);
      this.descending.set(false);
    }
    void this.pager.reset();
  }

  protected setSortKey(e: Event): void {
    const key = fieldValue(e) as SortKey | '';
    this.sortKey.set(key);
    this.descending.set(false);
    void this.pager.reset();
  }

  protected toggleDirection(): void {
    this.descending.update((d) => !d);
    void this.pager.reset();
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    return this.sortKey() !== key ? 'none' : this.descending() ? 'descending' : 'ascending';
  }

  protected arrow(key: SortKey): string {
    return this.sortKey() !== key ? '' : this.descending() ? '▼' : '▲';
  }

  private setRow(number: string, note: string, error: string): void {
    this.rowNote.update((m) => ({ ...m, [number]: note }));
    this.rowError.update((m) => ({ ...m, [number]: error }));
  }

  /** Saves the stored file of a song: the server gives a signed address and the browser downloads it. */
  protected async download(s: Song): Promise<void> {
    if (this.fileBusy()) return;
    this.setRow(s.number, '', '');
    this.fileBusy.set(s.number);
    try {
      const d = await this.admins.getSongDownload({ number: s.number });
      this.downloader.save(mediaUrl(this.serverUrl.base(), d.url), d.fileName);
    } catch (e) {
      this.setRow(s.number, '', problem(e, { [Code.PermissionDenied]: fromServer, [Code.NotFound]: fromServer }));
    } finally {
      this.fileBusy.set(undefined);
    }
  }

  /** Opens the file picker for the song whose file is to be replaced. */
  protected pickReplacement(s: Song): void {
    if (this.fileBusy()) return;
    this.replacing = s;
    document.getElementById('replace-file')?.click();
  }

  protected async replacementChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const s = this.replacing;
    input.value = ''; // the same file can be chosen again
    if (!file || !s || this.fileBusy()) return;
    this.setRow(s.number, '', '');
    this.fileBusy.set(s.number);
    try {
      const res = await this.uploads.uploadSong({ filename: file.name, content: new Uint8Array(await file.arrayBuffer()), replaceNumber: s.number });
      if (res.status === UploadStatus.UPDATED) {
        if (res.song) this.pager.items.update((all) => all.map((x) => (x.number === s.number ? res.song! : x)));
        this.setRow(s.number, `Replaced ${s.number}.`, '');
      } else if (res.status === UploadStatus.DUPLICATE) {
        this.setRow(s.number, 'That file is already this song.', '');
      } else {
        this.setRow(s.number, '', res.reason || 'The server did not accept this file.');
      }
    } catch (e) {
      this.setRow(s.number, '', problem(e, { [Code.PermissionDenied]: fromServer, [Code.FailedPrecondition]: fromServer }));
    } finally {
      this.fileBusy.set(undefined);
    }
  }

  protected edit(s: Song): void {
    this.title.set(s.title);
    this.artist.set(s.artist);
    this.editError.set('');
    this.editing.set(s);
  }

  /** Only the fields that were changed are sent; an emptied field removes the edit. */
  protected async save(s: Song): Promise<void> {
    const title = this.title() !== s.title ? this.title() : undefined;
    const artist = this.artist() !== s.artist ? this.artist() : undefined;
    if (title === undefined && artist === undefined) {
      this.editing.set(undefined);
      return;
    }
    this.saving.set(true);
    try {
      const res = await this.admins.updateSong({ number: s.number, title, artist });
      if (res.song) this.pager.items.update((all) => all.map((x) => (x.number === s.number ? res.song! : x)));
      this.editing.set(undefined);
    } catch (e) {
      if (ConnectError.from(e).code === Code.NotFound) {
        this.editError.set('That song no longer exists.');
        this.pager.items.update((all) => all.filter((x) => x.number !== s.number));
      } else {
        this.editError.set(problem(e, { [Code.InvalidArgument]: fromServer }));
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected toggle(number: string, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    if (on) {
      if (next.size >= MAX_SELECTED) {
        (event.target as HTMLInputElement).checked = false;
        this.selectedLimit.set(true);
        return;
      }
      next.add(number);
    } else {
      next.delete(number);
    }
    this.selectedLimit.set(false);
    this.setSelected(next);
  }

  /** The header checkbox: the songs of the page on show, up to the limit. */
  protected togglePage(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    for (const s of this.win.rows()) {
      if (!on) next.delete(s.number);
      else if (next.size < MAX_SELECTED) next.add(s.number);
      else this.selectedLimit.set(true);
    }
    if (!on) this.selectedLimit.set(false);
    this.setSelected(next);
  }

  protected clearSelection(): void {
    this.selectedLimit.set(false);
    this.setSelected(new Set());
  }

  private setSelected(next: Set<string>): void {
    this.selected.set(next);
    this.selAsk.set(undefined);
    this.selError.set('');
    this.selResult.set('');
  }

  /** Takes the chosen songs off the list; with deleteFiles their files are deleted too (the server does that only inside its folders). */
  protected async removeSelected(deleteFiles: boolean): Promise<void> {
    const numbers = [...this.selected()];
    this.selBusy.set(true);
    this.selError.set('');
    try {
      const r = await this.admins.removeSelectedSongs({ numbers, deleteFiles });
      const songs = r.removed === 1 ? '1 song' : `${r.removed} songs`;
      let text = deleteFiles ? `Removed ${songs} from the list.` : `Removed ${songs} from the list. ${r.removed === 1 ? 'Its file was' : 'Their files were'} kept.`;
      if (deleteFiles) {
        text += ` ${r.filesDeleted === 1 ? '1 file deleted' : `${r.filesDeleted} files deleted`}.`;
        if (r.filesFailed > 0) text += ` ${r.filesFailed === 1 ? '1 file could not be deleted' : `${r.filesFailed} files could not be deleted`} (outside the song folders or in use).`;
      }
      this.selected.set(new Set());
      this.selectedLimit.set(false);
      this.selAsk.set(undefined);
      this.selResult.set(text);
      void this.pager.reset();
    } catch (e) {
      this.selError.set(problem(e, { [Code.InvalidArgument]: fromServer, [Code.PermissionDenied]: fromServer }));
    } finally {
      this.selBusy.set(false);
    }
  }

  /** keepFile: only take the song off the list; otherwise its file is deleted too. */
  protected async remove(s: Song, keepFile: boolean): Promise<void> {
    this.rowError.update((m) => ({ ...m, [s.number]: '' }));
    try {
      await this.admins.deleteSong({ number: s.number, keepFile });
      this.pager.items.update((all) => all.filter((x) => x.number !== s.number));
      this.deleting.set(undefined);
    } catch (e) {
      if (ConnectError.from(e).code === Code.NotFound) {
        // already gone (another administrator): the list was out of date, not the delete wrong
        this.pager.items.update((all) => all.filter((x) => x.number !== s.number));
        this.deleting.set(undefined);
        return;
      }
      this.rowError.update((m) => ({ ...m, [s.number]: problem(e, { [Code.FailedPrecondition]: fromServer }) }));
    }
  }

  protected async rescan(): Promise<void> {
    this.scanning.set(true);
    this.scanResult.set('');
    this.scanError.set('');
    try {
      const r = await this.admins.rescan({});
      this.scanResult.set(`Added ${r.added}, updated ${r.updated}, removed ${r.removed}, failed ${r.failed}`);
      void this.pager.reset();
    } catch (e) {
      this.scanError.set(problem(e, { [Code.FailedPrecondition]: fromServer }));
    } finally {
      this.scanning.set(false);
    }
  }
}
