import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { UploadService, UploadStatus } from '../../../gen/kantahe/v1/upload_pb';
import { injectClient } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { Code } from '@connectrpc/connect';
import { fromServer, problem } from '../../core/errors';
import { extractSongs, readBlob } from './zip';

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MB = 1024 * 1024;

interface Row {
  name: string;
  result: 'Waiting' | 'Sending…' | 'Added' | 'Duplicate' | 'Rejected' | 'Not sent';
  detail: string;
}

@Component({
  selector: 'app-upload-page',
  template: `
    <main class="upload">
      <h1>Upload songs</h1>
      <div class="drop" (dragover)="$event.preventDefault()" (drop)="dropped($event)">
        <label for="upload-files">Choose song files (.kar, .karmp3) or ZIP files with songs in them</label>
        <input id="upload-files" type="file" multiple accept=".kar,.karmp3,.zip" [disabled]="busy()" (change)="chosen($event)" />
        <p class="hint">You can also drop files here. Files larger than {{ limitMb() }} MB are not sent.</p>
      </div>
      @if (rows().length > 0) {
        <p role="status">{{ done() }} of {{ total() }}@if (!busy()) { — {{ summary() }} }</p>
        @if (busy()) {
          <button type="button" (click)="cancel()">Cancel</button>
        }
        <table>
          <caption class="sr-only">
            Result for each file
          </caption>
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Result</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track $index) {
              <tr>
                <td>{{ r.name }}</td>
                <td>{{ r.result }}</td>
                <td>{{ r.detail }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </main>
  `,
  styles: `
    .upload {
      max-width: 50rem;
      margin: 0 auto;
      padding: 1rem;
    }
    .drop {
      padding: 1rem;
      border: 2px dashed var(--line);
      border-radius: 0.75rem;
    }
    .hint {
      color: var(--muted);
      font-size: 0.875rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.4rem;
      text-align: left;
      border-bottom: 1px solid var(--line);
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
export class UploadPage {
  private readonly uploads = injectClient(UploadService);
  private readonly admins = injectClient(AdminService);
  private readonly auth = inject(AuthStore);

  protected readonly rows = signal<Row[]>([]);
  protected readonly busy = signal(false);
  private readonly maxBytes = signal(DEFAULT_MAX_BYTES);
  protected readonly limitMb = computed(() => Math.max(1, Math.round(this.maxBytes() / MB)));
  protected readonly total = signal(0);
  protected readonly done = computed(() => this.rows().filter((r) => r.result !== 'Waiting' && r.result !== 'Sending…').length);
  protected readonly summary = computed(() => {
    const count = (r: Row['result']) => this.rows().filter((x) => x.result === r).length;
    return `${count('Added')} added, ${count('Duplicate')} duplicates, ${count('Rejected')} rejected`;
  });
  private cancelled = false;

  constructor() {
    // leaving the page ends the upload: nothing goes on in the background
    inject(DestroyRef).onDestroy(() => (this.cancelled = true));
    // an administrator is held to the limit the server has set; others to the default
    if (this.auth.user()?.admin) {
      this.admins
        .getServerSettings({})
        .then((r) => r.settings && this.maxBytes.set(Number(r.settings.maxUploadBytes)))
        .catch(() => undefined);
    }
  }

  protected cancel(): void {
    this.cancelled = true;
  }

  protected chosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // the same file can be chosen again
    void this.start(files);
  }

  protected dropped(event: Event): void {
    event.preventDefault();
    void this.start(Array.from((event as DragEvent).dataTransfer?.files ?? []));
  }

  private add(row: Row): number {
    this.rows.update((all) => [...all, row]);
    return this.rows().length - 1;
  }

  private set(index: number, row: Row): void {
    this.rows.update((all) => all.map((r, i) => (i === index ? row : r)));
  }

  private async start(files: File[]): Promise<void> {
    if (this.busy() || files.length === 0) return;
    this.busy.set(true);
    this.cancelled = false;
    this.rows.set([]);
    this.total.set(files.length);
    try {
      for (const file of files) {
        if (this.cancelled) {
          this.add({ name: file.name, result: 'Not sent', detail: 'Cancelled' });
          continue;
        }
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'zip') await this.fromZip(file);
        else if (ext === 'kar' || ext === 'karmp3') await this.send(file.name, file.name, file.size, () => readBlob(file));
        else this.add({ name: file.name, result: 'Rejected', detail: 'Only .kar, .karmp3 and .zip files can be uploaded.' });
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async fromZip(zip: File): Promise<void> {
    let found = 0;
    try {
      for await (const entry of extractSongs(zip, { maxEntryBytes: this.maxBytes() })) {
        if (this.cancelled) {
          this.add({ name: zip.name, result: 'Not sent', detail: 'Cancelled' });
          return;
        }
        found++;
        if (found > 1) this.total.update((t) => t + 1); // the ZIP itself counted as the first song
        await this.send(`${zip.name}: ${entry.name}`, entry.name, entry.tooLarge ? Number.POSITIVE_INFINITY : entry.bytes.length, async () => entry.bytes);
      }
    } catch (e) {
      this.add({ name: zip.name, result: 'Rejected', detail: e instanceof Error ? e.message : problem(e, {}) });
      return;
    }
    if (found === 0) this.add({ name: zip.name, result: 'Rejected', detail: 'No songs found in this ZIP file.' });
  }

  private async send(label: string, filename: string, size: number, content: () => Promise<Uint8Array>): Promise<void> {
    if (size > this.maxBytes()) {
      this.add({ name: label, result: 'Rejected', detail: `Larger than the limit of ${this.limitMb()} MB.` });
      return;
    }
    const at = this.add({ name: label, result: 'Sending…', detail: '' });
    try {
      const res = await this.uploads.uploadSong({ filename, content: await content() });
      if (res.status === UploadStatus.ADDED) this.set(at, { name: label, result: 'Added', detail: res.song?.number ?? '' });
      else if (res.status === UploadStatus.DUPLICATE) this.set(at, { name: label, result: 'Duplicate', detail: res.song?.number ?? '' });
      else this.set(at, { name: label, result: 'Rejected', detail: res.reason || 'The server did not accept this file.' });
    } catch (e) {
      this.set(at, { name: label, result: 'Rejected', detail: problem(e, { [Code.PermissionDenied]: fromServer, [Code.FailedPrecondition]: fromServer }) });
    }
  }
}
