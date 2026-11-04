import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { APIRequestContext, Browser, expect, test } from '@playwright/test';
import { SERVER_URL } from './ports';

// Every page of the app through axe-core (WCAG 2.2 A and AA, best practice, and label in name), on a desktop and a phone, light and dark.
// The name starts with zz so that it runs after flow.spec.ts, which needs a fresh server.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };
const AXE = readFileSync(createRequire(__filename).resolve('axe-core/axe.min.js'), 'utf8');

// Rules that a task of the accessibility epic still has to fix; the task deletes its entry. Every other rule fails at once.
const KNOWN: Record<string, string> = {};

// Each page with the title of its route: the tab says "<title> · Kantahe" once the page has loaded, so axe never looks at a half-drawn one.
// The embedded player (the page inside the phone and TV apps) has no title; it gets its token through the bridge.
const ROUTES: [string, string][] = [
  ['/login', 'Sign in'],
  ['/me/approve-tv', 'Approve a TV'],
  ['/library', 'Library'],
  ['/admin/upload', 'Upload songs'],
  ['/queue', 'Queue'],
  ['/player', 'Player'],
  ['/embed/player', ''],
  ['/me/favourites', 'Favourites'],
  ['/me/history', 'History'],
  ['/me/playlists', 'Playlists'],
  ['/me/playlists/:id', 'Playlist'],
  ['/me/devices', 'Devices'],
  ['/me/settings', 'Score'],
  ['/me/appearance', 'Appearance and account'],
  ['/me/help', 'Help'],
  ['/me/password', 'Password'],
  ['/admin/users', 'Users'],
  ['/admin/songs', 'Songs'],
  ['/admin/videos', 'Videos'],
  ['/admin/settings', 'Settings'],
  ['/admin/transfer', 'Transfer'],
];
/** The player pages are dark in either theme. */
const ALWAYS_DARK = ['/player', '/embed/player'];
const VIEWS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  {
    name: 'phone',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
];
const THEMES = ['light', 'dark'] as const;

interface Session {
  token: string;
  deviceId: string;
}
interface Finding {
  where: string;
  rule: string;
  targets: string[];
}

