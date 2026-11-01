import { expect, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The loading splash (docs/PLAN.md section 8): the brand logo is plain HTML and CSS in index.html, so it paints before any script arrives.
// Every test delays the JavaScript by 3 s, as a slow phone or a TV would, and looks at what the page shows meanwhile.

const OFFICIAL = readFileSync(resolve(__dirname, '../../branding/export/splash-1920x1080.png')).toString('base64');
const BACKGROUND = 'rgb(10, 14, 34)'; // #0a0e22

async function delayScripts(page: Page, ms = 3000): Promise<void> {
  await page.route('**/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

/** The logo of the splash, as the page lays it out. */
const logoRect = (page: Page) => page.locator('#splash .splash-logo svg').evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});

interface Rect { left: number; top: number; width: number; height: number }
interface Analysis {
  corners: number[][];
  centre: number[];
  mae: number;
  yellow: { web: number[] | null; official: number[] | null }; // bounding boxes of the yellow strokes of "kanta", in official pixels
  white: { web: number[] | null; official: number[] | null }; // and of the white strokes of "he"
}

/**
 * Compares a screenshot of the splash with the official 1920x1080 splash image, in a page of its own with a canvas (no image library).
 * The logo of the splash uses the coordinates of the official one: its viewBox starts at (477, 221) and is 966 x 638 units wide, so a
 * pixel of the page maps to a pixel of the official image exactly.
 */
async function compare(helper: Page, shot: Buffer, rect: Rect): Promise<Analysis> {
  await helper.setContent('<canvas id="c"></canvas>');
  return helper.evaluate(
    async ({ web, official, rect }) => {
      const load = (b64: string) =>
        new Promise<HTMLImageElement>((ok, no) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.onerror = no;
          i.src = 'data:image/png;base64,' + b64;
        });
      const [w, o] = await Promise.all([load(web), load(official)]);
      const canvasOf = (img: CanvasImageSource, width: number, height: number, sx = 0, sy = 0, sw = width, sh = height) => {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const x = c.getContext('2d', { willReadFrequently: true })!;
        x.imageSmoothingQuality = 'high';
        x.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
        return x;
      };
      const full = canvasOf(w, w.naturalWidth, w.naturalHeight);
      const px = (x: number, y: number) => Array.from(full.getImageData(x, y, 1, 1).data);
      const W = w.naturalWidth;
      const H = w.naturalHeight;
      const corners = [px(4, 4), px(W - 5, 4), px(4, H - 5), px(W - 5, H - 5)];
      const centre = px(Math.round(W / 2), Math.round(H / 2));

      // the composition (tile and wordmark: x 521..1399, y 265..815 in official pixels) as the page draws it
      const k = rect.width / 966;
      const rx = Math.round(rect.left + (521 - 477) * k);
      const ry = Math.round(rect.top + (265 - 221) * k);
      const rw = Math.round(878 * k);
      const rh = Math.round(550 * k);
      const mine = canvasOf(w, rw, rh, rx, ry, rw, rh);
      const theirs = canvasOf(o, rw, rh, 521, 265, 878, 550); // the official image, scaled down to the size of the page's logo
      const a = mine.getImageData(0, 0, rw, rh).data;
      const b = theirs.getImageData(0, 0, rw, rh).data;
      let sum = 0;
      for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      const mae = sum / ((a.length / 4) * 3 * 255);

      // the wordmark is below the tile: rows from y 640 (official) on
      const from = Math.round(((640 - 265) * rh) / 550);
      const box = (d: Uint8ClampedArray, test: (r: number, g: number, bl: number) => boolean): number[] | null => {
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = from; y < rh; y++)
          for (let x = 0; x < rw; x++) {
            const i = (y * rw + x) * 4;
            if (d[i + 3] > 200 && test(d[i], d[i + 1], d[i + 2])) {
              x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            }
          }
        // back to official pixels
        return x1 < 0 ? null : [x0, y0, x1, y1].map((v) => Math.round((v * 878) / rw));
      };
      const isYellow = (r: number, g: number, bl: number) => r > 225 && g > 180 && g < 235 && bl < 120;
      const isWhite = (r: number, g: number, bl: number) => r > 235 && g > 235 && bl > 235;
      return {
        corners,
        centre,
        mae,
        yellow: { web: box(a, isYellow), official: box(b, isYellow) },
        white: { web: box(a, isWhite), official: box(b, isWhite) },
      };
    },
    { web: shot.toString('base64'), official: OFFICIAL, rect },
  );
}

