import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QueueItem, SessionService } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from '../core/api';
import { problem } from '../core/errors';
import { StateStore } from '../core/state.store';
import { ToastService } from '../core/toast';
import { FormatBadgeComponent } from '../library/format-badge.component';
import { LibraryActions } from '../library/library-actions';
import { ActionMenuComponent, MenuItem } from '../shared/action-menu.component';
import { DevicesComponent } from './devices.component';
import { NowPlayingComponent } from './now-playing.component';

@Component({
  selector: 'app-queue-page',
  imports: [NowPlayingComponent, DevicesComponent, FormatBadgeComponent, RouterLink, ActionMenuComponent],
  template: `
    <div class="queue-page">
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
            <p><a class="open-library" routerLink="/library">Open the Library</a></p>
          } @else {
            <ol class="queue">
              @for (item of s.queue; track item.id; let first = $first) {
                <li>
                  <span class="info">
                    <span class="title">{{ item.song?.title }}</span>
                    <span class="artist">{{ item.song?.artist }}</span>
                  </span>
                  @if (item.song) {
                    <app-format-badge [format]="item.song.format" [timing]="item.song.lyricTiming" [vocals]="item.song.hasVocals" />
                  }
                  <!-- one line per song: the actions are in its More menu, as in the Library (kantahe-du1.7) -->
                  <app-action-menu [label]="'More actions for ' + (item.song?.title ?? '')" [items]="first ? firstItems(item) : otherItems(item)" />
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
    </div>
  `,
  styles: `
    .open-library {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
    }
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
      gap: 0.5rem;
      align-items: center;
      /* as compact as a Library row (kantahe-du1.7); the More button keeps the row 44 px high */
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--line);
    }
    .info {
      flex: 1 1 0;
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

  /** The More menu of a row; the same array for the same item, so that an open menu is not rebuilt while it shows. */
  private readonly menus = new Map<string, MenuItem[]>();
  protected firstItems(item: QueueItem): MenuItem[] {
    return this.menuOf(`${item.id}:first`, () => [{ label: 'Remove', danger: true, run: () => void this.remove(item) }]);
  }
  protected otherItems(item: QueueItem): MenuItem[] {
    return this.menuOf(item.id, () => [
      { label: 'Move to top', run: () => void this.moveToTop(item) },
      { label: 'Remove', danger: true, run: () => void this.remove(item) },
    ]);
  }
  private menuOf(key: string, make: () => MenuItem[]): MenuItem[] {
    let items = this.menus.get(key);
    if (!items) this.menus.set(key, (items = make()));
    return items;
  }
}
