import { Component, computed, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService } from '../../gen/kantahe/v1/admin_pb';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { fromServer, problem } from '../core/errors';
import { ToastService } from '../core/toast';
import { FormatBadgeComponent } from './format-badge.component';
import { LibraryActions } from './library-actions';
import { PageBarComponent } from './page-bar.component';
import { PageWindow } from './page-window';
import { PlaylistPickerComponent } from './playlist-picker.component';

@Component({
  selector: 'app-song-list',
  imports: [FormatBadgeComponent, PageBarComponent, PlaylistPickerComponent],
  template: `
    <ul #list class="songs">
      @for (s of win.rows(); track s.number) {
        <li class="row">
          <button type="button" class="main" [disabled]="s.failed" [attr.aria-label]="'Add ' + s.title + ' by ' + s.artist + ' to the queue'" (click)="actions.add(s)">
            <span class="num">{{ s.number }}</span>
            <span class="info">
              <span class="title" [attr.title]="s.title">{{ s.title }}</span>
              <span class="artist" [attr.title]="s.artist">{{ s.artist }}</span>
              @if (s.failed) {
                <span class="artist">This song can't be played.</span>
              }
            </span>
            <app-format-badge [format]="s.format" />
          </button>
          <span class="actions">
            <button type="button" class="star" [attr.aria-pressed]="actions.isFavourite(s)" [attr.aria-label]="'Favourite: ' + s.title" (click)="actions.toggleFavourite(s)">
              {{ actions.isFavourite(s) ? '★' : '☆' }}
            </button>
            <button type="button" class="menu" [attr.aria-expanded]="pickerFor() === s.number" [attr.aria-label]="'Add ' + s.title + ' to a playlist'" title="Add to a playlist" (click)="togglePicker(s.number)">＋</button>
            @if (isAdmin()) {
              <button type="button" class="delete" [attr.aria-label]="'Delete ' + s.title + ' by ' + s.artist" title="Delete" (click)="deleting.set(s.number)">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 12H7L6 9z" /></svg>
              </button>
            }
          </span>
          @if (deleting() === s.number) {
            <div class="confirm picker-slot" role="alert">
              <span>Take "{{ s.title }}" off the list, or delete its file too?</span>
              <button type="button" (click)="remove(s, true)">Remove from list</button>
              <button type="button" class="danger" (click)="remove(s, false)">Delete file too</button>
              <button type="button" (click)="deleting.set(undefined)">Cancel</button>
            </div>
          }
          @if (deleteError()[s.number]) {
            <p class="error picker-slot" role="alert">{{ deleteError()[s.number] }}</p>
          }
          @if (pickerFor() === s.number) {
            <app-playlist-picker class="picker-slot" [song]="s" (closed)="pickerFor.set(undefined)" />
          }
        </li>
      }
    </ul>
    @if (loading()) {
      <p role="status">Loading…</p>
    } @else if (visible().length === 0 && !failed()) {
      <p>{{ emptyText() }}</p>
    }
    <app-page-bar [win]="win" [hasMore]="hasMore()" />
  `,
  styles: `
    .songs {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      gap: 0.5rem;
      /* the buttons of one row stay 8 px away from those of the row above and below */
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--line);
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .main {
      /* a row of at least 14rem for the text: below that the buttons go to a second line instead of squeezing the title */
      flex: 1 1 14rem;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      font-weight: 400;
    }
    .num {
      min-width: 3.5rem;
      font-variant-numeric: tabular-nums;
      color: var(--muted);
    }
    .info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    /* a long title or artist is cut to two lines: the whole text is in the tooltip and in the button's label */
    .title {
      font-weight: 600;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .artist {
      color: var(--muted);
      font-size: 0.875rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .star {
      min-width: 2.75rem;
      padding: 0.25rem;
      background: transparent;
      color: var(--sung);
      font-size: 1.25rem;
    }
    .menu {
      min-width: 2.75rem;
      padding: 0.25rem;
      background: transparent;
      color: inherit;
      font-size: 1.25rem;
    }
    .picker-slot {
      flex-basis: 100%;
    }
    .delete {
      min-width: 2.75rem;
      padding: 0.25rem;
      background: transparent;
      color: var(--danger);
    }
    .confirm .danger {
      background: var(--danger);
      color: var(--paper);
    }
    .confirm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
    }
  `,
})
export class SongListComponent {
  protected readonly actions = inject(LibraryActions);
  /** The song whose playlist picker is open. */
  protected readonly pickerFor = signal<string | undefined>(undefined);

  private readonly admins = injectClient(AdminService);
  private readonly auth = inject(AuthStore);
  private readonly toasts = inject(ToastService);
  /** Delete is for administrators: it removes the song together with its file. */
  protected readonly isAdmin = computed(() => this.auth.user()?.admin === true);
  protected readonly deleting = signal<string | undefined>(undefined);
  protected readonly deleteError = signal<Record<string, string>>({});
  /** Songs deleted here: they leave the list at once, whatever the page that owns the list does. */
  private readonly removed = signal<ReadonlySet<string>>(new Set());

  readonly songs = input.required<Song[]>();
  protected readonly visible = computed(() => this.songs().filter((s) => !this.removed().has(s.number)));
  readonly hasMore = input(false);
  readonly loading = input(false);
  /**
   * Read the next page ahead by itself. Off while the list shows an error, so that a dead link is not asked
   * again and again: Next and Try again are then the way on.
   */
  readonly autoMore = input(true);
  readonly emptyText = input('No songs found.');
  /** The load failed: the page shows the error, so the list does not say that nothing was found. */
  readonly failed = input(false);
  /** The next page is wanted from the server (read ahead, or Next was pressed on the last page that is loaded). */
  readonly more = output<void>();

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  /** One page of rows at a time: thousands of songs must not become thousands of rows. */
  protected readonly win = new PageWindow<Song>({
    items: this.visible,
    hasMore: this.hasMore,
    loading: this.loading,
    auto: this.autoMore,
    more: () => this.more.emit(),
  });

  /** keepFile: only take the song off the list; otherwise its file is deleted too. */
  protected async remove(s: Song, keepFile: boolean): Promise<void> {
    this.deleteError.update((m) => ({ ...m, [s.number]: '' }));
    try {
      await this.admins.deleteSong({ number: s.number, keepFile });
      this.toasts.show(keepFile ? `Removed ${s.title} from the list` : `Deleted ${s.title} and its file`);
    } catch (e) {
      // already gone (another administrator): the list was out of date, not the delete wrong
      if (ConnectError.from(e).code !== Code.NotFound) {
        this.deleteError.update((m) => ({ ...m, [s.number]: problem(e, { [Code.FailedPrecondition]: fromServer }) }));
        return;
      }
    }
    this.removed.update((r) => new Set(r).add(s.number));
    this.deleting.set(undefined);
  }

  protected togglePicker(number: string): void {
    this.pickerFor.update((open) => (open === number ? undefined : number));
  }

  constructor() {
    // a new page starts at the top of the list, not at the Next button that was pressed
    let shown = 0;
    effect(() => {
      const c = this.win.current();
      if (c !== shown) this.list()?.nativeElement.scrollIntoView?.({ block: 'start' });
      shown = c;
    });
  }
}
