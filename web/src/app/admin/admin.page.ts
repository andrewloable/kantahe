import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="admin">
      <h1>Administration</h1>
      <nav class="sub-nav" aria-label="Administration">
        <a routerLink="/admin/upload" routerLinkActive="active" ariaCurrentWhenActive="page">Upload</a>
        <a routerLink="/admin/users" routerLinkActive="active" ariaCurrentWhenActive="page">Users</a>
        <a routerLink="/admin/songs" routerLinkActive="active" ariaCurrentWhenActive="page">Songs</a>
        <a routerLink="/admin/videos" routerLinkActive="active" ariaCurrentWhenActive="page">Videos</a>
        <a routerLink="/admin/settings" routerLinkActive="active" ariaCurrentWhenActive="page">Settings</a>
        <a routerLink="/admin/transfer" routerLinkActive="active" ariaCurrentWhenActive="page">Transfer</a>
      </nav>
      <router-outlet />
    </div>
  `,
  styles: `
    .admin {
      padding: 1rem;
    }
  `,
})
export class AdminPage {}
