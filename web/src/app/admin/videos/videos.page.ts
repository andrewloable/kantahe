import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { Video } from '../../../gen/kantahe/v1/common_pb';
import { UploadService } from '../../../gen/kantahe/v1/upload_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { ToastService } from '../../core/toast';
import { SilentVideoDirective } from './silent-video.directive';
import { uploadVideo } from './video-uploader';

const MB = 1024 * 1024;
const ACCEPTED = /\.(mp4|m4v|mov)$/i;

interface UploadRow {
  id: number;
  file: File;
  name: string;
  state: 'waiting' | 'sending' | 'done' | 'refused' | 'failed' | 'cancelled';
  percent: number;
  /** What is shown next to the name. */
  text: string;
}

/** Background videos (docs/PLAN.md section 4.2): add, see, order, switch on and off, rename and delete them, and the two options. */
@Component({
  selector: 'app-videos-page',
  imports: [RouterLink, SilentVideoDirective],
  template: `
    <h2>Background videos</h2>
    <p class="hint">
      The videos play behind the lyrics, one after another and round again, on the devices that play. They are pictures only: no sound ever comes from
      them. Each device can switch them off in its own settings.
    </p>
    <a class="devices-link" routerLink="/me/devices">My devices</a>

    <section aria-labelledby="add-videos">
      <h3 id="add-videos">Add videos</h3>
      <div class="drop">
        <label for="video-files">Choose video files</label>
        <input id="video-files" type="file" multiple accept=".mp4,.m4v,.mov,video/mp4" (change)="chosen($event)" />
        <p class="hint">MP4 (also .m4v and .mov) with H.264 video, up to {{ limitMb() }} MB each. One file is sent at a time and can be resumed.</p>
      </div>
      @if (rows().length > 0) {
        <ul class="uploads">
          @for (r of rows(); track r.id) {
            <li>
              <span class="name">{{ r.name }}</span>
              @if (r.state === 'sending') {
                <progress max="100" [value]="r.percent" [attr.aria-label]="'Uploading ' + r.name"></progress>
              }
              <span class="text">{{ r.text }}</span>
              @if (r.state === 'waiting' || r.state === 'sending') {
                <button type="button" [attr.aria-label]="'Cancel the upload of ' + r.name" (click)="cancel(r)">Cancel</button>
              }
            </li>
          }
        </ul>
        <p class="sr-only" role="status">{{ announcement() }}</p>
      }
    </section>

    <section aria-labelledby="the-videos">
      <h3 id="the-videos" tabindex="-1">The videos</h3>
      @if (loadError()) {
        <p class="error" role="alert">{{ loadError() }} <button type="button" (click)="load()">Try again</button></p>
      } @else if (loading()) {
        <p role="status">Loading…</p>
      } @else if (videos().length === 0) {
        <p>No background videos yet. Choose files above.</p>
      } @else {
        <ol class="videos">
          @for (v of videos(); track v.id; let i = $index; let first = $first; let last = $last) {
            <li class="video" [attr.data-video]="v.id">
              <span class="pos" aria-hidden="true">{{ i + 1 }}.</span>
              <div class="preview">
                <video #pv appSilent class="thumb" playsinline preload="metadata" width="160" [src]="v.url + '#t=0.1'" (ended)="previewing.set(undefined)"></video>
                <button type="button" [attr.aria-label]="(previewing() === v.id ? 'Stop the preview of ' : 'Play the preview of ') + v.name" (click)="preview(pv, v.id)">
                  {{ previewing() === v.id ? 'Stop' : 'Preview' }}
                </button>
              </div>
              <div class="body">
                @if (renaming() === v.id) {
                  <span class="rename">
                    <label [for]="'name-' + v.id" class="sr-only">Name of the video</label>
                    <input
                      [id]="'name-' + v.id"
                      [attr.data-focus]="'name-' + v.id"
                      type="text"
                      maxlength="200"
                      [value]="draft()"
                      (input)="draft.set(text($event))"
                      (keydown.enter)="saveName(v)"
                      (keydown.escape)="stopRename(v)"
                    />
                    <button type="button" [attr.aria-label]="'Save the name of ' + v.name" (click)="saveName(v)">Save</button>
                    <button type="button" [attr.aria-label]="'Cancel renaming ' + v.name" (click)="stopRename(v)">Cancel</button>
                  </span>
                  @if (nameError()) {
                    <p class="error" role="alert">{{ nameError() }}</p>
                  }
                } @else {
                  <span class="title">
                    <strong class="name">{{ v.name }}</strong>
                    <button type="button" [attr.aria-label]="'Rename ' + v.name" [attr.data-focus]="'rename-' + v.id" (click)="startRename(v)">Rename</button>
                  </span>
                }
                <span class="facts">{{ facts(v) }}</span>
                @if (v.hasAudio) {
                  <span class="sound">has a sound track (never played)</span>
                }
                @for (w of v.warnings; track w) {
                  <p class="warn" role="note">{{ w }}</p>
                }
                <span class="actions">
                  <label class="check">
                    <input type="checkbox" [checked]="v.enabled" [attr.aria-label]="'Play ' + v.name + ' in the loop'" (change)="setEnabled(v, $event)" />
                    Play this video
                  </label>
                  <button type="button" [attr.aria-label]="'Move ' + v.name + ' up'" [attr.data-focus]="'up-' + v.id" [disabled]="first || busy()" (click)="move(i, -1)">Move up</button>
                  <button type="button" [attr.aria-label]="'Move ' + v.name + ' down'" [attr.data-focus]="'down-' + v.id" [disabled]="last || busy()" (click)="move(i, 1)">Move down</button>
                  @if (confirming() === v.id) {
                    <span class="confirm" role="alert">
                      <span>Delete "{{ v.name }}" and its file? Players stop showing it.</span>
                      <button type="button" [attr.aria-label]="'Delete ' + v.name + ' for good'" (click)="remove(v)">Delete</button>
                      <button type="button" [attr.aria-label]="'Keep ' + v.name" [attr.data-focus]="'keep-' + v.id" (click)="keep(v)">Cancel</button>
                    </span>
                  } @else {
                    <button type="button" [attr.aria-label]="'Delete ' + v.name" [attr.data-focus]="'delete-' + v.id" (click)="ask(v)">Delete</button>
                  }
                </span>
              </div>
            </li>
          }
        </ol>
      }
    </section>

    <section aria-labelledby="video-options">
      <h3 id="video-options">Options</h3>
      <div class="options">
        <label class="check">
          <input type="checkbox" [checked]="enabledOption()" (change)="setOption('backgroundEnabled', $event)" />
          Play background videos on the players
        </label>
        <label class="check">
          <input type="checkbox" [checked]="shuffleOption()" (change)="setOption('backgroundShuffle', $event)" />
          Shuffle the order on every round
        </label>
      </div>
    </section>
  `,
  styles: `
    section {
      margin-bottom: 1.5rem;
    }
    .hint {
      color: var(--muted);
      font-size: 0.875rem;
    }
    .devices-link {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      margin-bottom: 0.5rem;
    }
    .drop {
      padding: 1rem;
      border: 2px dashed var(--line);
      border-radius: 0.75rem;
    }
    ul,
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .uploads li,
    .video {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 0.75rem;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--line);
    }
    .uploads .name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .text {
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    progress {
      width: min(16rem, 100%);
    }
    .video {
      align-items: flex-start;
    }
    .pos {
      min-width: 1.5rem;
      font-weight: 600;
    }
    .preview {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .thumb {
      width: 160px;
      max-width: 100%;
      aspect-ratio: 16 / 9;
      background: #0a0e22;
      border-radius: 0.375rem;
    }
    .body {
      flex: 1 1 14rem;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .title,
    .rename,
    .actions,
    .confirm,
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 0.75rem;
      align-items: center;
    }
    .options {
      flex-direction: column;
      align-items: flex-start;
    }
    .name {
      overflow-wrap: anywhere;
    }
    .facts,
    .sound {
      color: var(--muted);
      font-size: 0.875rem;
    }
    .warn {
      margin: 0;
      color: var(--danger);
      font-size: 0.875rem;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 2.75rem;
    }
    .confirm {
      flex-basis: 100%;
    }
    .error {
      margin: 0;
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
export class VideosPage {
  private readonly admins = injectClient(AdminService);
  private readonly uploads = injectClient(UploadService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private gone = false;

  protected readonly videos = signal<Video[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly renaming = signal<string | undefined>(undefined);
  protected readonly draft = signal('');
  protected readonly nameError = signal('');
  protected readonly confirming = signal<string | undefined>(undefined);
  protected readonly previewing = signal<string | undefined>(undefined);
  protected readonly enabledOption = signal(true);
  protected readonly shuffleOption = signal(false);
  protected readonly limitMb = signal(500);
  protected readonly rows = signal<UploadRow[]>([]);
  protected readonly announcement = signal('');

  /** Puts focus on the first of these controls that exists and is enabled, once the page has been drawn again. */
  private focusLater(...ids: string[]): void {
    setTimeout(() => {
      for (const id of ids) {
        const el = id === 'heading' ? this.host.querySelector<HTMLElement>('#the-videos') : this.host.querySelector<HTMLButtonElement | HTMLInputElement>(`[data-focus="${id}"]`);
        if (el && !(el as HTMLButtonElement).disabled) {
          el.focus();
          return;
        }
      }
    });
  }

  private maxBytes = 500 * MB;
  private nextRow = 1;
  private running = false;
  private current?: { row: UploadRow; abort: AbortController };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.gone = true;
      this.current?.abort.abort(); // leaving the page ends the upload; it can be resumed from here later
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadError.set('');
    this.loading.set(true);
    try {
      const [list, settings] = await Promise.all([this.admins.listVideos({}), this.admins.getServerSettings({})]);
      if (this.gone) return;
      this.videos.set(list.videos);
      if (settings.settings) {
        this.enabledOption.set(settings.settings.backgroundEnabled);
        this.shuffleOption.set(settings.settings.backgroundShuffle);
        this.maxBytes = Number(settings.settings.maxVideoBytes) || this.maxBytes;
        this.limitMb.set(Math.round(this.maxBytes / MB));
      }
    } catch (e) {
      if (!this.gone) this.loadError.set(problem(e, {}));
    } finally {
      if (!this.gone) this.loading.set(false);
    }
  }

  private async reloadVideos(): Promise<void> {
    try {
      const list = await this.admins.listVideos({});
      if (!this.gone) this.videos.set(list.videos);
    } catch {
      // the list stays as it was; the next action or a reload shows the truth
    }
  }

  private say(e: unknown): string {
    return problem(e, { [Code.FailedPrecondition]: fromServer, [Code.NotFound]: 'That video is not there any more. The list was reloaded.' });
  }

  // ---- adding ----

  protected chosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // the same file can be chosen again
    const added: UploadRow[] = files.map((file) => {
      const row: UploadRow = { id: this.nextRow++, file, name: file.name, state: 'waiting', percent: 0, text: 'Waiting' };
      const refusal = this.refusal(file);
      if (refusal) Object.assign(row, { state: 'refused', text: `Refused: ${refusal}` });
      return row;
    });
    this.rows.update((all) => [...all, ...added]);
    void this.pump();
  }

  private refusal(file: File): string | undefined {
    if (!ACCEPTED.test(file.name)) return 'only .mp4, .m4v and .mov files';
    if (file.size === 0) return 'the file is empty';
    if (file.size > this.maxBytes) return `larger than the limit of ${this.limitMb()} MB`;
    return undefined;
  }

  private patch(row: UploadRow, over: Partial<UploadRow>): void {
    this.rows.update((all) => all.map((r) => (r.id === row.id ? { ...r, ...over } : r)));
  }

  /** The files are sent one after another: the next starts when the one before has ended. */
  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let row = this.rows().find((r) => r.state === 'waiting'); row && !this.gone; row = this.rows().find((r) => r.state === 'waiting')) {
        await this.send(row);
      }
    } finally {
      this.running = false;
    }
  }

  private async send(row: UploadRow): Promise<void> {
    const abort = new AbortController();
    this.current = { row, abort };
    this.patch(row, { state: 'sending', text: 'Starting…' });
    let bucket = -1;
    let resumedAt = -1;
    const result = await uploadVideo(this.uploads, row.file, {
      signal: abort.signal,
      onResume: (got, total) => {
        resumedAt = got;
        this.patch(row, { percent: Math.round((got / total) * 100), text: `Resuming at ${Math.round((got / total) * 100)}%` });
      },
      onProgress: (got, total) => {
        if (got === resumedAt) return; // nothing new yet: "Resuming at 40%" stays until the first chunk is in
        const percent = Math.round((got / total) * 100);
        this.patch(row, { percent, text: `Uploading ${percent}%` });
        const quarter = Math.floor(percent / 25); // a screen reader hears four steps, not every update
        if (quarter > bucket) {
          bucket = quarter;
          this.announcement.set(`Uploading ${row.name}: ${percent}%`);
        }
      },
    });
    this.current = undefined;
    if (this.gone) return;
    switch (result.status) {
      case 'added':
        this.patch(row, { state: 'done', percent: 100, text: 'Added' });
        this.announcement.set(`${row.name} was added`);
        await this.reloadVideos();
        break;
      case 'duplicate':
        this.patch(row, { state: 'done', percent: 100, text: 'Already in the list' });
        this.announcement.set(`${row.name} is already in the list`);
        break;
      case 'refused':
        this.patch(row, { state: 'refused', text: `Refused: ${result.reason}` });
        this.announcement.set(`${row.name} was refused`);
        break;
      case 'failed':
        this.patch(row, { state: 'failed', text: `Could not be sent: ${result.reason}` });
        this.announcement.set(`${row.name} could not be sent`);
        break;
      case 'cancelled':
        this.patch(row, { state: 'cancelled', text: 'Cancelled' });
        break;
    }
  }

  protected cancel(row: UploadRow): void {
    if (this.current?.row.id === row.id) this.current.abort.abort();
    else if (row.state === 'waiting') this.patch(row, { state: 'cancelled', text: 'Cancelled' });
    // the Cancel button is gone now
    setTimeout(() => this.host.querySelector<HTMLElement>('#video-files')?.focus());
  }

  // ---- the list ----

  protected facts(v: Video): string {
    const seconds = Math.round(Number(v.durationMs) / 1000);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const codec = v.codec === 'avc1' || v.codec === 'avc3' ? 'H.264' : v.codec;
    return `${v.width} x ${v.height} · ${time} · ${Math.max(1, Math.round(Number(v.sizeBytes) / MB))} MB · ${codec}`;
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** The preview is a picture that can be played; it never has sound and no controls that could give it any. */
  protected silence(el: HTMLVideoElement): void {
    if (!el.muted) el.muted = true;
    if (el.volume !== 0) el.volume = 0;
    el.removeAttribute('controls');
  }

  protected preview(el: HTMLVideoElement, id: string): void {
    this.silence(el);
    for (const other of Array.from(this.host.querySelectorAll('video'))) if (other !== el) other.pause();
    if (el.paused) {
      void Promise.resolve(el.play()).catch(() => undefined);
      this.previewing.set(id);
    } else {
      el.pause();
      this.previewing.set(undefined);
    }
  }

  protected startRename(v: Video): void {
    this.nameError.set('');
    this.draft.set(v.name);
    this.renaming.set(v.id);
    this.focusLater('name-' + v.id);
  }

  protected stopRename(v: Video): void {
    this.renaming.set(undefined);
    this.focusLater('rename-' + v.id);
  }

  protected ask(v: Video): void {
    this.confirming.set(v.id);
    this.focusLater('keep-' + v.id); // the safe answer first
  }

  protected keep(v: Video): void {
    this.confirming.set(undefined);
    this.focusLater('delete-' + v.id);
  }

  protected async saveName(v: Video): Promise<void> {
    if (this.busy()) return;
    this.nameError.set('');
    this.busy.set(true);
    try {
      const res = await this.admins.updateVideo({ id: v.id, name: this.draft() });
      if (res.video) this.replace(res.video);
      this.stopRename(v);
    } catch (e) {
      if (codeOf(e) === Code.NotFound) {
        this.renaming.set(undefined);
        this.toast.show(this.say(e), 'error');
        await this.reloadVideos();
      } else {
        this.nameError.set(problem(e, { [Code.InvalidArgument]: fromServer }));
      }
    } finally {
      this.busy.set(false);
    }
  }

  private replace(video: Video): void {
    this.videos.update((all) => all.map((v) => (v.id === video.id ? video : v)));
  }

  protected async setEnabled(v: Video, event: Event): Promise<void> {
    const box = event.target as HTMLInputElement;
    try {
      const res = await this.admins.updateVideo({ id: v.id, enabled: box.checked });
      if (res.video) this.replace(res.video);
    } catch (e) {
      box.checked = v.enabled;
      this.toast.show(this.say(e), 'error');
      if (codeOf(e) === Code.NotFound) await this.reloadVideos();
    }
  }

  protected async move(index: number, delta: -1 | 1): Promise<void> {
    const ids = this.videos().map((v) => v.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length || this.busy()) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    this.busy.set(true);
    try {
      const res = await this.admins.reorderVideos({ ids });
      this.videos.set(res.videos);
      // the moved video is drawn in its new place: its button, or the other direction where it cannot go on
      this.focusLater(...(delta === 1 ? ['down-' + ids[to], 'up-' + ids[to]] : ['up-' + ids[to], 'down-' + ids[to]]));
    } catch (e) {
      if (codeOf(e) === Code.InvalidArgument) {
        // another administrator added or removed a video meanwhile: what is shown is out of date
        this.toast.show('The videos changed on the server. The list was reloaded.', 'error');
        await this.reloadVideos();
      } else {
        this.toast.show(this.say(e), 'error');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(v: Video): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.admins.deleteVideo({ id: v.id });
      this.confirming.set(undefined);
      this.videos.update((all) => all.filter((x) => x.id !== v.id));
      await this.reloadVideos(); // the positions of the others moved up
      this.focusLater('heading'); // the row with the focus is gone
    } catch (e) {
      this.confirming.set(undefined);
      this.toast.show(this.say(e), 'error');
      if (codeOf(e) === Code.NotFound) await this.reloadVideos();
      this.focusLater('delete-' + v.id, 'heading');
    } finally {
      this.busy.set(false);
    }
  }

  // ---- the options ----

  protected async setOption(field: 'backgroundEnabled' | 'backgroundShuffle', event: Event): Promise<void> {
    const box = event.target as HTMLInputElement;
    const value = box.checked;
    const signalOf = field === 'backgroundEnabled' ? this.enabledOption : this.shuffleOption;
    const before = signalOf();
    signalOf.set(value);
    try {
      await this.admins.updateServerSettings({ [field]: value });
      this.toast.show('Saved.');
    } catch (e) {
      signalOf.set(before);
      box.checked = before;
      this.toast.show(this.say(e), 'error');
    }
  }
}

/** The code of a failed call. */
const codeOf = (e: unknown): Code => ConnectError.from(e).code;
