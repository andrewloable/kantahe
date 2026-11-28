import { Browser, expect, Page, test, TestInfo } from '@playwright/test';
import { Check, patternOf, Raw } from './checks';
import { pick, Theme, VIEWPORTS } from './matrix';
import { contextOptions, openState, rawFindings } from './open-state';
import { RouteState, states } from './routes';

// Layout tests of single bugs. A test opens one state of the audit (web/e2e/responsive/routes.ts) at one viewport and looks at the findings of the
// audit's checks, so a bug's test is a few lines. Name a test "<route> <state>: <what> at <viewport>"; it must fail on the code that had the bug.

/** Opens "route:state" at the named viewport (as the audit does), runs `look` on the page and its findings, and closes the browser context. */
export async function layout<T>(
  browser: Browser,
  info: TestInfo,
  id: string,
  viewportName: string,
  look: (raw: Raw[], page: Page) => Promise<T> | T,
  theme: Theme = 'light',
  /** Replaces steps of the state, e.g. an "after" that only waits, so that the test does the action itself and measures around it. */
  override: Partial<RouteState> = {},
): Promise<T> {
  const found = states(true).find((s) => `${s.route}:${s.state}` === id);
  if (!found) throw new Error(`No route state "${id}"`);
  const state = { ...found, ...override };
  const [viewport] = pick(VIEWPORTS, viewportName);
  const context = await browser.newContext(contextOptions(viewport, theme));
  try {
    const page = await context.newPage();
    const opened = await openState(page, context, state, viewport, theme, info.parallelIndex);
    if (opened.unreachable.length > 0) throw new Error(`The state ${id} could not be reached: ${opened.unreachable[0].text}`);
    return await look(await rawFindings(page), page);
  } finally {
    await context.close();
  }
}

/** The findings of one check whose selector (or its pattern, without ":nth-of-type(n)") contains a part. */
export const where = (raw: Raw[], check: Check, selectorPart = ''): Raw[] =>
  raw.filter((r) => r.check === check && (r.selector.includes(selectorPart) || patternOf(r.selector).includes(selectorPart))); // the part may leave out the positions among siblings

/** Fails with the selectors and the details of what was found, so that the message says what is wrong. */
export const none = (raw: Raw[], check: Check, selectorPart = ''): void =>
  expect(where(raw, check, selectorPart).map((r) => `${r.check}: ${r.selector} (${r.detail ?? r.text})`), `findings of ${check}${selectorPart ? ' in ' + selectorPart : ''}`).toEqual([]);

test('/login empty: the sign-in page has no horizontal overflow at phone-320x568', async ({ browser }, info) => {
  none(await layout(browser, info, '/login:empty', 'phone-320x568', (r) => r), 'horizontalOverflow');
});

// the control of the helper: the same page is too wide for a phone and fits a desktop, so the viewport really is the one asked for
test('/selftest wide-table: the page of the audit itself is wider than the window at phone-390x844 and fits at desktop-1280x800', async ({ browser }, info) => {
  expect(where(await layout(browser, info, '/selftest:wide-table', 'phone-390x844', (r) => r), 'horizontalOverflow')).toHaveLength(1);
  expect(where(await layout(browser, info, '/selftest:wide-table', 'desktop-1280x800', (r) => r), 'horizontalOverflow')).toEqual([]);
});

// kantahe-dk8.11: the top bar (brand, theme select, Sign out)
test('/library many: the top bar fits inside the window at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-320x568', async (raw) => {
    none(raw, 'horizontalOverflow');
    none(raw, 'outsideViewport', 'div.top');
  });
});

test('/library many: the Sign out button of the top bar is one line high at phone-landscape-667x375', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-landscape-667x375', async (_raw, page) => {
    const signOut = await page.locator('button.signout').boundingBox();
    const select = await page.locator('select.theme').boundingBox();
    expect(signOut!.height, 'the Sign out button is one line high').toBeLessThanOrEqual(select!.height + 2);
  });
});

// kantahe-tlf.2.3: on a phone the theme and Sign out are under Me > Appearance; the header keeps the brand
test('/library many: the top bar has no theme select and no Sign out once signed in at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-390x844', async (_raw, page) => {
    await expect(page.locator('select.theme')).toBeHidden();
    await expect(page.locator('button.signout')).toBeHidden();
  });
});

test('/library many: the top bar keeps the theme select and Sign out at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'desktop-1280x800', async (_raw, page) => {
    await expect(page.locator('select.theme')).toBeVisible();
    await expect(page.locator('button.signout')).toBeVisible();
  });
});

test('/queue many: the page is not wider than the window at phone-390x844-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/queue:many', 'phone-390x844-zoom200', (r) => r), 'horizontalOverflow');
});

test('/library many: no two controls of the top bar are closer than 8 px at phone-320x568', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/library:many', 'phone-320x568', (r) => r);
  none(raw, 'tightTargets', 'div.top');
  none(raw, 'tightTargets', 'div.tools');
});

// kantahe-dk8.35: the library tabs and the number pad at 200% text
test('/library number-pad: the tabs are inside the window at phone-390x844-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:number-pad', 'phone-390x844-zoom200', (r) => r), 'outsideViewport', 'tab-');
});

test('/library number-pad: the keys are inside the window at phone-390x844-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:number-pad', 'phone-390x844-zoom200', (r) => r), 'outsideViewport', 'app-number-pad');
});

test('/library number-pad: the page is not wider than the window at phone-390x844-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:number-pad', 'phone-390x844-zoom200', (r) => r), 'horizontalOverflow');
});

// kantahe-dk8.15: the player with a long title on small windows
test('/player playing: the lyrics are not cut off and are at least 100 px high at phone-landscape-915x412', async ({ browser }, info) => {
  await layout(browser, info, '/player:playing', 'phone-landscape-915x412', async (raw, page) => {
    none(raw, 'clippedText', 'lyrics');
    expect((await page.locator('app-lyrics-view').boundingBox())!.height).toBeGreaterThanOrEqual(100);
  });
});

test('/player playing: the lyrics are not cut off at phone-320x568', async ({ browser }, info) => {
  none(await layout(browser, info, '/player:playing', 'phone-320x568', (r) => r), 'clippedText', 'lyrics');
});

test('/player playing: the stage is not cut off at phone-landscape-568x320 (it scrolls)', async ({ browser }, info) => {
  none(await layout(browser, info, '/player:playing', 'phone-landscape-568x320', (r) => r), 'clippedText', 'main.stage');
});

test('/player playing: the controls start inside the window at phone-390x844-zoom200', async ({ browser }, info) => {
  await layout(browser, info, '/player:playing', 'phone-390x844-zoom200', async (_raw, page) => {
    for (const button of await page.locator('.controls button').all()) {
      const box = (await button.boundingBox())!;
      expect(box.x, 'left edge of a control').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, 'right edge of a control').toBeLessThanOrEqual(390);
    }
  });
});

// kantahe-dk8.13: the menus
test('/admin/users many: every link of the main menu is fully inside the window at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:many', 'phone-320x568', async (_raw, page) => {
    const nav = page.locator('nav[aria-label="Main"]');
    expect(await nav.evaluate((el) => el.scrollWidth - el.clientWidth), 'the menu scrolls sideways').toBeLessThanOrEqual(0);
    for (const link of await nav.locator('a').all()) {
      const box = (await link.boundingBox())!;
      expect(box.x, `left edge of ${await link.innerText()}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `right edge of ${await link.innerText()}`).toBeLessThanOrEqual(320);
    }
  });
});

for (const viewport of ['phone-320x568', 'phone-390x844']) {
  test(`/me/devices list: no two links of the menus are closer than 8 px at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/me/devices:list', viewport, (r) => r), 'tightTargets', 'nav');
  });
}

test('/library many: tabs and chips are 8 px apart at phone-390x844', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/library:many', 'phone-390x844', (r) => r);
  none(raw, 'tightTargets', 'tab-');
  none(raw, 'tightTargets', '.chips');
});

// kantahe-dk8.29: stand-alone links
test('/me/playlists/:id many: the way back is at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/playlists/:id:many', 'phone-390x844', (r) => r), 'smallTargets', 'app-playlist-detail > p > a');
});

test('/queue many: Manage devices is at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/queue:many', 'phone-390x844', (r) => r), 'smallTargets', 'p.manage');
});

test('/me/playlists many: the playlist names are at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/playlists:many', 'phone-390x844', (r) => r), 'smallTargets', 'li.playlist > a');
});

