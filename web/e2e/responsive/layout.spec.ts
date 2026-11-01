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
  await layout(browser, info, '/library:many', 'phone-320x568', async (raw, page) => {
    none(raw, 'horizontalOverflow');
    none(raw, 'outsideViewport', 'div.top');
    const signOut = await page.locator('button.signout').boundingBox();
    const select = await page.locator('select.theme').boundingBox();
    expect(signOut!.height, 'the Sign out button is one line high').toBeLessThanOrEqual(select!.height + 2);
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
test('/library browse: the tabs are inside the window at phone-390x844-zoom200', async ({ browser }, info) => {
  none(await layout(browser, info, '/library:browse', 'phone-390x844-zoom200', (r) => r), 'outsideViewport', 'tab-');
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

// kantahe-dk8.25: toggle groups
for (const viewport of ['phone-320x568', 'phone-390x844', 'phone-430x932']) {
  test(`/library browse: every letter button is at least 44 x 44 and 8 px from its neighbours at ${viewport}`, async ({ browser }, info) => {
    const raw = await layout(browser, info, '/library:browse', viewport, (r) => r);
    none(raw, 'smallTargets', 'app-alpha-browse');
    none(raw, 'tightTargets', 'app-alpha-browse');
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

test('/upload empty: the file picker is at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/upload:empty', 'phone-390x844', (r) => r), 'smallTargets', '#upload-files');
});

test('/me/settings form: each radio counts at least 44 px with its label at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/settings:form', 'phone-390x844', (r) => r), 'smallTargets', 'fieldset');
});

test('/me/devices list: the MIDI mode select is at least 44 px high at phone-390x844', async ({ browser }, info) => {
  none(await layout(browser, info, '/me/devices:list', 'phone-390x844', (r) => r), 'smallTargets', 'select');
});

test('/admin/users many: the checkboxes of the new user count at least 44 px with their labels at phone-390x844', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/admin/users:many', 'phone-390x844', (r) => r);
  none(raw, 'smallTargets', '#new-admin');
  none(raw, 'smallTargets', '#new-uploader');
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
test('/upload results: the details of a result are at least 200 px wide at phone-320x568', async ({ browser }, info) => {
  await layout(browser, info, '/upload:results', 'phone-320x568', async (_raw, page) => {
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
      const main = (await page.locator('main').first().boundingBox())!;
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
      const behind = await page.locator('main.card').evaluate((el) => getComputedStyle(el).backgroundColor);
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

test('/me/devices list: the theme select has a font size of at least 16 px at phone-390x844', async ({ browser }, info) => {
  await layout(browser, info, '/me/devices:list', 'phone-390x844', async (_raw, page) => {
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
