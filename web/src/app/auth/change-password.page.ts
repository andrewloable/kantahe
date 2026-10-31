import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Code } from '@connectrpc/connect';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { Errors, fieldValue, fromServer, passwordLengthOk, problem } from './form';

@Component({
  selector: 'app-change-password-page',
  imports: [RouterLink],
  template: `
    <main class="card">
      <h1>Change password</h1>
      @if (done()) {
        <p role="status">Password changed. Other devices were signed out.</p>
        <p><a routerLink="/library">Continue</a></p>
      } @else {
        @if (mustChange()) {
          <p>Choose a new password to continue.</p>
        }
        <form (submit)="submit($event)" novalidate>
          <div class="field">
            <label for="current">Current password</label>
            <input id="current" type="password" autocomplete="current-password" [value]="current()" (input)="current.set(value($event))"
              [attr.aria-invalid]="errors().current ? true : null" [attr.aria-describedby]="errors().current ? 'current-error' : null" />
            @if (errors().current) {
              <p id="current-error" class="error" role="alert">{{ errors().current }}</p>
            }
          </div>
          <div class="field">
            <label for="new">New password</label>
            <input id="new" type="password" autocomplete="new-password" [value]="next()" (input)="next.set(value($event))"
              [attr.aria-invalid]="errors().next ? true : null" [attr.aria-describedby]="errors().next ? 'new-error' : null" />
            @if (errors().next) {
              <p id="new-error" class="error" role="alert">{{ errors().next }}</p>
            }
          </div>
          <div class="field">
            <label for="confirm">Repeat the new password</label>
            <input id="confirm" type="password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set(value($event))"
              [attr.aria-invalid]="errors().confirm ? true : null" [attr.aria-describedby]="errors().confirm ? 'confirm-error' : null" />
            @if (errors().confirm) {
              <p id="confirm-error" class="error" role="alert">{{ errors().confirm }}</p>
            }
          </div>
          @if (failure()) {
            <p class="error" role="alert">{{ failure() }}</p>
          }
          <button type="submit" [disabled]="busy()">Change password</button>
        </form>
      }
    </main>
  `,
})
export class ChangePasswordPage {
  private readonly client = injectClient(AuthService);
  private readonly auth = inject(AuthStore);

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  protected readonly done = signal(false);
  protected readonly mustChange = this.auth.passwordChangeRequired;
  private readonly submitted = signal(false);

  protected readonly value = fieldValue;

  protected readonly errors = computed(() => {
    if (!this.submitted()) return {} as Errors<'current'|'next'|'confirm'>;
    const out: Errors<'current'|'next'|'confirm'> = {};
    if (this.current() === '') out.current = 'Enter your current password.';
    if (!passwordLengthOk(this.next())) out.next = 'The new password must be 8 to 256 characters.';
    else if (this.next() === this.current()) out.next = 'The new password must differ from the current one.';
    else if (this.next() !== this.confirm()) out.confirm = 'The passwords do not match.';
    return out;
  });

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.submitted.set(true);
    this.failure.set('');
    if (Object.keys(this.errors()).length > 0) return;
    this.busy.set(true);
    try {
      await this.client.changePassword({ currentPassword: this.current(), newPassword: this.next() });
      this.auth.passwordChanged();
      this.current.set('');
      this.next.set('');
      this.confirm.set('');
      this.done.set(true);
    } catch (e) {
      this.failure.set(problem(e, { [Code.PermissionDenied]: 'Current password is wrong.', [Code.ResourceExhausted]: fromServer }));
    } finally {
      this.busy.set(false);
    }
  }
}
