import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-me-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="me">
      <h1>Me</h1>
      <nav aria-label="My account">
        <a routerLink="/me/favourites" routerLinkActive="active" ariaCurrentWhenActive="page">Favourites</a>
        <a routerLink="/me/history" routerLinkActive="active" ariaCurrentWhenActive="page">History</a>
        <a routerLink="/me/playlists" routerLinkActive="active" ariaCurrentWhenActive="page">Playlists</a>
        <a routerLink="/me/devices" routerLinkActive="active" ariaCurrentWhenActive="page">Devices</a>
        <a routerLink="/me/settings" routerLinkActive="active" ariaCurrentWhenActive="page">Score</a>
        <a routerLink="/me/password" routerLinkActive="active" ariaCurrentWhenActive="page">Password</a>
        <a routerLink="/code" routerLinkActive="active" ariaCurrentWhenActive="page">Approve a TV</a>
      </nav>
      <router-outlet />
    </main>
  `,
  styles: `
    .me {
      /* a reading column: wider, the title and the buttons of a row are too far apart; left aligned in the frame */
      max-width: 48rem;
      padding: 1rem;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--line);
    }
    nav a {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      min-width: 2.75rem;
    }
    nav a.active {
      font-weight: 700;
      color: var(--sung);
    }
  `,
})
export class MePage {}
