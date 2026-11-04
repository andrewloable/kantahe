import { expect, test } from '@playwright/test';
import { SERVER_URL } from './ports';

// Play next (kantahe-tlf.4.3): from the More menu of a song, the song goes right after the current one, ahead of what was queued.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

test('Play next puts the song at the head of Coming up', async ({ page, request }) => {
  const call = async <T>(method: string, data: object, token?: string): Promise<T> => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.${method}`, { data, headers: token ? { authorization: `Bearer ${token}` } : {} });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  const device = { deviceName: 'Play next', deviceType: 'DEVICE_TYPE_WEB' };
  const info = await call<{ setupRequired?: boolean }>('AuthService/GetServerInfo', {});
  const { auth } = info.setupRequired
    ? await call<{ auth: { token: string; deviceId: string } }>('AuthService/Setup', { email: ADMIN.email, password: ADMIN.password, displayName: ADMIN.name, ...device })
    : await call<{ auth: { token: string; deviceId: string } }>('AuthService/Login', { email: ADMIN.email, password: ADMIN.password, ...device });
  const { songs } = await call<{ songs: { number: string; title: string }[] }>('CatalogService/SearchSongs', { pageSize: 10 }, auth.token);
  // three songs waiting, so that "next" differs from "last"
  for (const s of songs.slice(0, 3)) await call('SessionService/AddToQueue', { number: s.number }, auth.token);
  const target = songs[4];

  await page.addInitScript((s) => {
    localStorage.setItem('kantahe.token', s.token);
    localStorage.setItem('kantahe.deviceId', s.deviceId);
  }, auth);
  await page.goto('/library');
  const row = page.locator('li.row').filter({ has: page.locator('.num', { hasText: target.number }) });
  await row.getByRole('button', { name: `More actions for ${target.title}` }).click();
  await page.getByRole('menuitem', { name: 'Play next' }).click();
  await expect(page.getByText(`${target.title} plays next`)).toBeVisible();

  await page.goto('/queue');
  const comingUp = page.getByRole('region', { name: 'Coming up' }).getByRole('listitem');
  // earlier specs may have left songs in the queue: ours are at least four, and the one played next leads
  await expect(comingUp.first().locator('.title')).toHaveText(target.title);
  expect(await comingUp.count()).toBeGreaterThanOrEqual(4);
});
