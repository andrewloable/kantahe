import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { SERVER_URL } from './ports';

// Guide vocals (docs/PLAN.md section 3): a .karmp3 made with Kantahe Maker 1.1 carries the singer's voice as a second MP3. The whole product in a
// real browser: the administrator uploads such files, a player device shows the Vocals switch only for them, the voice is fetched from
// /media/vocals and kept for the next song, and the buttons fit a phone screen. The adjustments are not on the player (kantahe-der): the test makes them
// the way another device does, with SetVocals, and reads what the player reports back (Device.vocals_state). The MP3 files are silent frames built here, not songs.

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
  // Maker 1.2.6 says how the lyrics are timed: the songs with vocals say word; the plain one says line although its .lrc has word marks (the row wins)
  const nfo = `Title : ${title}\nArtist : Band\n` + (vocals ? `Instrumental : ${base}.mp3\nVocals : ${base}.vocals.mp3\nVocals audio : MP3, 44.1 kHz, 64 kbps, mono\nTiming by : word\n` : 'Timing by : line\n');
  const entries: Record<string, Uint8Array> = { [`${base}.mp3`]: mp3(frames), [`${base}.lrc`]: strToU8('[00:01.00]<00:01.00>Sing <00:01.50>along'), [`${base}.nfo`]: strToU8(nfo) };
  if (vocals) entries[`${base}.vocals.mp3`] = mp3(frames - 20);
  return Buffer.from(zipSync(entries));
}

const stage = (page: Page) => page.locator('.stage');

/** While a song plays the buttons fade after three quiet seconds (a moved mouse brings them back): move it, as a user would, before a click. */
let shake = 0;
const wake = (page: Page) => page.mouse.move(100 + (shake++ % 2) * 10, 100);

