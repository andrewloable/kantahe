import { expect, Page, test } from '@playwright/test';
import { karmp3 } from './fixtures/karmp3';

// Admin > Songs (docs/admin-guide.md, "Filtering and sorting the song list"): the list is filtered by format, vocals and lyric timing, and sorted
// by its column headers; the server does both, so the whole product is in play. The songs of this test have a title that starts with "Zfilt".

const ADMIN = { email: 'admin@example.com', name: 'Admin', password: 'admin-password-1' };

async function signInAdmin(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForURL(/\/(setup|login)(\?.*)?$/);
  if (new URL(page.url()).pathname === '/setup') {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Your name').fill(ADMIN.name);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await page.getByLabel('Repeat the password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Create account' }).click();
  } else {
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page).toHaveURL(/\/library$/);
}

/** The rows of the table as {title, format, lyrics, vocals} (the cells after the checkbox, number, title and artist). */
async function rows(page: Page): Promise<{ title: string; format: string; lyrics: string; vocals: string }[]> {
  return page.locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => {
      const td = Array.from(tr.querySelectorAll('td')).map((c) => (c.textContent ?? '').trim());
      return { title: td[2], format: td[4], lyrics: td[5], vocals: td[6] };
    }),
  );
}

const titles = async (page: Page) => (await rows(page)).map((r) => r.title);

test('admin songs: filters by format, vocals and lyric timing, and sorting by the column headers', async ({ page }) => {
  await signInAdmin(page);
  await page.goto('/upload');
  await page.locator('#upload-files').setInputFiles([
    { name: 'Zfiltwordvoc.karmp3', mimeType: 'application/octet-stream', buffer: karmp3('Zfiltwordvoc', 400, { vocals: true, timing: 'word' }) },
    { name: 'Zfiltlineplain.karmp3', mimeType: 'application/octet-stream', buffer: karmp3('Zfiltlineplain', 500, { timing: 'line' }) },
    { name: 'Zfiltwordplain.karmp3', mimeType: 'application/octet-stream', buffer: karmp3('Zfiltwordplain', 600, { timing: 'word' }) },
  ]);
  await expect(page.getByText('3 added, 0 duplicates, 0 rejected')).toBeVisible();

  await page.goto('/admin/songs');
  await page.getByLabel('Search songs').fill('Zfilt');
  await expect.poll(() => titles(page)).toEqual(['Zfiltwordvoc', 'Zfiltlineplain', 'Zfiltwordplain']);

  await test.step('the vocals filter', async () => {
    await page.getByLabel('Vocals', { exact: true }).selectOption('with');
    await expect.poll(() => titles(page)).toEqual(['Zfiltwordvoc']);
    expect((await rows(page))[0]).toMatchObject({ format: 'MP3', lyrics: 'W', vocals: 'V' });
    await page.getByLabel('Vocals', { exact: true }).selectOption('without');
    await expect.poll(() => titles(page)).toEqual(['Zfiltlineplain', 'Zfiltwordplain']);
    await page.getByLabel('Vocals', { exact: true }).selectOption('any');
    await expect.poll(() => titles(page)).toHaveLength(3);
  });

  await test.step('the lyric timing filter, alone and with the vocals filter', async () => {
    await page.getByLabel('Lyrics', { exact: true }).selectOption('line');
    await expect.poll(() => titles(page)).toEqual(['Zfiltlineplain']);
    await page.getByLabel('Lyrics', { exact: true }).selectOption('word');
    await expect.poll(() => titles(page)).toEqual(['Zfiltwordvoc', 'Zfiltwordplain']);
    await page.getByLabel('Vocals', { exact: true }).selectOption('without');
    await expect.poll(() => titles(page)).toEqual(['Zfiltwordplain']);
  });

  await test.step('the format filter, and a filter that matches nothing says so', async () => {
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect.poll(() => titles(page)).toHaveLength(3);
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    await page.getByLabel('Format', { exact: true }).selectOption({ label: 'MIDI' });
    await expect(page.getByText('No songs match these filters')).toBeVisible();
    // without the text search the MIDI songs of the library show, and only they
    await page.getByLabel('Search songs').fill('');
    await expect.poll(async () => (await rows(page)).length).toBeGreaterThan(0);
    expect((await rows(page)).every((r) => r.format === 'MIDI')).toBe(true);
    await page.getByLabel('Format', { exact: true }).selectOption({ label: 'MP3' });
    await expect.poll(async () => (await rows(page)).some((r) => r.title === 'Zfiltwordvoc')).toBe(true);
    expect((await rows(page)).every((r) => r.format === 'MP3')).toBe(true);
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Search songs').fill('Zfilt');
    await expect.poll(() => titles(page)).toHaveLength(3);
  });

  await test.step('the column headers sort, ascending and then descending', async () => {
    const th = (name: string) => page.locator('thead th', { has: page.getByRole('button', { name: `${name}, sort` }) });
    await page.getByRole('button', { name: 'Title, sort' }).click();
    await expect(th('Title')).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(() => titles(page)).toEqual(['Zfiltlineplain', 'Zfiltwordplain', 'Zfiltwordvoc']);
    await page.getByRole('button', { name: 'Title, sort' }).click();
    await expect(th('Title')).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(() => titles(page)).toEqual(['Zfiltwordvoc', 'Zfiltwordplain', 'Zfiltlineplain']);
    // vocals: ascending puts the songs without them first, descending the song with them
    await page.getByRole('button', { name: 'Vocals, sort' }).click();
    await expect(th('Title')).toHaveAttribute('aria-sort', 'none');
    await expect.poll(async () => (await rows(page)).map((r) => r.vocals)).toEqual(['', '', 'V']);
    await page.getByRole('button', { name: 'Vocals, sort' }).click();
    await expect.poll(async () => (await rows(page)).map((r) => r.vocals)).toEqual(['V', '', '']);
    // lyrics: ascending puts line before word
    await page.getByRole('button', { name: 'Lyrics, sort' }).click();
    await expect.poll(async () => (await rows(page)).map((r) => r.lyrics)).toEqual(['L', 'W', 'W']);
  });
});
