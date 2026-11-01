import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { PlaylistSummary, PlaylistSummarySchema, UserLibraryService } from '../../gen/kantahe/v1/user_library_pb';
import { injectClient } from '../core/api';
import { problem } from '../core/errors';
import { ToastService } from '../core/toast';

@Component({
  selector: 'app-playlists',
  imports: [RouterLink],
  template: `
    <h2>Playlists</h2>
    <form (submit)="create($event)" novalidate>
      <div class="field">
        <label for="new-playlist">New playlist</label>
        <input #nameInput id="new-playlist" type="text" autocomplete="off" maxlength="100" [value]="draft()" (input)="draft.set(value($event))" />
        @if (nameError()) {
          <p class="error" role="alert">{{ nameError() }}</p>
        }
      </div>
      <button type="submit" [disabled]="busy()">Create</button>
    </form>
    @if (loadError()) {
      <p class="error" role="alert">{{ loadError() }} <button type="button" (click)="load()">Try again</button></p>
    }
    @if (loaded() && playlists().length === 0 && !loadError()) {
      <p>No playlists yet.</p>
    }
    <ul class="playlists">
      @for (p of playlists(); track p.id) {
        <li class="playlist">
          <a [routerLink]="['/me/playlists', p.id]">{{ p.name }}</a>
          <span class="count">{{ p.songCount === 1 ? '1 song' : p.songCount + ' songs' }}</span>
          @if (confirming() === p.id) {
            <span class="ask" role="group">
              <span>Delete "{{ p.name }}"?</span>
              <button type="button" (click)="remove(p)">Yes, delete</button>
              <button type="button" (click)="confirming.set(undefined)">Cancel</button>
            </span>
          } @else {
            <button type="button" [attr.aria-label]="'Rename ' + p.name" (click)="edit(p)">Rename</button>
            <button type="button" [attr.aria-label]="'Delete ' + p.name" (click)="confirming.set(p.id)">Delete</button>
          }
          @if (editing() === p.id) {
            <span class="edit">
              <label [for]="'rename-' + p.id" class="sr-only">New name of {{ p.name }}</label>
              <input [id]="'rename-' + p.id" type="text" maxlength="100" [value]="renameTo()" (input)="renameTo.set(value($event))" />
              <button type="button" (click)="rename(p)">Save</button>
              <button type="button" (click)="editing.set(undefined)">Cancel</button>
            </span>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    .playlists {
      list-style: none;
      margin: 1rem 0 0;
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
    li a {
      /* at least 10rem for the name before the count and the buttons take the rest of the row or wrap */
      flex: 1 1 10rem;
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      overflow-wrap: anywhere;
      font-weight: 600;
    }
    .count {
      color: var(--muted);
    }
    @media (max-width: 30rem) {
      li a {
        flex-basis: 100%;
      }
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
export class PlaylistsComponent {
  private readonly user = injectClient(UserLibraryService);
  private readonly toast = inject(ToastService);

  protected readonly playlists = signal<PlaylistSummary[]>([]);
  protected readonly loaded = signal(false);
  protected readonly draft = signal('');
  protected readonly nameError = signal('');
  protected readonly busy = signal(false);
  protected readonly confirming = signal<string | undefined>(undefined);
  protected readonly editing = signal<string | undefined>(undefined);
  protected readonly renameTo = signal('');
  private gone = false;
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.gone = true));
    void this.load();
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  /** Why the list could not be loaded, shown on the page with a way to try again (a toast would be gone before it was read). */
  protected readonly loadError = signal('');

  protected async load(): Promise<void> {
    this.loadError.set('');
    try {
      const res = await this.user.listPlaylists({});
      if (!this.gone) this.playlists.set(res.playlists);
    } catch (e) {
      if (!this.gone) this.loadError.set(problem(e, {}));
    } finally {
      this.loaded.set(true);
    }
  }

  /** Runs one change at a time; a second click while it runs is ignored. */
  private async once(change: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await change();
    } catch (e) {
      this.toast.show(problem(e, {}), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.draft().trim();
    if (!name) {
      this.nameError.set('Enter a name for the playlist.');
      return;
    }
    this.nameError.set('');
    await this.once(async () => {
      const res = await this.user.createPlaylist({ name, numbers: [] });
      const p = res.playlist;
      if (p) this.playlists.update((all) => [...all, create(PlaylistSummarySchema, { id: p.id, name: p.name, songCount: p.songs.length })]);
      this.draft.set('');
      const input = this.nameInput()?.nativeElement;
      if (input) input.value = ''; // the box may not have been redrawn since the last key
    });
  }

  protected edit(p: PlaylistSummary): void {
    this.renameTo.set(p.name);
    this.editing.set(p.id);
  }

  protected async rename(p: PlaylistSummary): Promise<void> {
    const name = this.renameTo().trim();
    if (!name) return;
    await this.once(async () => {
      await this.user.updatePlaylist({ id: p.id, name });
      this.playlists.update((all) => all.map((x) => (x.id === p.id ? create(PlaylistSummarySchema, { id: x.id, name, songCount: x.songCount }) : x)));
      this.editing.set(undefined);
    });
  }

  protected async remove(p: PlaylistSummary): Promise<void> {
    await this.once(async () => {
      await this.user.deletePlaylist({ id: p.id });
      this.playlists.update((all) => all.filter((x) => x.id !== p.id));
      this.confirming.set(undefined);
    });
  }
}
