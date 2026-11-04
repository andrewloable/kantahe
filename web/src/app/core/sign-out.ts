import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../gen/kantahe/v1/auth_pb';
import { injectClient } from './api';
import { AuthStore } from './auth.store';
import { ToastService } from './toast';

/** Sign out, from the top bar or from Me > Appearance and account: signs out here whatever the server says, so a user who presses it ends up signed out. */
@Injectable({ providedIn: 'root' })
export class SignOut {
  private readonly client = injectClient(AuthService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private busy = false;

  async run(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.client.logout({});
    } catch {
      this.toasts.show('Signed out here. The server could not be told, so this device stays signed in there until it expires.', 'error');
    } finally {
      this.auth.signOut();
      this.busy = false;
      await this.router.navigateByUrl('/login');
    }
  }
}
