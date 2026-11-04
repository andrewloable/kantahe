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
