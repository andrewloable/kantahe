import { expect, Locator, Page, Route } from '@playwright/test';
import { Account, rpc, Seed } from './seed';

// Every route of the web app (web/src/app/app.routes.ts) in the situations that matter for layout: empty, one item, many, long text,
// an error, a dialog or a question open, a toast showing. To add a route or a state, add one line to states().

export type Role = 'anon' | 'user' | 'admin' | 'scratch';

export interface Ctx {
  page: Page;
  seed: Seed;
  /** The account the page is signed in as (none for 'anon'). */
  account: Account | undefined;
}

export interface RouteState {
  /** The route as app.routes.ts writes it. */
  route: string;
  /** The situation on it. */
  state: string;
  role: Role;
  path: (seed: Seed) => string;
  /** A core flow (sign-in, library, queue, player): sideways scrolling there is a blocker. */
  core?: boolean;
  /** The page is not the app (a fixture of the harness): no sign-in, no splash to wait for. */
  bare?: boolean;
  /** Runs before the page is opened: calls made to fail, pages replaced, the account's data put in order. */
  before?: (c: Ctx) => Promise<void>;
  /** What must be on the screen before anything else happens; by default a heading. */
  ready?: (c: Ctx) => Promise<void>;
  /** Runs when the page has loaded: what the person does to reach the state. */
  after?: (c: Ctx) => Promise<void>;
  /** Console messages and failed requests that this state causes on purpose. */
  ignore?: RegExp[];
}

const LONG_ERROR =
  'The server could not do this just now because the database did not answer in time, and the same thing happened when it tried again a moment later. This message is long on purpose.';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Makes one call fail the way the server does; the state ignores the console message the browser writes for it. */
const failing = (...calls: string[]): Pick<RouteState, 'before' | 'ignore'> => ({
  before: async ({ page }) => {
    for (const call of calls) await page.route(`**/kantahe.v1.${call}`, (r) => json(r, { code: 'internal', message: LONG_ERROR }, 500));
  },
  ignore: [/Failed to load resource/, ...calls.map((c) => new RegExp(c.replace('/', '\\/')))],
});

/**
 * A scratch account's queue and song, the same at the start of every state that uses it: `now` is loaded and paused, the queue is `queue`, and the
 * player role belongs to the account's other device, so the browser's device never starts as the player.
 */
export async function resetScratch(a: Account, now: string, queue: string[] = []): Promise<void> {
  const call = <T>(m: string, body: Record<string, unknown> = {}, token = a.token) => rpc<T>('SessionService', m, body, token);
  const before = await call<{ state?: { queue?: { id: string }[] } }>('GetState');
  for (const item of before.state?.queue ?? []) await call('RemoveFromQueue', { itemId: item.id });
  await call('AddToQueue', { number: now });
  await call('Control', { action: 'CONTROL_ACTION_SKIP' }); // loads that song, whatever was playing or scored before
  await call('Control', { action: 'CONTROL_ACTION_PLAY_HERE' }, a.remoteToken);
  await call('Control', { action: 'CONTROL_ACTION_PAUSE' }, a.remoteToken);
  for (const n of queue) await call('AddToQueue', { number: n });
}

/** The player page has no heading: it is ready when it offers to play. */
const playerReady = ({ page }: Ctx) => expect(page.getByRole('button', { name: 'Play here' })).toBeVisible({ timeout: 15_000 });

/**
 * Presses something the way a person does; when it cannot be pressed (it is beyond the edge of a page that is too wide, say) the press
 * is sent to it anyway, so that the state is still reached and looked at. What was wrong with the layout is the checks' to report.
 */
const tap = async (target: Locator): Promise<void> => {
  try {
    await target.click({ timeout: 3000 });
  } catch {
    await target.dispatchEvent('click');
  }
};

const click = (page: Page, name: string | RegExp, exact = false) => tap(page.getByRole('button', { name, exact }).first());

