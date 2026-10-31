import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../gen/kantahe/v1/auth_pb';
import { injectClient } from './core/api';
import { AuthStore } from './core/auth.store';
import { ToastService } from './core/toast';

/** The frame of the ordinary pages: the title and, once signed in, the menu. The player pages have none. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './shell.component.css',
  template: `
    <h1>Kantahe</h1>
    @if (auth.signedIn()) {
      <nav aria-label="Main">
        <a routerLink="/library" routerLinkActive="active" ariaCurrentWhenActive="page">Library</a>
        <a routerLink="/queue" routerLinkActive="active" ariaCurrentWhenActive="page">Queue</a>
        <a routerLink="/player" routerLinkActive="active" ariaCurrentWhenActive="page">Player</a>
        <a routerLink="/me" routerLinkActive="active" ariaCurrentWhenActive="page">Me</a>
        <a routerLink="/code" routerLinkActive="active" ariaCurrentWhenActive="page">Approve a TV</a>
        @if (auth.user()?.uploader || auth.user()?.admin) {
          <a routerLink="/upload" routerLinkActive="active" ariaCurrentWhenActive="page">Upload</a>
        }
        @if (auth.user()?.admin) {
          <a routerLink="/admin" routerLinkActive="active" ariaCurrentWhenActive="page">Admin</a>
        }
        <button type="button" (click)="signOut()">Sign out</button>
      </nav>
    }
    <router-outlet />
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthStore);
  private readonly client = injectClient(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private signingOut = false;

  /** Signs out here whatever the server says: a user who presses Sign out must end up signed out. */
  protected async signOut(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    try {
      await this.client.logout({});
    } catch {
      this.toasts.show(
        'Signed out here. The server could not be told, so this device stays signed in there until it expires.',
        'error',
      );
    } finally {
      this.auth.signOut();
      this.signingOut = false;
      await this.router.navigateByUrl('/login');
    }
  }
}
