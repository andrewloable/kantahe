import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { SessionService } from '../../gen/kantahe/v1/session_pb';
import { UserLibraryService } from '../../gen/kantahe/v1/user_library_pb';
import { injectClient } from '../core/api';
import { problem } from '../core/errors';
import { ToastService } from '../core/toast';
import { FormatBadgeComponent } from '../library/format-badge.component';

@Component({
  selector: 'app-playlist-detail',
  imports: [RouterLink, FormatBadgeComponent],
  template: `
    <p><a class="back" routerLink="/me/playlists">← All playlists</a></p>
    @if (missing()) {
      <p>This playlist no longer exists.</p>
    } @else if (id()) {
      <h2>{{ name() }}</h2>
      <p>
        <button type="button" (click)="addAll()" [disabled]="songs().length === 0 || saving()">Add all to queue</button>
      </p>
      @if (loaded() && songs().length === 0) {
        <p>This playlist is empty. Add songs from the library.</p>
      }
      <ol class="entries">
        @for (s of songs(); track $index; let i = $index; let first = $first; let last = $last) {
          <li class="entry">
            <span class="info">
              <span class="title">{{ s.title }}</span>
              <span class="artist">{{ s.artist }}</span>
            </span>
            <app-format-badge [format]="s.format" />
            <span class="row-actions">
              @if (!first) {
                <button type="button" [disabled]="saving()" [attr.aria-label]="'Move ' + s.title + ' up'" (click)="move(i, -1)">Move up</button>
              }
              @if (!last) {
                <button type="button" [disabled]="saving()" [attr.aria-label]="'Move ' + s.title + ' down'" (click)="move(i, 1)">Move down</button>
              }
              <button type="button" [disabled]="saving()" [attr.aria-label]="'Remove ' + s.title + ' from the playlist'" (click)="removeAt(i)">Remove</button>
            </span>
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
    }
    .entries {
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
      font-size: 0.875rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
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
export class PlaylistDetailComponent {
  private readonly user = injectClient(UserLibraryService);
  private readonly session = injectClient(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly id = signal('');
  protected readonly name = signal('');
  protected readonly songs = signal<Song[]>([]);
  protected readonly loaded = signal(false);
  protected readonly missing = signal(false);
  protected readonly saving = signal(false);

  constructor() {
    const sub = inject(ActivatedRoute).paramMap.subscribe((params) => void this.load(params.get('id') ?? ''));
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  private async load(id: string): Promise<void> {
    this.id.set(id);
    this.loaded.set(false);
    this.missing.set(false);
    this.songs.set([]);
    try {
      const p = (await this.user.getPlaylist({ id })).playlist;
      if (this.id() !== id) return; // another playlist was opened meanwhile
      this.name.set(p?.name ?? '');
      this.songs.set(p?.songs ?? []);
      this.loaded.set(true);
    } catch (e) {
      if (ConnectError.from(e).code === Code.NotFound) this.missing.set(true);
      else this.toast.show(problem(e, {}), 'error');
    }
  }

  /**
   * Saves a change of the list, one at a time. The server replaces the whole list, so the list this
   * page shows must still be the server's: if it changed elsewhere (another device added a song) the
   * change is not made, the page shows the new content and the user repeats it.
   */
  private async change(apply: (current: Song[]) => Song[]): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const fresh = (await this.user.getPlaylist({ id: this.id() })).playlist;
      const current = this.songs();
      const same = fresh?.songs.length === current.length && fresh.songs.every((s, i) => s.number === current[i].number);
      if (fresh && !same) {
        this.name.set(fresh.name);
        this.songs.set(fresh.songs);
        this.toast.show('This playlist was changed on another device. Look at it again and repeat the change.', 'error');
        return;
      }
      const next = apply(current);
      const res = await this.user.updatePlaylist({ id: this.id(), replaceNumbers: true, numbers: next.map((s) => s.number) });
      this.songs.set(res.playlist?.songs ?? next);
    } catch (e) {
      this.toast.show(problem(e, { [Code.NotFound]: 'That playlist no longer exists.' }), 'error');
    } finally {
      this.saving.set(false);
    }
  }

  protected move(index: number, by: -1 | 1): Promise<void> {
    return this.change((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  protected removeAt(index: number): Promise<void> {
    return this.change((current) => current.filter((_, i) => i !== index));
  }

  protected async addAll(): Promise<void> {
    try {
      const res = await this.session.addPlaylistToQueue({ playlistId: this.id() });
      this.toast.show(`Added ${res.added} ${res.added === 1 ? 'song' : 'songs'} to the queue`);
    } catch (e) {
      this.toast.show(problem(e, {}), 'error');
    }
  }
}
