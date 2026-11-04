import { expect, test } from '@playwright/test';
import { SERVER_URL } from './ports';

// The footer (kantahe-30z): the copyright and the version of the server on every page of the frame.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

test('every page of the frame ends with the copyright and the version of the server; the player has none', async ({ page, request }) => {
  const call = async <T>(method: string, data: object): Promise<T> => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.${method}`, { data });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  const device = { deviceName: 'Footer', deviceType: 'DEVICE_TYPE_WEB' };
  const info = await call<{ version: string; setupRequired?: boolean }>('AuthService/GetServerInfo', {});
  const { auth } = info.setupRequired
    ? await call<{ auth: { token: string; deviceId: string } }>('AuthService/Setup', { email: ADMIN.email, password: ADMIN.password, displayName: ADMIN.name, ...device })
    : await call<{ auth: { token: string; deviceId: string } }>('AuthService/Login', { email: ADMIN.email, password: ADMIN.password, ...device });
  const text = `© 2020 Andrew Loable · Kantahe ${info.version}`;

  await test.step('signed out: the sign-in page has it', async () => {
    await page.goto('/login');
    await expect(page.getByRole('contentinfo')).toHaveText(text);
  });

  await page.addInitScript((s) => {
    localStorage.setItem('kantahe.token', s.token);
    localStorage.setItem('kantahe.deviceId', s.deviceId);
  }, auth);

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await test.step(`signed in at ${viewport.width}x${viewport.height}: library, queue and Me`, async () => {
      await page.setViewportSize(viewport);
      for (const route of ['/library', '/queue', '/me/help']) {
        await page.goto(route);
        const footer = page.getByRole('contentinfo');
        await expect(footer).toHaveText(text);
        await footer.scrollIntoViewIfNeeded();
        // small, and not under the phone's fixed tab bar
        const box = (await footer.boundingBox())!;
        expect(box.height, `${route} footer height`).toBeLessThan(80);
        const barTop = await page.evaluate(() => {
          const bar = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed');
          return bar ? bar.getBoundingClientRect().top : null;
        });
        if (barTop !== null) expect(box.y + box.height, `${route} footer above the tab bar`).toBeLessThanOrEqual(barTop);
      }
    });
  }

  await test.step('the player page has no frame and no footer', async () => {
    await page.goto('/player');
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
  });
});
