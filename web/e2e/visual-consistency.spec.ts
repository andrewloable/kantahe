import { expect, test, type Page } from '@playwright/test';
import { SERVER_URL } from './ports';

// The look of the app's controls is one look (kantahe-tlf.5.6, 5.7): what a page shows is read from the browser's computed styles.

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

async function signIn(page: Page, request: import('@playwright/test').APIRequestContext): Promise<void> {
  const call = async <T>(method: string, data: object): Promise<T> => {
    const res = await request.post(`${SERVER_URL}/kantahe.v1.${method}`, { data });
    expect(res.ok(), `${method}: ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  const device = { deviceName: 'Visual consistency', deviceType: 'DEVICE_TYPE_WEB' };
  const info = await call<{ setupRequired?: boolean }>('AuthService/GetServerInfo', {});
  const { auth } = info.setupRequired
    ? await call<{ auth: { token: string; deviceId: string } }>('AuthService/Setup', { email: ADMIN.email, password: ADMIN.password, displayName: ADMIN.name, ...device })
    : await call<{ auth: { token: string; deviceId: string } }>('AuthService/Login', { email: ADMIN.email, password: ADMIN.password, ...device });
  await page.addInitScript((s) => {
    localStorage.setItem('kantahe.token', s.token);
    localStorage.setItem('kantahe.deviceId', s.deviceId);
  }, auth);
}

for (const [route, nav] of [
  ['/me/favourites', 'My account'],
  ['/admin/songs', 'Administration'],
] as const) {
  test(`the ${nav} menu is made of tabs: no underline, the current one filled`, async ({ page, request }) => {
    await signIn(page, request);
    await page.goto(route);
    const links = page.getByRole('navigation', { name: nav }).getByRole('link');
    await expect(links.first()).toBeVisible();
    const looks = await links.evaluateAll((els) =>
      els.map((a) => {
        const s = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        return { underline: s.textDecorationLine, background: s.backgroundColor, current: a.getAttribute('aria-current') === 'page', width: r.width, height: r.height };
      }),
    );
    expect(looks.length).toBeGreaterThan(3);
    expect(looks.filter((l) => l.underline !== 'none')).toEqual([]);
    expect(looks.filter((l) => l.current).map((l) => l.background !== 'rgba(0, 0, 0, 0)')).toEqual([true]);
    expect(looks.filter((l) => !l.current && l.background !== 'rgba(0, 0, 0, 0)')).toEqual([]);
    expect(looks.filter((l) => l.width < 44 || l.height < 44)).toEqual([]); // a 44 px target each
  });
}

// kantahe-tlf.5.7: a dropdown is outlined and rounded like a text box; a checkbox is drawn by the app (a 24 px box) and keeps its 44 px target.
test('dropdowns look like text boxes and checkboxes are drawn in the app colours', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/admin/songs');
  await expect(page.locator('#select-page')).toBeVisible();
  const box = (sel: string) =>
    page.locator(sel).evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderTopWidth, radius: s.borderTopLeftRadius, color: s.borderTopColor, background: s.backgroundColor };
    });
  const search = await box('input#admin-search');
  const format = await box('select#filter-format');
  expect(format).toMatchObject({ width: search.width, radius: search.radius, color: search.color });

  const tick = await page.locator('#select-page').evaluate((el) => {
    const s = getComputedStyle(el);
    const before = getComputedStyle(el, '::before');
    return { appearance: s.appearance, target: el.getBoundingClientRect().width, drawn: before.width, border: before.borderTopWidth };
  });
  expect(tick).toEqual({ appearance: 'none', target: 44, drawn: '24px', border: '2px' });
});

// kantahe-0m9: Approve a TV is a page of Me, like Change password: the Me menu is around it, so there is always a way out
test('Approve a TV sits inside the Me menu, and the address the TV shows (/code) leads there', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/code');
  await expect(page).toHaveURL(/\/me\/approve-tv$/);
  const menu = page.getByRole('navigation', { name: 'My account' });
  await expect(menu.getByRole('link', { name: 'Approve a TV' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Approve a TV' })).toBeVisible();
  await menu.getByRole('link', { name: 'Devices' }).click(); // the way out
  await expect(page).toHaveURL(/\/me\/devices$/);
});
