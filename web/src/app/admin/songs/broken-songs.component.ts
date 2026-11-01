import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService, BrokenSong, RemoveScope } from '../../../gen/kantahe/v1/admin_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { FormatBadgeComponent } from '../../library/format-badge.component';
import { PageBarComponent } from '../../library/page-bar.component';
import { Pager } from '../../library/paged';
import { PageWindow } from '../../library/page-window';

const PAGE_SIZE = 50;

const songs = (n: number) => (n === 1 ? '1 broken song' : `${n} broken songs`);

/** Admin > Songs, "Check the library": find the songs that cannot be played, list them with the reason, and remove them (files kept or deleted). */
@Component({
  selector: 'app-broken-songs',
  imports: [FormatBadgeComponent, PageBarComponent],
  template: `
    <section class="check" aria-labelledby="check-title">
      <h3 id="check-title">Check the library</h3>
      <p class="hint">Looks at every song file again: a missing file, a MIDI song without music, a damaged file. A broken song is hidden from everyone until it is removed, or repaired and checked again.</p>
      <button type="button" (click)="check()" [disabled]="checking()">Check for broken songs</button>
      @if (progress()) {
        <span role="status">{{ progress() }}</span>
      }
      @if (checkError()) {
        <span class="error" role="alert">{{ checkError() }}</span>
      }
      @if (total() > 0) {
        <h4>{{ label(total()) }}</h4>
        <ul class="broken-list">
          @for (b of win.rows(); track b.song?.number) {
            <li class="broken">
              <span class="num">{{ b.song?.number }}</span>
              <span class="what">
                <span class="title">{{ b.song?.title }}</span>
                <span class="artist">{{ b.song?.artist }}</span>
                <span class="why">{{ b.reason }}</span>
              </span>
              @if (b.song) {
                <app-format-badge [format]="b.song.format" />
              }
              <span class="row-actions">
                @if (asking() === b.song?.number) {
                  <span>Take "{{ b.song?.title }}" off the list, or delete its file too?</span>
                  <button type="button" (click)="removeOne(b, true)">Remove from list</button>
                  <button type="button" (click)="removeOne(b, false)">Delete file too</button>
                  <button type="button" (click)="asking.set(undefined)">Cancel</button>
                } @else {
                  <button type="button" [attr.aria-label]="'Remove ' + b.song?.title" (click)="asking.set(b.song?.number)">Remove</button>
                }
                @if (rowError()[b.song?.number ?? '']) {
                  <span class="error" role="alert">{{ rowError()[b.song?.number ?? ''] }}</span>
                }
              </span>
            </li>
          }
        </ul>
        <app-page-bar [win]="win" [hasMore]="pager.hasMore()" />
        @if (bulkAsk(); as ask) {
          <div class="ask" role="alert">
            <span>
              @if (ask === 'list') {
                Take {{ label(total()) }} off the list? The files stay where they are.
              } @else {
                Remove {{ label(total()) }} and delete their files? The files are deleted for good.
              }
            </span>
            <button type="button" (click)="removeAll(ask === 'files')" [disabled]="busy()">{{ ask === 'list' ? 'Remove' : 'Delete files' }}</button>
            <button type="button" (click)="bulkAsk.set(undefined)" [disabled]="busy()">Cancel</button>
          </div>
        } @else {
          <p class="bulk">
            <button type="button" (click)="bulkAsk.set('list')">Remove all {{ total() }} {{ total() === 1 ? 'broken song' : 'broken songs' }} from the list</button>
            <button type="button" (click)="bulkAsk.set('files')">Remove them and delete their files</button>
          </p>
        }
      }
      @if (result()) {
        <p role="status">{{ result() }}</p>
      }
      @if (bulkError()) {
        <p class="error" role="alert">{{ bulkError() }}</p>
      }
    </section>
  `,
  styles: `
    .check {
      margin: 1rem 0;
    }
    .check h3 {
      margin: 0 0 0.25rem;
    }
    .check h4 {
      margin: 1rem 0 0.25rem;
    }
    .check > button {
      margin-top: 0.5rem;
    }
    .broken-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .broken {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--line);
    }
    .num {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .what {
      flex: 1 1 12rem;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .title {
      font-weight: 600;
    }
    .artist,
    .why {
      color: var(--muted);
      font-size: 0.875rem;
    }
    .row-actions,
    .ask {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .bulk {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .hint {
      color: var(--muted);
      font-size: 0.875rem;
    }
  `,
})
export class BrokenSongsComponent {
  private readonly admins = injectClient(AdminService);

