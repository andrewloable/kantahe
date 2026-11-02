import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

// Guide vocals (docs/PLAN.md section 3): a .karmp3 made with Kantahe Maker 1.1 carries the singer's voice as a second MP3. The whole product in a
// real browser: the administrator uploads such files, a player device shows the Vocals switch only for them, the voice is fetched from
// /media/vocals and kept for the next song, and the buttons fit a phone screen. The MP3 files are silent frames built here, not songs.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

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

/** n silent MPEG-1 Layer III frames (44.1 kHz, 128 kbps, stereo): 417 bytes each, the header FF FB 90 00 and zeros; 2000 frames play for about a minute. */
function mp3(frames: number): Uint8Array {
  const out = new Uint8Array(417 * frames);
  for (let i = 0; i < frames; i++) out.set([0xff, 0xfb, 0x90, 0x00], i * 417);
  return out;
}

/** A .karmp3 in the order and with the .nfo rows of Kantahe Maker 1.1; without `vocals` it is a file of Maker 1.0.x. */
function karmp3(title: string, frames: number, vocals: boolean): Buffer {
  const base = `00500 - Band - ${title}`;
  const nfo = `Title : ${title}\nArtist : Band\n` + (vocals ? `Instrumental : ${base}.mp3\nVocals : ${base}.vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\n` : '');
  const entries: Record<string, Uint8Array> = { [`${base}.mp3`]: mp3(frames), [`${base}.lrc`]: strToU8('[00:01.00]<00:01.00>Sing <00:01.50>along'), [`${base}.nfo`]: strToU8(nfo) };
  if (vocals) entries[`${base}.vocals.mp3`] = mp3(frames - 20);
  return Buffer.from(zipSync(entries));
}

const stage = (page: Page) => page.locator('.stage');

/** While a song plays the buttons fade after three quiet seconds (a moved mouse brings them back): move it, as a user would, before a click. */
let shake = 0;
const wake = (page: Page) => page.mouse.move(100 + (shake++ % 2) * 10, 100);

