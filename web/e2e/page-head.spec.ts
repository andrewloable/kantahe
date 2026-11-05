import { expect, test } from '@playwright/test';

// What index.html says about the app before any script runs: search engines and link previews read the description.
test('the page has a description', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Kantahe: your own karaoke server. Your songs, your queue, any screen.',
  );
});

// kantahe-8ib.1: what a phone needs in the page to treat it as an app
test('the page and its manifest are set up to be put on a home screen', async ({ page, request }) => {
  await page.goto('/login');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Kantahe');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.id).toBe('./');
  expect(manifest.display).toBe('standalone');
});

// kantahe-org.1: below the minimum engine (Chromium 85) the page says so, instead of staying on the logo for ever. The user agent is the one
// of the Android TV WebView 74. The page runs in a current browser, which could start the app, so the app's script files are blocked: what
// is left is what an engine that cannot read them sees, the guard of index.html and the splash.
test('a browser older than Chromium 85 is told so, and a current one is not', async ({ browser }) => {
  const visit = async (userAgent?: string) => {
    const context = await browser.newContext(userAgent ? { userAgent } : {});
    const page = await context.newPage();
    await page.route('**/*.js', (route) => route.abort());
    await page.goto('/login');
    return { page, close: () => context.close() };
  };

  const old = await visit('Mozilla/5.0 (Linux; Android 10; TV Build/QP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.186 Safari/537.36');
  await expect(old.page.locator('#splash-old')).toBeVisible();
  await expect(old.page.locator('#splash-old')).toContainText('Chromium 74');
  await expect(old.page.locator('#splash-old')).toContainText('Chromium 85 or newer');
  await expect(old.page.locator('#splash .splash-logo')).toBeHidden();
  await old.close();

  const current = await visit();
  await expect(current.page.locator('#splash-old')).toBeHidden();
  await expect(current.page.locator('#splash .splash-logo')).toBeVisible();
  await current.close();
});
