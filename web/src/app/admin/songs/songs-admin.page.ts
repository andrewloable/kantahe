import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService, RemoveScope } from '../../../gen/kantahe/v1/admin_pb';
import { CatalogService } from '../../../gen/kantahe/v1/catalog_pb';
import { Song } from '../../../gen/kantahe/v1/common_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { fieldValue } from '../../auth/form';
import { FormatBadgeComponent } from '../../library/format-badge.component';
import { PageBarComponent } from '../../library/page-bar.component';
import { Pager } from '../../library/paged';
import { PageWindow } from '../../library/page-window';

const SEARCH_DELAY_MS = 250;

@Component({
  selector: 'app-songs-admin-page',
  imports: [FormatBadgeComponent, PageBarComponent],
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
    <section class="bulk" aria-labelledby="bulk-title">
      <h3 id="bulk-title">Remove songs from the list</h3>
      <p class="hint">The song files are never deleted.</p>
      @if (bulkAsk(); as ask) {
        <div class="confirm" role="alert">
          <span>
            @if (ask === 'all') {
              Take every song off the list?
            } @else {
              Take every MIDI song that has no instruments, only lyric timing, off the list?
            }
            The files stay where they are.
          </span>
          <button type="button" (click)="removeSongs(ask)" [disabled]="bulkBusy()">Remove</button>
          <button type="button" (click)="bulkAsk.set(undefined)" [disabled]="bulkBusy()">Cancel</button>
        </div>
      } @else {
        <button type="button" (click)="bulkAsk.set('noMusic')">Remove songs with no music</button>
        <button type="button" (click)="bulkAsk.set('all')">Remove all songs</button>
      }
      @if (bulkResult()) {
        <p role="status">{{ bulkResult() }}</p>
      }
      @if (bulkError()) {
        <p class="error" role="alert">{{ bulkError() }}</p>
      }
    </section>
    @if (pager.error()) {
      <p class="error" role="alert">{{ pager.error() }} <button type="button" (click)="pager.retry()">Try again</button></p>
    }
    <table>
      <thead>
        <tr>
          <th scope="col">Number</th>
          <th scope="col">Title</th>
          <th scope="col">Artist</th>
          <th scope="col">Format</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        @for (s of win.rows(); track s.number) {
          <tr>
            <td>{{ s.number }}</td>
            <td>{{ s.title }}</td>
            <td>{{ s.artist }}</td>
            <td><app-format-badge [format]="s.format" /></td>
            <td class="actions">
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
    } @else if (pager.loaded() && pager.items().length === 0) {
      <p>No songs found.</p>
    }
    <app-page-bar [win]="win" [hasMore]="pager.hasMore()" />
    @if (editing(); as e) {
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
        <button type="button" (click)="save(e)" [disabled]="saving()">Save</button>
        <button type="button" (click)="editing.set(undefined)">Cancel</button>
      </div>
    }
  `,
  styles: `
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
    .dialog {
      position: fixed;
      left: 50%;
      top: 20%;
      transform: translateX(-50%);
      width: min(28rem, 92vw);
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      background: var(--panel);
      box-shadow: 0 8px 30px rgb(0 0 0 / 0.4);
    }
    .bulk {
      margin: 1rem 0;
    }
    .bulk h3 {
      margin: 0;
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
  protected readonly bulkAsk = signal<'all' | 'noMusic' | undefined>(undefined);
  protected readonly bulkBusy = signal(false);
  protected readonly bulkResult = signal('');
  protected readonly bulkError = signal('');
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

  /** Takes many songs off the list; the server never deletes a song file for this. */
  protected async removeSongs(which: 'all' | 'noMusic'): Promise<void> {
    this.bulkBusy.set(true);
    this.bulkResult.set('');
    this.bulkError.set('');
    try {
      const r = await this.admins.removeSongs({ scope: which === 'all' ? RemoveScope.ALL : RemoveScope.NO_MUSIC });
      this.bulkResult.set(r.removed === 1 ? 'Removed 1 song from the list. Its file was kept.' : `Removed ${r.removed} songs from the list. Their files were kept.`);
      this.bulkAsk.set(undefined);
      void this.pager.reset();
    } catch (e) {
      this.bulkError.set(problem(e, {}));
    } finally {
      this.bulkBusy.set(false);
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
