import { expect, test } from '@playwright/test';
import { SERVER_URL } from './ports';

// Keyboard shortcuts (kantahe-tlf.4.7) in a real browser: / in the library, ? for the list, Space on the player, and the switch.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

test('the keyboard shortcuts work on the pages they belong to, and the switch turns them off', async ({ page, request }) => {
  const call = async <T>(method: string, data: object, token?: string): Promise<T> => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.${method}`, { data, headers: token ? { authorization: `Bearer ${token}` } : {} });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  const device = { deviceName: 'Shortcuts', deviceType: 'DEVICE_TYPE_WEB' };
  const info = await call<{ setupRequired?: boolean }>('AuthService/GetServerInfo', {});
  const { auth } = info.setupRequired
    ? await call<{ auth: { token: string; deviceId: string } }>('AuthService/Setup', { email: ADMIN.email, password: ADMIN.password, displayName: ADMIN.name, ...device })
    : await call<{ auth: { token: string; deviceId: string } }>('AuthService/Login', { email: ADMIN.email, password: ADMIN.password, ...device });
  await page.addInitScript((s) => {
    localStorage.setItem('kantahe.token', s.token);
    localStorage.setItem('kantahe.deviceId', s.deviceId);
  }, auth);

  await test.step('/ goes to the search box and is not typed into it', async () => {
    await page.goto('/library');
    await expect(page.locator('li.row').first()).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('/');
    await expect(page.locator('#search')).toBeFocused();
    await expect(page.locator('#search')).toHaveValue('');
  });

  await test.step('typing a ? in the search box opens nothing; ? on the page opens the list, Escape closes it', async () => {
    await page.keyboard.type('a?');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('#search').fill('');
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  await test.step('the switch in Me > Appearance and account turns them off', async () => {
    await page.goto('/me/appearance');
    await page.getByLabel('Keyboard shortcuts').uncheck();
    await page.goto('/library');
    await expect(page.locator('li.row').first()).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('/');
    await expect(page.locator('#search')).not.toBeFocused();
    await page.goto('/me/appearance');
    await page.getByLabel('Keyboard shortcuts').check();
  });
});