test('guide vocals: uploaded, played when another device asks, remembered for the next song, no vocals buttons on the player, and the buttons fit a phone', async ({ browser, request }) => {
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
  // this test is about when the player asks for the vocals: the song cache (which also fetches the next song's files ahead of time) is off for it
  await dev.addInitScript(() => localStorage.setItem('kantahe.songcache.enabled', 'false'));
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
      // the badges of the list: W or L for the timing, V when there is a vocals track
      await expect(row.locator('.timing-badge')).toHaveText(title === 'Plainsong' ? 'L' : 'W');
      if (title === 'Plainsong') await expect(row.locator('.vocals-badge')).toHaveCount(0);
      else await expect(row.locator('.vocals-badge')).toHaveText('V');
      await row.locator('button.main').click();
      await expect(p.getByText(`Added ${title}`).first()).toBeVisible();
    }
  });

  // what another device (the Queue page) does: the same calls, made from the test with the player's own account
  const call = async <T>(method: string, data: object): Promise<T> => {
    const token = await p.evaluate(() => localStorage.getItem('kantahe.token'));
    const res = await request.post(`${SERVER_URL}/kantahe.v1.${method}`, { data, headers: { authorization: `Bearer ${token}` } });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  interface Dev { id: string; vocalsOn?: boolean; vocalsPct?: number; vocalsState?: string }
  const myDevice = async (): Promise<Dev> => {
    const id = await p.evaluate(() => localStorage.getItem('kantahe.deviceId'));
    const { state } = await call<{ state: { devices: Dev[] } }>('SessionService/GetState', {});
    return state.devices.find((d) => d.id === id)!;
  };
  const playerSays = (state: string) => expect.poll(async () => (await myDevice()).vocalsState, { message: `the player reports ${state}`, timeout: 20_000 }).toBe(state);

  await test.step('on the player the first song has no Vocals or volume buttons at all, and plays no voice', async () => {
    await p.goto('/player');
    await p.getByRole('button', { name: 'Play here' }).click();
    // an earlier test (videos.spec) may have left a song playing for the account; Play here takes it over, and the queue is next
    await expect(stage(p).locator('header.song h1')).toHaveText(/\S/);
    if ((await stage(p).locator('header.song h1').innerText()) !== 'Vocalsong') {
      await wake(p);
      await stage(p).getByRole('button', { name: 'Skip' }).click();
    }
    await expect(stage(p).locator('header.song h1')).toHaveText('Vocalsong');
    await wake(p);
    await expect(stage(p).locator('.controls button')).toHaveText(['Pause', 'Skip']);
    await expect(stage(p).getByText(/volume|vocals:/i)).toHaveCount(0);
    // the player shows the same badges beside MP3
    await expect(stage(p).locator('header.song .timing-badge')).toHaveText('W'); // the song's own header (the title card has badges too)
    await expect(stage(p).locator('header.song .vocals-badge')).toHaveText('V');
    await playerSays('VOCALS_STATE_OFF');
    expect(vocalsResponses, 'nothing is fetched before the vocals are switched on').toEqual([]);
  });

  await test.step('another device (the laptop, on its Queue page) switches them on: the voice is fetched, the player reports it, and shows nothing new', async () => {
    const before = await stage(p).innerText();
    await a.goto('/queue');
    await a.getByRole('button', { name: /^Volume(,| and) tempo/ }).click(); // the controls are folded away (kantahe-du1.7)
    const adjust = a.locator('app-adjust-controls');
    await expect(adjust.getByRole('button', { name: 'Vocals: off' })).toBeVisible();
    await expect(adjust.getByText('MP3 volume 100%')).toBeVisible();
    await adjust.getByRole('button', { name: 'Vocals: off' }).click();
    await expect(adjust.getByRole('button', { name: 'Vocals: on' })).toBeVisible();
    await playerSays('VOCALS_STATE_ON');
    await expect.poll(() => vocalsResponses.length, { message: 'the vocals were fetched' }).toBeGreaterThan(0);
    await expect(adjust.getByText('Vocals volume 60%')).toBeVisible();
    await adjust.getByRole('button', { name: 'Vocals quieter' }).click();
    await adjust.getByRole('button', { name: 'Vocals quieter' }).click();
    await expect(adjust.getByText('Vocals volume 40%')).toBeVisible();
    await expect.poll(async () => (await myDevice()).vocalsPct, { message: 'the level reached the server' }).toBe(40);
    await expect(stage(p).locator('app-lyrics-view')).toBeVisible(); // the lyrics are untouched
    await expect(stage(p).locator('.controls button')).toHaveText(['Pause', 'Skip']);
    expect((await stage(p).innerText()).replace(/\d+:\d+/g, ''), 'nothing on the player changed').toBe(before.replace(/\d+:\d+/g, ''));
  });

  await test.step('the volume of the player is changed from the Queue page too', async () => {
    const adjust = a.locator('app-adjust-controls');
    await adjust.getByRole('button', { name: 'Volume up' }).click();
    await adjust.getByRole('button', { name: 'Volume up' }).click();
    await expect(adjust.getByText('MP3 volume 110%')).toBeVisible();
    await expect.poll(async () => ((await myDevice()) as Dev & { mp3VolumePct?: number }).mp3VolumePct).toBe(110);
    await adjust.getByRole('button', { name: 'Volume down' }).click();
    await adjust.getByRole('button', { name: 'Volume down' }).click();
    await expect.poll(async () => ((await myDevice()) as Dev & { mp3VolumePct?: number }).mp3VolumePct).toBe(100);
  });

  await test.step('the tempo is changed from the Queue page: the song is told, and the player shows nothing', async () => {
    const adjust = a.locator('app-adjust-controls');
    await expect(stage(p).locator('.title-card')).toHaveCount(0, { timeout: 15_000 }); // the title card counts down: compare the playing song
    const before = await stage(p).innerText();
    const tempo = async () => {
      const { state } = await call<{ state: { now: { tempoPct?: number } } }>('SessionService/GetState', {});
      return state.now.tempoPct;
    };
    await expect(adjust.getByText('Tempo 100%')).toBeVisible();
    await expect(adjust.getByRole('button', { name: 'Normal speed' })).toHaveCount(0);
    await adjust.getByRole('button', { name: 'Slower' }).click();
    await adjust.getByRole('button', { name: 'Slower' }).click();
    await expect(adjust.getByText('Tempo 90%')).toBeVisible();
    await expect.poll(tempo).toBe(90);
    await expect(stage(p).locator('.controls button')).toHaveText(['Pause', 'Skip']);
    expect((await stage(p).innerText()).replace(/\d+:\d+/g, ''), 'nothing on the player changed').toBe(before.replace(/\d+:\d+/g, ''));
    await adjust.getByRole('button', { name: 'Normal speed' }).click();
    await expect.poll(tempo).toBe(100);
  });

  await test.step('on a phone the Queue page controls wrap: nothing overlaps, every button is 44 px high and the page does not scroll sideways', async () => {
    for (const [width, height] of [[320, 568], [390, 844], [1280, 800]]) {
      await a.setViewportSize({ width, height });
      await a.waitForTimeout(200);
      const report = await a.evaluate(() => {
        const rects = Array.from(document.querySelectorAll('app-adjust-controls button, app-adjust-controls .level')).map((e) => {
          const r = e.getBoundingClientRect();
          return { text: e.textContent?.trim() ?? '', left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, button: e.tagName === 'BUTTON' };
        });
        const overlaps: string[] = [];
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) {
            const x = rects[i], y = rects[j];
            if (x.left < y.right - 0.5 && y.left < x.right - 0.5 && x.top < y.bottom - 0.5 && y.top < x.bottom - 0.5) overlaps.push(`${x.text} / ${y.text}`);
          }
        return {
          overlaps,
          outside: rects.filter((r) => r.left < -0.5 || r.right > window.innerWidth + 0.5).map((r) => r.text),
          small: rects.filter((r) => r.button && r.height < 43.5).map((r) => `${r.text} ${r.height}`),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          count: rects.length,
        };
      });
      expect(report.count, `the controls are there at ${width} px`).toBe(10); // Volume down, level, Volume up, Slower, level, Faster, Vocals, Vocals quieter, level, Vocals louder
      expect(report.overlaps, `no overlap at ${width} px`).toEqual([]);
      expect(report.outside, `nothing outside the screen at ${width} px`).toEqual([]);
      expect(report.small, `44 px targets at ${width} px`).toEqual([]);
      expect(report.scrollWidth, `no sideways scroll at ${width} px`).toBeLessThanOrEqual(report.innerWidth);
    }
    await a.setViewportSize({ width: 1280, height: 720 });
  });

  await test.step('on a phone the buttons of the player wrap: nothing overlaps and the page does not scroll sideways', async () => {
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
      expect(report.count, `the controls are there at ${width} px`).toBeGreaterThanOrEqual(2);
      expect(report.overlaps, `no overlap at ${width} px`).toEqual([]);
      expect(report.outside, `nothing outside the screen at ${width} px`).toEqual([]);
      expect(report.scrollWidth, `no sideways scroll at ${width} px`).toBeLessThanOrEqual(report.innerWidth);
    }
    await p.setViewportSize({ width: 1280, height: 800 });
  });

  await test.step('the next song has no vocals: nothing is played, whatever was chosen', async () => {
    await wake(p);
    await stage(p).getByRole('button', { name: 'Skip' }).click();
    await expect(stage(p).locator('header.song h1')).toHaveText('Plainsong');
    await playerSays('VOCALS_STATE_OFF');
    expect((await myDevice()).vocalsOn, 'the choice is kept on the server').toBe(true);
  });

  await test.step('the song after it has vocals again: they start by themselves, at the level chosen', async () => {
    const before = vocalsResponses.length;
    await wake(p);
    await stage(p).getByRole('button', { name: 'Skip' }).click();
    await expect(stage(p).locator('header.song h1')).toHaveText('Vocalsongtwo');
    await playerSays('VOCALS_STATE_ON');
    expect((await myDevice()).vocalsPct).toBe(40);
    await expect.poll(() => vocalsResponses.length, { message: 'the second voice was fetched' }).toBeGreaterThan(before);
    expect(new Set(vocalsResponses.map((u) => u.split('/').pop())).size, 'two different songs had their vocals fetched').toBe(2);
  });

  await test.step('switching them off from the Queue page stops the voice, the choice is kept, and the song goes on', async () => {
    await a.goto('/queue');
    await a.getByRole('button', { name: /^Volume(,| and) tempo/ }).click(); // the controls are folded away (kantahe-du1.7)
    await a.locator('app-adjust-controls').getByRole('button', { name: 'Vocals: on' }).click();
    await playerSays('VOCALS_STATE_OFF');
    expect((await myDevice()).vocalsOn).toBe(false);
    await wake(p);
    await expect(stage(p).getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  // the server only takes reports for the song that is current, so a position report of the song that was just skipped is answered 400 (a harmless
  // race, likelier on a slow machine); nothing else may fail: no media file, no other call, no error in the page
  const unexpected = failed.filter((f) => !/^400 \/kantahe\.v1\.SessionService\/(ReportPosition|Ready|Ended)$/.test(f));
  expect(unexpected, 'no failed request except a stale report').toEqual([]);
  expect(pageErrors, 'no error in the page').toEqual([]);
  await dev.close();
  await admin.close();
});
