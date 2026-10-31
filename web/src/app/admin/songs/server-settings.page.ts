import { Component, signal } from '@angular/core';
import { Code } from '@connectrpc/connect';
import { AdminService, ServerSettings } from '../../../gen/kantahe/v1/admin_pb';
import { injectClient } from '../../core/api';
import { fromServer, problem } from '../../core/errors';
import { fieldValue } from '../../auth/form';

const MB = 1024n * 1024n;

@Component({
  selector: 'app-server-settings-page',
  template: `
    <h2>Server settings</h2>
    <form (submit)="save($event)" novalidate>
      <div class="field">
        <label for="max-upload">Largest song file (MB)</label>
        <input id="max-upload" type="text" inputmode="numeric" autocomplete="off" [value]="maxUpload()" (input)="maxUpload.set(value($event))" />
        @if (maxError()) {
          <p class="error" role="alert">{{ maxError() }}</p>
        }
      </div>
      <div class="field">
        <label for="score-seconds">Show the score for (seconds)</label>
        <input id="score-seconds" type="text" inputmode="numeric" autocomplete="off" [value]="scoreSeconds()" (input)="scoreSeconds.set(value($event))" />
        @if (scoreError()) {
          <p class="error" role="alert">{{ scoreError() }}</p>
        }
      </div>
      @if (failure()) {
        <p class="error" role="alert">{{ failure() }}</p>
      }
      <button type="submit" [disabled]="busy()">Save</button>
      @if (saved()) {
        <span role="status">Saved.</span>
      }
    </form>
  `,
})
export class ServerSettingsPage {
  private readonly admins = injectClient(AdminService);

  protected readonly maxUpload = signal('');
  protected readonly scoreSeconds = signal('');
  protected readonly maxError = signal('');
  protected readonly scoreError = signal('');
  protected readonly failure = signal('');
  protected readonly saved = signal(false);
  protected readonly busy = signal(false);
  protected readonly value = fieldValue;
  private current?: ServerSettings;

  constructor() {
    void this.load();
  }

  private show(s: ServerSettings): void {
    this.current = s;
    this.maxUpload.set(String(s.maxUploadBytes / MB));
    this.scoreSeconds.set(String(s.scoreSeconds));
  }

  private async load(): Promise<void> {
    try {
      const res = await this.admins.getServerSettings({});
      if (res.settings) this.show(res.settings);
    } catch (e) {
      this.failure.set(problem(e, {}));
    }
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || !this.current) return;
    this.saved.set(false);
    this.failure.set('');
    this.maxError.set('');
    this.scoreError.set('');
    const maxText = this.maxUpload().trim();
    const scoreText = this.scoreSeconds().trim();
    const maxOk = /^\d+$/.test(maxText) && BigInt(maxText) >= 1n;
    const scoreOk = /^\d+$/.test(scoreText) && Number(scoreText) <= 60;
    if (!maxOk) this.maxError.set('The upload limit must be a whole number of megabytes, at least 1.');
    if (!scoreOk) this.scoreError.set('The score time is a whole number of seconds, 0 to 60.');
    if (!maxOk || !scoreOk) return;
    const maxUploadBytes = BigInt(maxText) * MB;
    const score = Number(scoreText);
    const changes = {
      maxUploadBytes: maxUploadBytes !== this.current.maxUploadBytes ? maxUploadBytes : undefined,
      scoreSeconds: score !== this.current.scoreSeconds ? score : undefined,
    };
    if (changes.maxUploadBytes === undefined && changes.scoreSeconds === undefined) return;
    this.busy.set(true);
    try {
      const res = await this.admins.updateServerSettings(changes);
      if (res.settings) this.show(res.settings);
      this.saved.set(true);
    } catch (e) {
      this.failure.set(problem(e, { [Code.InvalidArgument]: fromServer }));
    } finally {
      this.busy.set(false);
    }
  }
}
