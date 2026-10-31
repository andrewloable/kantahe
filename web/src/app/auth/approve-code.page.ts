import { Component, computed, signal } from '@angular/core';
import { Code } from '@connectrpc/connect';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { injectClient } from '../core/api';
import { fromServer, problem } from './form';

const CODE_LENGTH = 6;

@Component({
  selector: 'app-approve-code-page',
  template: `
    <main class="card">
      <h1>Approve a TV</h1>
      <p>Enter the code shown on the TV to sign it in with your account.</p>
      <form (submit)="submit($event)" novalidate>
        <div class="field">
          <label for="code">Code</label>
          <input id="code" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="6"
            aria-describedby="code-hint" class="code" [value]="code()" (input)="type($event)" />
          <p id="code-hint" class="hint">Six characters: letters and the digits 2 to 9. A code never has 0, 1, I or O.</p>
        </div>
        @if (failure()) {
          <p class="error" role="alert">{{ failure() }}</p>
        }
        @if (approved()) {
          <p role="status">Signed in {{ approved() }}</p>
        }
        <button type="submit" [disabled]="busy() || !complete()">Approve</button>
      </form>
    </main>
  `,
})
export class ApproveCodePage {
  private readonly client = injectClient(AuthService);

  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  protected readonly approved = signal('');
  protected readonly complete = computed(() => this.code().length === CODE_LENGTH);

  /** Capitals only; spaces, dashes and other marks (as in "ab-c d12") are dropped. */
  protected type(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
    input.value = clean;
    this.code.set(clean);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || !this.complete()) return;
    this.failure.set('');
    this.approved.set('');
    this.busy.set(true);
    try {
      const res = await this.client.approveCode({ code: this.code() });
      this.approved.set(res.deviceName);
      this.code.set('');
    } catch (e) {
      this.failure.set(problem(e, { [Code.NotFound]: 'Code not found or expired', [Code.ResourceExhausted]: fromServer }));
    } finally {
      this.busy.set(false);
    }
  }
}
