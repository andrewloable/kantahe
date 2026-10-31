import { Routes } from '@angular/router';
import { adminGuard, authGuard, setupGuard, uploaderGuard } from './core/guards';
import { ShellComponent } from './shell.component';

const pages: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'library' },
  { path: 'setup', loadComponent: () => import('./auth/setup.page').then((m) => m.SetupPage) },
  { path: 'login', loadComponent: () => import('./auth/login.page').then((m) => m.LoginPage), canActivate: [setupGuard] },
  { path: 'code', loadComponent: () => import('./auth/approve-code.page').then((m) => m.ApproveCodePage), canActivate: [authGuard] },
  { path: 'library', loadComponent: () => import('./library/library.page').then((m) => m.LibraryPage), canActivate: [authGuard] },
  { path: 'upload', loadComponent: () => import('./admin/songs/upload.page').then((m) => m.UploadPage), canActivate: [authGuard, uploaderGuard] },
  { path: 'queue', loadComponent: () => import('./queue/queue.page').then((m) => m.QueuePage), canActivate: [authGuard] },
  {
    path: 'me',
    loadComponent: () => import('./me/me.page').then((m) => m.MePage),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'favourites' },
      { path: 'favourites', loadComponent: () => import('./me/favourites.component').then((m) => m.FavouritesComponent) },
      { path: 'history', loadComponent: () => import('./me/history.component').then((m) => m.HistoryComponent) },
      { path: 'playlists', loadComponent: () => import('./me/playlists.component').then((m) => m.PlaylistsComponent) },
      { path: 'playlists/:id', loadComponent: () => import('./me/playlist-detail.component').then((m) => m.PlaylistDetailComponent) },
      { path: 'devices', loadComponent: () => import('./me/my-devices.component').then((m) => m.MyDevicesComponent) },
      { path: 'settings', loadComponent: () => import('./me/score-settings.component').then((m) => m.ScoreSettingsComponent) },
      { path: 'password', loadComponent: () => import('./auth/change-password.page').then((m) => m.ChangePasswordPage) },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.page').then((m) => m.AdminPage),
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      { path: 'users', loadComponent: () => import('./admin/users/users.page').then((m) => m.UsersPage) },
      { path: 'songs', loadComponent: () => import('./admin/songs/songs-admin.page').then((m) => m.SongsAdminPage) },
      { path: 'settings', loadComponent: () => import('./admin/songs/server-settings.page').then((m) => m.ServerSettingsPage) },
    ],
  },
  { path: '**', redirectTo: 'library' },
];

export const routes: Routes = [
  // the player pages have no frame: they are the whole screen
  { path: 'player', loadComponent: () => import('./player/player.page').then((m) => m.PlayerPage), canActivate: [authGuard] },
  // the token arrives through window.kantahe.setToken, so there is no guard
  { path: 'embed/player', loadComponent: () => import('./player/embed-player.page').then((m) => m.EmbedPlayerPage) },
  { path: '', component: ShellComponent, children: pages },
];
