import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Artist, CatalogService, SongSort } from '../../gen/kantahe/v1/catalog_pb';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { injectClient } from '../core/api';
import { LibraryActions } from './library-actions';
import { Pager } from './paged';
import { SongListComponent } from './song-list.component';

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

@Component({
  selector: 'app-alpha-browse',
  imports: [SongListComponent],
  template: `
    <div class="modes" role="group" aria-label="Browse by">
      <button type="button" [attr.aria-pressed]="mode() === 'titles'" (click)="setMode('titles')">Titles</button>
      <button type="button" [attr.aria-pressed]="mode() === 'artists'" (click)="setMode('artists')">Artists</button>
    </div>
    <div class="letters" role="group" aria-label="First letter">
      @for (l of letters; track l) {
        <button type="button" [attr.aria-pressed]="letter() === l" (click)="setLetter(l)">{{ l }}</button>
      }
    </div>

    @if (mode() === 'titles') {
      @if (titles.error()) {
        <p role="alert">{{ titles.error() }} <button type="button" (click)="titles.retry()">Try again</button></p>
      }
      <app-song-list [songs]="titles.items()" [hasMore]="titles.hasMore()" [loading]="titles.loading()" [autoMore]="!titles.error()" (more)="titles.more()" />
    } @else if (artist(); as name) {
      <p><button type="button" (click)="back()">← Back to artists</button></p>
      <h2>{{ name }}</h2>
      @if (artistSongs.error()) {
        <p role="alert">{{ artistSongs.error() }} <button type="button" (click)="artistSongs.retry()">Try again</button></p>
      }
      <app-song-list [songs]="artistSongs.items()" [hasMore]="artistSongs.hasMore()" [loading]="artistSongs.loading()" [autoMore]="!artistSongs.error()" (more)="artistSongs.more()" />
    } @else {
      @if (artists.error()) {
        <p role="alert">{{ artists.error() }} <button type="button" (click)="artists.retry()">Try again</button></p>
      }
      <ul class="artists">
        @for (a of artists.items(); track a.name) {
          <li>
            <button type="button" (click)="choose(a)">
              <span>{{ a.name }}</span>
              <span class="count">{{ a.songCount === 1 ? '1 song' : a.songCount + ' songs' }}</span>
            </button>
          </li>
        }
      </ul>
      @if (artists.loading()) {
        <p role="status">Loading…</p>
      } @else if (artists.loaded() && artists.items().length === 0) {
        <p>No artists under this letter.</p>
      }
      @if (artists.hasMore()) {
        <p><button type="button" (click)="artists.more()" [disabled]="artists.loading()">Load more</button></p>
      }
    }
  `,
  styles: `
    .modes,
    .letters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
    }
    button[aria-pressed='true'] {
      outline: 2px solid var(--sung);
    }
    .letters button {
      min-width: 2.5rem;
      padding: 0.25rem;
    }
    .artists {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .artists button {
      display: flex;
      justify-content: space-between;
      width: 100%;
      background: transparent;
      color: inherit;
      border-bottom: 1px solid var(--line);
      border-radius: 0;
      font-weight: 400;
    }
    .count {
      color: var(--muted);
    }
  `,
})
export class AlphaBrowseComponent {
  private readonly catalog = injectClient(CatalogService);
  private readonly actions = inject(LibraryActions);

  protected readonly letters = LETTERS;
  protected readonly letter = signal('A');
  protected readonly mode = signal<'titles' | 'artists'>('titles');
  /** The artist whose songs are shown. */
  protected readonly artist = signal<string | undefined>(undefined);

  protected readonly titles = new Pager<Song>(
    async (pageToken, signal) => {
      const r = await this.catalog.searchSongs({ sort: SongSort.TITLE, letter: this.letter(), pageToken }, { signal });
      this.actions.adopt(r.songs);
      return { items: r.songs, next: r.nextPageToken };
    },
    (s) => s.number,
  );

  protected readonly artists = new Pager<Artist>(
    async (pageToken, signal) => {
      const r = await this.catalog.listArtists({ letter: this.letter(), pageToken }, { signal });
      return { items: r.artists, next: r.nextPageToken };
    },
    (a) => a.name,
  );

  protected readonly artistSongs = new Pager<Song>(
    async (pageToken, signal) => {
      const r = await this.catalog.searchSongs({ query: this.artist() ?? '', sort: SongSort.TITLE, pageToken }, { signal });
      this.actions.adopt(r.songs);
      return { items: r.songs, next: r.nextPageToken };
    },
    (s) => s.number,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.titles.cancel();
      this.artists.cancel();
      this.artistSongs.cancel();
    });
    void this.titles.reset();
  }

  protected setLetter(l: string): void {
    this.letter.set(l);
    this.artist.set(undefined);
    void (this.mode() === 'titles' ? this.titles : this.artists).reset();
  }

  protected setMode(m: 'titles' | 'artists'): void {
    if (m === this.mode()) return;
    this.mode.set(m);
    this.artist.set(undefined);
    void (m === 'titles' ? this.titles : this.artists).reset();
  }

  protected choose(a: Artist): void {
    this.artist.set(a.name);
    void this.artistSongs.reset();
  }

  protected back(): void {
    this.artist.set(undefined);
  }
}
