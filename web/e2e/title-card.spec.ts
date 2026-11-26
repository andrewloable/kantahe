import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { karmp3 } from './fixtures/karmp3';
import { SERVER_URL } from './ports';

// The title card (kantahe-2d3): before a new song starts, the player shows its title with a countdown for the admin's "title card seconds",
// and the other devices say "Starting in N"; then the song starts. The whole product in a real browser.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };
const FIRST = 'Cardone';
const SECOND = 'Cardtwo';

async function device(browser: Browser, name: string): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript((brand) => {
    Object.defineProperty(navigator, 'userAgentData', { value: { brands: [{ brand, version: '1' }] }, configurable: true });
  }, name);
  return context;
}

async function signInAdmin(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForURL(/\/(setup|login)(\?.*)?$/);
  if (new URL(page.url()).pathname === '/setup') {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Your name').fill(ADMIN.name);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await page.getByLabel('Repeat the password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Create account' }).click();
  } else {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page).toHaveURL(/\/library$/);
}

const stage = (page: Page) => page.locator('.stage');

test('title card: the next song shows its title and a countdown, other devices say Starting in, then it starts', async ({ browser, request }) => {
  const laptop = await device(browser, 'Laptop');
  const a = await laptop.newPage();
  await signInAdmin(a);
  const token = await a.evaluate(() => localStorage.getItem('kantahe.token'));
  const call = async <T>(service: string, method: string, data: object): Promise<T> => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.${service}/${method}`, { data, headers: { authorization: `Bearer ${token}` } });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  type Snapshot = { queue?: { id: string; song: { title: string } }[]; now?: { song: { title: string } } };
  const snapshot = async () => (await call<{ state: Snapshot }>('SessionService', 'GetState', {})).state;
  try {
    await a.goto('/upload');
    await a.locator('#upload-files').setInputFiles([
      { name: `${FIRST}.karmp3`, mimeType: 'application/octet-stream', buffer: karmp3(FIRST, 230) }, // about 6 s
      { name: `${SECOND}.karmp3`, mimeType: 'application/octet-stream', buffer: karmp3(SECOND, 2400) },
    ]);
    await expect(a.getByText('2 added, 0 duplicates, 0 rejected')).toBeVisible();
    await call('AdminService', 'UpdateServerSettings', { introSeconds: 2 });

    // the account is shared with the other specs: an empty queue, the two songs, the first one current
    await call('SessionService', 'Control', { action: 'CONTROL_ACTION_PAUSE' });
    for (const q of (await snapshot()).queue ?? []) await call('SessionService', 'RemoveFromQueue', { itemId: q.id });
    const tv = await device(browser, 'Tv');
    await tv.addInitScript(() => localStorage.setItem('kantahe.songcache.enabled', 'false'));
    const p = await tv.newPage();
    await signInAdmin(p);
    for (const title of [FIRST, SECOND]) {
      await p.goto('/library');
      await p.getByLabel('Search songs').fill(title);
      await p.locator('li.row', { hasText: title }).first().locator('button.main').click();
      await expect(p.getByText(`Added ${title}`).first()).toBeVisible();
    }
    if ((await snapshot()).now?.song.title !== FIRST) await call('SessionService', 'Control', { action: 'CONTROL_ACTION_SKIP' });
    expect((await snapshot()).now?.song.title).toBe(FIRST);

    await p.goto('/player');
    await p.getByRole('button', { name: 'Play here' }).click();
    await call('SessionService', 'Control', { action: 'CONTROL_ACTION_PLAY' });
    await expect(stage(p).locator('header.song h1')).toHaveText(FIRST);
    await a.goto('/queue');

    await test.step('when the first song ends (after its score), the second shows its title card with a countdown', async () => {
      const card = stage(p).locator('.title-card');
      await expect(card.locator('.card-title')).toHaveText(SECOND, { timeout: 30_000 });
      const shownAt = Date.now();
      await expect(card.locator('.count')).toHaveText(/^[12]$/);
      await expect(card).toContainText('Get ready');
      // the laptop's Queue page says when it starts instead of showing the clock
      await expect(a.locator('app-now-playing .time')).toHaveText(/Starting in [12]/);
      await expect(card).toHaveCount(0, { timeout: 5_000 });
      const shownFor = Date.now() - shownAt;
      expect(shownFor, 'the card stays about the 2 seconds set').toBeGreaterThan(1000);
      expect(shownFor).toBeLessThan(3500);
    });

    await test.step('then the second song plays', async () => {
      await expect(stage(p).locator('.time')).toContainText('0:01', { timeout: 5_000 });
      await expect(a.locator('app-now-playing .time')).not.toContainText('Starting');
    });
  } finally {
    // leave the shared server as the other specs expect: the default 3 s, nothing playing, an empty queue (best effort)
    const tidy = (service: string, method: string, data: object) =>
      request.post(`${SERVER_URL}/kantahe.v1.${service}/${method}`, { data, headers: { authorization: `Bearer ${token}` } });
    await tidy('AdminService', 'UpdateServerSettings', { introSeconds: 3 });
    await tidy('SessionService', 'Control', { action: 'CONTROL_ACTION_PAUSE' });
    for (const q of (await snapshot()).queue ?? []) await tidy('SessionService', 'RemoveFromQueue', { itemId: q.id });
  }
});
