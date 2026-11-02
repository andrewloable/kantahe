import { expect, test } from '@playwright/test';
import { SERVER_URL } from './ports';

// Inside the app the buttons are the app's own, drawn over the bottom of /embed/player. The app tells the page how tall they are
// (window.kantahe.setControlsHeight), and the page keeps that much room below its time and progress bar. The unit specs check the
// number; this one checks in a real browser that the style sheet really uses it.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

/** A session for the page: the account is made when the server has none (this file alone), else the administrator signs in. */
async function session(request: import('@playwright/test').APIRequestContext): Promise<{ token: string; deviceId: string }> {
  const call = async (method: string, data: object) => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.AuthService/${method}`, { data });
    expect(res.ok(), `${method} answered ${res.status()}`).toBe(true);
    return res.json();
  };
  const device = { deviceName: 'Embedded page', deviceType: 'DEVICE_TYPE_WEB' };
  const info = await call('GetServerInfo', {});
  const reply = info.setupRequired
    ? await call('Setup', { email: ADMIN.email, password: ADMIN.password, displayName: ADMIN.name, ...device })
    : await call('Login', { email: ADMIN.email, password: ADMIN.password, ...device });
  return { token: reply.auth.token, deviceId: reply.auth.deviceId };
}

test('the embedded player keeps the room the app says its buttons take', async ({ page, request }) => {
  const { token, deviceId } = await session(request);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/embed/player');
  await page.waitForFunction(() => typeof (window as unknown as { kantahe?: { setToken?: unknown } }).kantahe?.setToken === 'function');
  // the token goes in through the bridge, never in the address
  await page.evaluate(([t, d]) => (window as unknown as { kantahe: { setToken(t: string, d: string): void } }).kantahe.setToken(t, d), [token, deviceId]);
  const stage = page.locator('main.stage');
  await expect(stage).toBeVisible();

  const bottom = () => stage.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const setRoom = (px: number) => page.evaluate((n) => (window as unknown as { kantahe: { setControlsHeight(n: number): void } }).kantahe.setControlsHeight(n), px);

  await test.step('without a word from the app one row of buttons is allowed for: 6rem', async () => {
    expect(await bottom()).toBeCloseTo(6 * rem, 0);
  });

  await test.step('with three rows of buttons (300 px) the page keeps 300 px and some air free', async () => {
    await setRoom(300);
    await expect.poll(bottom).toBeGreaterThanOrEqual(300 + 1.5 * rem - 0.5);
  });

  await test.step('a small number never goes below the 6rem of one row', async () => {
    await setRoom(40);
    await expect.poll(bottom).toBeCloseTo(6 * rem, 0);
  });
});
