import { Component, DestroyRef, inject, signal } from '@angular/core';
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
                  <span class="row-actions">
                    @if (!first) {
                      <button type="button" [attr.aria-label]="'Move ' + item.song?.title + ' to the top of the queue'" (click)="moveToTop(item)">Move to top</button>
                    }
                    <button type="button" [attr.aria-label]="'Remove ' + item.song?.title + ' from the queue'" (click)="remove(item)">Remove</button>
                  </span>
                </li>
              }
            </ol>
          }
        </section>
        <app-devices />
      } @else {
        @if (stalled()) {
          <p role="alert">Could not reach the server. Still trying…</p>
        } @else {
          <p role="status">Connecting…</p>
        }
      }
    </main>
  `,
  styles: `
    .queue-page {
      /* a reading column: wider, the title and the buttons of a row are too far apart; left aligned in the frame */
      max-width: 48rem;
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
      flex: 1 1 12rem;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    /* a long title or artist is cut to two lines (the library list does the same); an unbroken word breaks inside its box */
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
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .notice {
      color: var(--muted);
    }
    /* the buttons of a row stay together: on a phone they are one line below the title, equally wide */
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    @media (max-width: 30rem) {
      .row-actions {
        flex: 1 0 100%;
      }
      .row-actions button {
        flex: 1;
      }
    }
  `,
})
export class QueuePage {
  /** No state has arrived for a few seconds: "Connecting…" alone would say nothing for ever. */
  protected readonly stalled = signal(false);

  constructor() {
    const timer = setTimeout(() => this.stalled.set(true), 6000);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

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
