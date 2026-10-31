import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Code } from '@connectrpc/connect';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { DeviceType } from '../../gen/kantahe/v1/common_pb';
import { injectClient } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { Errors, fieldValue, fromServer, problem, safeReturnUrl, webDeviceName } from './form';

@Component({
  selector: 'app-login-page',
  template: `
    <main class="card">
      <h1>Sign in</h1>
      <form (submit)="submit($event)" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="username" [value]="email()" (input)="email.set(value($event))"
            [attr.aria-invalid]="errors().email ? true : null" [attr.aria-describedby]="errors().email ? 'email-error' : null" />
          @if (errors().email) {
            <p id="email-error" class="error" role="alert">{{ errors().email }}</p>
          }
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="current-password" [value]="password()" (input)="password.set(value($event))"
            [attr.aria-invalid]="errors().password ? true : null" [attr.aria-describedby]="errors().password ? 'password-error' : null" />
          @if (errors().password) {
            <p id="password-error" class="error" role="alert">{{ errors().password }}</p>
          }
        </div>
        @if (failure()) {
          <p class="error" role="alert">{{ failure() }}</p>
        }
        <button type="submit" [disabled]="busy()">Sign in</button>
      </form>
    </main>
  `,
})
export class LoginPage {
  private readonly client = injectClient(AuthService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  private readonly submitted = signal(false);

  protected readonly value = fieldValue;

  protected errors(): Errors<'email'|'password'> {
    if (!this.submitted()) return {};
    const out: Errors<'email'|'password'> = {};
    if (this.email().trim() === '') out.email = 'Enter your email address.';
    if (this.password() === '') out.password = 'Enter your password.';
    return out;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    this.submitted.set(true);
    this.failure.set('');
    if (Object.keys(this.errors()).length > 0) return;
    this.busy.set(true);
    try {
      const res = await this.client.login({
        email: this.email().trim(),
        password: this.password(),
        deviceName: webDeviceName(),
        deviceType: DeviceType.WEB,
      });
      if (!res.auth) throw new Error('empty reply');
      this.auth.signIn(res.auth);
      this.password.set('');
      this.submitted.set(false);
      const next = res.auth.user?.mustChangePassword ? '/me/password' : safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
      await this.router.navigateByUrl(next);
    } catch (e) {
      this.password.set('');
      this.submitted.set(false); // the emptied password is not a mistake to flag
      this.failure.set(
        problem(e, {
          [Code.Unauthenticated]: 'Invalid email or password',
          [Code.ResourceExhausted]: fromServer,
          [Code.PermissionDenied]: 'This account is disabled.',
        }),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
