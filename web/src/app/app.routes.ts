import { Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { Environment } from '../environments/environment.model';
import { adminGuard, authGuard, serverGuard, setupGuard, uploaderGuard } from './core/guards';
import { ShellComponent } from './shell.component';

const signInPage = (env: Environment) =>
  env.isTv
    ? () => import('./tv/code-sign-in.page').then((m) => m.CodeSignInPage)
    : () => import('./auth/login.page').then((m) => m.LoginPage);

const pages = (env: Environment): Routes => [
  { path: '', pathMatch: 'full', redirectTo: 'library' },
  { path: 'setup', title: 'Set up', loadComponent: () => import('./auth/setup.page').then((m) => m.SetupPage) },
  { path: 'login', title: 'Sign in', loadComponent: signInPage(env), canActivate: [setupGuard] },
  { path: 'code', title: 'Approve a TV', loadComponent: () => import('./auth/approve-code.page').then((m) => m.ApproveCodePage), canActivate: [authGuard] },
  { path: 'library', title: 'Library', loadComponent: () => import('./library/library.page').then((m) => m.LibraryPage), canActivate: [authGuard] },
  { path: 'upload', title: 'Upload songs', loadComponent: () => import('./admin/songs/upload.page').then((m) => m.UploadPage), canActivate: [authGuard, uploaderGuard] },
  { path: 'queue', title: 'Queue', loadComponent: () => import('./queue/queue.page').then((m) => m.QueuePage), canActivate: [authGuard] },
  {
    path: 'me',
    loadComponent: () => import('./me/me.page').then((m) => m.MePage),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'favourites' },
      { path: 'favourites', title: 'Favourites', loadComponent: () => import('./me/favourites.component').then((m) => m.FavouritesComponent) },
      { path: 'history', title: 'History', loadComponent: () => import('./me/history.component').then((m) => m.HistoryComponent) },
      { path: 'playlists', title: 'Playlists', loadComponent: () => import('./me/playlists.component').then((m) => m.PlaylistsComponent) },
      { path: 'playlists/:id', title: 'Playlist', loadComponent: () => import('./me/playlist-detail.component').then((m) => m.PlaylistDetailComponent) },
      { path: 'devices', title: 'Devices', loadComponent: () => import('./me/my-devices.component').then((m) => m.MyDevicesComponent) },
      { path: 'settings', title: 'Score', loadComponent: () => import('./me/score-settings.component').then((m) => m.ScoreSettingsComponent) },
      { path: 'password', title: 'Password', loadComponent: () => import('./auth/change-password.page').then((m) => m.ChangePasswordPage) },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.page').then((m) => m.AdminPage),
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      { path: 'users', title: 'Users', loadComponent: () => import('./admin/users/users.page').then((m) => m.UsersPage) },
      { path: 'songs', title: 'Songs', loadComponent: () => import('./admin/songs/songs-admin.page').then((m) => m.SongsAdminPage) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./admin/songs/server-settings.page').then((m) => m.ServerSettingsPage) },
    ],
  },
  { path: '**', redirectTo: 'library' },
];

/** The routes of a build: a TV build adds the page for the server address and signs in with a code. */
export function buildRoutes(env: Environment): Routes {
  return [
  // the address of the server is typed in on a TV before anything else
  ...(env.isTv ? [{ path: 'server', title: 'Server address', loadComponent: () => import('./tv/server-address.page').then((m) => m.ServerAddressPage) }] : []),
  // the player pages have no frame: they are the whole screen
  { path: 'player', title: 'Player', loadComponent: () => import('./player/player.page').then((m) => m.PlayerPage), canActivate: [serverGuard, authGuard] },
  // the token arrives through window.kantahe.setToken, so there is no guard
  { path: 'embed/player', loadComponent: () => import('./player/embed-player.page').then((m) => m.EmbedPlayerPage) },
  { path: '', component: ShellComponent, canActivateChild: [serverGuard], children: pages(env) },
  ];
}

export const routes: Routes = buildRoutes(environment);
