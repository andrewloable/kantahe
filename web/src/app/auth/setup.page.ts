import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { DeviceType } from '../../gen/kantahe/v1/common_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { Errors, fieldValue, passwordLengthOk, problem, validEmail, webDeviceName } from './form';

@Component({
  selector: 'app-setup-page',
  imports: [RouterLink],
  template: `
    <main class="card">
      <h1>Welcome to Kantahe</h1>
      <p>Create the administrator account. You can add other people afterwards.</p>
      <form (submit)="submit($event)" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="email" [value]="email()" (input)="email.set(value($event))"
            [attr.aria-invalid]="errors().email ? true : null" [attr.aria-describedby]="errors().email ? 'email-error' : null" />
          @if (errors().email) {
            <p id="email-error" class="error" role="alert">{{ errors().email }}</p>
          }
        </div>
        <div class="field">
          <label for="displayName">Your name</label>
          <input id="displayName" type="text" autocomplete="name" [value]="displayName()" (input)="displayName.set(value($event))"
            [attr.aria-invalid]="errors().name ? true : null" [attr.aria-describedby]="errors().name ? 'name-error' : null" />
          @if (errors().name) {
            <p id="name-error" class="error" role="alert">{{ errors().name }}</p>
          }
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="new-password" [value]="password()" (input)="password.set(value($event))"
            [attr.aria-invalid]="errors().password ? true : null" [attr.aria-describedby]="errors().password ? 'password-error' : null" />
          @if (errors().password) {
            <p id="password-error" class="error" role="alert">{{ errors().password }}</p>
          }
        </div>
        <div class="field">
          <label for="confirm">Repeat the password</label>
          <input id="confirm" type="password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set(value($event))"
            [attr.aria-invalid]="errors().confirm ? true : null" [attr.aria-describedby]="errors().confirm ? 'confirm-error' : null" />
          @if (errors().confirm) {
            <p id="confirm-error" class="error" role="alert">{{ errors().confirm }}</p>
          }
        </div>
        @if (failure()) {
          <p class="error" role="alert">{{ failure() }}</p>
          @if (alreadyDone()) {
            <p><a routerLink="/login">Sign in</a></p>
          }
        }
        <button type="submit" [disabled]="busy()">Create account</button>
      </form>
    </main>
  `,
})
export class SetupPage {
  private readonly client = injectClient(AuthService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly displayName = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  protected readonly alreadyDone = signal(false);
  private readonly submitted = signal(false);

  protected readonly value = fieldValue;

  /** Messages per field, shown once the user has tried to submit. */
  protected readonly errors = computed(() => {
    if (!this.submitted()) return {} as Errors<'email'|'name'|'password'|'confirm'>;
    const out: Errors<'email'|'name'|'password'|'confirm'> = {};
    if (!validEmail(this.email())) out.email = 'Enter a valid email address.';
    const name = this.displayName().trim();
    if (name.length < 1 || [...name].length > 100) out.name = 'Enter your name (1 to 100 characters).';
    if (!passwordLengthOk(this.password())) out.password = 'The password must be 8 to 256 characters.';
    else if (this.password() !== this.confirm()) out.confirm = 'The passwords do not match.';
    return out;
  });

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.submitted.set(true);
    this.failure.set('');
    this.alreadyDone.set(false);
    if (Object.keys(this.errors()).length > 0) return;
    this.busy.set(true);
    try {
      const res = await this.client.setup({
        email: this.email().trim(),
        displayName: this.displayName().trim(),
        password: this.password(),
        deviceName: webDeviceName(),
        deviceType: DeviceType.WEB,
      });
      if (res.auth) this.auth.signIn(res.auth);
      this.password.set('');
      this.confirm.set('');
      this.submitted.set(false);
      await this.router.navigateByUrl('/library');
    } catch (e) {
      this.alreadyDone.set(ConnectError.from(e).code === Code.FailedPrecondition);
      this.failure.set(this.alreadyDone() ? 'Setup is already complete.' : problem(e, {}));
    } finally {
      this.busy.set(false);
    }
  }
}
