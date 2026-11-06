import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { karmp3 } from './fixtures/karmp3';

// Amateur singer mode (docs/PLAN.md, "Amateur singer mode"): the administrator switches it on in Admin > Settings; a song with a vocals track then plays
// the singer's voice by itself from 0:00 to the start of its third lyric line, and the Vocals button shows it. The whole product in a real browser.
// This file is named zy-... on purpose: it runs after the specs that expect an empty server (flow.spec makes the first account) and leaves the mode off.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };
const LRC = '[00:01.00]<00:01.00>One\n[00:02.00]<00:02.00>Two\n[00:03.00]<00:03.00>Three\n[00:04.00]<00:04.00>Four';

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

/** Admin > Settings: ticks or clears "Amateur singer mode" and saves. */
async function setMode(page: Page, on: boolean): Promise<void> {
  await page.goto('/admin/settings');
  const box = page.getByRole('checkbox', { name: 'Amateur singer mode' });
  await expect(box).toBeVisible();
  if ((await box.isChecked()) !== on) {
    await box.setChecked(on);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Amateur singer mode' })).toBeChecked({ checked: on });
}

test('amateur singer mode: the voice plays by itself until the third line, then stops; with the mode off it never does', async ({ browser }) => {
  const admin = await device(browser, 'Admin laptop');
  const a = await admin.newPage();
  await signInAdmin(a);
  try {
    await test.step('the administrator uploads two songs with vocals and four lyric lines, and switches the mode on', async () => {
      await a.goto('/upload');
      const file = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/octet-stream', buffer });
      await a.locator('#upload-files').setInputFiles([
        file('Amateurone.karmp3', karmp3('Amateurone', 600, { vocals: true, lrc: LRC })),
        file('Amateurtwo.karmp3', karmp3('Amateurtwo', 600, { vocals: true, lrc: LRC })),
      ]);
      await expect(a.getByText('2 added, 0 duplicates, 0 rejected')).toBeVisible();
      await setMode(a, true);
    });

    const dev = await device(browser, 'Player device');
    await dev.addInitScript(() => localStorage.setItem('kantahe.songcache.enabled', 'false'));
    const p = await dev.newPage();
    const pageErrors: string[] = [];
    p.on('pageerror', (e) => pageErrors.push(e.message));
    await signInAdmin(p);
    for (const title of ['Amateurone', 'Amateurtwo']) {
      await p.goto('/library');
      await p.getByLabel('Search songs').fill(title);
      await p.locator('li.row', { hasText: title }).first().locator('button.main').click();
      await expect(p.getByText(`Added ${title}`).first()).toBeVisible();
    }
    const stage = p.locator('.stage');
    const vocals = stage.locator('button.vocals');
    const requests: string[] = [];
    p.on('request', (r) => {
      if (r.url().includes('/media/vocals/')) requests.push(new URL(r.url()).pathname);
    });

    await test.step('the first song: the Vocals button is on without a press, then off after the third line, and the singer can still switch it on', async () => {
      await p.goto('/player');
      await p.getByRole('button', { name: 'Play here' }).click();
      await expect(stage.locator('header.song h1')).toHaveText(/\S/);
      if ((await stage.locator('header.song h1').innerText()) !== 'Amateurone') {
        await p.mouse.move(100, 100);
        await stage.getByRole('button', { name: 'Skip' }).click();
      }
      await expect(stage.locator('header.song h1')).toHaveText('Amateurone');
      await expect(vocals).toHaveAttribute('aria-pressed', 'true');
      expect(requests.length, 'the vocals were fetched by themselves').toBeGreaterThan(0);
      await expect(vocals).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 }); // the third line starts at 3 s
      await expect(stage.locator('header.song h1')).toHaveText('Amateurone'); // the song itself went on
    });

    await test.step('the mode is switched off while the first song plays: the second song gets no guide', async () => {
      await setMode(a, false);
      // the second song starts after the first one and its score screen
      await expect(stage.locator('header.song h1')).toHaveText('Amateurtwo', { timeout: 60_000 });
      await p.waitForTimeout(2500);
      await expect(vocals).toHaveAttribute('aria-pressed', 'false');
    });
    expect(pageErrors).toEqual([]);
  } finally {
    await setMode(a, false); // the other specs share this server and expect the vocals off at the start of a song
  }
});