test('guide vocals: uploaded, offered only for songs that have them, played, remembered for the next song, and the buttons fit a phone', async ({ browser }) => {
  const admin = await device(browser, 'Admin laptop');
  const a = await admin.newPage();
  await signInAdmin(a);

  await test.step('the administrator uploads two songs with vocals and one without', async () => {
    await a.goto('/upload');
    const file = (name: string, buffer: Buffer) => ({ name, mimeType: 'application/octet-stream', buffer });
    await a.locator('#upload-files').setInputFiles([
      file('Vocalsong.karmp3', karmp3('Vocalsong', 2000, true)),
      file('Plainsong.karmp3', karmp3('Plainsong', 2100, false)),
      file('Vocalsongtwo.karmp3', karmp3('Vocalsongtwo', 2200, true)),
    ]);
    await expect(a.getByText('3 added, 0 duplicates, 0 rejected')).toBeVisible();
  });

  const dev = await device(browser, 'Player device');
  const p = await dev.newPage();
  const vocalsResponses: string[] = [];
  const failed: string[] = [];
  const pageErrors: string[] = [];
  p.on('response', (r) => {
    if (r.url().includes('/media/vocals/') && (r.status() === 200 || r.status() === 206)) vocalsResponses.push(new URL(r.url()).pathname);
  });
  p.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  p.on('pageerror', (e) => pageErrors.push(e.message));
  await signInAdmin(p);

  await test.step('the three songs are queued in the order vocals, plain, vocals', async () => {
    for (const title of ['Vocalsong', 'Plainsong', 'Vocalsongtwo']) {
      await p.goto('/library');
      await p.getByLabel('Search songs').fill(title);
      const row = p.locator('li.row', { hasText: title }).first();
      await row.locator('button.main').click();
      await expect(p.getByText(`Added ${title}`).first()).toBeVisible();
    }
  });

  await test.step('on the player the first song shows the Vocals switch, off', async () => {
    await p.goto('/player');
    await p.getByRole('button', { name: 'Play here' }).click();
    // an earlier test (videos.spec) may have left a song playing for the account; Play here takes it over, and the queue is next
    await expect(stage(p).locator('h1')).toHaveText(/\S/);
    if ((await stage(p).locator('h1').innerText()) !== 'Vocalsong') {
      await wake(p);
      await stage(p).getByRole('button', { name: 'Skip' }).click();
    }
    await expect(stage(p).locator('h1')).toHaveText('Vocalsong');
    await expect(p.getByRole('button', { name: 'Vocals: off' })).toBeVisible();
    await expect(p.getByRole('button', { name: 'Vocals: off' })).toHaveAttribute('aria-pressed', 'false');
    expect(vocalsResponses, 'nothing is fetched before the switch is used').toEqual([]);
  });

  await test.step('switching it on fetches the voice from /media/vocals and shows the level', async () => {
    await wake(p);
    await p.getByRole('button', { name: 'Vocals: off' }).click();
    await expect(p.getByRole('button', { name: 'Vocals: on' })).toBeVisible();
    await expect.poll(() => vocalsResponses.length, { message: 'the vocals were fetched' }).toBeGreaterThan(0);
    await expect(stage(p).getByText('Vocals volume 60%')).toBeVisible();
    await wake(p);
    await p.getByRole('button', { name: 'Vocals quieter' }).click();
    await wake(p);
    await p.getByRole('button', { name: 'Vocals quieter' }).click();
    await expect(stage(p).getByText('Vocals volume 40%')).toBeVisible();
    await expect(stage(p).locator('app-lyrics-view')).toBeVisible(); // the lyrics are untouched
  });

  await test.step('on a phone the buttons wrap: nothing overlaps and the page does not scroll sideways', async () => {
    for (const [width, height] of [[320, 568], [744, 1133]]) {
      await p.setViewportSize({ width, height });
      await p.waitForTimeout(200);
      const report = await p.evaluate(() => {
        const rects = Array.from(document.querySelectorAll('.controls button, .controls .level')).map((e) => {
          const r = e.getBoundingClientRect();
          return { text: e.textContent?.trim() ?? '', left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
        const overlaps: string[] = [];
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) {
            const x = rects[i], y = rects[j];
            if (x.left < y.right - 0.5 && y.left < x.right - 0.5 && x.top < y.bottom - 0.5 && y.top < x.bottom - 0.5) overlaps.push(`${x.text} / ${y.text}`);
          }
        return { overlaps, outside: rects.filter((r) => r.left < -0.5 || r.right > window.innerWidth + 0.5).map((r) => r.text), scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, count: rects.length };
      });
      expect(report.count, `the controls are there at ${width} px`).toBeGreaterThanOrEqual(9);
      expect(report.overlaps, `no overlap at ${width} px`).toEqual([]);
      expect(report.outside, `nothing outside the screen at ${width} px`).toEqual([]);
      expect(report.scrollWidth, `no sideways scroll at ${width} px`).toBeLessThanOrEqual(report.innerWidth);
    }
    await p.setViewportSize({ width: 1280, height: 800 });
  });

  await test.step('the next song has no vocals: no switch at all, whatever was chosen', async () => {
    await wake(p);
    await stage(p).getByRole('button', { name: 'Skip' }).click();
    await expect(stage(p).locator('h1')).toHaveText('Plainsong');
    await expect(p.getByRole('button', { name: /^Vocals/ })).toHaveCount(0);
    await expect(stage(p).getByText('Vocals volume')).toHaveCount(0);
  });

  await test.step('the song after it has vocals again: they start by themselves, at the level chosen', async () => {
    const before = vocalsResponses.length;
    await wake(p);
    await stage(p).getByRole('button', { name: 'Skip' }).click();
    await expect(stage(p).locator('h1')).toHaveText('Vocalsongtwo');
    await expect(p.getByRole('button', { name: 'Vocals: on' })).toBeVisible({ timeout: 20_000 });
    await expect(stage(p).getByText('Vocals volume 40%')).toBeVisible();
    await expect.poll(() => vocalsResponses.length, { message: 'the second voice was fetched' }).toBeGreaterThan(before);
    expect(new Set(vocalsResponses.map((u) => u.split('/').pop())).size, 'two different songs had their vocals fetched').toBe(2);
  });

  await test.step('switching it off stops the voice and the choice is kept', async () => {
    await wake(p);
    await p.getByRole('button', { name: 'Vocals: on' }).click();
    await expect(p.getByRole('button', { name: 'Vocals: off' })).toBeVisible();
    await expect(stage(p).getByText('Vocals volume')).toHaveCount(0);
    await expect(stage(p).getByRole('button', { name: 'Pause' })).toBeVisible(); // the song goes on
  });

  // the server only takes reports for the song that is current, so a position report of the song that was just skipped is answered 400 (a harmless
  // race, likelier on a slow machine); nothing else may fail: no media file, no other call, no error in the page
  const unexpected = failed.filter((f) => !/^400 \/kantahe\.v1\.SessionService\/(ReportPosition|Ready|Ended)$/.test(f));
  expect(unexpected, 'no failed request except a stale report').toEqual([]);
  expect(pageErrors, 'no error in the page').toEqual([]);
  await dev.close();
  await admin.close();
});
