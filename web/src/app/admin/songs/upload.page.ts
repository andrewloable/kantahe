import { RouterLink } from '@angular/router';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { AdminService } from '../../../gen/kantahe/v1/admin_pb';
import { UploadService, UploadStatus } from '../../../gen/kantahe/v1/upload_pb';
import { injectClient } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { Code } from '@connectrpc/connect';
import { fromServer, problem } from '../../core/errors';
import { extractSongs, readBlob } from './zip';
import { GettingStartedComponent } from '../getting-started.component';

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MB = 1024 * 1024;

interface Row {
  name: string;
  result: 'Waiting' | 'Sending…' | 'Added' | 'Duplicate' | 'Rejected' | 'Not sent';
  detail: string;
}

@Component({
  selector: 'app-upload-page',
  imports: [GettingStartedComponent, RouterLink],
  template: `
    <!-- the first page of Administration: a new server's first steps (kantahe-qzr.7); the lists of the other pages stay dense -->
    <app-getting-started />
    <section class="upload">
      <div class="page-head">
        <h2>Upload songs</h2>
        <a class="help-link" routerLink="/me/help" fragment="admin">Help</a>
      </div>
      <div class="drop" (dragover)="$event.preventDefault()" (drop)="dropped($event)">
        <label id="upload-label" for="upload-files">Choose song files (.kar, .karmp3) or ZIP files with songs in them</label>
        <!-- the browser's own control is hidden: a button in the app's style opens it (kantahe-qzr.5); drop and the tests still use the input -->
        <div class="picker">
          <button type="button" aria-describedby="upload-label upload-help" [disabled]="busy()" (click)="fileInput.click()">Choose files</button>
          <span class="chosen">{{ chosenCount() === 0 ? 'No file chosen' : chosenCount() === 1 ? '1 file chosen' : chosenCount() + ' files chosen' }}</span>
        </div>
        <input #fileInput id="upload-files" type="file" multiple hidden accept=".kar,.karmp3,.zip" [disabled]="busy()" (change)="chosen($event)" />
        <p class="hint" id="upload-help">
          You can also drop files here. Files larger than {{ limitMb() }} MB are not sent. ZIP files are unpacked on this device. A song that is already in
          the library is reported as a duplicate and not added again.
        </p>
      </div>
      @if (rows().length > 0) {
        <p role="status">{{ done() }} of {{ total() }}@if (!busy()) { — {{ summary() }} }</p>
        @if (busy()) {
          <button class="quiet" type="button" (click)="cancel()">Cancel</button>
        }
        <table role="table">
          <caption class="sr-only">
            Result for each file
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">File</th>
              <th scope="col" role="columnheader">Result</th>
              <th scope="col" role="columnheader">Details</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            @for (r of rows(); track $index) {
              <tr role="row">
                <td role="cell" class="file" [attr.title]="r.name">{{ r.name }}</td>
                <!-- the result in words with a mark beside it: colour is never the only signal (kantahe-qzr.5) -->
                <td role="cell"><span [class]="'status ' + statusClass(r.result)">{{ r.result }}</span></td>
                <td role="cell" class="detail">{{ r.detail }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
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
    /* on a phone each result is a block: the file, the result, the details at the full width; the header row stays for screen readers */
    /* the width of the page's own box, in rem: with a larger text size a table that needs 44rem no longer fits, and the blocks come sooner */
    @container (max-width: 44rem) {
      table,
      tbody,
      tr,
      td {
        display: block;
      }
      thead {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      /* one row per file: the name and its status badge on one line, the details under them (kantahe-qzr.5) */
      tr {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 0.75rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--line);
      }
      /* tbody td: stronger than the th, td rule below, which drew a line under every cell of a block */
      tbody td {
        padding: 0.15rem 0;
        border-bottom: 0;
        overflow-wrap: anywhere;
      }
      td.file {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      td.detail {
        grid-column: 1 / -1;
        color: var(--muted);
      }
      td.detail:empty {
        display: none;
      }
    }
    .picker {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
      margin-top: 0.5rem;
    }
    .chosen {
      color: var(--muted);
    }
    .status {
      display: inline-block;
      padding: 0.1rem 0.5rem;
      border: 1px solid var(--field-line);
      border-radius: 0.35rem;
      font-size: 0.875rem;
      font-weight: 700;
      white-space: nowrap;
    }
    /* the marks are decoration: the word says it (the empty alternative keeps them out of the spoken name) */
    .status.added::before {
      content: '✓ ' / '';
    }
    .status.duplicate::before {
      content: '= ' / '';
    }
    .status.rejected::before {
      content: '✕ ' / '';
    }
    .status.added {
      border-color: var(--accent);
      color: var(--accent);
    }
    .status.rejected {
      border-color: var(--danger);
      color: var(--danger);
    }
    .status.duplicate {
      color: var(--muted);
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
    const duplicates = count('Duplicate');
    return `${count('Added')} added, ${duplicates} ${duplicates === 1 ? 'duplicate' : 'duplicates'}, ${count('Rejected')} rejected`;
  });
  /** How many files were chosen or dropped last, said beside Choose files. */
  protected readonly chosenCount = signal(0);

  protected statusClass(result: Row['result']): string {
    return result === 'Added' ? 'added' : result === 'Duplicate' ? 'duplicate' : result === 'Rejected' ? 'rejected' : 'pending';
  }
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
    this.chosenCount.set(files.length);
    void this.start(files);
  }

  protected dropped(event: Event): void {
    event.preventDefault();
    const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
    this.chosenCount.set(files.length);
    void this.start(files);
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