async function rpc<T>(
  request: APIRequestContext,
  method: string,
  data: object,
  token?: string,
): Promise<T> {
  const res = await request.post(`${SERVER_URL}/kantahe.v1.${method}`, {
    data,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok()) throw new Error(`${method}: ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Signs the admin in through the API (creating the account when the server is new) and gives the pages something to show. */
async function seed(request: APIRequestContext): Promise<{ session: Session; playlistId: string }> {
  const device = { deviceName: 'Accessibility check', deviceType: 'DEVICE_TYPE_WEB' };
  const info = await rpc<{ setupRequired?: boolean }>(request, 'AuthService/GetServerInfo', {});
  const { auth } = info.setupRequired
    ? await rpc<{ auth: Session }>(request, 'AuthService/Setup', {
        email: ADMIN.email,
        password: ADMIN.password,
        displayName: ADMIN.name,
        ...device,
      })
    : await rpc<{ auth: Session }>(request, 'AuthService/Login', {
        email: ADMIN.email,
        password: ADMIN.password,
        ...device,
      });
  const { songs } = await rpc<{ songs: { number: string }[] }>(
    request,
    'CatalogService/SearchSongs',
    { pageSize: 10 },
    auth.token,
  );
  for (const s of songs.slice(0, 2))
    await rpc(
      request,
      'UserLibraryService/SetFavourite',
      { number: s.number, favourite: true },
      auth.token,
    );
  for (const s of songs.slice(2, 4))
    await rpc(request, 'SessionService/AddToQueue', { number: s.number }, auth.token);
  const { playlist } = await rpc<{ playlist: { id: string } }>(
    request,
    'UserLibraryService/CreatePlaylist',
    { name: 'Accessibility', numbers: songs.slice(0, 3).map((s) => s.number) },
    auth.token,
  );
  return { session: auth, playlistId: playlist.id };
}

/** One page at one size and theme, in a browser profile of its own: the axe findings. */
async function audit(
  browser: Browser,
  route: string,
  title: string,
  view: (typeof VIEWS)[number],
  theme: (typeof THEMES)[number],
  session: Session,
): Promise<Finding[]> {
  const { name, ...options } = view;
  const context = await browser.newContext({ ...options, colorScheme: theme });
  try {
    const embedded = route === '/embed/player';
    if (route !== '/login' && !embedded)
      await context.addInitScript((s) => {
        localStorage.setItem('kantahe.token', s.token);
        localStorage.setItem('kantahe.deviceId', s.deviceId);
      }, session);
    const page = await context.newPage();
    await page.goto(route);
    if (embedded) {
      type Bridge = { kantahe?: { setToken?(t: string, d: string): void } };
      await page.waitForFunction(
        () => typeof (window as unknown as Bridge).kantahe?.setToken === 'function',
      );
      await page.evaluate(
        (s) => (window as unknown as Bridge).kantahe!.setToken!(s.token, s.deviceId),
        session,
      );
      await page.locator('main.stage').waitFor();
    } else {
      await expect(page, `${route} loaded`).toHaveTitle(`${title} · Kantahe`);
    }
    // not networkidle: the app keeps a streaming request open; the data of the page arrives within this
    await page.waitForTimeout(1200);
    const where = `${route} ${name} ${theme}`;
    // the theme really applied: the page background is dark in the dark theme and light in the light one (the player's stage is always dark)
    const surface = ALWAYS_DARK.includes(route) ? 'main.stage' : 'body';
    const luminance = await page.evaluate((selector) => {
      const [r, g, b] = getComputedStyle(document.querySelector(selector)!)
        .backgroundColor.match(/[\d.]+/g)!
        .slice(0, 3)
        .map((c) => Number(c) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }, surface);
    const dark = theme === 'dark' || ALWAYS_DARK.includes(route);
    if (dark ? luminance >= 0.2 : luminance <= 0.5)
      throw new Error(
        `${where}: the page is not drawn in the ${dark ? 'dark' : 'light'} theme (background luminance ${luminance.toFixed(3)})`,
      );
    await page.addScriptTag({ content: AXE });
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: {
            run: (
              c: Document,
              o: object,
            ) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }>;
          };
        }
      ).axe;
      const res = await axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
        },
        rules: { 'label-content-name-mismatch': { enabled: true } }, // WCAG 2.5.3, an experimental rule that no tag turns on
        resultTypes: ['violations'],
      });
      return res.violations.map((v) => ({
        rule: v.id,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      }));
    });
    return violations.map((v) => ({ where, ...v }));
  } finally {
    await context.close();
  }
}

test('accessibility: no axe findings on any page, desktop and phone, light and dark', async ({
  browser,
  request,
}) => {
  test.setTimeout(360_000);
  const { session, playlistId } = await seed(request);
  const failing: Finding[] = [];
  const known: Finding[] = [];
  for (const view of VIEWS)
    for (const theme of THEMES)
      for (const [route, title] of ROUTES)
        for (const f of await audit(
          browser,
          route.replace(':id', playlistId),
          title,
          view,
          theme,
          session,
        ))
          (KNOWN[f.rule] ? known : failing).push(f);
  const tally = new Map<string, number>();
  for (const f of known) tally.set(f.rule, (tally.get(f.rule) ?? 0) + 1);
  const counts = [...tally].map(([rule, n]) => `${rule}: ${n} page views [${KNOWN[rule]}]`);
  if (counts.length)
    console.log(`known findings, each with the task that fixes it:\n${counts.join('\n')}`);
  expect(failing.map((f) => `${f.where}: ${f.rule} at ${f.targets.join(' | ')}`)).toEqual([]);
});