// the name link of a playlist may not be squeezed to a few pixels by the count and the buttons (a first version of the fix did that at 320 px)
test('/me/playlists many: a playlist name is at least 100 px wide at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/me/playlists:many', 'phone-320x568', async (_raw, page) => {
    for (const link of await page.locator('li.playlist > a').all()) expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(100);
  });
});

// kantahe-dk8.27: form controls
test('/admin/songs many: the search box is at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/songs:many', 'phone-390x844', (r) => r), 'smallTargets', '#admin-search');
});

test('/admin/upload empty: the file picker is at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/upload:empty', 'phone-390x844', (r) => r), 'smallTargets', '#upload-files');
});

test('/me/settings form: each radio counts at least 44 px with its label at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/settings:form', 'phone-390x844', (r) => r), 'smallTargets', 'fieldset');
});

test('/me/devices list: the MIDI mode select is at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/devices:list', 'phone-390x844', (r) => r), 'smallTargets', 'select');
});

test('/admin/users new-user: the checkbox of the new user counts at least 44 px with its label at phone-390x844', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/admin/users:new-user', 'phone-390x844', (r) => r);
  none(raw, 'smallTargets', '#new-admin');
});

// kantahe-dk8.23: the song row
test('/library many: the title column of a row is at least 120 px wide at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-320x568', async (_raw, page) => {
    for (const info of await page.locator('li.row .info').all()) expect((await info.boundingBox())!.width).toBeGreaterThanOrEqual(120);
  });
});

for (const viewport of ['phone-320x568', 'phone-390x844']) {
  test(`/library many: star, plus and add are at least 8 px apart at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/library:many', viewport, (r) => r), 'tightTargets', 'li.row');
  });
}

// kantahe-dk8.31: toasts
test('/library toast: the Dismiss button is at least 44 x 44 at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:toast', 'phone-390x844', (r) => r), 'smallTargets', 'app-toasts');
});

test('/library toast: the toast is not wider than the window at phone-390x844-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:toast', 'phone-390x844-zoom200', (r) => r), 'outsideViewport', 'app-toasts');
});

// kantahe-dk8.17: the Admin > Songs table and its dialog
for (const viewport of ['phone-320x568', 'phone-390x844', 'phone-430x932', 'phone-landscape-568x320', 'phone-landscape-667x375']) {
  test(`/admin/songs many: the page is not wider than the window at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/admin/songs:many', viewport, (r) => r), 'horizontalOverflow');
  });
}

test('/admin/songs empty: no horizontal overflow at phone-320x568', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/songs:empty', 'phone-320x568', (r) => r), 'horizontalOverflow');
});

test('/admin/songs delete-question: the page is not wider than the window at phone-landscape-667x375', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/songs:delete-question', 'phone-landscape-667x375', (r) => r), 'horizontalOverflow');
});

