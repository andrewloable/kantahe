import { Component, inject } from '@angular/core';
import { QueueItem, SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { FormatBadgeComponent } from '../library/format-badge.component';
import { LibraryActions } from '../library/library-actions';
import { DevicesComponent } from './devices.component';
import { NowPlayingComponent } from './now-playing.component';

@Component({
  selector: 'app-queue-page',
  imports: [NowPlayingComponent, DevicesComponent, FormatBadgeComponent],
  template: `
    <main class="queue-page">
      <h1>Queue</h1>
      @if (state(); as s) {
        @if (!store.connected()) {
          <p class="notice" role="status">Reconnecting… Showing the last known state.</p>
        }
        <app-now-playing />
        <section aria-labelledby="queue-title">
          <h2 id="queue-title">Coming up</h2>
          @if (s.queue.length === 0) {
            <p>The queue is empty. Add songs from the library, or let the next one be picked at random.</p>
          } @else {
            <ol class="queue">
              @for (item of s.queue; track item.id; let first = $first) {
                <li>
                  <span class="info">
                    <span class="title">{{ item.song?.title }}</span>
                    <span class="artist">{{ item.song?.artist }}</span>
                  </span>
                  @if (item.song) {
                    <app-format-badge [format]="item.song.format" />
                  }
                  @if (!first) {
                    <button type="button" [attr.aria-label]="'Move ' + item.song?.title + ' to the top of the queue'" (click)="moveToTop(item)">Move to top</button>
                  }
                  <button type="button" [attr.aria-label]="'Remove ' + item.song?.title + ' from the queue'" (click)="remove(item)">Remove</button>
                </li>
              }
            </ol>
          }
        </section>
        <app-devices />
      } @else {
        <p role="status">Connecting…</p>
      }
    </main>
  `,
  styles: `
    .queue-page {
      max-width: 44rem;
      margin: 0 auto;
      padding: 1rem;
    }
    .queue {
      margin: 0;
      padding: 0;
      list-style: none;
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
      min-width: 8rem;
    }
    .title {
      font-weight: 600;
    }
    .artist,
    .notice {
      color: var(--muted);
    }
  `,
})
export class QueuePage {
  protected readonly store = inject(StateStore);
  protected readonly state = this.store.state;
  private readonly client = injectClient(SessionService);
  private readonly toast = inject(ToastService);
  private readonly library = inject(LibraryActions);

  /** Items with a command on its way; a second click on the same item is ignored until it is done. */
  private readonly busy = new Set<string>();

  private async once(item: QueueItem, command: () => Promise<unknown>): Promise<boolean> {
    if (this.busy.has(item.id)) return false;
    this.busy.add(item.id);
    try {
      await command();
      return true;
    } catch (e) {
      this.toast.show(problem(e, {}), 'error');
      return false;
    } finally {
      this.busy.delete(item.id);
    }
  }

  /** Undo puts the song back at the end of the queue (its old place is not kept). */
  protected async remove(item: QueueItem): Promise<void> {
    const song = item.song;
    if ((await this.once(item, () => this.client.removeFromQueue({ itemId: item.id }))) && song) {
      this.toast.show(`Removed ${song.title}`, 'info', { label: 'Undo', run: () => void this.library.add(song) });
    }
  }

  protected async moveToTop(item: QueueItem): Promise<void> {
    await this.once(item, () => this.client.moveToTop({ itemId: item.id }));
  }
}
