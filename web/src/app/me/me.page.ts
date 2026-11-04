import { Component, inject } from '@angular/core';
import { InstallPrompt } from '../core/install';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-me-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="me">
      <h1>Me</h1>
      <nav class="sub-nav" aria-label="My account">
        <a routerLink="/me/favourites" routerLinkActive="active" ariaCurrentWhenActive="page">Favourites</a>
        <a routerLink="/me/history" routerLinkActive="active" ariaCurrentWhenActive="page">History</a>
        <a routerLink="/me/playlists" routerLinkActive="active" ariaCurrentWhenActive="page">Playlists</a>
        <a routerLink="/me/devices" routerLinkActive="active" ariaCurrentWhenActive="page">Devices</a>
        <a routerLink="/me/settings" routerLinkActive="active" ariaCurrentWhenActive="page">Score</a>
        <a routerLink="/me/appearance" routerLinkActive="active" ariaCurrentWhenActive="page">Appearance and account</a>
        <a routerLink="/me/password" routerLinkActive="active" ariaCurrentWhenActive="page">Password</a>
        <a routerLink="/me/help" routerLinkActive="active" ariaCurrentWhenActive="page">Help</a>
        <a routerLink="/me/approve-tv" routerLinkActive="active" ariaCurrentWhenActive="page">Approve a TV</a>
        @if (install.available()) {
          <button type="button" class="entry" (click)="install.install()">Install the app</button>
        }
      </nav>
      <router-outlet />
    </div>
  `,
  styles: `
    .me {
      /* a reading column: wider, the title and the buttons of a row are too far apart; left aligned in the frame */
      max-width: 48rem;
      padding: 1rem;
    }
  `,
})
export class MePage {
  protected readonly install = inject(InstallPrompt);
}