for (const viewport of ['phone-320x568', 'phone-landscape-568x320']) {
  test(`/admin/songs edit-dialog: the dialog is fully inside the window at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/admin/songs:edit-dialog', viewport, async (_raw, page) => {
      const [v] = pick(VIEWPORTS, viewport);
      const box = (await page.getByRole('dialog').boundingBox())!;
      expect(box.x, 'left').toBeGreaterThanOrEqual(0);
      expect(box.y, 'top').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, 'right').toBeLessThanOrEqual(v.width);
      expect(box.y + box.height, 'bottom').toBeLessThanOrEqual(v.height);
    });
  });
}

test('/admin/songs many: Edit and Delete are at least 44 px high and 8 px apart at phone-390x844', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/admin/songs:many', 'phone-390x844', (r) => r);
  none(raw, 'smallTargets', 'actions');
  none(raw, 'tightTargets', 'actions');
});

// kantahe-dk8.19: the Admin > Users table
test('/admin/users many: nothing is cut off by a sideways scroller at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:many', 'phone-390x844', async (_raw, page) => {
    const host = page.locator('app-users-page');
    expect(await host.evaluate((el) => el.scrollWidth - el.clientWidth), 'the table scrolls inside its box').toBeLessThanOrEqual(0);
    for (const button of await page.locator('.actions button').all()) expect((await button.boundingBox())!.x + (await button.boundingBox())!.width).toBeLessThanOrEqual(390);
  });
});

// kantahe-qzr.1: the role checkboxes became the More menu; its button is a 44 px target like every other
test('/admin/users many: the More buttons are at least 44 px at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/users:many', 'phone-390x844', (r) => r), 'smallTargets', 'tbody');
});

test('/admin/users delete-question: the question and its buttons are inside the window at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:delete-question', 'phone-320x568', async (_raw, page) => {
    for (const part of await page.locator('.actions').locator('button, input, label').all()) {
      const box = await part.boundingBox();
      if (!box) continue;
      expect(box.x, 'left edge').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, 'right edge').toBeLessThanOrEqual(320);
    }
  });
});

// kantahe-dk8.21: queue and playlist rows
test('/me/playlists/:id many: the page is not wider than the window at phone-320x568', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/playlists/:id:many', 'phone-320x568', (r) => r), 'horizontalOverflow');
});

test('/me/playlists/:id many: the format badge does not overlap the title at phone-landscape-667x375', async ({ browser }, info) => {
  await layout(browser, info, '/me/playlists/:id:many', 'phone-landscape-667x375', async (_raw, page) => {
    for (const row of await page.locator('li.entry').all()) {
      const title = (await row.locator('.title').boundingBox())!;
      const badge = (await row.locator('app-format-badge').boundingBox())!;
      const overlap = Math.min(title.x + title.width, badge.x + badge.width) - Math.max(title.x, badge.x) > 1 && Math.min(title.y + title.height, badge.y + badge.height) - Math.max(title.y, badge.y) > 1;
      expect(overlap, `the badge overlaps the title of "${await row.locator('.title').innerText()}"`).toBe(false);
      // an unbroken word wider than its box runs under the badge without the boxes touching: the text must stay inside its box
      expect(await row.locator('.title').evaluate((el) => el.scrollWidth - el.clientWidth), 'the title is wider than its box').toBeLessThanOrEqual(1);
    }
  });
});

test('/queue many: the buttons of a row are in one line at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'phone-390x844', async (_raw, page) => {
    for (const row of await page.locator('.queue li').all()) {
      const tops = await Promise.all((await row.locator('button').all()).map(async (b) => (await b.boundingBox())!.y));
      expect(Math.max(...tops) - Math.min(...tops), 'the buttons of one row start at different heights').toBeLessThanOrEqual(2);
    }
  });
});

// kantahe-dk8.42: the list of playlists
test('/me/playlists many: a playlist name is at least 200 px wide at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/me/playlists:many', 'phone-320x568', async (_raw, page) => {
    for (const link of await page.locator('li.playlist > a').all()) expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(200);
  });
});

test('/me/playlists rename: the rename field and its buttons are inside the window at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/me/playlists:rename', 'phone-320x568', async (_raw, page) => {
    for (const part of await page.locator('li.playlist .edit').locator('input, button').all()) {
      const box = (await part.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
  });
});

// kantahe-dk8.47: the now-playing card of the queue
test('/queue one-long: the title of the now-playing card is at most two lines high at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/queue:one-long', 'phone-320x568', async (_raw, page) => {
    const h2 = page.locator('app-now-playing h2');
    const { height, line } = await h2.evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2 }));
    expect(height, 'height of the title in lines').toBeLessThanOrEqual(line * 2.2);
  });
});

// kantahe-du1.7: the head of the queue is no longer repeated in an Up next line (the list right below shows it); its long title is clamped there
test('/queue one-long: the long song at the head of the queue is two lines at most in its row at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/queue:one-long', 'phone-320x568', async (_raw, page) => {
    await expect(page.locator('.up-next')).toHaveCount(0);
    const { height, line } = await page
      .locator('.queue li .title')
      .first()
      .evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) || 24 }));
    expect(height, 'height of the title').toBeLessThanOrEqual(line * 2.2);
  });
});

// kantahe-dk8.44: the upload results
test('/admin/upload results: the details of a result are at least 200 px wide at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/admin/upload:results', 'phone-320x568', async (_raw, page) => {
    const rejected = page.locator('tbody tr').filter({ hasText: 'Rejected' });
    expect((await rejected.locator('td').nth(2).boundingBox())!.width).toBeGreaterThanOrEqual(200);
  });
});

// kantahe-du1.7: one line per queue row, the More button beside the song (it was a line of buttons below the title)
test('/queue many: the More button is on the line of the title at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'phone-320x568', async (_raw, page) => {
    for (const row of (await page.locator('.queue li').all()).slice(0, 10)) {
      const text = (await row.locator('.info').boundingBox())!;
      const more = (await row.locator('button.more').boundingBox())!;
      expect(more.y, 'top of the More button').toBeLessThan(text.y + text.height);
    }
  });
});

test('/me/playlists many: the count and the buttons are below the name at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/me/playlists:many', 'phone-320x568', async (_raw, page) => {
    for (const row of await page.locator('li.playlist').all()) {
      const name = (await row.locator('a').boundingBox())!;
      const count = (await row.locator('.count').boundingBox())!;
      expect(count.y, 'top of the count').toBeGreaterThanOrEqual(name.y + name.height - 1);
    }
  });
});

test('/me/playlists/:id many: the row buttons are inside the window at phone-390x844-zoom200', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/me/playlists/:id:many', 'phone-390x844-zoom200', (r) => r);
  none(raw, 'outsideViewport', 'row-actions');
  none(raw, 'horizontalOverflow');
});

test('/queue many: the row buttons are inside the window at phone-390x844-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/queue:many', 'phone-390x844-zoom200', (r) => r), 'outsideViewport', 'app-action-menu');
});

// kantahe-dk8.38: a failed search is not an empty search
test('/library error: the no-result message is not shown next to the error at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:error', 'phone-390x844', async (_raw, page) => {
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.locator('.no-match')).toHaveCount(0);
  });
});

// kantahe-cqc.9: the message names the search and offers Clear search
test('/library empty: a search without result says so, with Clear search, at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:empty', 'phone-390x844', async (raw, page) => {
    await expect(page.getByText('No songs match "zzzzqqqq".')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible();
    none(raw, 'tightTargets', '.no-match');
  });
});

// kantahe-dk8.40: failed loads are shown on the page, with a way to try again
for (const id of ['/me/devices:error', '/me/playlists:error']) {
  test(`${id.replace(':', ' ')}: the page shows an inline error with a Try again button at phone-390x844`, async ({ browser }, info) => {
    await layout(browser, info, id, 'phone-390x844', async (_raw, page) => {
      await expect(page.getByRole('alert').filter({ hasText: 'Try again' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    });
  });
}

test('/queue error: the page says that it could not connect at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/queue:error', 'phone-390x844', async (_raw, page) => {
    await expect(page.getByText('Could not reach the server')).toBeVisible({ timeout: 12_000 });
  });
});

// kantahe-dk8.33: one frame for the menu, the now bar and the pages
for (const viewport of ['phone-landscape-915x412', 'desktop-1920x1080']) {
  for (const id of ['/library:many', '/queue:many', '/me/devices:list', '/admin/songs:many']) {
    test(`${id.replace(':', ' ')}: brand, menu, now bar and page heading share the left edge at ${viewport}`, async ({ browser }, info) => {
      await layout(browser, info, id, viewport, async (_raw, page) => {
        const left = async (selector: string) => (await page.locator(selector).first().boundingBox())?.x;
        const edges = {
          brand: await left('a.brand'),
          menu: await left('nav[aria-label="Main"] a'),
          nowbar: (await page.locator('aside.nowbar').count()) > 0 ? await left('aside.nowbar') : undefined,
          heading: await left('main h1'),
        };
        const present = Object.entries(edges).filter(([, x]) => x !== undefined) as [string, number][];
        const first = present[0][1];
        for (const [name, x] of present) expect(Math.abs(x - first), `left edge of the ${name} against the brand (${JSON.stringify(edges)})`).toBeLessThanOrEqual(2);
      });
    });
  }
}

// kantahe-dk8.53: the admin tables on a tablet
test('/admin/songs many: the songs are a table at tablet-768x1024', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'tablet-768x1024', async (_raw, page) => {
    expect(await page.locator('table').evaluate((el) => getComputedStyle(el).display)).toBe('table');
  });
});

test('/admin/users many: the users are a table at tablet-768x1024', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:many', 'tablet-768x1024', async (_raw, page) => {
    expect(await page.locator('table').evaluate((el) => getComputedStyle(el).display)).toBe('table');
  });
});

test('/admin/songs delete-question: the page is not wider than the window at tablet-744x1133', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/songs:delete-question', 'tablet-744x1133', (r) => r), 'horizontalOverflow');
});

// REGRESSION (CI, Linux): a wide font (DejaVu Sans there, Verdana here) made the table 797 px wide in a 744 px window, because a long word in a
// title kept its column wide. The other tests above pass with the narrower fonts of a Mac.
for (const state of ['/admin/songs:many', '/admin/songs:long-text', '/admin/songs:delete-question']) {
  test(`${state}: the page is not wider than the window with a wide font at tablet-744x1133`, async ({ browser }, info) => {
    await layout(browser, info, state, 'tablet-744x1133', async (_raw, page) => {
      await page.addStyleTag({ content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important; }' });
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, 'scrollWidth').toBeLessThanOrEqual(744);
    });
  });
}

// the blocks come sooner with a larger text size: a table that needs 44rem no longer fits (the case a media query in rem cannot see)
test('/admin/songs many: the page is not wider than the window at tablet-768x1024-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/songs:many', 'tablet-768x1024-zoom200', (r) => r), 'horizontalOverflow');
});

// kantahe-dk8.55: the now-playing card on a tablet
test('/queue many: the now-playing card and the list share the left edge at tablet-768x1024', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'tablet-768x1024', async (_raw, page) => {
    const card = (await page.locator('section.now').boundingBox())!;
    const list = (await page.getByRole('heading', { name: 'Coming up' }).boundingBox())!;
    expect(Math.abs(card.x - list.x), 'left of the card against the left of the list').toBeLessThanOrEqual(2);
  });
});

// kantahe-dk8.57: the list pages are a reading column (owner decision: option A, 48rem, left aligned in the frame); the Queue is two columns
// on a wide window since kantahe-cqc.5 (owner decision 2026-11-28)
for (const id of ['/library:many', '/me/favourites:many']) {
  test(`${id.replace(':', ' ')}: the page is at most 48rem wide at desktop-1920x1080`, async ({ browser }, info) => {
    await layout(browser, info, id, 'desktop-1920x1080', async (_raw, page) => {
      const main = (await page.locator('main#main').locator('.library, .queue-page, .me').first().boundingBox())!;
      expect(main.width, 'width of the page column').toBeLessThanOrEqual(768);
    });
  });
}

// kantahe-du1.1: a toast floats above the page and moves nothing (owner decision 2026-11-28; replaces kantahe-dk8.59, toasts in the page flow)
const rowsOnly: Partial<RouteState> = { after: ({ page }) => expect(page.locator('li.row').nth(12)).toBeVisible() };
const rowTops = (page: Page, from: number, to: number) =>
  page.locator('li.row').evaluateAll((rows, [a, b]) => rows.slice(a, b).map((r) => Math.round(r.getBoundingClientRect().top)), [from, to]);
const pageHeight = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight);
async function addSong(page: Page, row: number): Promise<void> {
  await page.locator('li.row').nth(row).locator('button.main').click();
  await expect(page.getByText(/^Added /).first()).toBeVisible();
  await page.waitForTimeout(400); // the toast's own entrance has ended
}

for (const viewport of ['phone-390x844', 'desktop-1280x800']) {
  test(`/library toast: no row moves when a song is added at the top of the page at ${viewport}`, async ({ browser }, info) => {
    await layout(
      browser,
      info,
      '/library:toast',
      viewport,
      async (_raw, page) => {
        const before = await rowTops(page, 1, 4);
        const height = await pageHeight(page);
        await addSong(page, 0);
        expect(await rowTops(page, 1, 4), 'tops of rows 2 to 4').toEqual(before);
        expect(await pageHeight(page), 'height of the page').toBe(height);
      },
      'light',
      rowsOnly,
    );
  });
}

test('/library toast: no row moves on a scrolled page without scroll anchoring (Safari has none) at phone-390x844', async ({ browser }, info) => {
  await layout(
    browser,
    info,
    '/library:toast',
    'phone-390x844',
    async (_raw, page) => {
      await page.addStyleTag({ content: '* { overflow-anchor: none !important; }' });
      await page.locator('li.row').nth(6).scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 200));
      await page.waitForTimeout(200);
      const before = await rowTops(page, 7, 9);
      await addSong(page, 6);
      expect(await rowTops(page, 7, 9), 'tops of rows 8 and 9').toEqual(before);
    },
    'light',
    rowsOnly,
  );
});

test('/library toast: the toast floats above the tab bar at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:toast', 'phone-390x844', async (_raw, page) => {
    const toast = page.locator('.toast').first();
    expect(await toast.evaluate((t) => getComputedStyle(t.parentElement!).position)).toBe('fixed');
    const t = (await toast.boundingBox())!;
    const bar = (await page.locator('nav[aria-label="Main"]').boundingBox())!;
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.y + t.height, 'bottom of the toast against the top of the tab bar').toBeLessThanOrEqual(bar.y);
  });
});

test('/library toast: the toast is at the bottom centre at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/library:toast', 'desktop-1280x800', async (_raw, page) => {
    const toast = page.locator('.toast').first();
    expect(await toast.evaluate((t) => getComputedStyle(t.parentElement!).position)).toBe('fixed');
    const t = (await toast.boundingBox())!;
    expect(Math.abs(t.x + t.width / 2 - 640), 'distance of the toast centre from the window centre').toBeLessThanOrEqual(2);
    expect(800 - (t.y + t.height), 'gap under the toast').toBeLessThanOrEqual(24);
  });
});

test('/player playing: a toast moves nothing on the stage at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/player:playing', 'phone-390x844', async (_raw, page) => {
    await page.route('**/kantahe.v1.SessionService/Control', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"internal","message":"no"}' }));
    await page.mouse.move(10, 10);
    const tops = () => page.evaluate(() => ['app-lyrics-view', '.controls'].map((s) => Math.round(document.querySelector(s)?.getBoundingClientRect().top ?? -1)));
    const before = await tops();
    await page.getByRole('button', { name: 'Skip' }).click(); // a refused command shows a toast
    await expect(page.locator('.toast').first()).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(400);
    expect(await tops(), 'tops of the lyrics and the controls').toEqual(before);
  });
});

// kantahe-du1.5: while typing a search on a phone, results show above the on-screen keyboard. Chromium has no keyboard: the visible part of the
// window is its height minus the keyboard's (iPhone 390x844: 336 px with the suggestion bar; Android 360x640: 290; 375x667: 300).
const keyboardRows = (page: Page, keyboard: number) =>
  page.evaluate((k) => [...document.querySelectorAll('li.row')].filter((r) => r.getBoundingClientRect().top >= 0 && r.getBoundingClientRect().bottom <= innerHeight - k).length, keyboard);
async function typeSearch(page: Page, text: string): Promise<void> {
  await page.locator('#search').click();
  await page.locator('#search').pressSequentially(text, { delay: 20 });
  await expect(page.locator('li.row').first()).toBeVisible();
  await page.waitForTimeout(600); // the search delay (250 ms), the answer, and the scroll
}
for (const [viewport, keyboard, rows] of [
  ['phone-390x844', 336, 4],
  ['phone-375x667', 300, 2],
  ['phone-360x640', 290, 2],
  // the smallest phone: two-line rows (the title keeps 120 px), so one result shows above the keyboard (kantahe-du1.19)
  ['phone-320x568', 227, 1],
  // kantahe-du1.6 review: a phone on its side is wider than 40rem but the keyboard takes half of its height
  ['phone-landscape-844x390', 200, 1],
  ['phone-landscape-667x375', 200, 1],
  // review kantahe-du1.15: found once the audit stopped counting menu links as results
  ['phone-landscape-568x320', 176, 1],
  ['phone-390x844-zoom200', 338, 1],
] as const) {
  test(`/library many: search results show above the keyboard at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/library:many', viewport, async (_raw, page) => {
      await typeSearch(page, 'Title 1');
      expect(await keyboardRows(page, keyboard), `rows above a keyboard of ${keyboard} px`).toBeGreaterThanOrEqual(rows);
    });
  });
}

