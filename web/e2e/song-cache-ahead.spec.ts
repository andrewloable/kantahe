import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { karmp3 } from './fixtures/karmp3';
import { SERVER_URL } from './ports';

// kantahe-cnf.2: the player keeps the next three songs on the device while a song plays, so that a spotty connection does not stop the
// music: after a cut across the end of a song, the next one starts from the device once the connection is back. The whole product in a
// real browser. The queue itself moves on only through the server (docs/PLAN.md D5/D8), so during the cut the next song waits.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };
const TITLES = ['Aheadone', 'Aheadtwo', 'Aheadthree', 'Aheadfour'];

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

/** The audio files the song cache keeps, from Cache Storage itself. */
const keptAudio = (page: Page) =>
  page.evaluate(async () =>
    (await (await caches.open('kantahe-songs-v1')).keys())
      .map((r) => new URL(r.url).pathname)
      .filter((p) => p.startsWith('/kantahe-song-cache/audio/'))
      .map((p) => p.split('/').pop() ?? '')
      .sort(),
  );

test('spotty network: the next three songs are kept ahead, and after a cut the next song starts from the device', async ({ browser, request }) => {
  const admin = await device(browser, 'Admin laptop');
  const a = await admin.newPage();
  await signInAdmin(a);
  await a.goto('/upload');
  // the first song is short (about 8 s), so that it ends during the cut; the others are long enough not to end during the test
  await a.locator('#upload-files').setInputFiles(
    TITLES.map((t, i) => ({ name: `${t}.karmp3`, mimeType: 'application/octet-stream', buffer: karmp3(t, i === 0 ? 300 : 2400) })),
  );
  await expect(a.getByText('4 added, 0 duplicates, 0 rejected')).toBeVisible();

  const dev = await device(browser, 'Car');
  const p = await dev.newPage();
  await signInAdmin(p);
  type Song = { number: string; title: string };
  type Snapshot = { status?: string; queue?: { id: string; song: Song }[]; now?: { song: Song } };
  const token = await p.evaluate(() => localStorage.getItem('kantahe.token'));
  const call = async <T>(method: string, data: object): Promise<T> => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.SessionService/${method}`, { data, headers: { authorization: `Bearer ${token}` } });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  const snapshot = async () => (await call<{ state: Snapshot }>('GetState', {})).state;
  // the account is shared with the other specs: start from an empty queue, with the four songs in it and the first one current
  await call('Control', { action: 'CONTROL_ACTION_PAUSE' });
  for (const q of (await snapshot()).queue ?? []) await call('RemoveFromQueue', { itemId: q.id });
  for (const title of TITLES) {
    await p.goto('/library');
    await p.getByLabel('Search songs').fill(title);
    await p.locator('li.row', { hasText: title }).first().locator('button.main').click();
    await expect(p.getByText(`Added ${title}`).first()).toBeVisible();
  }
  if ((await snapshot()).now?.song.title !== TITLES[0]) await call('Control', { action: 'CONTROL_ACTION_SKIP' });
  const state = await snapshot();
  expect(state.now?.song.title, 'the first song is current').toBe(TITLES[0]);
  // the numbers of the songs, from the server (uploads may renumber a clashing song)
  const numberOf = (title: string) => (state.queue ?? []).find((q) => q.song.title === title)?.song.number ?? '';
  const [two, three, four] = TITLES.slice(1).map(numberOf);
  expect([two, three, four].every(Boolean), 'the three songs after the first are in the queue').toBe(true);

  await test.step('playing the first song keeps the next three on the device, not the fourth', async () => {
    await p.goto('/player');
    await p.getByRole('button', { name: 'Play here' }).click();
    await call('Control', { action: 'CONTROL_ACTION_PLAY' });
    await expect(stage(p).locator('header.song h1')).toHaveText(TITLES[0]);
    await expect.poll(() => keptAudio(p), { message: 'the three songs after the current one are kept', timeout: 30_000 }).toEqual(expect.arrayContaining([two, three, four]));
  });

  await test.step('a cut across the end of the first song: the second starts from the device once the connection is back', async () => {
    const fetched: string[] = [];
    p.on('request', (r) => {
      if (r.url().includes('/media/song/')) fetched.push(new URL(r.url()).pathname);
    });
    const titles: string[] = []; // every title the player shows from now on
    const watch = setInterval(() => {
      void stage(p)
        .locator('header.song h1')
        .innerText({ timeout: 500 })
        .then((t) => titles.at(-1) !== t && titles.push(t))
        .catch(() => undefined);
    }, 200);
    await dev.setOffline(true);
    await p.waitForTimeout(12_000); // the first song (about 8 s) ends while the device is offline
    const back = Date.now();
    await dev.setOffline(false);
    await expect(stage(p).locator('header.song h1')).toHaveText(TITLES[1], { timeout: 30_000 });
    const startedAfter = Date.now() - back;
    clearInterval(watch);
    console.log(`second song shown ${startedAfter} ms after the connection came back; titles seen: ${titles.join(', ')}`);
    // kantahe-0v6: the end heard at once when the connection is back (state polling every 2 s), the score screen (3 s here), the next song
    expect(startedAfter, 'the second song starts soon after the connection is back').toBeLessThan(10_000);
    expect(titles.filter((t) => t === TITLES[0]).length, 'the first song is not started again after the cut').toBeLessThanOrEqual(1);
    expect(fetched.filter((f) => f.includes(`/${two}`)), 'the second song was played from the device, not downloaded again').toEqual([]);
  });

  // leave the shared account as calm as it was: nothing playing, an empty queue (best effort: an item may be gone by then)
  const tidy = (method: string, data: object) =>
    request.post(`${SERVER_URL}/kantahe.v1.SessionService/${method}`, { data, headers: { authorization: `Bearer ${token}` } });
  await tidy('Control', { action: 'CONTROL_ACTION_PAUSE' });
  for (const q of (await snapshot()).queue ?? []) await tidy('RemoveFromQueue', { itemId: q.id });
});
