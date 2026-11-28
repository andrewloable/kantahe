import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
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
import { startsIn } from './eta';
import { NowPlayingComponent } from './now-playing.component';

@Component({
  selector: 'app-queue-page',
  imports: [NowPlayingComponent, DevicesComponent, FormatBadgeComponent, RouterLink, ActionMenuComponent],
  template: `
    <div class="queue-page">
      <div class="page-head">
        <h1>Queue</h1>
        <a class="help-link" routerLink="/me/help" fragment="queue">Help</a>
      </div>
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
              @for (item of s.queue; track item.id; let first = $first, i = $index) {
                <li>
                  <!-- its place in the queue and, roughly, when it starts (kantahe-cqc.7) -->
                  <span class="pos">
                    <span class="n">{{ i + 1 }}</span>
                    @if (when(i); as w) {
                      <span class="when" aria-hidden="true">{{ w.short }}</span>
                      <span class="sr-only">, {{ w.long }}</span>
                    }
                  </span>
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
    /* a wide window: now playing on the left, kept in view; the queue and the devices on the right (owner decision 2026-11-28,
       kantahe-cqc.5). The order on screen is the order of the page, left then right, so the keyboard goes the same way */
    @media (min-width: 64rem) {
      .queue-page {
        max-width: none;
        display: grid;
        grid-template-columns: minmax(20rem, 26rem) minmax(0, 1fr);
        grid-template-areas:
          'title title'
          'notice notice'
          'now list'
          'now devices';
        grid-template-rows: auto auto auto 1fr;
        column-gap: 2rem;
      }
      .queue-page > .page-head {
        grid-area: title;
      }
      .queue-page > .notice {
        grid-area: notice;
      }
      .queue-page > app-now-playing {
        grid-area: now;
        align-self: start;
        position: sticky;
        top: 1rem;
        /* never taller than the window: a taller card would keep its lower part out of reach while it sticks (kantahe-cqc.6) */
        max-height: calc(100vh - 2rem);
        overflow-y: auto;
      }
      .queue-page > section {
        grid-area: list;
      }
      /* the heading of the list starts level with the card beside it */
      .queue-page > section > h2 {
        margin-top: 0;
      }
      .queue-page > app-devices {
        grid-area: devices;
      }
      .queue-page > p {
        grid-column: 1 / -1;
      }
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
    .pos {
      flex: none;
      min-width: 3.5rem;
      display: flex;
      flex-direction: column;
      font-variant-numeric: tabular-nums;
    }
    .pos .n {
      font-weight: 700;
    }
    .pos .when {
      color: var(--muted);
      font-size: 0.75rem;
      white-space: nowrap;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

  `,
})
export class QueuePage {
  /** No state has arrived for a few seconds: "Connecting…" alone would say nothing for ever. */
  protected readonly stalled = signal(false);

  /** Moves every 30 s, so that the start times count down between two states. */
  private readonly tick = signal(0);

  constructor() {
    const timer = setTimeout(() => this.stalled.set(true), 6000);
    const ticking = setInterval(() => this.tick.update((t) => t + 1), 30_000);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      clearInterval(ticking);
    });
  }

  private readonly starts = computed(() => {
    this.tick();
    const s = this.state();
    return s ? startsIn(s, this.store.positionMs()) : [];
  });

  /** "next" for the first song, about how many minutes for the others; nothing when it is not known (kantahe-cqc.7). */
  protected when(i: number): { short: string; long: string } | undefined {
    if (i === 0) return { short: 'next', long: 'plays next' };
    const ms = this.starts()[i];
    if (ms === undefined) return undefined;
    const minutes = Math.max(1, Math.ceil(ms / 60_000));
    return { short: `~${minutes} min`, long: `starts in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` };
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
