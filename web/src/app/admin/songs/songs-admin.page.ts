import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { CatalogService } from '../../../gen/kantahe/v1/catalog_pb';
import { Song } from '../../../gen/kantahe/v1/common_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { fieldValue } from '../../auth/form';
import { FormatBadgeComponent } from '../../library/format-badge.component';
import { BrokenSongsComponent } from './broken-songs.component';
import { PageBarComponent } from '../../library/page-bar.component';
import { Pager } from '../../library/paged';
import { PageWindow } from '../../library/page-window';

const SEARCH_DELAY_MS = 250;
/** The most songs one removal takes (the server's limit). */
const MAX_SELECTED = 1000;

@Component({
  selector: 'app-songs-admin-page',
  imports: [BrokenSongsComponent, FormatBadgeComponent, PageBarComponent],
  template: `
    <h2>Songs</h2>
    <div class="field">
      <label for="admin-search">Search songs</label>
      <input id="admin-search" type="search" autocomplete="off" [value]="query()" (input)="onQuery($event)" />
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
              <button type="button" (click)="removeSelected(true)" [disabled]="selBusy()">Yes, delete</button>
            } @else {
              <span>Take {{ selectedCount() }} {{ selectedCount() === 1 ? 'song' : 'songs' }} off the list? The files stay where they are.</span>
              <button type="button" (click)="removeSelected(false)" [disabled]="selBusy()">Yes, remove</button>
            }
            <button type="button" (click)="selAsk.set(undefined)" [disabled]="selBusy()">Cancel</button>
          </div>
        } @else {
          <div class="buttons">
            <button type="button" (click)="selAsk.set('list')">Remove from list</button>
            <button type="button" (click)="selAsk.set('files')">Delete files too</button>
            <button type="button" (click)="clearSelection()">Clear selection</button>
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
          <th scope="col" role="columnheader">Number</th>
          <th scope="col" role="columnheader">Title</th>
          <th scope="col" role="columnheader">Artist</th>
          <th scope="col" role="columnheader">Format</th>
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
            <td role="cell" class="actions">
              @if (deleting() === s.number) {
                <span>Take "{{ s.title }}" off the list, or delete its file too?</span>
                <button type="button" (click)="remove(s, true)">Remove from list</button>
                <button type="button" (click)="remove(s, false)">Delete file too</button>
                <button type="button" (click)="deleting.set(undefined)">Cancel</button>
              } @else {
                <button type="button" [attr.aria-label]="'Edit ' + s.title" (click)="edit(s)">Edit</button>
                <button type="button" [attr.aria-label]="'Delete ' + s.title" (click)="deleting.set(s.number)">Delete</button>
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
      <p>No songs found.</p>
    }
    <app-page-bar [win]="win" [hasMore]="pager.hasMore()" />
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
          <button type="button" (click)="save(e)" [disabled]="saving()">Save</button>
          <button type="button" (click)="editing.set(undefined)">Cancel</button>
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
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
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
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.45);
    }
    /* the dialog fits a phone on its side and one with the keyboard open: it starts near the top and scrolls inside */
    .dialog {
      position: fixed;
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

  protected readonly query = signal('');
  protected readonly pager = new Pager<Song>(
    async (pageToken, signal) => {
      const r = await this.catalog.searchSongs({ query: this.query().trim(), pageToken }, { signal });
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
