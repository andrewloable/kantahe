import { expect, test } from '@playwright/test';
import { SERVER_URL } from './ports';

// WCAG 2.4.11 Focus Not Obscured (kantahe-tlf.5.4): on a phone the tab bar is fixed to the bottom of the window,
// and a control that gets the keyboard focus must be scrolled clear of it.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

test('tabbing down a long list on a phone never leaves the focus behind the tab bar', async ({ page, request }) => {
  const call = async <T>(method: string, data: object, token?: string): Promise<T> => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.${method}`, { data, headers: token ? { authorization: `Bearer ${token}` } : {} });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  const device = { deviceName: 'Focus not obscured', deviceType: 'DEVICE_TYPE_WEB' };
  const info = await call<{ setupRequired?: boolean }>('AuthService/GetServerInfo', {});
  const { auth } = info.setupRequired
    ? await call<{ auth: { token: string; deviceId: string } }>('AuthService/Setup', { email: ADMIN.email, password: ADMIN.password, displayName: ADMIN.name, ...device })
    : await call<{ auth: { token: string; deviceId: string } }>('AuthService/Login', { email: ADMIN.email, password: ADMIN.password, ...device });
  const { songs } = await call<{ songs: { number: string }[] }>('CatalogService/SearchSongs', { pageSize: 1 }, auth.token);
  const queued: string[] = [];
  for (let i = 0; i < 12; i++) queued.push((await call<{ item: { id: string } }>('SessionService/AddToQueue', { number: songs[0].number }, auth.token)).item.id);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((s) => {
    localStorage.setItem('kantahe.token', s.token);
    localStorage.setItem('kantahe.deviceId', s.deviceId);
  }, auth);
  await page.goto('/queue');
  await expect(page.getByRole('region', { name: 'Coming up' }).getByRole('listitem').nth(9)).toBeVisible();

  let belowFirstScreen = 0;
  const behind: string[] = [];
  try {
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const bar = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed');
        if (!bar || bar.contains(el)) return null;
        const r = el.getBoundingClientRect();
        return { label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), bottom: r.bottom, barTop: bar.getBoundingClientRect().top, scrolled: window.scrollY > 0 };
      });
      if (!f) continue;
      if (f.scrolled) belowFirstScreen++;
      if (f.bottom > f.barTop) behind.push(`${f.label} (bottom ${Math.round(f.bottom)} > bar ${Math.round(f.barTop)})`);
    }
  } finally {
    // the other specs share this server and this user: leave the queue as it was found
    for (const id of queued) await call('SessionService/RemoveFromQueue', { itemId: id }, auth.token);
  }
  expect(belowFirstScreen, 'the list must be long enough to scroll').toBeGreaterThan(0);
  expect(behind).toEqual([]);
});
