import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Moving a whole server (docs/PLAN.md section 6): the administrator exports the running server into a folder on its disk, changes the
// server, and imports the folder. The server restarts by itself and is found as it was exported. The spec leaves the server as it found
// it, so the specs after it start from the same data.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };
const TRANSIENT = 'transient@example.com';

/** A browser profile of its own that calls itself `name` (the device name in the list of devices). */
async function device(browser: Browser, name: string): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript((brand) => {
    Object.defineProperty(navigator, 'userAgentData', { value: { brands: [{ brand, version: '1' }] }, configurable: true });
  }, name);
  return context;
}

/** Signs in as the administrator; on a server without users (this file alone) it makes the account first. */
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

test('transfer: export the server, change it, import the export; the server restarts by itself and is as it was exported', async ({ browser }) => {
  const dataDir = process.env['E2E_DATA_DIR'];
  expect(dataDir, 'the global setup says where the server keeps its data').toBeTruthy();
  const folder = mkdtempSync(join(tmpdir(), 'kantahe-transfer-'));
  const exportTo = join(folder, 'export');
  try {
    const admin = await device(browser, 'Admin laptop');
    const a = await admin.newPage();
    const failed: string[] = [];
    const pageErrors: string[] = [];
    let restarting = false; // while the server restarts, requests to it fail
    a.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname} ${restarting ? 'during the restart' : ''}`.trim());
    });
    a.on('requestfailed', (r) => {
      // leaving a page cancels what it still has open (the state stream): that is not a failure
      if (r.failure()?.errorText !== 'net::ERR_ABORTED') failed.push(`failed ${new URL(r.url()).pathname} ${restarting ? 'during the restart' : ''}`.trim());
    });
    a.on('pageerror', (e) => pageErrors.push(e.message));
    await signInAdmin(a);

    let songsInExport = 0;
    await test.step('the administrator exports the server into a folder on its disk', async () => {
      await a.getByRole('link', { name: 'Admin' }).click();
      await a.getByRole('link', { name: 'Transfer' }).click();
      await expect(a).toHaveURL(/\/admin\/transfer$/);
      await a.locator('#export-folder').fill(exportTo);
      await a.getByRole('button', { name: 'Export' }).click();
      await expect(a.getByText(`Exported to ${exportTo}.`)).toBeVisible({ timeout: 60_000 });
      expect(existsSync(join(exportTo, 'kantahe-export.json')), 'the manifest is there').toBe(true);
      expect(existsSync(join(exportTo, 'kantahe.db')), 'the database is there').toBe(true);
      expect(readdirSync(join(exportTo, 'songs')).length, 'the songs are there').toBeGreaterThan(0);
    });

    await test.step('the server changes after the export: a new user', async () => {
      await a.goto('/admin/users');
      await a.getByRole('button', { name: 'New user' }).click();
      await a.locator('#new-email').fill(TRANSIENT);
      await a.locator('#new-name').fill('Transient');
      await a.getByRole('button', { name: 'Generate' }).click();
      await a.getByRole('button', { name: 'Create user' }).click();
      await expect(a.getByText(TRANSIENT).first()).toBeVisible();
    });

    await test.step('Check shows what the export holds, then the import replaces everything', async () => {
      await a.goto('/admin/transfer');
      await a.locator('#import-folder').fill(exportTo);
      await a.getByRole('button', { name: 'Check' }).click();
      const summary = a.locator('.summary');
      await expect(summary).toContainText('Importing replaces everything on this server');
      const text = (await summary.innerText()).replace(/\s+/g, ' ');
      const counts = /(\d+) songs, (\d+) users, (\d+) videos/.exec(text);
      expect(counts, `the summary says how many songs it holds: ${text}`).not.toBeNull();
      songsInExport = Number(counts![1]);
      expect(songsInExport).toBeGreaterThan(0);
      const replace = a.getByRole('button', { name: 'Replace everything on this server' });
      await expect(replace).toBeDisabled();
      await a.getByLabel('I understand that this replaces everything').check();
      restarting = true;
      await replace.click();
      await expect(a.getByText('The server is back.')).toBeVisible({ timeout: 90_000 });
      restarting = false;
    });

    await test.step('the administrator of the export signs in again; the user made after the export is gone', async () => {
      await a.goto('/login');
      await a.getByLabel('Email').fill(ADMIN.email);
      await a.getByLabel('Password', { exact: true }).fill(ADMIN.password);
      await a.getByRole('button', { name: 'Sign in' }).click();
      await expect(a).toHaveURL(/\/library$/);
      await a.goto('/admin/users');
      await expect(a.getByText(ADMIN.email).first()).toBeVisible();
      await expect(a.getByText(TRANSIENT)).toHaveCount(0);
    });

    await test.step('the songs are still there and an MP3 is served with the signed address of the restarted server', async () => {
      await a.goto('/library');
      await expect(a.locator('li.row').first()).toBeVisible();
      // asked as the page asks (Connect over JSON, the token of the signed-in device); nothing is queued, so the account stays as it was
      const served = await a.evaluate(async () => {
        const call = async (method: string, body: object) => {
          const res = await fetch(`/kantahe.v1.${method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${localStorage.getItem('kantahe.token')}` },
            body: JSON.stringify(body),
          });
          return { status: res.status, json: await res.json() };
        };
        const found = await call('CatalogService/SearchSongs', { query: '' });
        const mp3 = (found.json.songs ?? []).find((s: { format: string }) => s.format === 'FORMAT_MP3');
        if (!mp3) return { songs: (found.json.songs ?? []).length, status: 0, type: '' };
        const playback = await call('CatalogService/GetPlayback', { number: mp3.number });
        const audio = await fetch(playback.json.playback.audioUrl, { headers: { range: 'bytes=0-99' } });
        return { songs: (found.json.songs ?? []).length, status: audio.status, type: audio.headers.get('content-type') ?? '' };
      });
      expect(served.songs, 'the library lists songs').toBeGreaterThan(0);
      expect(served.status, 'the MP3 comes back as a range').toBe(206);
      expect(served.type).toContain('audio/mpeg');
    });

    await test.step('the old database is kept in the data folder', async () => {
      const backups = readdirSync(join(dataDir!, 'backups')).filter((n) => n.startsWith('before-import-'));
      expect(backups.length, 'one backup of the database that was replaced').toBe(1);
      expect(existsSync(join(dataDir!, 'backups', backups[0], 'kantahe.db'))).toBe(true);
      expect(existsSync(join(dataDir!, 'import-pending')), 'the staging folder is gone').toBe(false);
    });

    // the server only takes reports for the song that is current, so a position report of a song that was just skipped is answered 400;
    // while the server restarts its requests fail (and the page that was signed in before asks again); nothing else may fail
    const unexpected = failed.filter((f) => !/^400 \/kantahe\.v1\.SessionService\/(ReportPosition|Ready|Ended)$/.test(f) && !f.endsWith('during the restart'));
    expect(unexpected, 'no failed request except a stale report and what the restart breaks').toEqual([]);
    expect(pageErrors, 'no error in the page').toEqual([]);
    await admin.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