test('/library many: the search field stays at the top while the results scroll at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-390x844', async (_raw, page) => {
    await typeSearch(page, 'Title 1');
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(200);
    const top = await page.locator('#search').evaluate((e) => e.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(60);
  });
});

test('/library many: focusing the search does not scroll at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'desktop-1280x800', async (_raw, page) => {
    await typeSearch(page, 'Title 1');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

// kantahe-du1.7: the Queue page shows queued songs on the first screen (it showed none on a phone, one on a desktop)
const queueRowsOnFirstScreen = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Main"]');
    const barTop = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().top : innerHeight;
    return [...document.querySelectorAll('.queue li')].filter((r) => r.getBoundingClientRect().top >= 0 && r.getBoundingClientRect().bottom <= barTop).length;
  });
for (const [viewport, rows] of [
  ['phone-390x844', 3],
  ['desktop-1280x800', 4],
] as const) {
  test(`/queue many: queued songs show on the first screen at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/queue:many', viewport, async (_raw, page) => {
      expect(await queueRowsOnFirstScreen(page), 'queue rows on the first screen').toBeGreaterThanOrEqual(rows);
    });
  });
}

test('/queue many: a queue row is one line at phone-360x640', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'phone-360x640', async (_raw, page) => {
    expect((await page.locator('.queue li').first().boundingBox())!.height).toBeLessThanOrEqual(72);
  });
});

for (const viewport of ['phone-320x568', 'phone-360x640']) {
  test(`/queue many: the volume and tempo panel opens and fits at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/queue:many', viewport, async (_raw, page) => {
      const toggle = page.getByRole('button', { name: /^Volume(,| and) tempo/ });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('button', { name: 'Volume up' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Volume down' })).toBeVisible();
      const raw = await rawFindings(page);
      none(raw, 'horizontalOverflow');
      none(raw, 'tightTargets', 'app-adjust-controls');
    });
  });
}

// kantahe-du1.9: on a phone the sub-menus of Me and Administration are one line that scrolls sideways (Me took four rows)
for (const id of ['/me/devices:list', '/admin/songs:many']) {
  test(`${id.replace(':', ' ')}: the sub-menu is one line at phone-390x844`, async ({ browser }, info) => {
    await layout(browser, info, id, 'phone-390x844', async (_raw, page) => {
      expect((await page.locator('nav.sub-nav').boundingBox())!.height, 'height of the sub-menu').toBeLessThanOrEqual(60);
    });
  });
}

test('/me/help page: the current sub-menu entry is in view at phone-360x640', async ({ browser }, info) => {
  await layout(browser, info, '/me/help:page', 'phone-360x640', async (_raw, page) => {
    const nav = (await page.locator('nav.sub-nav').boundingBox())!;
    const current = (await page.locator('nav.sub-nav a[aria-current="page"]').boundingBox())!;
    expect(current.x).toBeGreaterThanOrEqual(nav.x - 1);
    expect(current.x + current.width).toBeLessThanOrEqual(nav.x + nav.width + 1);
  });
});

test('/me/devices list: the one-line sub-menu makes no sideways scroll at phone-320x568', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/devices:list', 'phone-320x568', (r) => r), 'horizontalOverflow');
});

test('/me/devices list: the sub-menu shows every entry without scrolling at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/me/devices:list', 'desktop-1280x800', async (_raw, page) => {
    const { scroll, client } = await page.locator('nav.sub-nav').evaluate((n) => ({ scroll: n.scrollWidth, client: n.clientWidth }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
});

// kantahe-du1.9: Admin > Songs on a phone: filters and the library tools fold away, so the songs start on the first screen (the first was at y=841)
test('/admin/songs many: the first song is on the first screen at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'phone-390x844', async (_raw, page) => {
    const first = (await page.locator('tbody tr').first().boundingBox())!;
    const bar = (await page.locator('nav[aria-label="Main"]').boundingBox())!;
    expect(first.y, 'top of the first song').toBeLessThan(bar.y);
  });
});

test('/admin/songs many: the filters open and fit at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'phone-320x568', async (_raw, page) => {
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.locator('#filter-format')).toBeVisible();
    await expect(page.locator('#sort-by')).toBeVisible();
    none(await rawFindings(page), 'horizontalOverflow');
  });
});

test('/admin/songs many: filters and tools are open, with no fold buttons, at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'desktop-1280x800', async (_raw, page) => {
    await expect(page.locator('#filter-format')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rescan' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Filters/ })).toBeHidden();
  });
});

// kantahe-du1.11: on a TV the player keeps a 5% title-safe margin on every side (a TV that overscans cuts the edges of the picture)
const outsideSafeArea = (page: Page) =>
  page.evaluate(() => {
    const [sx, sy] = [innerWidth * 0.05, innerHeight * 0.05];
    const items = [...document.querySelectorAll('main.stage button, main.stage header.song h1, app-lyrics-view, .overlay .number, .overlay .comment')];
    return items
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
      })
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.left < sx - 0.5 || r.top < sy - 0.5 || r.right > innerWidth - sx + 0.5 || r.bottom > innerHeight - sy + 0.5;
      })
      .map((e) => `${e.tagName.toLowerCase()}.${e.className} "${(e.textContent ?? '').trim().slice(0, 20)}"`);
  });
