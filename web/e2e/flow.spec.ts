import { Browser, BrowserContext, expect, Locator, Page, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { karmp3 } from './fixtures/karmp3';

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };
const USER = { email: 'una@example.com', name: 'Una', password: 'una-password-2' };

/** A browser profile of its own that calls itself `name` (the device name in the list of devices). */
async function device(browser: Browser, name: string): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript((brand) => {
    Object.defineProperty(navigator, 'userAgentData', { value: { brands: [{ brand, version: '1' }] }, configurable: true });
  }, name);
  return context;
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

const stage = (page: Page) => page.locator('.stage');

/** The browser writes inset(0 0% 0 0) as inset(0px 0% 0px 0px). */
const FULLY_SUNG = /^inset\(0(px)? 0% 0(px)? 0(px)?\)$/;

async function expectSung(word: Locator): Promise<void> {
  await expect.poll(() => word.locator('.over').evaluate((el) => (el as HTMLElement).style.clipPath), { message: 'the word is sung' }).toMatch(FULLY_SUNG);
}

test('the whole flow: setup, accounts, upload, search, queue, play, score, random fill, takeover, favourites, history, playlist', async ({ browser }) => {
  const admin = await device(browser, 'Admin laptop');
  const a = await admin.newPage();
  let temporaryPassword = '';

  await test.step('the first visit creates the administrator', async () => {
    await a.goto('/');
    await expect(a).toHaveURL(/\/setup$/);
    await a.getByLabel('Email').fill(ADMIN.email);
    await a.getByLabel('Your name').fill(ADMIN.name);
    await a.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await a.getByLabel('Repeat the password').fill(ADMIN.password);
    await a.getByRole('button', { name: 'Create account' }).click();
    await expect(a).toHaveURL(/\/library$/);
    await expect(a.getByRole('heading', { name: 'Library' })).toBeVisible();
    // the songs in the watched folder were found
    await expect(a.locator('li.row').first()).toBeVisible();
  });

  await test.step('the administrator creates a user with a temporary password', async () => {
    await a.getByRole('link', { name: 'Admin' }).click();
    await expect(a).toHaveURL(/\/admin\/users$/);
    await a.getByRole('button', { name: 'New user' }).click();
    await a.locator('#new-email').fill(USER.email);
    await a.locator('#new-name').fill(USER.name);
    await a.getByRole('button', { name: 'Generate' }).click();
    await expect(a.locator('#new-password')).toHaveValue(/^\S{12}$/);
    temporaryPassword = await a.locator('#new-password').inputValue();
    await a.getByRole('button', { name: 'Create user' }).click();
    await expect(a.locator('tbody tr', { hasText: USER.email })).toBeVisible();
    await expect(a.locator('app-temp-password-panel input')).toHaveValue(temporaryPassword);
  });

  await test.step('the tabs of the administration open their pages: Users, Songs, Settings, Users', async () => {
    const tab = (name: string) => a.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name });
    await tab('Songs').click();
    await expect(a).toHaveURL(/\/admin\/songs$/);
    await expect(a.getByRole('heading', { name: 'Songs', level: 2 })).toBeVisible();
    await tab('Settings').click();
    await expect(a).toHaveURL(/\/admin\/settings$/);
    await expect(a.getByRole('heading', { name: 'Server settings' })).toBeVisible();
    await tab('Users').click();
    await expect(a).toHaveURL(/\/admin\/users$/);
    await expect(a.getByRole('heading', { name: 'Users', level: 2 })).toBeVisible();
  });

  await test.step('a page left open across a server update still opens a tab: the file that is gone is fetched again by a reload', async () => {
    const stale = await admin.newPage();
    await stale.goto('/admin/users');
    await expect(stale.getByRole('heading', { name: 'Users', level: 2 })).toBeVisible();
    // the first file asked for from here on is gone (404), as for a page that was loaded before the server was rebuilt
    let gone = false;
    await stale.route(/\.js(\?.*)?$/, (route) => {
      if (gone) return route.continue();
      gone = true;
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    });
    await stale.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: 'Songs' }).click();
    await expect(stale).toHaveURL(/\/admin\/songs$/);
    await expect(stale.getByRole('heading', { name: 'Songs', level: 2 })).toBeVisible();
    expect(gone).toBe(true);
    await stale.close();
  });

  await test.step('the administrator uploads three songs', async () => {
    await a.goto('/upload');
    const dir = process.env['E2E_UPLOAD_DIR'] as string;
    const files = readdirSync(dir).map((f) => join(dir, f));
    expect(files).toHaveLength(3);
    await a.locator('#upload-files').setInputFiles(files);
    await expect(a.getByText('3 added, 0 duplicates, 0 rejected')).toBeVisible();
    await expect(a.locator('tbody tr')).toHaveCount(3);
  });

  // two devices of the user: the first sings, the second takes over
  const one = await device(browser, 'Device 1');
  const b = await one.newPage();

  await test.step('the user signs in with the temporary password and has to change it', async () => {
    await signIn(b, USER.email, temporaryPassword);
    await expect(b).toHaveURL(/\/me\/password$/);
    await b.getByLabel('Current password').fill(temporaryPassword);
    await b.getByLabel('New password', { exact: true }).fill(USER.password);
    await b.getByLabel('Repeat the new password').fill(USER.password);
    await b.getByRole('button', { name: 'Change password' }).click();
    await expect(b.getByText('Password changed. Other devices were signed out.')).toBeVisible();
    await b.getByRole('link', { name: 'Continue' }).click();
    await expect(b).toHaveURL(/\/library$/);
  });

  await test.step('searching for Title 1 finds the MP3 and the MIDI entry, each with its badge', async () => {
    await b.getByLabel('Search songs').fill('Title 1');
    const rows = b.locator('li.row');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'MP3' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'MIDI' })).toHaveCount(1);
  });

  await test.step('the songs the administrator uploaded are found by the user too', async () => {
    await b.getByLabel('Search songs').fill('Title 20');
    const rows = b.locator('li.row');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'MP3' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'MIDI' })).toHaveCount(1);
    await b.getByLabel('Search songs').fill('Title 21');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('MIDI');
    await b.getByLabel('Search songs').fill('Title 1');
    await expect(rows).toHaveCount(2);
  });

  await test.step('both are queued', async () => {
    const rows = b.locator('li.row');
    await rows.filter({ hasText: 'MP3' }).locator('button.main').click();
    await expect(b.getByText('Added Title 1').first()).toBeVisible();
    await rows.filter({ hasText: 'MIDI' }).locator('button.main').click();
    await b.goto('/queue');
    await expect(b.locator('.queue li')).toHaveCount(2);
  });

  await test.step('Play here on the player page starts the MP3 and its lyrics are sung', async () => {
    await b.goto('/player');
    await b.getByRole('button', { name: 'Play here' }).click();
    await expect(stage(b).locator('header.song h1')).toHaveText('Title 1');
    await expect(stage(b).locator('app-format-badge .badge').first()).toHaveText('MP3');
    const firstWord = stage(b).locator('app-lyrics-view .row').first().locator('.word').first();
    await expect(firstWord.locator('.base')).toHaveText('Sing ');
    await expectSung(firstWord);
  });

  // the second device of the user
  const two = await device(browser, 'Device 2');
  const c = await two.newPage();

  await test.step('a second device takes over in the middle of the song: Playing on swaps, and the song goes on from where it was', async () => {
    await expect(stage(b).locator('.time')).toContainText('0:01');
    await stage(b).getByRole('button', { name: 'Pause' }).click();
    await signIn(c, USER.email, USER.password);
    await expect(c).toHaveURL(/\/library$/);
    await c.goto('/player');
    await expect(c.getByText('Playing on Device 1')).toBeVisible();
    await c.getByRole('button', { name: 'Play here' }).click();
    await expect(stage(c).locator('header.song h1')).toHaveText('Title 1');
    // pause at once: the song was loaded and set to where the first device left it (past 0:01), not to the start
    await stage(c).getByRole('button', { name: 'Pause' }).click();
    await expect(stage(c).locator('.time')).toHaveText(/^\s*0:0[1-9]\s+\//);
    await expect(b.getByText('Playing on Device 2')).toBeVisible();
    await stage(c).getByRole('button', { name: 'Play', exact: true }).click();
  });

  await test.step('when the MP3 ends the score rolls and lands', async () => {
    const overlay = c.getByRole('dialog', { name: 'Score' });
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('.number')).toHaveText(/^(5\d|[6-9]\d|100)$/, { timeout: 15_000 });
  });

  await test.step('the MIDI entry plays next, through the synthesizer, with its lyrics', async () => {
    await expect(stage(c).locator('app-format-badge .badge').first()).toHaveText('MIDI', { timeout: 20_000 });
    const firstWord = stage(c).locator('app-lyrics-view .row').first().locator('.word').first();
    await expectSung(firstWord);
  });

  await test.step('after the queue is empty a random song plays', async () => {
    await expect(c.getByRole('dialog', { name: 'Score' })).toBeVisible({ timeout: 20_000 });
    await expect(c.getByRole('dialog', { name: 'Score' })).toBeHidden({ timeout: 15_000 });
    await expect(stage(c).locator('header.song h1')).toHaveText(/^Title \d+$/, { timeout: 15_000 });
    const queue = await one.newPage();
    await queue.goto('/queue');
    await expect(queue.getByText('The queue is empty')).toBeVisible();
    await expect(queue.getByText('Picked at random', { exact: true })).toBeVisible();
  });

  await test.step('a favourite shows in the favourites', async () => {
    await b.goto('/library');
    await b.getByLabel('Search songs').fill('Title 5');
    const row = b.locator('li.row', { hasText: 'Title 5' });
    await row.locator('button.star').click();
    await expect(row.locator('button.star')).toHaveAttribute('aria-pressed', 'true');
    await b.goto('/me/favourites');
    await expect(b.locator('li.row', { hasText: 'Title 5' })).toBeVisible();
  });

  await test.step('the history lists the songs that were sung, with their score', async () => {
    await b.goto('/me/history');
    // the MP3 entry and the MIDI entry of Title 1 were both sung to the end, each with its score
    const sung = b.locator('ul.history li', { hasText: 'Title 1' });
    await expect(sung.filter({ hasText: 'MP3' }).filter({ hasText: /Score \d+/ })).toHaveCount(1);
    await expect(sung.filter({ hasText: 'MIDI' }).filter({ hasText: /Score \d+/ })).toHaveCount(1);
  });

  await test.step('a playlist: create, add a song, add it all to the queue', async () => {
    await b.goto('/me/playlists');
    await b.locator('#new-playlist').fill('Party');
    await b.getByRole('button', { name: 'Create' }).click();
    await expect(b.getByRole('link', { name: 'Party' })).toBeVisible();
    await b.goto('/library');
    await b.getByLabel('Search songs').fill('Title 6');
    await b.locator('li.row', { hasText: 'Title 6' }).getByRole('button', { name: 'More actions for Title 6' }).click();
    await b.getByRole('menuitem', { name: 'Add to a playlist' }).click();
    await b.getByRole('button', { name: 'Party' }).click();
    await expect(b.getByText('Added Title 6 to Party')).toBeVisible();
    await b.goto('/me/playlists');
    await b.getByRole('link', { name: 'Party' }).click();
    await expect(b.locator('li.entry', { hasText: 'Title 6' })).toBeVisible();
    await b.getByRole('button', { name: 'Add all to queue' }).click();
    await expect(b.getByText('Added 1 song to the queue')).toBeVisible();
  });

  await test.step('an ordinary user has no Upload and cannot open it', async () => {
    await b.goto('/library');
    await expect(b.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Library' })).toBeVisible();
    await expect(b.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Upload' })).toHaveCount(0);
    await b.goto('/upload');
    await expect(b).toHaveURL(/\/library$/);
  });

  await test.step('the administrator downloads a song file exactly as uploaded, replaces it, and the number stays', async () => {
    await a.goto('/admin/songs');
    // the list is searched a moment after typing: wait for that answer, so that the list does not change under the buttons
    const searched = a.waitForResponse((r) => r.url().includes('CatalogService/SearchSongs') && (r.request().postData() ?? '').includes('Title 20'));
    await a.getByLabel('Search songs').fill('Title 20');
    await searched;
    const row = a.locator('tbody tr', { hasText: 'MP3' }).filter({ hasText: 'Title 20' });
    await expect(row).toHaveCount(1);
    const [download] = await Promise.all([a.waitForEvent('download'), row.getByRole('button', { name: 'Download Title 20' }).click()]);
    const number = (await row.locator('td.number').innerText()).trim();
    expect(download.suggestedFilename()).toBe(`${number} - Artist 20 - Title 20.karmp3`);
    const dir = process.env['E2E_UPLOAD_DIR'] as string;
    const original = readFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith('Title 20.karmp3'))!));
    const got = readFileSync((await download.path())!);
    expect(got.equals(original), 'the download is the uploaded file, byte for byte').toBe(true);

    // the button opens the browser's file chooser; the file is given to it
    const [chooser] = await Promise.all([a.waitForEvent('filechooser'), row.getByRole('button', { name: 'Replace file: Title 20' }).click()]);
    await chooser.setFiles({ name: 'whatever.karmp3', mimeType: 'application/octet-stream', buffer: karmp3('Replaced title') });
    const same = a.locator('tbody tr').filter({ has: a.locator('td.number', { hasText: number }) });
    await expect(same.getByText(`Replaced ${number}.`)).toBeVisible();
    await expect(same).toContainText('Replaced title');
    // the song, as the user sees it, has the new title under the same number
    await b.goto('/library');
    await b.getByLabel('Search songs').fill('Replaced title');
    await expect(b.locator('li.row', { hasText: number })).toContainText('Replaced title');
  });
});