export function states(selftest = false): RouteState[] {
  const at = (route: string, state: string, role: Role, path: string, extra: Partial<RouteState> = {}): RouteState => ({ route, state, role, path: () => path, ...extra });
  const list: RouteState[] = [
    // signing in and setting up
    at('/setup', 'form', 'anon', '/setup', {
      core: true,
      before: ({ page }) => page.route('**/kantahe.v1.AuthService/GetServerInfo', (r) => json(r, { version: '1.0.0', setupRequired: true, name: 'Kantahe on a machine' })),
    }),
    at('/setup', 'errors', 'anon', '/setup', {
      core: true,
      before: ({ page }) => page.route('**/kantahe.v1.AuthService/GetServerInfo', (r) => json(r, { version: '1.0.0', setupRequired: true, name: 'Kantahe on a machine' })),
      after: ({ page }) => click(page, 'Create account'),
    }),
    at('/login', 'empty', 'anon', '/login', { core: true }),
    at('/login', 'errors', 'anon', '/login', { core: true, after: ({ page }) => click(page, 'Sign in') }),
    at('/login', 'long-text', 'anon', '/login', {
      core: true,
      before: ({ page }) => page.route('**/kantahe.v1.AuthService/Login', (r) => json(r, { code: 'unauthenticated', message: 'The email or the password is not right.' }, 401)),
      ignore: [/Failed to load resource/, /AuthService\/Login/],
      after: async ({ page }) => {
        await page.getByLabel('Email').fill('a-very-long-address-for-testing-the-layout-of-lists@example.com');
        await page.getByLabel('Password', { exact: true }).fill('not-the-password');
        await click(page, 'Sign in');
        await expect(page.getByRole('alert').first()).toBeVisible();
      },
    }),
    at('/code', 'empty', 'scratch', '/code', { core: true }),
    at('/code', 'typed', 'scratch', '/code', { core: true, after: ({ page }) => page.getByLabel('Code').fill('ABC234') }),
    at('/code', 'error', 'scratch', '/code', {
      core: true,
      before: ({ page }) => page.route('**/kantahe.v1.AuthService/ApproveCode', (r) => json(r, { code: 'not_found', message: 'That code does not exist or has expired. Check the code on the TV and try again.' }, 404)),
      ignore: [/Failed to load resource/, /AuthService\/ApproveCode/],
      after: async ({ page }) => {
        await page.getByLabel('Code').fill('ZZZZZZ');
        await click(page, 'Approve');
        await expect(page.getByRole('alert').first()).toBeVisible();
      },
    }),

    // the library
    at('/library', 'many', 'user', '/library', { core: true, after: ({ page }) => expect(page.locator('li.row').first()).toBeVisible() }),
    at('/library', 'empty', 'user', '/library', {
      core: true,
      after: async ({ page }) => {
        await page.getByLabel('Search songs').fill('zzzzqqqq');
        await expect(page.getByText(/no songs/i).first()).toBeVisible();
      },
    }),
    at('/library', 'long-text', 'user', '/library', {
      core: true,
      after: async ({ page, seed }) => {
        await page.getByLabel('Search songs').fill(seed.longQuery);
        await expect(page.locator('li.row').first()).toBeVisible();
      },
    }),
    at('/library', 'error', 'user', '/library', { core: true, ...failing('CatalogService/SearchSongs'), after: ({ page }) => expect(page.getByRole('alert').first()).toBeVisible() }),
    at('/library', 'playlist-picker', 'user', '/library', {
      core: true,
      after: async ({ page }) => {
        await expect(page.locator('li.row').first()).toBeVisible();
        await tap(page.locator('li.row button.menu').first());
        await expect(page.locator('li.row button.menu[aria-expanded=true]')).toBeVisible();
      },
    }),
    at('/library', 'toast', 'scratch', '/library', {
      core: true,
      after: async ({ page }) => {
        await expect(page.locator('li.row').first()).toBeVisible();
        await tap(page.locator('li.row button.main').first());
        await expect(page.getByText(/^Added /).first()).toBeVisible();
      },
    }),
    at('/library', 'number-pad', 'user', '/library', { core: true, after: ({ page }) => tap(page.getByRole('tab', { name: 'Number' })) }),
    at('/library', 'browse', 'user', '/library', { core: true, after: ({ page }) => tap(page.getByRole('tab', { name: 'Browse' })) }),

    // upload: three files whose answers are made up, so that the library stays the same
    at('/upload', 'empty', 'admin', '/upload'),
    at('/upload', 'results', 'admin', '/upload', {
      before: async ({ page }) => {
        let calls = 0;
        await page.route('**/kantahe.v1.UploadService/UploadSong', (r) => {
          const i = calls++ % 3;
          const song = { number: '09001', format: 'FORMAT_MP3', title: 'Title 9001', artist: 'Artist 9001' };
          return json(r, i === 0 ? { status: 'UPLOAD_STATUS_ADDED', song } : i === 1 ? { status: 'UPLOAD_STATUS_DUPLICATE', song } : { status: 'UPLOAD_STATUS_REJECTED', reason: LONG_ERROR });
        });
      },
      after: async ({ page }) => {
        const files = ['9000 - A - Title 9000.karmp3', '9001 - A - Title 9001.kar', '9002 - A - Title 9002.kar'].map((name) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from('x') }));
        await page.locator('#upload-files').setInputFiles(files);
        await expect(page.getByRole('status').filter({ hasText: /of 3/ })).toBeVisible();
      },
    }),

    // the queue
    at('/queue', 'many', 'user', '/queue', { core: true, after: ({ page }) => expect(page.locator('.queue li').first()).toBeVisible() }),
    at('/queue', 'empty', 'admin', '/queue', { core: true, after: ({ page }) => expect(page.getByText(/queue is empty/i)).toBeVisible() }),
    at('/queue', 'one-long', 'scratch', '/queue', {
      core: true,
      before: ({ account, seed }) => resetScratch(account!, seed.numbers.longTitle, [seed.numbers.longBoth]),
      after: ({ page }) => expect(page.locator('.queue li')).toHaveCount(1),
    }),
    at('/queue', 'error', 'user', '/queue', { core: true, ...failing('SessionService/WatchState', 'SessionService/GetState') }),

    // the player
    at('/player', 'idle', 'scratch', '/player', {
      core: true,
      ready: playerReady,
    }),
    at('/player', 'playing', 'scratch', '/player', {
      core: true,
      ready: playerReady,
      after: async ({ page }) => {
        await click(page, 'Play here');
        await expect(page.locator('.stage h1')).toBeVisible();
        await tap(page.locator('.stage').getByRole('button', { name: 'Pause' })); // the song is 3 s long: freeze it
      },
    }),
    at('/player', 'score', 'scratch', '/player', {
      core: true,
      ready: playerReady,
      after: async ({ page }) => {
        await click(page, 'Play here');
        await expect(page.getByRole('dialog', { name: 'Score' })).toBeVisible({ timeout: 20_000 });
      },
    }),
    at('/embed/player', 'empty', 'anon', '/embed/player', { ready: () => Promise.resolve() }),

    // my pages
    at('/me/favourites', 'many', 'user', '/me/favourites', { after: ({ page }) => expect(page.locator('li.row').first()).toBeVisible() }),
    at('/me/favourites', 'empty', 'admin', '/me/favourites'),
    at('/me/history', 'many', 'user', '/me/history', { after: ({ page }) => expect(page.locator('ul.history li').first()).toBeVisible() }),
    at('/me/history', 'empty', 'admin', '/me/history'),
    at('/me/playlists', 'many', 'user', '/me/playlists', { after: ({ page }) => expect(page.locator('li.playlist').first()).toBeVisible() }),
    at('/me/playlists', 'empty', 'admin', '/me/playlists', { after: ({ page }) => expect(page.getByText('No playlists yet.')).toBeVisible() }),
    at('/me/playlists', 'rename', 'user', '/me/playlists', { after: ({ page }) => click(page, 'Rename Party mix') }),
    at('/me/playlists', 'delete-question', 'user', '/me/playlists', { after: ({ page }) => click(page, 'Delete Party mix') }),
    at('/me/playlists', 'error', 'user', '/me/playlists', { ...failing('UserLibraryService/ListPlaylists') }),
    { route: '/me/playlists/:id', state: 'many', role: 'user', path: (s) => `/me/playlists/${s.playlists.many}`, after: ({ page }) => expect(page.locator('li.entry').first()).toBeVisible() },
    { route: '/me/playlists/:id', state: 'long-name', role: 'user', path: (s) => `/me/playlists/${s.playlists.long}`, after: ({ page }) => expect(page.locator('li.entry').first()).toBeVisible() },
    { route: '/me/playlists/:id', state: 'empty', role: 'user', path: (s) => `/me/playlists/${s.playlists.empty}`, after: ({ page }) => expect(page.getByText(/playlist is empty/i)).toBeVisible() },
    {
      route: '/me/playlists/:id',
      state: 'missing',
      role: 'user',
      path: () => '/me/playlists/does-not-exist',
      ignore: [/Failed to load resource/, /UserLibraryService\/GetPlaylist/],
      after: ({ page }) => expect(page.getByText(/no longer exists/i)).toBeVisible(),
    },
    at('/me/devices', 'list', 'user', '/me/devices', { after: ({ page }) => expect(page.locator('li.device').nth(2)).toBeVisible() }),
    at('/me/devices', 'sign-out-question', 'user', '/me/devices', { after: ({ page }) => click(page, 'Sign out Living room TV') }),
    at('/me/devices', 'error', 'user', '/me/devices', { ...failing('AuthService/ListMyDevices') }),
    at('/me/settings', 'form', 'user', '/me/settings'),
    at('/me/password', 'form', 'user', '/me/password'),
    at('/me/password', 'errors', 'user', '/me/password', { after: ({ page }) => click(page, 'Change password') }),

    // the administration
    at('/admin/users', 'many', 'admin', '/admin/users', { after: ({ page }) => expect(page.locator('tbody tr').nth(3)).toBeVisible() }),
    at('/admin/users', 'delete-question', 'admin', '/admin/users', { after: ({ page }) => click(page, /^Delete a-very-long-address/) }),
    at('/admin/users', 'reset-question', 'admin', '/admin/users', { after: ({ page }) => click(page, /^Reset password of a-very-long-address/) }),
    at('/admin/users', 'error', 'admin', '/admin/users', { ...failing('AdminService/ListUsers') }),
    // no video is in the seed (a real MP4 would have to be made): the empty and the failed page; the list with videos is checked in a real browser by hand
    at('/admin/videos', 'empty', 'admin', '/admin/videos', { after: ({ page }) => expect(page.getByText('No background videos yet.')).toBeVisible() }),
    at('/admin/videos', 'error', 'admin', '/admin/videos', { ...failing('AdminService/ListVideos') }),
    at('/admin/songs', 'many', 'admin', '/admin/songs', { after: ({ page }) => expect(page.locator('tbody tr').nth(10)).toBeVisible() }),
    at('/admin/songs', 'empty', 'admin', '/admin/songs', {
      after: async ({ page }) => {
        await page.getByLabel('Search songs').fill('zzzzqqqq');
        await expect(page.getByText('No songs found.')).toBeVisible();
      },
    }),
    at('/admin/songs', 'long-text', 'admin', '/admin/songs', {
      after: async ({ page, seed }) => {
        await page.getByLabel('Search songs').fill(seed.longQuery);
        await expect(page.locator('tbody tr').first()).toBeVisible();
      },
    }),
    at('/admin/songs', 'edit-dialog', 'admin', '/admin/songs', {
      after: async ({ page }) => {
        await expect(page.locator('tbody tr').first()).toBeVisible();
        await tap(page.locator('tbody tr button', { hasText: 'Edit' }).first());
        await expect(page.getByRole('dialog')).toBeVisible();
      },
    }),
    at('/admin/songs', 'delete-question', 'admin', '/admin/songs', {
      after: async ({ page }) => {
        await expect(page.locator('tbody tr').first()).toBeVisible();
        await tap(page.locator('tbody tr button', { hasText: 'Delete' }).first());
      },
    }),
    at('/admin/songs', 'broken-list-question', 'admin', '/admin/songs', {
      after: async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Check the library' })).toBeVisible();
        await click(page, /^Remove all \d+ broken songs from the list$/);
        await expect(page.getByText(/off the list\? The files stay/)).toBeVisible();
      },
    }),
    at('/admin/songs', 'broken-files-question', 'admin', '/admin/songs', {
      after: async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Check the library' })).toBeVisible();
        await click(page, 'Remove them and delete their files');
        await expect(page.getByText(/deleted for good/)).toBeVisible();
      },
    }),
    at('/admin/songs', 'remove-all-question', 'admin', '/admin/songs', { after: ({ page }) => click(page, 'Remove all songs') }),
    at('/admin/songs', 'error', 'admin', '/admin/songs', { ...failing('CatalogService/SearchSongs') }),
    at('/admin/settings', 'form', 'admin', '/admin/settings'),
    at('/admin/settings', 'error', 'admin', '/admin/settings', { ...failing('AdminService/GetServerSettings') }),
  ];
  if (selftest) {
    // a page of the harness with a table 500 px wide, to see that the audit notices and fails
    list.push({
      route: '/selftest',
      state: 'wide-table',
      role: 'anon',
      core: true,
      bare: true,
      path: () => '/__audit/selftest',
      before: ({ page }) =>
        page.route('**/__audit/selftest', (r) =>
          r.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><h1>Self test</h1><table style="width:500px"><tr><td>a table that is 500 px wide</td></tr></table>',
          }),
        ),
    });
  }
  return list;
}
