import { Browser, BrowserContext, chromium, expect, Page, test } from '@playwright/test';
import { VIDEO_A, VIDEO_B } from './fixtures/tiny-video';

// Background videos (docs/PLAN.md section 4.2) from the administrator's upload to a player: the whole product in a real browser.
// Playwright's own Chromium has no H.264 decoder, so the first test checks the wiring: the requests, the elements and their attributes.
// The second test plays the same videos in the installed Google Chrome (skipped when it is not installed).

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

test.describe.configure({ mode: 'serial' }); // the second test uses what the first one left on the server

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

/** Notes every address a <video> gets (the player drops it again when a browser cannot decode the file). */
const noteVideoAddresses = (context: BrowserContext) =>
  context.addInitScript(() => {
    const seen = new Set<string>();
    (window as unknown as { __videoSrcs: Set<string> }).__videoSrcs = seen;
    const watch = () =>
      new MutationObserver((records) => {
        for (const r of records) if (r.target instanceof HTMLVideoElement && r.target.getAttribute('src')) seen.add(r.target.getAttribute('src')!);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['src'], childList: true });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();
  });

const addresses = (page: Page) => page.evaluate(() => [...(window as unknown as { __videoSrcs: Set<string> }).__videoSrcs]);

/** What every background <video> must be: picture only, no sound, nothing to turn it on. */
async function expectSilent(videos: ReturnType<Page['locator']>): Promise<void> {
  const states = await videos.evaluateAll((all) =>
    (all as HTMLVideoElement[]).map((v) => ({ muted: v.muted, volume: v.volume, controls: v.hasAttribute('controls'), playsinline: v.hasAttribute('playsinline') })),
  );
  expect(states.length).toBeGreaterThan(0);
  for (const s of states) expect(s).toEqual({ muted: true, volume: 0, controls: false, playsinline: true });
}