const asTv = (page: Page) => page.evaluate(() => document.documentElement.classList.add('tv', 'tv-safe'));
for (const id of ['/player:playing', '/player:score']) {
  test(`${id.replace(':', ' ')}: on a TV everything of the player is inside the 5% safe area at desktop-1920x1080`, async ({ browser }, info) => {
    await layout(browser, info, id, 'desktop-1920x1080', async (_raw, page) => {
      await asTv(page);
      await page.mouse.move(960, 540); // the buttons show
      await page.waitForTimeout(300);
      expect(await outsideSafeArea(page)).toEqual([]);
    });
  });
}

test('/player playing: without a TV the top bar keeps its place at desktop-1920x1080', async ({ browser }, info) => {
  await layout(browser, info, '/player:playing', 'desktop-1920x1080', async (_raw, page) => {
    expect(await page.locator('.topbar').evaluate((e) => Math.round(e.getBoundingClientRect().left))).toBe(12);
  });
});

// kantahe-qzr.1: Admin > Users: one compact row per user, the actions in a More menu (a phone showed one user per screen)
test('/admin/users many: a user row is at most 80 px high at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:many', 'phone-390x844', async (_raw, page) => {
    const rows = page.locator('tbody tr').filter({ hasText: /^scratch\d@example\.com/ });
    expect((await rows.first().boundingBox())!.height).toBeLessThanOrEqual(80);
  });
});

test('/admin/users many: at least 5 users on the first screen at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:many', 'phone-390x844', async (_raw, page) => {
    const barTop = (await page.locator('nav[aria-label="Main"]').boundingBox())!.y;
    const shown = await page.locator('tbody tr').evaluateAll((rows, bar) => rows.filter((r) => r.getBoundingClientRect().top >= 0 && r.getBoundingClientRect().bottom <= bar).length, barTop);
    expect(shown).toBeGreaterThanOrEqual(5);
  });
});

test('/admin/users many: the row separators line up at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:many', 'desktop-1280x800', async (_raw, page) => {
    const bottoms = await page.locator('tbody tr').first().locator('td').evaluateAll((tds) => tds.map((td) => Math.round(td.getBoundingClientRect().bottom)));
    expect(Math.max(...bottoms) - Math.min(...bottoms), `bottoms of the cells ${bottoms.join(', ')}`).toBeLessThanOrEqual(1);
  });
});

test('/admin/users many: no red button outside the menus at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:many', 'desktop-1280x800', async (_raw, page) => {
    await expect(page.locator('tbody button.danger')).toHaveCount(0);
  });
});

// kantahe-qzr.3: Admin > Songs on a phone: one compact row per song, the selection bar in reach, the broken songs folded
test('/admin/songs many: a song row is at most 72 px high at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'phone-390x844', async (_raw, page) => {
    const row = page.locator('tbody tr').filter({ hasText: /Title \d+/ }).first();
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(72);
  });
});

for (const where of ['end', 'middle'] as const) {
  test(`/admin/songs selected: the selection bar is on screen with the page scrolled to the ${where} at phone-390x844`, async ({ browser }, info) => {
    await layout(browser, info, '/admin/songs:selected', 'phone-390x844', async (_raw, page) => {
      await page.evaluate((w) => window.scrollTo({ top: w === 'end' ? document.documentElement.scrollHeight : document.documentElement.scrollHeight / 2, behavior: 'instant' }), where);
      await page.waitForTimeout(200);
      const button = (await page.getByRole('button', { name: 'Remove from list' }).first().boundingBox())!;
      const bar = (await page.locator('nav[aria-label="Main"]').boundingBox())!;
      expect(button.y, 'top of Remove from list').toBeGreaterThanOrEqual(0);
      expect(button.y + button.height, 'bottom of Remove from list against the tab bar').toBeLessThanOrEqual(bar.y);
    });
  });
}

// with the text at 200% the bar and its question grew to half the screen and covered the search at the top (audit, kantahe-qzr.3)
test('/admin/songs bulk-question: the selection bar takes at most 30% of the window at phone-390x844-zoom200', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:bulk-question', 'phone-390x844-zoom200', async (raw, page) => {
    expect((await page.locator('section.selection').boundingBox())!.height).toBeLessThanOrEqual(844 * 0.3 + 1);
    none(raw, 'overlap');
  });
});

test('/admin/songs selected: the selection bar covers no row that cannot be scrolled out from under it at desktop-1280x800', async ({ browser }, info) => {
  none(await layout(browser, info, '/admin/songs:selected', 'desktop-1280x800', (r) => r), 'overlap');
});

test('/admin/songs many: the broken songs list is closed at first at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'desktop-1280x800', async (_raw, page) => {
    await expect(page.locator('li.broken')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show', exact: true })).toBeVisible();
  });
});

// kantahe-qzr.5: each upload result is one row: the file name and its status badge on one line (they were loose stacked words)
test('/admin/upload results: each file is one row with its status badge at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/upload:results', 'phone-390x844', async (_raw, page) => {
    const rows = await page.locator('tbody tr').all();
    expect(rows.length).toBe(3);
    for (const row of rows) {
      const name = (await row.locator('td').first().boundingBox())!;
      const status = (await row.locator('.status').boundingBox())!;
      expect(status.y, 'the badge starts above the bottom of the file name').toBeLessThan(name.y + name.height);
      expect(name.y, 'the file name starts above the bottom of the badge').toBeLessThan(status.y + status.height);
      // one line under the row, none under each cell
      expect(await row.locator('td').evaluateAll((tds) => tds.map((td) => getComputedStyle(td).borderBottomWidth))).toEqual(['0px', '0px', '0px']);
    }
  });
});

// kantahe-qzr.7: the Getting started panel on the first page of Administration: it fits a small phone and moves nothing when its answers come
test('/admin/upload empty: the Getting started panel fits at phone-360x640', async ({ browser }, info) => {
  await layout(browser, info, '/admin/upload:empty', 'phone-360x640', async (raw, page) => {
    await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible();
    none(raw, 'horizontalOverflow');
    none(raw, 'smallTargets', 'app-getting-started');
  });
});

test('/admin/upload empty: the page does not move when the Getting started answers come at phone-390x844', async ({ browser }, info) => {
  await layout(
    browser,
    info,
    '/admin/upload:empty',
    'phone-390x844',
    async (_raw, page) => {
      const top = () => page.locator('section.upload h2').evaluate((e) => Math.round(e.getBoundingClientRect().top));
      await expect(page.getByText('Checking…').first()).toBeVisible();
      const before = await top();
      await expect(page.getByText('Checking…')).toHaveCount(0, { timeout: 5_000 });
      expect(await top()).toBe(before);
    },
    'light',
    {
      // the answer about the users comes a second late
      before: ({ page }) => page.route('**/kantahe.v1.AdminService/ListUsers', async (r) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await r.continue();
      }),
      ready: ({ page }) => expect(page.getByRole('heading', { name: 'Upload songs' })).toBeVisible(),
    },
  );
});

// kantahe-cqc.1: a row says In queue once its song is added, and keeps its height (the label shares the artist's line)
test('/library toast: the In queue label keeps the row one line at phone-360x640', async ({ browser }, info) => {
  await layout(
    browser,
    info,
    '/library:toast',
    'phone-360x640',
    async (_raw, page) => {
      const row = page.locator('li.row').filter({ has: page.locator('.title', { hasText: /^Title \d+$/ }) }).first();
      const before = (await row.boundingBox())!.height;
      await row.locator('button.main').click();
      await expect(row.locator('.queued')).toHaveText('In queue');
      expect(Math.abs((await row.boundingBox())!.height - before), 'change of the row height').toBeLessThanOrEqual(2);
    },
    'light',
    rowsOnly,
  );
});

// kantahe-cqc.3: denser rows (the badges wrapped onto a second line, 65 px rows) and a one-line now-playing bar on phones
const plainRow = (page: Page) =>
  page
    .locator('li.row')
    .filter({ has: page.locator('.title', { hasText: /^Title \d+$/ }) })
    .filter({ has: page.locator('.artist', { hasText: /^Artist \d+$/ }) })
    .first();
test('/library many: a plain song row is at most 56 px high at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-390x844', async (_raw, page) => {
    expect((await plainRow(page).boundingBox())!.height).toBeLessThanOrEqual(56);
  });
});

