import { Browser, expect, Page, test, TestInfo } from '@playwright/test';
import { Check, patternOf, Raw } from './checks';
import { pick, Theme, VIEWPORTS } from './matrix';
import { contextOptions, openState, rawFindings } from './open-state';
import { states } from './routes';

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
): Promise<T> {
  const state = states(true).find((s) => `${s.route}:${s.state}` === id);
  if (!state) throw new Error(`No route state "${id}"`);
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
    for (const button of await page.locator('td.actions button').all()) expect((await button.boundingBox())!.x + (await button.boundingBox())!.width).toBeLessThanOrEqual(390);
  });
});

test('/admin/users many: the role checkboxes count at least 44 px with their label at phone-390x844', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/admin/users:many', 'phone-390x844', (r) => r);
  expect(where(raw, 'smallTargets', 'td').filter((r) => r.selector.includes('input')).map((r) => r.selector), 'small checkboxes in the table').toEqual([]);
});

test('/admin/users delete-question: the question and its buttons are inside the window at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/admin/users:delete-question', 'phone-320x568', async (_raw, page) => {
    for (const part of await page.locator('td.actions').locator('button, input, label').all()) {
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

test('/queue one-long: Up next is one line high at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/queue:one-long', 'phone-320x568', async (_raw, page) => {
    const { height, line } = await page.locator('.up-next').evaluate((el) => ({ height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) || 24 }));
    expect(height, 'height of the Up next line').toBeLessThanOrEqual(line * 1.5);
  });
});

// kantahe-dk8.44: the upload results
test('/admin/upload results: the details of a result are at least 200 px wide at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/admin/upload:results', 'phone-320x568', async (_raw, page) => {
    const rejected = page.locator('tbody tr').filter({ hasText: 'Rejected' });
    expect((await rejected.locator('td').nth(2).boundingBox())!.width).toBeGreaterThanOrEqual(200);
  });
});

test('/queue many: the buttons of a row are one line below the title at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/queue:many', 'phone-320x568', async (_raw, page) => {
    for (const row of await page.locator('.queue li').all()) {
      const text = (await row.locator('.info').boundingBox())!;
      const actions = (await row.locator('.row-actions').boundingBox())!;
      expect(actions.y, 'top of the buttons').toBeGreaterThanOrEqual(text.y + text.height - 1);
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
  none(await layout(browser, info, '/queue:many', 'phone-390x844-zoom200', (r) => r), 'outsideViewport', 'row-actions');
});

// kantahe-dk8.38: a failed search is not an empty search
test('/library error: "No songs found." is not shown next to the error at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:error', 'phone-390x844', async (_raw, page) => {
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByText('No songs found.')).toHaveCount(0);
  });
});

test('/library empty: "No songs found." is shown for a search without result at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:empty', 'phone-390x844', async (_raw, page) => {
    await expect(page.getByText('No songs found.')).toBeVisible();
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

// kantahe-dk8.57: the list pages are a reading column (owner decision: option A, 48rem, left aligned in the frame)
for (const id of ['/library:many', '/queue:many', '/me/favourites:many']) {
  test(`${id.replace(':', ' ')}: the page is at most 48rem wide at desktop-1920x1080`, async ({ browser }, info) => {
    await layout(browser, info, id, 'desktop-1920x1080', async (_raw, page) => {
      const main = (await page.locator('main#main').locator('.library, .queue-page, .me').first().boundingBox())!;
      expect(main.width, 'width of the page column').toBeLessThanOrEqual(768);
    });
  });
}

// kantahe-dk8.59: toasts in the flow of the page, under the menu
for (const viewport of ['phone-390x844', 'tablet-768x1024']) {
  test(`/library toast: the toast does not cover any control of the page at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/library:toast', viewport, async (raw, page) => {
      await expect(page.getByText(/^Added /).first()).toBeVisible();
      none(raw, 'overlap');
    });
  });
}

test('/me/playlists error: the toast does not cover any control of the page at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/playlists:error', 'phone-390x844', (r) => r), 'overlap');
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

  test(`/player playing: the volume buttons and the other controls are at least 8 px apart at ${viewport}`, async ({ browser }, info) => {
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

test('/library toast: the toast is fully visible, clear of the tab bar, at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/library:toast', 'phone-390x844', async (_raw, page) => {
    const toast = (await page.locator('.toast').first().boundingBox())!;
    const bar = (await page.locator('nav[aria-label="Main"]').boundingBox())!;
    expect(toast.y, 'top of the toast').toBeGreaterThanOrEqual(0);
    expect(toast.y + toast.height, 'bottom of the toast against the top of the tab bar').toBeLessThanOrEqual(bar.y);
  });
});

// kantahe-tlf.2.6 review: a toast on the player (no page frame) lies over no button of the player
for (const viewport of ['phone-390x844', 'phone-landscape-844x390', 'desktop-1280x800']) {
  test(`/player playing: a toast covers no button of the player at ${viewport}`, async ({ browser }, info) => {
    await layout(browser, info, '/player:playing', viewport, async (_raw, page) => {
      await page.route('**/kantahe.v1.SessionService/SetVolume', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"internal","message":"no"}' }));
      await page.mouse.move(10, 10);
      await page.getByRole('button', { name: 'Volume up' }).click();
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
          const boxes = await row.locator('td.actions button:visible').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), height: r.height })));
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