  protected readonly total = signal(0);
  protected readonly pager = new Pager<BrokenSong>(
    async (pageToken, signal) => {
      const r = await this.admins.listBrokenSongs({ pageToken, pageSize: PAGE_SIZE }, { signal });
      this.total.set(r.total);
      return { items: r.songs, next: r.nextPageToken };
    },
    (b) => b.song?.number ?? '',
  );
  protected readonly win = new PageWindow<BrokenSong>({
    items: this.pager.items,
    hasMore: this.pager.hasMore,
    loading: this.pager.loading,
    auto: () => !this.pager.error(),
    more: () => void this.pager.more(),
  });

  protected readonly checking = signal(false);
  protected readonly progress = signal('');
  protected readonly checkError = signal('');
  protected readonly asking = signal<string | undefined>(undefined);
  protected readonly rowError = signal<Record<string, string>>({});
  protected readonly bulkAsk = signal<'list' | 'files' | undefined>(undefined);
  protected readonly busy = signal(false);
  protected readonly result = signal('');
  protected readonly bulkError = signal('');
  protected readonly label = songs;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pager.cancel());
    // the list of what an earlier check found is there when the page opens
    void this.pager.reset();
  }

  /** Runs the check; the server streams how far it is. The list is read again at the end. */
  protected async check(): Promise<void> {
    this.checking.set(true);
    this.progress.set('');
    this.checkError.set('');
    this.result.set('');
    try {
      for await (const m of this.admins.checkLibrary({})) {
        this.progress.set(m.done ? `Checked ${m.total} songs, ${m.broken} broken.` : `Checked ${m.checked} of ${m.total}, ${m.broken} broken`);
      }
      await this.pager.reset();
    } catch (e) {
      this.progress.set('');
      this.checkError.set(problem(e, { [Code.FailedPrecondition]: fromServer }));
    } finally {
      this.checking.set(false);
    }
  }

  /** One song: keepFile only takes it off the list, otherwise its file is deleted too. */
  protected async removeOne(b: BrokenSong, keepFile: boolean): Promise<void> {
    const number = b.song?.number ?? '';
    this.rowError.update((m) => ({ ...m, [number]: '' }));
    try {
      await this.admins.deleteSong({ number, keepFile });
      this.pager.items.update((all) => all.filter((x) => x.song?.number !== number));
      this.total.update((n) => Math.max(0, n - 1));
      this.asking.set(undefined);
    } catch (e) {
      if (ConnectError.from(e).code === Code.NotFound) {
        this.pager.items.update((all) => all.filter((x) => x.song?.number !== number));
        this.total.update((n) => Math.max(0, n - 1));
        this.asking.set(undefined);
        return;
      }
      this.rowError.update((m) => ({ ...m, [number]: problem(e, { [Code.FailedPrecondition]: fromServer }) }));
    }
  }

  /** Every broken song: deleteFiles false keeps the files, true deletes them. Only called after the answer to the question. */
  protected async removeAll(deleteFiles: boolean): Promise<void> {
    this.busy.set(true);
    this.result.set('');
    this.bulkError.set('');
    try {
      const r = await this.admins.removeSongs({ scope: RemoveScope.BROKEN, deleteFiles });
      const count = songs(r.removed);
      this.result.set(
        deleteFiles
          ? `Removed ${count} and deleted ${r.filesDeleted} ${r.filesDeleted === 1 ? 'file' : 'files'}${r.filesFailed ? `; ${r.filesFailed} could not be deleted` : ''}.`
          : `Removed ${count} from the list. Their files were kept.`,
      );
      this.bulkAsk.set(undefined);
      await this.pager.reset();
    } catch (e) {
      this.bulkError.set(problem(e, {}));
    } finally {
      this.busy.set(false);
    }
  }
}
