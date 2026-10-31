import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="admin">
      <h1>Administration</h1>
      <nav aria-label="Administration">
        <a routerLink="/admin/users" routerLinkActive="active" ariaCurrentWhenActive="page">Users</a>
        <a routerLink="/admin/songs" routerLinkActive="active" ariaCurrentWhenActive="page">Songs</a>
        <a routerLink="/admin/settings" routerLinkActive="active" ariaCurrentWhenActive="page">Settings</a>
      </nav>
      <router-outlet />
    </main>
  `,
  styles: `
    .admin {
      max-width: 60rem;
      margin: 0 auto;
      padding: 1rem;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--line);
    }
    nav a {
      display: inline-flex;
      align-items: center;
      min-height: 2.75rem;
      padding: 0 0.25rem;
    }
    nav a.active {
      font-weight: 700;
      color: var(--sung);
    }
  `,
})
export class AdminPage {}