test('background videos: uploaded by the administrator, ordered, shown on a player, switched off', async ({ browser }) => {
  const admin = await device(browser, 'Admin laptop');
  const a = await admin.newPage();
  await signInAdmin(a);
  const names = () => a.locator('li.video .name');

  await test.step('Admin has a Videos tab with an empty page', async () => {
    await a.getByRole('link', { name: 'Admin' }).click();
    await a.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: 'Videos' }).click();
    await expect(a).toHaveURL(/\/admin\/videos$/);
    await expect(a.getByRole('heading', { name: 'Background videos', level: 2 })).toBeVisible();
    await expect(a.getByText('No background videos yet. Choose files above.')).toBeVisible();
  });

  await test.step('two videos are uploaded with the file chooser; both rows show the picture facts', async () => {
    await a.locator('#video-files').setInputFiles([VIDEO_A, VIDEO_B]);
    await expect(names()).toHaveText(['a', 'b'], { timeout: 30_000 });
    await expect(a.locator('.uploads li')).toHaveText([/a\.mp4.*Added/s, /b\.mp4.*Added/s]);
    const first = a.locator('li.video').first();
    await expect(first.locator('.facts')).toHaveText('64 x 64 · 0:01 · 1 MB · H.264');
    // A carries a sound track: the page says so, as a plain note, and nothing offers to play it
    await expect(first.locator('.sound')).toHaveText('has a sound track (never played)');
    await expect(a.locator('li.video').nth(1).locator('.sound')).toHaveCount(0);
    await expect(a.getByRole('button', { name: 'Move a up' })).toBeDisabled();
    await expect(a.getByRole('button', { name: 'Move a down' })).toBeEnabled();
    await expectSilent(a.locator('li.video video')); // the previews are silent too
  });

  await test.step('the same file again is "Already in the list"', async () => {
    await a.locator('#video-files').setInputFiles([VIDEO_B]);
    await expect(a.locator('.uploads li').last()).toContainText('Already in the list');
    await expect(names()).toHaveText(['a', 'b']);
  });

  await test.step('the order is changed so that b is first, and it is still so after a reload', async () => {
    await a.getByRole('button', { name: 'Move b up' }).click();
    await expect(names()).toHaveText(['b', 'a']);
    await a.reload();
    await expect(names()).toHaveText(['b', 'a']);
  });

  // another device of the administrator is the player
  const dev = await device(browser, 'Player device');
  await noteVideoAddresses(dev);
  const p = await dev.newPage();
  const videoResponses: number[] = [];
  const problems: string[] = [];
  let getBackground = 0;
  p.on('response', (r) => {
    if (r.url().includes('/media/video/')) videoResponses.push(r.status());
  });
  p.on('request', (r) => {
    if (r.url().includes('CatalogService/GetBackground')) getBackground++;
  });
  p.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  p.on('pageerror', (e) => problems.push(e.message));
  const stageVideos = p.locator('.stage app-background-video video');

  await test.step('the player device shows the videos behind the lyrics: two elements, the addresses of the loop, no sound', async () => {
    await signInAdmin(p);
    await p.goto('/player');
    await p.getByRole('button', { name: 'Play here' }).click();
    await expect(stageVideos).toHaveCount(2);
    await expect.poll(() => addresses(p), { message: 'the videos of the loop are given to the elements' }).not.toEqual([]);
    expect((await addresses(p)).every((s) => s.includes('/media/video/'))).toBe(true);
    await expect.poll(() => videoResponses.some((s) => s === 200 || s === 206), { message: 'a video was fetched' }).toBe(true);
    await expectSilent(stageVideos);
    expect(problems, 'no error in the console').toEqual([]);
    await expect(p.locator('.stage app-lyrics-view')).toBeVisible(); // the lyrics are still there, in front
  });

  await test.step('with one video switched off the loop has only the other', async () => {
    await a.getByLabel('Play a in the loop').uncheck();
    await expect(a.getByLabel('Play a in the loop')).not.toBeChecked();
    await p.reload();
    await expect(stageVideos).toHaveCount(2);
    await expect.poll(async () => (await addresses(p)).length).toBe(1);
    // only b (the first of the list, the one that is left) is given to a player
    const listed = await a.locator('li.video video').first().getAttribute('src');
    expect((await addresses(p))[0].split('?')[0]).toBe(listed!.split('?')[0]);
    await expectSilent(stageVideos);
  });

  await test.step('with both switched off there is no video element at all', async () => {
    await a.getByLabel('Play b in the loop').uncheck();
    await expect(a.getByLabel('Play b in the loop')).not.toBeChecked();
    await p.reload();
    await expect(p.locator('.stage')).toBeVisible();
    await p.waitForTimeout(1500); // the list has been asked for and answered
    await expect(stageVideos).toHaveCount(0);
    await expect(p.locator('video')).toHaveCount(0);
  });

  await test.step('switched on again, and then "Background video: Off" for this device: no request for the list is made', async () => {
    await a.getByLabel('Play a in the loop').check();
    await a.getByLabel('Play b in the loop').check();
    await expect(a.getByLabel('Play b in the loop')).toBeChecked();
    await p.goto('/me/devices');
    const row = p.locator('li.device', { hasText: 'Player device' });
    await row.getByLabel('Background video of Player device').selectOption('Off');
    await expect(row.locator('.background .effective')).toHaveText('Now using: Off');
    getBackground = 0;
    await p.goto('/player');
    await expect(p.locator('.stage')).toBeVisible();
    await p.waitForTimeout(2500); // long enough for a request that should not be made
    expect(getBackground, 'no GetBackground request while the device has the background off').toBe(0);
    await expect(p.locator('video')).toHaveCount(0);
    // back to Auto, for the test that follows
    await p.goto('/me/devices');
    await p.locator('li.device', { hasText: 'Player device' }).getByLabel('Background video of Player device').selectOption('Auto');
    await expect(p.locator('li.device', { hasText: 'Player device' }).locator('.background .effective')).toHaveText('Now using: On');
  });

  await dev.close();
  await admin.close();
});

test('the same player decodes and plays the video in the installed Google Chrome', async () => {
  const chrome = await chromium
    .launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
    .catch(() => undefined);
  test.skip(!chrome, 'Google Chrome is not installed: Playwright\'s Chromium has no H.264 decoder');
  try {
    const dev = await device(chrome!, 'Chrome player');
    const p = await dev.newPage();
    await signInAdmin(p);
    await p.goto('/player');
    await p.getByRole('button', { name: 'Play here' }).click();
    const videos = p.locator('.stage app-background-video video');
    await expect(videos).toHaveCount(2);
    await expectSilent(videos);
    // a video has data to show (readyState 2 = a frame) and moves
    const state = () =>
      videos.evaluateAll((all) =>
        (all as HTMLVideoElement[]).filter((v) => v.getAttribute('src')).map((v) => ({ ready: v.readyState, time: v.currentTime, paused: v.paused })),
      );
    await expect.poll(async () => (await state()).some((s) => s.ready >= 2), { message: 'a frame is decoded' }).toBe(true);
    await expect.poll(async () => Math.max(0, ...(await state()).map((s) => s.time)), { message: 'currentTime advances' }).toBeGreaterThan(0.2);
    await expectSilent(videos); // still silent while they play
  } finally {
    await chrome!.close();
  }
});
