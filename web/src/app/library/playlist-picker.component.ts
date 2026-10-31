import { Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { PlaylistSummary } from '../../gen/kantahe/v1/user_library_pb';
import { problem } from '../core/errors';
import { LibraryActions } from './library-actions';

/** Lists the user's playlists under a song so that one of them can be chosen. */
@Component({
  selector: 'app-playlist-picker',
  imports: [RouterLink],
  host: { '(keydown.escape)': 'closed.emit()' },
  template: `
    <div class="picker" role="group" [attr.aria-label]="'Add ' + song().title + ' to a playlist'">
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else if (playlists() === undefined) {
        <p role="status">Loading…</p>
      } @else if (playlists()!.length === 0) {
        <p>No playlists yet. <a routerLink="/me/playlists">Make one</a> first.</p>
      } @else {
        <ul>
          @for (p of playlists(); track p.id) {
            <li>
              <button type="button" (click)="choose(p)">{{ p.name }}</button>
            </li>
          }
        </ul>
      }
      <button type="button" class="close" (click)="closed.emit()">Close</button>
    </div>
  `,
  styles: `
    .picker {
      padding: 0.5rem;
      border: 1px solid var(--line);
      border-radius: 0.5rem;
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0 0 0.5rem;
      padding: 0;
      list-style: none;
    }
  `,
})
export class PlaylistPickerComponent {
  private readonly actions = inject(LibraryActions);

  readonly song = input.required<Song>();
  readonly closed = output<void>();

  protected readonly playlists = signal<PlaylistSummary[] | undefined>(undefined);
  protected readonly error = signal('');

  constructor() {
    this.actions
      .playlists()
      .then((list) => this.playlists.set(list))
      .catch((e) => this.error.set(problem(e, {})));
  }

  protected async choose(p: PlaylistSummary): Promise<void> {
    if (await this.actions.addToPlaylist(p, this.song())) this.closed.emit();
  }
}
