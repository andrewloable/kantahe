import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { karmp3 } from './fixtures/karmp3';

// The song cache (docs/PLAN.md section 4.3): a song that was played is kept on the device, so that the next play does not download it again;
// a replaced file is never played from the old copy; and the switch in Me > Devices turns the keeping off. The whole product in a real browser.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };
const TITLE = 'Cachesong';

/** A browser profile of its own that calls itself `name` (the device name in the list of devices). */
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

/** The files the song cache keeps, from Cache Storage itself (not from the page's own bookkeeping). */
const keptFiles = (page: Page) =>
  page.evaluate(async () => (await (await caches.open('kantahe-songs-v1')).keys()).map((r) => new URL(r.url).pathname).sort());

/** The index row the cache holds for the audio file of a song (undefined when none): its version and when it was last played. */
const keptRow = (page: Page, number: string) =>
  page.evaluate((n) => {
    const rows: { kind: string; number: string; version: string; lastUsed: number }[] = JSON.parse(localStorage.getItem('kantahe.songcache.index') ?? '[]');
    return rows.find((r) => r.kind === 'audio' && r.number === n);
  }, number);
const keptVersion = async (page: Page, number: string) => (await keptRow(page, number))?.version ?? '';

/**
 * Reloads the player and waits until the song has been played from the device: the cache records the use of the file (its last-use time
 * moves). Only then does "no request to /media/song" prove something; the clock on the screen starts from the server's position at once.
 */
async function reloadAndPlayFromDevice(page: Page, number: string): Promise<void> {
  const before = (await keptRow(page, number))?.lastUsed ?? 0;
  await page.reload();
  await expect(stage(page).locator('header.song h1')).toHaveText(TITLE);
  await expect.poll(async () => (await keptRow(page, number))?.lastUsed ?? 0, { message: 'the song was played from the device', timeout: 20_000 }).toBeGreaterThan(before);
  await expectPlaying(page);
}

/** Whether the cache keeps the audio file of the song (it may keep others: the song that is up next is kept ahead of time). */
const keeps = async (page: Page, number: string) => (await keptFiles(page)).includes(`/kantahe-song-cache/audio/${number}`);

/** The song plays: the clock of the player moves, for three seconds (by then the file has loaded, from the server or from the device). */
async function expectPlaying(page: Page): Promise<void> {
  const seconds = async () => {
    const text = (await stage(page).locator('.time').innerText()).match(/(\d+):(\d\d)/);
    return text ? Number(text[1]) * 60 + Number(text[2]) : -1;
  };
  await expect.poll(seconds, { timeout: 20_000 }).toBeGreaterThanOrEqual(0);
  const first = await seconds();
  await expect.poll(seconds, { message: 'the clock of the song moves', timeout: 20_000 }).toBeGreaterThanOrEqual(first + 3);
}