test.describe('the loading splash', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('shows the logo before the app, then gives way to it without a jump', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const w = window as unknown as { __shift: number };
      w.__shift = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const shift = e as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) w.__shift += shift.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await delayScripts(page);
    await page.goto('/library', { waitUntil: 'commit' });
    await page.waitForTimeout(500);

    await expect(page.locator('#splash')).toBeVisible();
    await expect(page.locator('#splash svg')).toBeVisible();
    const shot = await page.screenshot();
    const analysis = await compare(await page.context().newPage(), shot, await logoRect(page));
    // not blank: the centre of the page is the logo, not the page's own colour
    const [r, g, b] = analysis.centre;
    expect(Math.abs(r - 10) + Math.abs(g - 14) + Math.abs(b - 34), 'the centre of the page shows the logo').toBeGreaterThan(20);

    // the app arrives, and the splash is gone within a second of it
    await page.waitForURL(/\/(login|setup)(\?|$)/, { timeout: 20_000 });
    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 1000 });
    const shift = await page.evaluate(() => (window as unknown as { __shift: number }).__shift);
    expect(shift, 'layout shift while the splash gives way').toBeLessThan(0.01);
    expect(errors, 'console errors').toEqual([]);
  });

  test('looks the same in the light and the dark theme: dark in both', async ({ browser }) => {
    const pictures: Buffer[] = [];
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      await page.addInitScript((t) => localStorage.setItem('kantahe.theme', t), theme);
      await delayScripts(page);
      await page.goto('/login', { waitUntil: 'commit' });
      await page.waitForTimeout(600); // the fade-in has ended
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'the theme was applied').toBe(theme);
      expect(await page.locator('#splash').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(BACKGROUND);
      pictures.push(await page.locator('#splash').screenshot());
      await context.close();
    }
    expect(pictures[0].equals(pictures[1]), 'the splash is the same picture in both themes').toBe(true);
  });

  test('matches the official splash image', async ({ page }) => {
    await delayScripts(page);
    await page.goto('/login', { waitUntil: 'commit' });
    await page.waitForTimeout(600); // the fade-in (0.3 s) has ended
    const shot = await page.screenshot();
    const a = await compare(await page.context().newPage(), shot, await logoRect(page));

    for (const px of a.corners) for (let c = 0; c < 3; c++) expect(Math.abs(px[c] - [10, 14, 34][c]), `corner ${px}`).toBeLessThanOrEqual(3);
    expect(a.yellow.web && a.yellow.official, 'the yellow strokes of kanta are found in both').toBeTruthy();
    for (const word of ['yellow', 'white'] as const) {
      const { web, official } = a[word];
      expect(web && official, `the ${word} strokes of the wordmark are found in both`).toBeTruthy();
      web!.forEach((v, i) => expect(Math.abs(v - official![i]), `${word} stroke box, side ${i}`).toBeLessThanOrEqual(6));
    }
    expect(a.mae, 'mean absolute pixel error of the logo after scaling').toBeLessThan(0.04);
  });

  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1920, 1080],
    [3840, 2160],
  ]) {
    test(`the logo is whole and centred on a ${width}x${height} screen`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await delayScripts(page);
      await page.goto('/login', { waitUntil: 'commit' });
      await page.waitForTimeout(400);
      const r = await logoRect(page);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left + r.width).toBeLessThanOrEqual(width);
      expect(r.top + r.height).toBeLessThanOrEqual(height);
      expect(Math.abs(r.left + r.width / 2 - width / 2)).toBeLessThanOrEqual(2);
      expect(Math.abs(r.top + r.height / 2 - height / 2)).toBeLessThanOrEqual(2);
    });
  }

  test('inside the Flutter WebView (/embed/player) there is only the dark colour, no logo', async ({ page }) => {
    await delayScripts(page);
    await page.goto('/embed/player', { waitUntil: 'commit' });
    await page.waitForTimeout(400);
    await expect(page.locator('#splash')).toBeVisible();
    await expect(page.locator('#splash .splash-logo')).toBeHidden();
    expect(await page.locator('#splash').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(BACKGROUND);
  });

  test('a TV page that is not embedded (/player) keeps the logo', async ({ page }) => {
    await delayScripts(page);
    await page.goto('/player', { waitUntil: 'commit' });
    await page.waitForTimeout(400);
    await expect(page.locator('#splash .splash-logo')).toBeVisible();
  });
});