test('/library many: the badges of a row are on one line at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'desktop-1280x800', async (_raw, page) => {
    // badges of different heights are centred on one line: their middles agree (two lines differ by a badge height)
    const middles = await plainRow(page).locator('app-format-badge .badge').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).map((r) => r.top + r.height / 2));
    expect(middles.length).toBeGreaterThan(1);
    expect(Math.max(...middles) - Math.min(...middles), `middles of the badges: ${middles.join(', ')}`).toBeLessThanOrEqual(2);
  });
});

test('/library many: the now-playing bar is at most 48 px high at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-390x844', async (_raw, page) => {
    expect((await page.locator('app-now-bar aside').boundingBox())!.height).toBeLessThanOrEqual(48);
  });
});

test('/library many: rows stay at least 44 px high and nothing scrolls sideways at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-320x568', async (raw, page) => {
    expect((await plainRow(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    none(raw, 'horizontalOverflow');
  });
});

test('/library many: the page does not move when the now-playing bar fills in at desktop-1280x800', async ({ browser }, info) => {
  await layout(
    browser,
    info,
    '/library:many',
    'desktop-1280x800',
    async (_raw, page) => {
      const top = () => page.locator('h1').evaluate((e) => Math.round(e.getBoundingClientRect().top));
      const before = await top();
      await expect(page.locator('app-now-bar .song strong')).toBeVisible({ timeout: 10_000 });
      expect(await top()).toBe(before);
    },
    'light',
    {
      // the first state comes a second late: the page is drawn before it
      before: ({ page }) =>
        page.route('**/kantahe.v1.SessionService/WatchState', async (r) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await r.continue();
        }),
      ready: ({ page }) => expect(page.getByRole('heading', { name: 'Library' })).toBeVisible(),
      after: undefined,
    },
  );
});

// kantahe-cqc.5: on a wide window the Queue shows now playing and the queue side by side (owner decision 2026-11-28)
test('/queue many: at least 8 queued songs on the first screen at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'desktop-1280x800', async (_raw, page) => {
    expect(await queueRowsOnFirstScreen(page)).toBeGreaterThanOrEqual(8);
  });
});

test('/queue many: one column at tablet-768x1024', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'tablet-768x1024', async (_raw, page) => {
    const card = (await page.locator('app-now-playing section').boundingBox())!;
    const list = (await page.locator('#queue-title').boundingBox())!;
    expect(list.y, 'Coming up starts below the card').toBeGreaterThan(card.y + card.height);
  });
});

test('/queue many: the now-playing card stays in view while the queue scrolls at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'desktop-1280x800', async (_raw, page) => {
    await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'instant' }));
    await page.waitForTimeout(200);
    const top = (await page.locator('app-now-playing section').boundingBox())!.y;
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(40);
  });
});

// kantahe-cqc.6 review: the sticky card is never taller than the window, so every control in it can be reached on a short window
test('/queue many: with Volume and tempo open the whole card fits the window at tablet-landscape-1024x768', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'tablet-landscape-1024x768', async (_raw, page) => {
    await page.getByRole('button', { name: /^Volume(,| and) tempo/ }).click();
    const card = (await page.locator('app-now-playing').boundingBox())!;
    expect(card.height, 'height of the sticky card').toBeLessThanOrEqual(768);
    await page.evaluate(() => window.scrollBy({ top: 2000, behavior: 'instant' }));
    await page.waitForTimeout(200);
    const faster = page.getByRole('button', { name: 'Faster' });
    await faster.scrollIntoViewIfNeeded();
    const b = (await faster.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  });
});

// kantahe-cqc.9: the Help link of a page leads to the section that explains it, its heading in view
test('/admin/songs many: Help leads to For administrators, in view, at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'desktop-1280x800', async (_raw, page) => {
    await page.locator('a.help-link').click();
    await expect(page).toHaveURL(/\/me\/help#admin$/);
    const heading = page.getByRole('heading', { name: 'For administrators' });
    await expect(heading).toBeInViewport();
    await expect(heading).toBeFocused();
  });
});

test('/queue many: Help leads to the section about the queue at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'phone-390x844', async (_raw, page) => {
    await page.locator('a.help-link').click();
    await expect(page.getByRole('heading', { name: 'The queue and Play here' })).toBeInViewport();
  });
});

test('/library many: the Help link is a 44 px target at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:many', 'phone-390x844', (r) => r), 'smallTargets', 'help-link');
});

// kantahe-du1.17: nothing pushes the page after the first paint (Lighthouse CLS up to 0.146: the install offer above the page, the footer
// pushed down when a list arrived). The browser's own layout-shift entries are summed from the start of the page.
const measureShifts: Partial<RouteState> = {
  before: ({ page }) =>
    page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    }),
};
for (const [id, viewport] of [
  ['/queue:many', 'phone-390x844'],
  ['/admin/users:many', 'phone-390x844'],
  ['/admin/songs:many', 'desktop-1280x800'],
  // Lighthouse mobile still saw 0.027 here: the Loading line under the list moved when the rows came
  ['/admin/songs:many', 'phone-412x915'],
] as const) {
  test(`${id.replace(':', ' ')}: nothing moves while the page loads at ${viewport}`, async ({ browser }, info) => {
    await layout(
      browser,
      info,
      id,
      viewport,
      async (_raw, page) => {
        await page.waitForTimeout(1000);
        expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), 'cumulative layout shift').toBeLessThan(0.02);
      },
      'light',
      {
        before: async (ctx) => {
          await measureShifts.before!(ctx);
          // the list comes a second late, as on a slow network: the page must not grow under what is already drawn
          await ctx.page.route('**/kantahe.v1.CatalogService/SearchSongs', async (r) => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await r.continue();
          });
        },
      },
    );
  });
}

// kantahe-du1.23: a playlist's page grew under its first paint (CLS 0.065): the empty heading took its line and the songs came above the
// legend when the playlist arrived
test('/me/playlists/:id many: nothing moves while the page loads at desktop-1280x800', async ({ browser }, info) => {
  await layout(
    browser,
    info,
    '/me/playlists/:id:many',
    'desktop-1280x800',
    async (_raw, page) => {
      await page.waitForTimeout(1000);
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), 'cumulative layout shift').toBeLessThan(0.02);
    },
    'light',
    {
      before: async (ctx) => {
        await measureShifts.before!(ctx);
        await ctx.page.route('**/kantahe.v1.UserLibraryService/GetPlaylist', async (r) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await r.continue();
        });
      },
    },
  );
});

const offerInstall = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() })));
test('/library many: the install offer appears without moving the page, above the tab bar, at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-390x844', async (_raw, page) => {
    const top = () => page.locator('h1').evaluate((e) => Math.round(e.getBoundingClientRect().top));
    const before = await top();
    await offerInstall(page);
    const offer = page.locator('aside.install');
    await expect(offer).toBeVisible();
    expect(await top(), 'the heading did not move').toBe(before);
    const o = (await offer.boundingBox())!;
    const bar = (await page.locator('nav[aria-label="Main"]').boundingBox())!;
    expect(o.y + o.height).toBeLessThanOrEqual(bar.y);
  });
});

// kantahe-du1.21: Admin > Songs on a phone, as the Library (kantahe-du1.5): results above the keyboard while typing a search
const songRowsAboveKeyboard = (page: Page, keyboard: number) =>
  page.evaluate((k) => [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().top >= 0 && r.getBoundingClientRect().bottom <= innerHeight - k).length, keyboard);
