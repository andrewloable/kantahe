import { Component, computed, inject } from '@angular/core';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { UserLibraryService } from '../../gen/kantahe/v1/user_library_pb';
import { injectClient } from '../core/api';
import { LibraryActions } from '../library/library-actions';
import { Pager } from '../library/paged';
import { SongListComponent } from '../library/song-list.component';

@Component({
  selector: 'app-favourites',
  imports: [SongListComponent],
  template: `
    <h2>Favourites</h2>
    @if (pager.error()) {
      <p class="error" role="alert">{{ pager.error() }} <button type="button" (click)="pager.retry()">Try again</button></p>
    }
    <app-song-list [songs]="shown()" [hasMore]="pager.hasMore()" [loading]="pager.loading()" emptyText="You have no favourites yet." [failed]="!!pager.error()" (more)="more()" />
  `,
})
export class FavouritesComponent {
  private readonly user = injectClient(UserLibraryService);
  private readonly actions = inject(LibraryActions);

  protected readonly pager = new Pager<Song>(
    async (pageToken, signal) => {
      const r = await this.user.listFavourites({ pageToken }, { signal });
      this.actions.adopt(r.songs);
      return { items: r.songs, next: r.nextPageToken };
    },
    (s) => s.number,
  );

  /** A song that is un-starred here leaves the list. */
  protected readonly shown = computed(() => this.pager.items().filter((s) => this.actions.isFavourite(s)));

  /** Songs were un-starred here, so the positions the server counts from have moved. */
  private readonly moved = computed(() => this.pager.items().some((s) => !this.actions.isFavourite(s)));

  constructor() {
    void this.pager.reset();
  }

  /**
   * The next page. After un-starring, the server's next page (counted by position) would skip a
   * song, so the list is read again from the start, at least as far as it was, plus a page.
   */
  protected async more(): Promise<void> {
    if (!this.pager.hasMore() || this.pager.loading()) return;
    if (!this.moved()) return this.pager.more();
    const keep = this.shown().length;
    await this.pager.reset();
    while (this.pager.items().length <= keep && this.pager.hasMore()) await this.pager.more();
  }
}
