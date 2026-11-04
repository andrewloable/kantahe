import { Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { Environment } from '../environments/environment.model';
import { adminGuard, authGuard, serverGuard, setupGuard } from './core/guards';
import { ShellComponent } from './shell.component';

const signInPage = (env: Environment) =>
  env.isTv
    ? () => import('./tv/code-sign-in.page').then((m) => m.CodeSignInPage)
    : () => import('./auth/login.page').then((m) => m.LoginPage);

const pages = (env: Environment): Routes => [
  { path: '', pathMatch: 'full', redirectTo: 'library' },
  { path: 'setup', title: 'Set up', loadComponent: () => import('./auth/setup.page').then((m) => m.SetupPage) },
  { path: 'login', title: 'Sign in', loadComponent: signInPage(env), canActivate: [setupGuard] },
  // the address on the TV's screen and in its QR code: the page itself is under Me, with the Me menu
  { path: 'code', pathMatch: 'full', redirectTo: 'me/approve-tv' },
  { path: 'library', title: 'Library', loadComponent: () => import('./library/library.page').then((m) => m.LibraryPage), canActivate: [authGuard] },
  // Upload is a page of Admin (with the admin menu on screen); the old address still leads there
  { path: 'upload', pathMatch: 'full', redirectTo: 'admin/upload' },
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
      { path: 'appearance', title: 'Appearance and account', loadComponent: () => import('./me/appearance.component').then((m) => m.AppearanceComponent) },
      { path: 'help', title: 'Help', loadComponent: () => import('./me/help.component').then((m) => m.HelpComponent) },
      { path: 'password', title: 'Password', loadComponent: () => import('./auth/change-password.page').then((m) => m.ChangePasswordPage) },
      { path: 'approve-tv', title: 'Approve a TV', loadComponent: () => import('./auth/approve-code.page').then((m) => m.ApproveCodePage) },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.page').then((m) => m.AdminPage),
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      { path: 'upload', title: 'Upload songs', loadComponent: () => import('./admin/songs/upload.page').then((m) => m.UploadPage) },
      { path: 'users', title: 'Users', loadComponent: () => import('./admin/users/users.page').then((m) => m.UsersPage) },
      { path: 'songs', title: 'Songs', loadComponent: () => import('./admin/songs/songs-admin.page').then((m) => m.SongsAdminPage) },
      { path: 'videos', title: 'Videos', loadComponent: () => import('./admin/videos/videos.page').then((m) => m.VideosPage) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./admin/songs/server-settings.page').then((m) => m.ServerSettingsPage) },
      { path: 'transfer', title: 'Transfer', loadComponent: () => import('./admin/transfer/transfer.page').then((m) => m.TransferPage) },
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
