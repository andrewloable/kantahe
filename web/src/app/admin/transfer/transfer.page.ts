import { Component, DestroyRef, InjectionToken, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminService, InspectExportResponse } from '../../../gen/kantahe/v1/admin_pb';
import { AuthService } from '../../../gen/kantahe/v1/auth_pb';
import { fieldValue } from '../../auth/form';
import { injectClient } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { fromServer, problem } from '../../core/errors';

/** How often the page asks a restarting server whether it is back, and when it gives up (tests make both short). */
export const TRANSFER_TIMING = new InjectionToken<{ pollMs: number; giveUpMs: number }>('kantahe transfer timing', {
  providedIn: 'root',
  factory: () => ({ pollMs: 1000, giveUpMs: 120_000 }),
});

interface Progress {
  done: number;
  total: number;
  bytesDone: bigint;
  bytesTotal: bigint;
}

type ExportRun = 'idle' | 'running' | 'done' | 'cancelled' | 'failed';
type ImportRun = 'idle' | 'running' | 'restarting' | 'back' | 'slow' | 'staged' | 'failed';

const MB = 1024 * 1024;
const megabytes = (n: bigint) => (Number(n) / MB).toFixed(1);
const progressText = (p: Progress) => `${p.done} of ${p.total} files, ${megabytes(p.bytesDone)} of ${megabytes(p.bytesTotal)} MB`;
const serverTexts = { [Code.InvalidArgument]: fromServer, [Code.FailedPrecondition]: fromServer };

/** Admin > Transfer: move the whole server to another one through a folder on the server's disk (docs/PLAN.md section 6). */
@Component({
  selector: 'app-transfer-page',
  imports: [RouterLink],
  template: `
    <h2>Move this server</h2>
    <p class="hint">
      Export writes everything (settings, users, songs and videos) into a folder on the server's disk. Import replaces everything on this server with such a folder. The folder holds
      password hashes: keep it private and delete it when you are done.
    </p>

    <section aria-labelledby="export-title">
      <h3 id="export-title">Export</h3>
      <div class="field">
        <label for="export-folder">Folder on the server</label>
        <input
          id="export-folder"
          type="text"
          autocomplete="off"
          spellcheck="false"
          [placeholder]="placeholder"
          [value]="exportFolder()"
          [disabled]="busy()"
          (input)="exportFolder.set(value($event))"
        />
      </div>
      <button class="primary" type="button" (click)="runExport()" [disabled]="busy()">Export</button>
      @if (exportRun() === 'running') {
        <button class="quiet" type="button" (click)="cancelExport()">Cancel</button>
        @if (exportProgress(); as p) {
          <p><progress aria-label="Export progress" [value]="p.done" [max]="p.total || 1"></progress></p>
          <p role="status" aria-live="polite">{{ text(p) }}</p>
        }
      }
      @if (exportRun() === 'done') {
        <p role="status">Exported to {{ exportedTo() }}.</p>
        @if (skipped().length > 0) {
          <p>These songs were left out because their file could not be read: {{ skipped().join(', ') }}</p>
        }
      }
      @if (exportRun() === 'cancelled') {
        <p role="status">Export cancelled. The folder {{ exportFolder() }} is incomplete; delete it.</p>
      }
      @if (exportError()) {
        <p class="error" role="alert">{{ exportError() }}</p>
      }
    </section>

    <section aria-labelledby="import-title">
      <h3 id="import-title">Import</h3>
      <div class="field">
        <label for="import-folder">Folder on the server</label>
        <input
          id="import-folder"
          type="text"
          autocomplete="off"
          spellcheck="false"
          [value]="importFolder()"
          [disabled]="busy()"
          (input)="folderChanged($event)"
        />
      </div>
      <button type="button" (click)="check()" [disabled]="busy()">Check</button>
      @if (checkError()) {
        <p class="error" role="alert">{{ checkError() }}</p>
      }
      @if (found(); as f) {
        <div class="summary">
          <p>From {{ f.serverName }} (Kantahe {{ f.kantaheVersion }}), exported {{ date(f) }}</p>
          <p>{{ f.songs }} songs, {{ f.users }} users, {{ f.videos }} videos, {{ mb(f.bytesTotal) }} MB</p>
          <p class="warning">
            Importing replaces everything on this server: its users, settings, songs, videos, queues and playlists. The current database is kept in the data folder under backups.
            Everyone is signed out; sign in with an account of the exported server.
          </p>
          <div class="field">
            <input id="import-confirm" type="checkbox" [checked]="confirmed()" [disabled]="busy()" (change)="confirmChanged($event)" />
            <label for="import-confirm" class="inline">I understand that this replaces everything</label>
          </div>
          <button class="danger primary" type="button" (click)="runImport()" [disabled]="busy() || !confirmed()">Replace everything on this server</button>
        </div>
      }
      @if (importRun() === 'running' && importProgress(); as p) {
        <p><progress aria-label="Import progress" [value]="p.done" [max]="p.total || 1"></progress></p>
        <p role="status" aria-live="polite">{{ text(p) }}</p>
      }
      @switch (importRun()) {
        @case ('restarting') {
          <p role="status">Imported. The server is restarting…</p>
        }
        @case ('back') {
          <p role="status">The server is back. <a routerLink="/login">Sign in</a> with an account of the exported server.</p>
        }
        @case ('slow') {
          <p role="alert">The server has not come back yet. Check its log.</p>
        }
        @case ('staged') {
          <p role="status">Imported. Restart the server to finish.</p>
        }
      }
      @if (importError()) {
        <p class="error" role="alert">{{ importError() }}</p>
      }
    </section>
  `,
  styles: `
    section {
      max-width: 40rem;
      margin: 0 0 2rem;
    }
    progress {
      width: 100%;
    }
    .summary {
      margin-top: 1rem;
    }
    .warning {
      padding: 0.75rem;
      border: 1px solid var(--danger);
      border-radius: 0.5rem;
    }
    label.inline {
      display: inline;
      margin-left: 0.5rem;
      font-weight: 400;
    }
  `,
})
export class TransferPage {
  private readonly admins = injectClient(AdminService);
  private readonly server = injectClient(AuthService);
  private readonly auth = inject(AuthStore);
  private readonly timing = inject(TRANSFER_TIMING);
  private gone = false;
  private exportAbort?: AbortController;
  private checkAbort?: AbortController;

