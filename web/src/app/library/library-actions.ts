import { effect, Injectable, inject, signal, untracked } from '@angular/core';
import { Code } from '@connectrpc/connect';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { SessionService } from '../../gen/kantahe/v1/session_pb';
import { PlaylistSummary, UserLibraryService } from '../../gen/kantahe/v1/user_library_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { problem } from '../core/errors';
import { ToastService } from '../core/toast';

/** What a tap on a song does: queue it, or star it. The star state is shared by every list. */
@Injectable({ providedIn: 'root' })
export class LibraryActions {
  private readonly session = injectClient(SessionService);
  private readonly userLibrary = injectClient(UserLibraryService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);
  /** The newest known star of each song, by number: what the user set here, or what the server last said. */
  private readonly stars = new Map<string, boolean>();
  private readonly version = signal(0);
  /** Numbers whose star is being saved; a list read before the save finished must not undo it. */
  private readonly saving = new Set<string>();

  constructor() {
    // stars belong to the user: another one signing in on this page starts with none
    let signedInAs = this.auth.token();
    effect(() => {
      const token = this.auth.token();
      if (token === signedInAs) return;
      signedInAs = token;
      untracked(() => {
        this.stars.clear();
        this.saving.clear();
        this.version.update((v) => v + 1);
      });
    });
  }

  isFavourite(song: Song): boolean {
    this.version(); // makes the answer follow every change
    return this.stars.get(song.number) ?? song.favourite;
  }

  /** Takes the stars of songs that were just read from the server (they may have changed elsewhere). */
  adopt(songs: Song[]): void {
    for (const s of songs) if (!this.saving.has(s.number)) this.stars.set(s.number, s.favourite);
    this.version.update((v) => v + 1);
  }

  async add(song: Song): Promise<boolean> {
    if (song.failed) {
      this.toast.show("That song can't be played.", 'error');
      return false;
    }
    try {
      await this.session.addToQueue({ number: song.number });
      this.toast.show(`Added ${song.title}`);
      return true;
    } catch (e) {
      this.toast.show(problem(e, { [Code.NotFound]: 'That song is no longer in the library.' }), 'error');
      return false;
    }
  }

  /** The user's playlists, for choosing where a song goes. */
  async playlists(): Promise<PlaylistSummary[]> {
    return (await this.userLibrary.listPlaylists({})).playlists;
  }

  /** Appends the song to the end of the playlist. */
  async addToPlaylist(playlist: { id: string; name: string }, song: Song): Promise<boolean> {
    try {
      await this.userLibrary.updatePlaylist({ id: playlist.id, numbers: [song.number], replaceNumbers: false });
      this.toast.show(`Added ${song.title} to ${playlist.name}`);
      return true;
    } catch (e) {
      this.toast.show(problem(e, { [Code.NotFound]: 'That playlist or song is gone.' }), 'error');
      return false;
    }
  }

  async toggleFavourite(song: Song): Promise<void> {
    const before = this.isFavourite(song);
    this.saving.add(song.number);
    this.setStar(song.number, !before); // shown at once; undone below if the server refuses
    try {
      await this.userLibrary.setFavourite({ number: song.number, favourite: !before });
    } catch (e) {
      this.setStar(song.number, before);
      this.toast.show(problem(e, { [Code.NotFound]: 'That song is no longer in the library.' }), 'error');
    } finally {
      this.saving.delete(song.number);
    }
  }

  private setStar(number: string, value: boolean): void {
    this.stars.set(number, value);
    this.version.update((v) => v + 1);
  }
}
