import { Component, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { FormatBadgeComponent } from './format-badge.component';
import { LibraryActions } from './library-actions';
import { PlaylistPickerComponent } from './playlist-picker.component';

@Component({
  selector: 'app-song-list',
  imports: [FormatBadgeComponent, PlaylistPickerComponent],
  template: `
    <ul class="songs">
      @for (s of songs(); track s.number) {
        <li class="row">
          <button type="button" class="main" [disabled]="s.failed" [attr.aria-label]="'Add ' + s.title + ' by ' + s.artist + ' to the queue'" (click)="actions.add(s)">
            <span class="num">{{ s.number }}</span>
            <span class="info">
              <span class="title">{{ s.title }}</span>
              <span class="artist">{{ s.artist }}</span>
              @if (s.failed) {
                <span class="artist">This song can't be played.</span>
              }
            </span>
            <app-format-badge [format]="s.format" />
          </button>
          <button type="button" class="star" [attr.aria-pressed]="actions.isFavourite(s)" [attr.aria-label]="'Favourite: ' + s.title" (click)="actions.toggleFavourite(s)">
            {{ actions.isFavourite(s) ? '★' : '☆' }}
          </button>
          <button type="button" class="menu" [attr.aria-expanded]="pickerFor() === s.number" [attr.aria-label]="'Add ' + s.title + ' to a playlist'" (click)="togglePicker(s.number)">
            Add to playlist…
          </button>
          @if (pickerFor() === s.number) {
            <app-playlist-picker class="picker-slot" [song]="s" (closed)="pickerFor.set(undefined)" />
          }
        </li>
      }
    </ul>
    @if (loading()) {
      <p role="status">Loading…</p>
    } @else if (songs().length === 0) {
      <p>{{ emptyText() }}</p>
    }
    @if (hasMore()) {
      <div #sentinel class="more">
        <button type="button" (click)="more.emit()" [disabled]="loading()">Load more</button>
      </div>
    }
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
      gap: 0.25rem;
      border-bottom: 1px solid var(--line);
    }
    .main {
      flex: 1;
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
    .title {
      font-weight: 600;
    }
    .artist {
      color: var(--muted);
      font-size: 0.875rem;
    }
    .star {
      min-width: 2.75rem;
      background: transparent;
      color: var(--sung);
      font-size: 1.25rem;
    }
    .menu {
      background: transparent;
      color: inherit;
      font-weight: 400;
      font-size: 0.875rem;
    }
    .picker-slot {
      flex-basis: 100%;
    }
    .more {
      padding: 0.75rem 0;
      text-align: center;
    }
  `,
})
export class SongListComponent {
  protected readonly actions = inject(LibraryActions);
  /** The song whose playlist picker is open. */
  protected readonly pickerFor = signal<string | undefined>(undefined);

  readonly songs = input.required<Song[]>();
  readonly hasMore = input(false);
  readonly loading = input(false);
  readonly emptyText = input('No songs found.');
  /** The end of the list is in view (or Load more was pressed). */
  readonly more = output<void>();

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  protected togglePicker(number: string): void {
    this.pickerFor.update((open) => (open === number ? undefined : number));
  }

  constructor() {
    effect((onCleanup) => {
      this.songs(); // look again after every page: an end that is still in view must ask again
      const el = this.sentinel()?.nativeElement;
      if (!el || !this.hasMore() || this.loading() || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) this.more.emit();
      });
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
  }
}