for (const [viewport, keyboard, rows] of [
  ['phone-390x844', 336, 3],
  ['phone-360x640', 290, 2],
] as const) {
  test(`/admin/songs many: search results show above the keyboard at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/admin/songs:many', viewport, async (_raw, page) => {
      await page.locator('#admin-search').click();
      await page.locator('#admin-search').pressSequentially('Title 1', { delay: 20 });
      await expect(page.locator('tbody tr').first()).toBeVisible();
      await page.waitForTimeout(700);
      expect(await songRowsAboveKeyboard(page, keyboard)).toBeGreaterThanOrEqual(rows);
    });
  });
}

// a tap on a result takes the focus off the field first: the page must not change then, or the rows jump under the finger (the fold buttons
// came back above the list on blur). Scroll anchoring is off, as in Safari, where it does not exist (review kantahe-du1.22)
test('/admin/songs many: leaving the search field moves no row at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'phone-390x844', async (_raw, page) => {
    await page.addStyleTag({ content: 'html, body { overflow-anchor: none !important; }' });
    await page.locator('#admin-search').click();
    await page.locator('#admin-search').pressSequentially('Title 1', { delay: 20 });
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await page.waitForTimeout(700);
    const before = (await page.locator('tbody tr').first().boundingBox())!.y;
    await page.locator('#admin-search').blur();
    await page.waitForTimeout(300);
    expect((await page.locator('tbody tr').first().boundingBox())!.y).toBeCloseTo(before, 0);
  });
});

test('/admin/songs many: focusing the search does not scroll at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'desktop-1280x800', async (_raw, page) => {
    await page.locator('#admin-search').click();
    await page.locator('#admin-search').pressSequentially('Title 1', { delay: 20 });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

// the WCAG contrast of two colours given as the browser writes them: "rgb(r, g, b)" or "rgba(r, g, b, a)"
const channels = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const luminance = (css: string) => {
  const [r, g, b] = channels(css).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// kantahe-dk8.65: the border of a control has 3:1 against what is behind it
for (const theme of ['light', 'dark'] as const) {
  test(`/library many: the border of the search field has a contrast of at least 3:1 to the page in the ${theme} theme at phone-390x844`, async ({ browser }, info) => {
    await layout(browser, info, '/library:many', 'phone-390x844', async (_raw, page) => {
      const border = await page.locator('#search').evaluate((el) => getComputedStyle(el).borderTopColor);
      const behind = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(contrast(border, behind), `${border} on ${behind}`).toBeGreaterThanOrEqual(3);
    }, theme);
  });

  test(`/login empty: the border of the email field has a contrast of at least 3:1 to its card in the ${theme} theme at phone-390x844`, async ({ browser }, info) => {
    await layout(browser, info, '/login:empty', 'phone-390x844', async (_raw, page) => {
      const border = await page.locator('#email').evaluate((el) => getComputedStyle(el).borderTopColor);
      const behind = await page.locator('main#main .card').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(contrast(border, behind), `${border} on ${behind}`).toBeGreaterThanOrEqual(3);
    }, theme);
  });
}

// kantahe-dk8.61: a select gets the font size of the page, so that iOS does not zoom into it
test('/me/devices list: the MIDI mode select has a font size of at least 16 px at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/me/devices:list', 'phone-390x844', async (_raw, page) => {
    expect(await page.locator('li.device select').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  });
});

test('/login empty: the theme select has a font size of at least 16 px at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/login:empty', 'phone-390x844', async (_raw, page) => {
    expect(await page.locator('select.theme').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  });
});

// kantahe-dk8.63: a container with its own scroll keeps the gesture
test('/player playing: the stage keeps the pull-down for itself at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/player:playing', 'phone-390x844', async (_raw, page) => {
    expect(await page.locator('main.stage').evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe('contain');
  });
});

test('/admin/songs edit-dialog: the dialog does not chain its scrolling to the page at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:edit-dialog', 'phone-390x844', async (_raw, page) => {
    expect(await page.getByRole('dialog').evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe('contain');
  });
});

// kantahe-dk8.68: buttons with no space between them (a touching pair of boxes is a defect, the audit's tightTargets check now says so)
for (const viewport of ['phone-390x844', 'phone-320x568', 'desktop-1280x800']) {
  test(`/admin/songs edit-dialog: Save and Cancel are at least 8 px apart and the hint has room above them at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/admin/songs:edit-dialog', viewport, async (raw, page) => {
      none(raw, 'tightTargets', 'div.dialog');
      const hint = await page.locator('.dialog p.hint').boundingBox();
      const save = await page.getByRole('button', { name: 'Save', exact: true }).boundingBox();
      expect(save!.y - (hint!.y + hint!.height), 'room between the hint and the buttons').toBeGreaterThanOrEqual(8);
    });
  });

  test(`/player playing: the control buttons are at least 8 px apart at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/player:playing', viewport, (r) => r), 'tightTargets', '.controls');
  });

  test(`/admin/users temp-password: Copy and Close are at least 8 px apart at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/admin/users:temp-password', viewport, (r) => r), 'tightTargets', 'section.panel');
  });

  test(`/admin/users new-user: the Generate button is at least 8 px from the password box at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/admin/users:new-user', viewport, (r) => r), 'tightTargets', 'new-password');
  });

  test(`/me/playlists rename: the name box, Save and Cancel are at least 8 px apart at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/me/playlists:rename', viewport, (r) => r), 'tightTargets', 'span.edit');
  });

  test(`/me/playlists delete-question: Yes, delete and Cancel are at least 8 px apart at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/me/playlists:delete-question', viewport, (r) => r), 'tightTargets', 'span.ask');
  });
}

// kantahe-b16: the checkboxes and the bar of the chosen songs
for (const viewport of ['phone-390x844', 'phone-320x568', 'desktop-1280x800']) {
  test(`/admin/songs selected: the checkboxes are at least 44 px and nothing in the bar or the rows touches at ${viewport}`, async ({ browser }, info) => {
    const raw = await layout(browser, info, '/admin/songs:selected', viewport, (r) => r);
    none(raw, 'smallTargets', 'input');
    none(raw, 'tightTargets', 'section.selection');
    none(raw, 'tightTargets', 'tbody');
    none(raw, 'horizontalOverflow');
  });

  test(`/admin/songs bulk-question: the question and its buttons are at least 8 px apart at ${viewport}`, async ({ browser }, info) => {
    none(await layout(browser, info, '/admin/songs:bulk-question', viewport, (r) => r), 'tightTargets', 'section.selection');
  });
}

// on its side the phone has no tab bar, yet the bar of the chosen songs kept the room for one: it floated 72 px up, over the rows, 4.5 px
// from a row's checkbox (audit, kantahe-du1.21)
test('/admin/songs bulk-question: the selection bar rests at the bottom and crowds no row at phone-landscape-667x375', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:bulk-question', 'phone-landscape-667x375', async (raw, page) => {
    none(raw, 'tightTargets', 'section.selection');
    const bar = (await page.locator('section.selection').boundingBox())!;
    const tabs = await page.locator('nav.tabs, nav[aria-label="Main"]').first().isVisible().catch(() => false);
    if (!tabs) expect(375 - (bar.y + bar.height), 'no tab bar: the bar sits 1rem above the bottom').toBeLessThanOrEqual(17);
  });
});

// kantahe-tlf.2.1: the menu is a tab bar at the bottom of a phone
test('/library many: the page starts within 160 px of the top at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-390x844', async (_raw, page) => {
    const main = (await page.locator('main').first().boundingBox())!;
    expect(main.y, 'top of the page under the brand, the menu and the now bar').toBeLessThanOrEqual(160);
  });
});

test('/library many: the tab bar leaves the end of the page visible at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many', 'phone-390x844', async (raw, page) => {
    none(raw, 'overlap');
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const next = (await page.getByRole('button', { name: 'Next' }).boundingBox())!;
    const bar = (await page.locator('nav[aria-label="Main"]').boundingBox())!;
    expect(next.y + next.height, 'bottom of Next against the top of the tab bar').toBeLessThanOrEqual(bar.y);
  });
});

test('/library many: the tabs are 8 px below the controls of the top bar at desktop-1280x800', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:many', 'desktop-1280x800', (r) => r), 'tightTargets', 'nav');
});

for (const viewport of ['phone-landscape-568x320', 'phone-390x844-zoom200']) {
  test(`/admin/songs edit-dialog: the tab bar does not cover Save and Cancel at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/admin/songs:edit-dialog', viewport, async (raw, page) => {
      none(raw, 'overlap');
      for (const name of ['Save', 'Cancel']) {
        const button = page.getByRole('dialog').getByRole('button', { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        const box = (await button.boundingBox())!;
        const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.textContent?.trim(), [box.x + box.width / 2, box.y + box.height / 2]);
        expect(onTop, `what is on top of ${name}`).toBe(name);
      }
    });
  });
}

// kantahe-tlf.2.5: a toast keeps 8 px from the controls of the page
test('/library toast: the buttons of a toast are 8 px from the other controls at phone-landscape-915x412', async ({ browser }, info) => {
  await layout(browser, info, '/library:toast', 'phone-landscape-915x412', async (raw, page) => {
    none(raw, 'tightTargets', 'toast');
  });
});

test('/library toast: at the top of the page the toast is 8 px from the controls around it at phone-landscape-915x412', async ({ browser }, info) => {
  await layout(browser, info, '/library:toast', 'phone-landscape-915x412', async (_raw, page) => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    none(await rawFindings(page), 'tightTargets', 'toast');
  });
});