  protected readonly value = fieldValue;
  protected readonly placeholder = `/transfer/kantahe-${new Date().toISOString().slice(0, 10)}`;

  protected readonly exportFolder = signal('');
  protected readonly exportRun = signal<ExportRun>('idle');
  protected readonly exportProgress = signal<Progress | undefined>(undefined);
  protected readonly exportedTo = signal('');
  protected readonly skipped = signal<string[]>([]);
  protected readonly exportError = signal('');

  protected readonly importFolder = signal('');
  protected readonly checking = signal(false);
  protected readonly found = signal<InspectExportResponse | undefined>(undefined);
  protected readonly checkError = signal('');
  protected readonly confirmed = signal(false);
  protected readonly importRun = signal<ImportRun>('idle');
  protected readonly importProgress = signal<Progress | undefined>(undefined);
  protected readonly importError = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.gone = true;
      this.exportAbort?.abort();
      this.checkAbort?.abort();
      // a running import is not stopped: it is staged on the server either way, the page just stops watching
    });
  }

  protected busy(): boolean {
    return this.exportRun() === 'running' || this.checking() || this.importRun() === 'running' || this.importRun() === 'restarting';
  }

  protected text = progressText;
  protected mb = megabytes;
  protected date(f: InspectExportResponse): string {
    return new Date(Number(f.createdUnix) * 1000).toLocaleString();
  }

  protected async runExport(): Promise<void> {
    if (this.busy()) return;
    const folder = this.exportFolder().trim();
    this.exportError.set('');
    this.exportRun.set('idle');
    if (!folder) {
      this.exportError.set('Type the folder on the server where the export goes.');
      return;
    }
    const abort = new AbortController();
    this.exportAbort = abort;
    this.exportProgress.set(undefined);
    this.skipped.set([]);
    this.exportRun.set('running');
    try {
      for await (const m of this.admins.exportData({ folder }, { signal: abort.signal })) {
        if (m.done) {
          this.exportedTo.set(m.folder || folder);
          this.skipped.set(m.skippedNumbers);
          this.exportRun.set('done');
        } else {
          this.exportProgress.set({ done: m.filesDone, total: m.filesTotal, bytesDone: m.bytesDone, bytesTotal: m.bytesTotal });
        }
      }
      if (this.exportRun() === 'running') this.exportRun.set('idle'); // the stream ended without its last message
    } catch (e) {
      if (abort.signal.aborted || ConnectError.from(e).code === Code.Canceled) {
        this.exportRun.set('cancelled');
      } else {
        this.exportRun.set('failed');
        this.exportError.set(problem(e, serverTexts));
      }
    }
  }

  protected cancelExport(): void {
    this.exportAbort?.abort();
  }

  protected folderChanged(event: Event): void {
    this.importFolder.set(fieldValue(event));
    this.found.set(undefined);
    this.checkError.set('');
    this.confirmed.set(false);
    this.importRun.set('idle');
    this.importError.set('');
  }

  protected confirmChanged(event: Event): void {
    this.confirmed.set((event.target as HTMLInputElement).checked);
  }

  protected async check(): Promise<void> {
    if (this.busy()) return;
    const folder = this.importFolder().trim();
    this.found.set(undefined);
    this.confirmed.set(false);
    this.checkError.set('');
    this.importRun.set('idle');
    this.importError.set('');
    if (!folder) {
      this.checkError.set('Type the folder on the server that holds the export.');
      return;
    }
    const abort = new AbortController();
    this.checkAbort = abort;
    this.checking.set(true);
    try {
      const r = await this.admins.inspectExport({ folder }, { signal: abort.signal });
      if (r.importable) this.found.set(r);
      else this.checkError.set(r.reason || 'This folder cannot be imported.');
    } catch (e) {
      if (!abort.signal.aborted) this.checkError.set(problem(e, serverTexts));
    } finally {
      this.checking.set(false);
    }
  }

  /** The start time of the running server, 0 when it cannot be read. */
  private async startedAt(): Promise<bigint> {
    try {
      return (await this.server.getServerInfo({}, { timeoutMs: 5000 })).startedUnixMs;
    } catch {
      return 0n;
    }
  }

  protected async runImport(): Promise<void> {
    const folder = this.importFolder().trim();
    if (this.busy() || !this.confirmed() || !folder) return;
    this.importError.set('');
    this.importProgress.set(undefined);
    this.importRun.set('running');
    const before = await this.startedAt();
    let restarting: boolean | undefined;
    try {
      for await (const m of this.admins.importData({ folder })) {
        if (m.done) restarting = m.restarting;
        else this.importProgress.set({ done: m.filesDone, total: m.filesTotal, bytesDone: m.bytesDone, bytesTotal: m.bytesTotal });
      }
    } catch (e) {
      if (restarting === undefined) {
        this.importRun.set('failed');
        this.confirmed.set(false);
        this.importError.set(problem(e, serverTexts));
        return;
      }
      // the last message came: a connection that breaks after it is the restart itself
    }
    if (restarting === undefined) {
      this.importRun.set('failed');
      this.importError.set('The server stopped answering before the import was done. Check its log.');
      return;
    }
    this.found.set(undefined);
    this.confirmed.set(false);
    if (!restarting) {
      this.importRun.set('staged');
      return;
    }
    this.importRun.set('restarting');
    if (await this.waitForRestart(before)) {
      this.auth.signOut();
      this.importRun.set('back');
    } else if (!this.gone) {
      this.importRun.set('slow');
    }
  }

  /**
   * Waits until the server answers with another start time than before, that is, until it is the restarted one and not the old one that is
   * still shutting down. When the start time before the import could not be read, an answer counts after the server was seen down.
   */
  private async waitForRestart(before: bigint): Promise<boolean> {
    const until = Date.now() + this.timing.giveUpMs;
    let sawDown = false;
    while (!this.gone && Date.now() < until) {
      await new Promise((r) => setTimeout(r, this.timing.pollMs));
      try {
        const info = await this.server.getServerInfo({}, { timeoutMs: 5000 });
        if (info.startedUnixMs !== before && (before !== 0n || sawDown)) return true;
      } catch {
        sawDown = true;
      }
    }
    return false;
  }
}