test('song cache: the second play is not downloaded, a replaced file is, and the switch turns it off', async ({ browser }) => {
  const admin = await device(browser, 'Admin laptop');
  const a = await admin.newPage();
  await signInAdmin(a);
  await a.goto('/upload');
  await a.locator('#upload-files').setInputFiles([{ name: `${TITLE}.karmp3`, mimeType: 'application/octet-stream', buffer: karmp3(TITLE, 2000) }]);
  await expect(a.getByText('1 added, 0 duplicates, 0 rejected')).toBeVisible();

  const dev = await device(browser, 'Cache player');
  const p = await dev.newPage();
  // the browser's own HTTP cache is off for this page: a request to /media/song is then always a real download, never an answer from that cache
  await (await dev.newCDPSession(p)).send('Network.setCacheDisabled', { cacheDisabled: true });
  const songRequests: string[] = [];
  const pageErrors: string[] = [];
  p.on('request', (r) => {
    if (r.url().includes('/media/song/')) songRequests.push(new URL(r.url()).pathname);
  });
  p.on('pageerror', (e) => pageErrors.push(e.message));
  await signInAdmin(p);

  let number = '';
  await test.step('the first play downloads the song and the device keeps it', async () => {
    await p.goto('/library');
    await p.getByLabel('Search songs').fill(TITLE);
    const row = p.locator('li.row', { hasText: TITLE }).first();
    number = (await row.locator('.num').innerText()).trim();
    await row.locator('button.main').click();
    await expect(p.getByText(`Added ${TITLE}`).first()).toBeVisible();
    await p.goto('/player');
    await p.getByRole('button', { name: 'Play here' }).click();
    // an earlier test may have left songs in the queue: skip to ours
    for (let i = 0; i < 6 && (await stage(p).locator('header.song h1').innerText().catch(() => '')) !== TITLE; i++) {
      await expect(stage(p).locator('header.song h1')).toHaveText(/\S/);
      if ((await stage(p).locator('header.song h1').innerText()) === TITLE) break;
      await p.mouse.move(100 + i, 100);
      await stage(p).getByRole('button', { name: 'Skip' }).click();
      await p.waitForTimeout(500);
    }
    await expect(stage(p).locator('header.song h1')).toHaveText(TITLE);
    await expectPlaying(p);
    await expect.poll(() => songRequests.length, { message: 'the song came from the server' }).toBeGreaterThan(0);
    await expect.poll(() => keeps(p, number), { message: 'the song was kept', timeout: 20_000 }).toBe(true);
    expect(await keptVersion(p, number)).not.toBe('');
  });

  await test.step('the next play is from the device: no request to /media/song at all', async () => {
    songRequests.length = 0;
    await reloadAndPlayFromDevice(p, number);
    expect(songRequests, 'nothing was downloaded: the song played from the device').toEqual([]);
  });

  let firstVersion = '';
  await test.step('an administrator replaces the file: the old copy is not played, the new file is downloaded and kept', async () => {
    firstVersion = await keptVersion(p, number);
    await a.goto('/admin/songs');
    const searched = a.waitForResponse((r) => r.url().includes('CatalogService/SearchSongs') && (r.request().postData() ?? '').includes(TITLE));
    await a.getByLabel('Search songs').fill(TITLE);
    await searched;
    const row = a.locator('tbody tr').filter({ has: a.locator('td.number', { hasText: number }) });
    await expect(row).toHaveCount(1);
    const [chooser] = await Promise.all([a.waitForEvent('filechooser'), row.getByRole('button', { name: `Replace file: ${TITLE}` }).click()]);
    await chooser.setFiles({ name: 'whatever.karmp3', mimeType: 'application/octet-stream', buffer: karmp3(TITLE, 2400) });
    await expect(row.getByText(`Replaced ${number}.`)).toBeVisible();

    songRequests.length = 0;
    await p.reload();
    await expect(stage(p).locator('header.song h1')).toHaveText(TITLE);
    await expectPlaying(p);
    await expect.poll(() => songRequests.length, { message: 'the replaced file came from the server' }).toBeGreaterThan(0);
    await expect.poll(() => keptVersion(p, number), { message: 'the new file was kept', timeout: 20_000 }).not.toBe(firstVersion);
    expect(await keeps(p, number)).toBe(true);

    songRequests.length = 0;
    await reloadAndPlayFromDevice(p, number);
    expect(songRequests, 'and the new file plays from the device').toEqual([]);
  });

  await test.step('Me > Devices shows what is kept; with the switch off every play comes from the server', async () => {
    await p.goto('/me/devices');
    const mine = p.locator('li.device', { hasText: '(this device)' });
    await expect(mine).toContainText('Keep played songs on this device');
    await expect(mine).toContainText(/\d+ songs?, [\d.]+ [KM]B of up to 2 GB/);
    await mine.getByLabel('Keep played songs on this device').uncheck();
    songRequests.length = 0;
    await p.goto('/player');
    await expect(stage(p).locator('header.song h1')).toHaveText(TITLE);
    await expectPlaying(p);
    await expect.poll(() => songRequests.length, { message: 'with the switch off the song comes from the server' }).toBeGreaterThan(0);
    await p.goto('/me/devices');
    await mine.getByLabel('Keep played songs on this device').check();
  });

  await test.step('Clear song cache asks first and then empties it', async () => {
    const mine = p.locator('li.device', { hasText: '(this device)' });
    await mine.getByRole('button', { name: 'Clear song cache' }).click();
    await expect(mine).toContainText(/Delete the (kept song|\d+ kept songs) from this device\?/);
    expect(await keeps(p, number)).toBe(true); // asking does not clear
    await mine.getByRole('button', { name: 'Yes, clear' }).click();
    await expect(mine).toContainText('Nothing is kept yet');
    expect(await keptFiles(p)).toEqual([]);
    expect(await keptVersion(p, number)).toBe('');
  });

  expect(pageErrors).toEqual([]);
});