// kantahe-tlf.2.6 review: a toast on the player (no page frame) lies over no button of the player
for (const viewport of ['phone-390x844', 'phone-landscape-844x390', 'desktop-1280x800']) {
  test(`/player playing: a toast covers no button of the player at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/player:playing', viewport, async (_raw, page) => {
      await page.route('**/kantahe.v1.SessionService/Control', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"internal","message":"no"}' }));
      await page.mouse.move(10, 10);
      await page.getByRole('button', { name: 'Skip' }).click(); // a refused command shows a toast
      const toast = page.locator('.toast').first();
      await expect(toast).toBeVisible({ timeout: 5_000 });
      const t = (await toast.boundingBox())!;
      for (const button of await page.locator('main.stage button:not(.toast *)').all()) {
        const b = await button.boundingBox();
        if (!b) continue;
        const apart = b.x >= t.x + t.width || t.x >= b.x + b.width || b.y >= t.y + t.height || t.y >= b.y + b.height;
        expect(apart, `the toast against ${await button.innerText()}`).toBe(true);
      }
    });
  });
}

// kantahe-tlf.3.3: one line per song on a phone (the + and the bin wrapped every row to two lines, the Library was ~13,700 px tall)
for (const id of ['/library:many', '/library:many-admin', '/me/favourites:many']) {
  test(`${id.replace(':', ' ')}: a song row with a short title and artist is one line, at most 4.5rem tall, at phone-390x844`, async ({ browser }, info) => {
    await layout(browser, info, id, 'phone-390x844', async (_raw, page) => {
      // an ordinary row: a short title and a short artist (a long one may take two lines, by design)
      const rows = page
        .locator('li.row')
        .filter({ has: page.locator('.title', { hasText: /^Title \d+$/ }) })
        .filter({ has: page.locator('.artist', { hasText: /^Artist \d+$/ }) });
      expect(await rows.count()).toBeGreaterThan(3);
      for (const row of (await rows.all()).slice(0, 10)) {
        const box = (await row.boundingBox())!;
        expect(box.height, `height of ${(await row.innerText()).split('\n')[1]}`).toBeLessThanOrEqual(72);
      }
    });
  });
}

test('/library many-admin: the page of 50 songs is at most 4,000 px tall (6,450 with the actions in the row) at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:many-admin', 'phone-390x844', async (_raw, page) => {
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(4000);
  });
});

test('/admin/songs many: the page of 50 songs is less than half as tall as before (36,000 px) at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/admin/songs:many', 'phone-390x844', async (_raw, page) => {
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(18000);
  });
});

test('/library more-menu: the open menu is inside the window at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/library:more-menu', 'phone-320x568', async (raw) => {
    none(raw, 'outsideViewport', 'menu');
    none(raw, 'horizontalOverflow');
  });
});

for (const [id, viewport] of [
  ['/admin/songs:more-menu', 'phone-390x844'],
  ['/admin/songs:more-menu', 'phone-320x568'],
  ['/library:more-menu', 'phone-390x844-zoom200'],
]) {
  test(`${id.replace(':', ' ')}: the open menu is inside the window at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, id, viewport, async (raw) => none(raw, 'outsideViewport', 'menu'));
  });
}

// kantahe-tlf.3.5: a wider frame on a desktop for the admin tables; running text stays readable
for (const id of ['/admin/songs:many', '/admin/users:many']) {
  for (const viewport of ['desktop-1280x800', 'desktop-1920x1080']) {
    test(`${id.replace(':', ' ')}: the action buttons of a row are on one line, each label on one line, at ${viewport}`, async ({ browser }, info) => {
      await layout(browser, info, id, viewport, async (_raw, page) => {
        for (const row of (await page.locator('tbody tr').all()).slice(0, 5)) {
          const boxes = await row.locator('.actions button:visible').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), height: r.height })));
          const name = (await row.innerText()).slice(0, 40);
          expect(new Set(boxes.map((b) => b.top)).size, `rows of buttons in ${name}`).toBe(1);
          for (const b of boxes) expect(b.height, `height of a button in ${name} (a label on two lines is taller)`).toBeLessThanOrEqual(46);
        }
      });
    });
  }
}

for (const id of ['/admin/songs:many', '/admin/users:many']) {
  test(`${id.replace(':', ' ')}: the table uses the wide frame (60rem left it 928 px with squeezed titles) at desktop-1280x800`, async ({ browser }, info) => {
    await layout(browser, info, id, 'desktop-1280x800', async (_raw, page) => {
      expect((await page.locator('table').boundingBox())!.width).toBeGreaterThanOrEqual(1100);
    });
  });
}

for (const id of ['/me/devices:list', '/me/settings:form', '/admin/settings:form']) {
  test(`${id.replace(':', ' ')}: running text is at most 70 characters wide at desktop-1920x1080`, async ({ browser }, info) => {
    await layout(browser, info, id, 'desktop-1920x1080', async (_raw, page) => {
      // how far each long paragraph is wider than 70ch in its own font (a probe of width 70ch inside it: CSS's own ch)
      const widest = await page.locator('main p, main .hint').evaluateAll((ps) =>
        Math.max(
          0,
          ...ps
            .filter((p) => (p.textContent ?? '').trim().length > 80)
            .map((p) => {
              const probe = document.createElement('span');
              probe.style.cssText = 'position:absolute;visibility:hidden;display:block;width:70ch';
              p.appendChild(probe);
              const over = p.getBoundingClientRect().width - probe.getBoundingClientRect().width;
              probe.remove();
              return over;
            }),
        ),
      );
      expect(widest, 'px by which the widest paragraph is wider than 70ch').toBeLessThanOrEqual(1);
    });
  });
}

for (const id of ['/admin/settings:form', '/admin/users:new-user']) {
  test(`${id.replace(':', ' ')}: a form keeps the 48rem reading column in the wide frame at desktop-1920x1080`, async ({ browser }, info) => {
    await layout(browser, info, id, 'desktop-1920x1080', async (_raw, page) => {
      expect((await page.locator('main#main form').first().boundingBox())!.width).toBeLessThanOrEqual(768);
    });
  });
}

// kantahe-tlf.3.7: a device that is not this one is one summary line until its settings are opened
for (const viewport of ['phone-390x844', 'desktop-1280x800']) {
  test(`/me/devices list: a closed device is one short line at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/me/devices:list', viewport, async (_raw, page) => {
      const closed = page.locator('li.device').filter({ has: page.locator('button.toggle-settings[aria-expanded="false"]') });
      expect(await closed.count()).toBeGreaterThan(0);
      for (const li of await closed.all()) expect((await li.boundingBox())!.height, (await li.innerText()).split('\n')[0]).toBeLessThanOrEqual(viewport.startsWith('phone') ? 130 : 90);
    });
  });
}

// kantahe-tlf (player centring): the player is not in the app frame, so the 70ch cap on paragraphs must not apply: a paragraph capped at
// 70ch is a narrow block at the left edge and its centred text was centred in that block, not in the window
test('/player playing: the title, the artist row and the time are centred in the window at desktop-1920x1080', async ({ browser }, info) => {
  await layout(browser, info, '/player:playing', 'desktop-1920x1080', async (_raw, page) => {
    for (const selector of ['.stage h1', '.stage header.song p', '.stage p.time']) {
      const box = (await page.locator(selector).first().boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - 960), `${selector} is off the centre of the window`).toBeLessThanOrEqual(2);
    }
  });
});

test('/player idle: the line about who is playing is centred in the window at desktop-1920x1080', async ({ browser }, info) => {
  await layout(browser, info, '/player:idle', 'desktop-1920x1080', async (_raw, page) => {
    const box = (await page.locator('.stage p.elsewhere').boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - 960), 'the line is off the centre of the window').toBeLessThanOrEqual(2);
  });
});

// the player's buttons were 56 px high and 128 px wide at least: the owner asked for smaller ones; a 44 px target stays
test('/player playing: the control buttons are 44 to 48 px high and at most 12rem wide at desktop-1280x800', async ({ browser }, info) => {
  await layout(browser, info, '/player:playing', 'desktop-1280x800', async (_raw, page) => {
    const buttons = await page.locator('.stage .controls button').all();
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      const box = (await button.boundingBox())!;
      expect(box.height, await button.innerText()).toBeGreaterThanOrEqual(44);
      expect(box.height, await button.innerText()).toBeLessThanOrEqual(48);
      expect(box.width, await button.innerText()).toBeLessThanOrEqual(192);
    }
  });
});
