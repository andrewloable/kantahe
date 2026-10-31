import { Component, DestroyRef, inject } from '@angular/core';
import { HistoryEntry, UserLibraryService } from '../../gen/kantahe/v1/user_library_pb';
import { injectClient } from '../core/api';
import { FormatBadgeComponent } from '../library/format-badge.component';
import { LibraryActions } from '../library/library-actions';
import { Pager } from '../library/paged';

@Component({
  selector: 'app-history',
  imports: [FormatBadgeComponent],
  template: `
    <h2>History</h2>
    @if (pager.error()) {
      <p class="error" role="alert">{{ pager.error() }} <button type="button" (click)="pager.retry()">Try again</button></p>
    }
    <ul class="history">
      @for (e of pager.items(); track $index) {
        <li>
          <span class="info">
            <span class="title">{{ e.song?.title }}</span>
            <span class="artist">{{ e.song?.artist }}</span>
            <time [attr.datetime]="iso(e)">{{ when(e) }}</time>
          </span>
          @if (e.song) {
            <app-format-badge [format]="e.song.format" />
          }
          <span class="result">{{ e.skipped ? 'skipped' : e.hasScore ? 'Score ' + e.score : 'No score' }}</span>
          @if (e.song; as s) {
            <button type="button" [attr.aria-label]="'Sing ' + s.title + ' again'" (click)="actions.add(s)">Sing again</button>
          }
        </li>
      }
    </ul>
    @if (pager.loading()) {
      <p role="status">Loading…</p>
    } @else if (pager.loaded() && pager.items().length === 0) {
      <p>Nothing sung yet.</p>
    }
    @if (pager.hasMore()) {
      <p><button type="button" (click)="pager.more()" [disabled]="pager.loading()">Load more</button></p>
    }
  `,
  styles: `
    .history {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--line);
    }
    .info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 10rem;
    }
    .title {
      font-weight: 600;
    }
    .artist,
    time {
      color: var(--muted);
      font-size: 0.875rem;
    }
  `,
})
export class HistoryComponent {
  private readonly user = injectClient(UserLibraryService);
  protected readonly actions = inject(LibraryActions);

  protected readonly pager = new Pager<HistoryEntry>(async (pageToken, signal) => {
    const r = await this.user.listHistory({ pageToken }, { signal });
    this.actions.adopt(r.entries.flatMap((e) => (e.song ? [e.song] : [])));
    return { items: r.entries, next: r.nextPageToken };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pager.cancel());
    void this.pager.reset();
  }

  private date(e: HistoryEntry): Date {
    return new Date(Number(e.sungAtUnix) * 1000);
  }

  protected iso(e: HistoryEntry): string {
    return this.date(e).toISOString();
  }

  protected when(e: HistoryEntry): string {
    return this.date(e).toLocaleString();
  }
}
