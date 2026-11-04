import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { SearchSongsRequest, SongSort } from '../../../gen/kantahe/v1/catalog_pb';
import { Format, LyricTiming } from '../../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../../core/api';
import { UploadStatus } from '../../../gen/kantahe/v1/upload_pb';
import { FileDownloader } from './file-downloader';
import { fakeAdminSongs, song } from '../testing';
import { SongsAdminPage } from './songs-admin.page';

const SONGS = [song('00001', 'Alpha', 'Abba', Format.MP3, false, { lyricTiming: LyricTiming.WORD, hasVocals: true }), song('00002', 'Bravo', 'Beatles', Format.MIDI), song('00003', 'Charlie', 'Cher', Format.MIDI)];

async function setup(songs = SONGS, pageSize?: number) {
  const server = fakeAdminSongs({ songs, pageSize });
  const saved: { url: string; name: string }[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: TRANSPORT, useValue: server.transport },
      { provide: FileDownloader, useValue: { save: (url: string, name: string) => saved.push({ url, name }) } },
    ],
  });
  const fixture = TestBed.createComponent(SongsAdminPage);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (n = 4) => {
    for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  const row = (number: string) => Array.from(el.querySelectorAll('tbody tr')).find((r) => r.textContent?.includes(number)) as HTMLElement;
  const button = (within: ParentNode, text: string) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text))!;
  const type = (id: string, value: string) => {
    const i = el.querySelector<HTMLInputElement>('#' + id)!;
    i.value = value;
    i.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return { fixture, el, server, settle, row, button, type, saved };
}

describe('SongsAdminPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lists songs page by page with number, title, artist and format', async () => {
    const { el, settle, server } = await setup();
    await settle();
    expect(Array.from(el.querySelectorAll('tbody tr')).map((r) => r.querySelectorAll('td')[1].textContent?.trim())).toEqual(['00001', '00002', '00003']);
    expect(el.textContent).toContain('MP3');
    expect(el.querySelector('tbody tr .timing-badge')?.textContent).toBe('W');
    expect(el.querySelector('tbody tr .vocals-badge')?.textContent).toBe('V');
    expect(server.calls.search.map((c) => c.pageToken)).toEqual(['', '2']); // the second page is read ahead by itself
  });

  it('regression: 500 songs are 50 table rows, and Next shows the following 50', async () => {
    const many = Array.from({ length: 500 }, (_, i) => song(String(10000 + i), `Song ${i}`, 'Artist', Format.MP3));
    const { el, settle, button, fixture } = await setup(many, 50);
    await settle(10);
    const rows = () => Array.from(el.querySelectorAll('tbody tr')).map((r) => r.querySelectorAll('td')[2].textContent);
    expect(rows().length).toBe(50);
    expect(rows()[0]).toBe('Song 0');
    button(el, 'Next').click();
    fixture.detectChanges();
    expect(rows().length).toBe(50);
    expect(rows()[0]).toBe('Song 50');
    button(el, 'Previous').click();
    fixture.detectChanges();
    expect(rows()[0]).toBe('Song 0');
  });

  it('has the section "Check the library"', async () => {
    const { el, settle } = await setup();
    await settle();
    const headings = Array.from(el.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(headings.indexOf('Check the library')).toBeGreaterThanOrEqual(0);
  });

  it('searches 250 ms after the last key', async () => {
    const { server, settle, type } = await setup();
    server.calls.search.length = 0;
    type('admin-search', 'br');
    await vi.advanceTimersByTimeAsync(100);
    type('admin-search', 'bra');
    await vi.advanceTimersByTimeAsync(249);
    expect(server.calls.search).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    await settle();
    expect(server.calls.search.map((c) => c.query)).toEqual(['bra']);
  });

  it('Edit opens the title and artist as they are now', async () => {
    const { row, button, settle, el } = await setup();
    button(row('00001'), 'Edit').click();
    await settle();
    expect(el.querySelector<HTMLInputElement>('#edit-title')!.value).toBe('Alpha');
    expect(el.querySelector<HTMLInputElement>('#edit-artist')!.value).toBe('Abba');
    expect(el.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Edit song 00001');
  });

  it('Save sends only what changed; an empty title is sent as empty (it removes the edit)', async () => {
    const { row, button, settle, el, type, server } = await setup();
    button(row('00001'), 'Edit').click();
    await settle();
    type('edit-title', '');
    button(el.querySelector('[role="dialog"]')!, 'Save').click();
    await settle();
    expect(server.calls.update.length).toBe(1);
    expect(server.calls.update[0].number).toBe('00001');
    expect(server.calls.update[0].title).toBe('');
    expect(server.calls.update[0].artist).toBeUndefined();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(row('00001').textContent).toContain('File title'); // what the server answered
  });

  it('changing only the artist sends only the artist', async () => {
    const { row, button, settle, el, type, server } = await setup();
    button(row('00002'), 'Edit').click();
    await settle();
    type('edit-artist', 'The Beatles');
    button(el.querySelector('[role="dialog"]')!, 'Save').click();
    await settle();
    expect(server.calls.update[0].title).toBeUndefined();
    expect(server.calls.update[0].artist).toBe('The Beatles');
  });

  it('saving without a change sends nothing', async () => {
    const { row, button, settle, el, server } = await setup();
    button(row('00001'), 'Edit').click();
    await settle();
    button(el.querySelector('[role="dialog"]')!, 'Save').click();
    await settle();
    expect(server.calls.update).toEqual([]);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Cancel closes the edit without sending', async () => {
    const { row, button, settle, el, type, server } = await setup();
    button(row('00001'), 'Edit').click();
    await settle();
    type('edit-title', 'Something else');
    button(el.querySelector('[role="dialog"]')!, 'Cancel').click();
    await settle();
    expect(server.calls.update).toEqual([]);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('a refused edit stays open with the server\'s words', async () => {
    const { row, button, settle, el, type, server } = await setup();
    server.failNext(new ConnectError('title is too long', Code.InvalidArgument));
    button(row('00001'), 'Edit').click();
    await settle();
    type('edit-title', 'x');
    button(el.querySelector('[role="dialog"]')!, 'Save').click();
    await settle();
    expect(el.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('title is too long');
  });

  it('regression: on a wide screen the row has Edit (plain), Delete (danger), Download and Replace file (quiet) and no More menu shown', async () => {
    const { row } = await setup();
    const wide = Array.from(row('00002').querySelectorAll<HTMLButtonElement>('.wide-only button'));
    expect(wide.map((b) => [b.textContent?.trim(), b.className])).toEqual([
      ['Delete', 'danger'],
      ['Download', 'quiet'],
      ['Replace file', 'quiet'],
    ]);
    const edit = Array.from(row('00002').querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Edit')!;
    expect(edit.className).toBe('');
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
    const narrowAt = css.indexOf('@container (max-width: 44rem)');
    expect(css.slice(0, narrowAt), 'the menu is hidden at a wide size').toMatch(/\.narrow-only[^{]*\{[^}]*display:\s*none/);
  });

  it('regression: in the narrow layout a row has Edit and a More menu with Delete, Download and Replace file (four filled buttons per song before)', async () => {
    const { row, settle, el, fixture } = await setup();
    const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
    const narrow = css.slice(css.indexOf('@container (max-width: 44rem)'));
    expect(narrow).toMatch(/\.wide-only[^{]*\{[^}]*display:\s*none/);
    expect(narrow).toMatch(/\.narrow-only[^{]*\{[^}]*display:\s*inline-flex/);
    const more = row('00002').querySelector<HTMLButtonElement>('app-action-menu.narrow-only button.more')!;
    expect(more.getAttribute('aria-label')).toBe('More actions for Bravo');
    more.click();
    fixture.detectChanges();
    const items = Array.from(row('00002').querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(items.map((b) => b.textContent?.trim())).toEqual(['Delete', 'Download', 'Replace file']);
    expect(items[0].classList.contains('danger')).toBe(true);
    items[0].click();
    await settle();
    expect(el.textContent).toContain('Take "Bravo" off the list, or delete its file too?');
  });

  it('Delete asks first; Delete file too deletes the song and its file', async () => {
    const { row, button, settle, server, el } = await setup();
    button(row('00002'), 'Delete').click();
    await settle();
    expect(row('00002').textContent).toContain('Take "Bravo" off the list, or delete its file too?');
    expect(server.calls.remove).toEqual([]);
    button(row('00002'), 'Delete file too').click();
    await settle();
    expect(server.calls.remove).toEqual(['00002']);
    expect(server.calls.removeKeep).toEqual([false]);
    expect(el.textContent).not.toContain('Bravo');
  });

  it('Remove from list takes the song off the list and keeps its file (keepFile is sent)', async () => {
    const { row, button, settle, server, el } = await setup();
    button(row('00002'), 'Delete').click();
    await settle();
    button(row('00002'), 'Remove from list').click();
    await settle();
    expect(server.calls.remove).toEqual(['00002']);
    expect(server.calls.removeKeep).toEqual([true]);
    expect(el.textContent).not.toContain('Bravo');
  });

  it('Cancel on the question keeps the song', async () => {
    const { row, button, settle, server } = await setup();
    button(row('00002'), 'Delete').click();
    await settle();
    button(row('00002'), 'Cancel').click();
    await settle();
    expect(server.calls.remove).toEqual([]);
    expect(row('00002').textContent).not.toContain('Delete file too');
  });

  it('a refused delete shows the server\'s message, for example a read-only folder', async () => {
    const { row, button, settle, server } = await setup();
    server.failNext(new ConnectError("the song's file could not be deleted: read-only file system", Code.FailedPrecondition));
    button(row('00002'), 'Delete').click();
    await settle();
    button(row('00002'), 'Delete file too').click();
    await settle();
    expect(row('00002').querySelector('[role="alert"]')?.textContent).toContain('read-only file system');
    expect(row('00002')).toBeDefined();
  });

  it('regression: deleting a song that is already gone just takes it off the list', async () => {
    const { row, button, settle, server, el } = await setup();
    server.songs.splice(server.songs.findIndex((x) => x.number === '00002'), 1); // another administrator deleted it
    server.failNext(new ConnectError('song not found', Code.NotFound));
    button(row('00002'), 'Delete').click();
    await settle();
    button(row('00002'), 'Delete file too').click();
    await settle();
    expect(el.textContent).not.toContain('Bravo');
  });

  it('regression: editing a song that is gone says so and takes it off the list', async () => {
    const { row, button, settle, el, type, server } = await setup();
    button(row('00001'), 'Edit').click();
    await settle();
    type('edit-title', 'x');
    server.failNext(new ConnectError('song not found', Code.NotFound));
    button(el.querySelector('[role="dialog"]')!, 'Save').click();
    await settle();
    expect(el.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('That song no longer exists.');
    expect(el.querySelectorAll('tbody tr')[0].textContent).not.toContain('Alpha');
  });

  it('regression: the edit window opens with the cursor in the title and closes on Escape', async () => {
    const { row, button, settle, el } = await setup();
    button(row('00001'), 'Edit').click();
    await settle();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.activeElement?.id).toBe('edit-title');
    el.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('Rescan reports what it found and reads the list again', async () => {
    const { button, settle, server, el } = await setup();
    server.calls.search.length = 0;
    button(el, 'Rescan').click();
    await settle();
    expect(server.calls.rescan).toBe(1);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Added 3, updated 1, removed 0, failed 2');
    expect(server.calls.search.map((c) => c.pageToken)).toEqual(['', '2']); // from the first page again, then the page ahead
  });

  it('REGRESSION: the page has no button Remove all songs and none for songs with no music: songs are removed by choosing them', async () => {
    const { el } = await setup();
    const labels = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).not.toContain('Remove all songs');
    expect(labels).not.toContain('Remove songs with no music');
    expect(el.textContent).not.toMatch(/remove all songs|songs with no music/i);
  });

  describe('choosing songs to remove', () => {
    const box = (row: HTMLElement) => row.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const pageBox = (el: HTMLElement) => el.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!;
    const tick = (input: HTMLInputElement, fixture: { detectChanges(): void }, on = true) => {
      input.checked = on;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
    };
    const bar = (el: HTMLElement) => el.querySelector<HTMLElement>('.selection');

    it('REGRESSION: every row has a checkbox named Select song <number>, and there is no bar while nothing is chosen', async () => {
      const { el, row } = await setup();
      for (const n of ['00001', '00002', '00003']) {
        expect(box(row(n)).getAttribute('aria-label')).toBe(`Select song ${n}`);
        expect(box(row(n)).checked).toBe(false);
      }
      expect(bar(el)).toBeNull();
    });

    it('the header checkbox chooses the page, shows indeterminate when some are chosen, and clears them again', async () => {
      const { el, row, fixture } = await setup();
      expect(pageBox(el).getAttribute('aria-label') ?? el.querySelector('label[for="select-page"]')?.textContent).toMatch(/select all songs on this page/i);
      tick(box(row('00002')), fixture);
      expect(pageBox(el).indeterminate).toBe(true);
      expect(pageBox(el).checked).toBe(false);
      tick(pageBox(el), fixture);
      for (const n of ['00001', '00002', '00003']) expect(box(row(n)).checked, n).toBe(true);
      expect(pageBox(el).indeterminate).toBe(false);
      expect(pageBox(el).checked).toBe(true);
      tick(pageBox(el), fixture, false);
      for (const n of ['00001', '00002', '00003']) expect(box(row(n)).checked, n).toBe(false);
      expect(bar(el)).toBeNull();
    });

    it('the bar says how many are chosen (singular and plural) and can clear the choice', async () => {
      const { el, row, fixture, button } = await setup();
      tick(box(row('00001')), fixture);
      expect(bar(el)?.textContent).toContain('1 song selected');
      tick(box(row('00003')), fixture);
      expect(bar(el)?.textContent).toContain('2 songs selected');
      button(bar(el)!, 'Clear selection').click();
      fixture.detectChanges();
      expect(bar(el)).toBeNull();
      expect(box(row('00001')).checked).toBe(false);
    });

    it('the choice survives going to the next page and back, and a search', async () => {
      const many = Array.from({ length: 120 }, (_, i) => song(String(10000 + i), `Song ${i}`, 'Artist', Format.MP3));
      const { el, row, fixture, button, settle, type } = await setup(many, 50);
      await settle(10);
      tick(box(row('10002')), fixture);
      button(el, 'Next').click();
      fixture.detectChanges();
      tick(box(row('10055')), fixture);
      expect(bar(el)?.textContent).toContain('2 songs selected');
      button(el, 'Previous').click();
      fixture.detectChanges();
      expect(box(row('10002')).checked).toBe(true);
      type('admin-search', 'Song 1');
      await vi.advanceTimersByTimeAsync(300);
      await settle(10);
      expect(bar(el)?.textContent).toContain('2 songs selected');
    });

    it('Remove from list asks first, then sends the chosen numbers with delete_files false, clears the choice and reads the list again', async () => {
      const { el, row, fixture, button, settle, server } = await setup();
      tick(box(row('00001')), fixture);
      tick(box(row('00003')), fixture);
      button(bar(el)!, 'Remove from list').click();
      await settle();
      expect(bar(el)?.querySelector('[role="alert"]')?.textContent).toContain('Take 2 songs off the list');
      expect(server.calls.removeSelected).toEqual([]);
      server.calls.search.length = 0;
      button(bar(el)!, 'Yes, remove').click();
      await settle();
      expect(server.calls.removeSelected).toHaveLength(1);
      expect([...server.calls.removeSelected[0].numbers].sort()).toEqual(['00001', '00003']);
      expect(server.calls.removeSelected[0].deleteFiles).toBe(false);
      expect(bar(el)?.textContent ?? '').not.toContain('selected');
      expect(el.querySelector('.selection-result')?.textContent).toContain('Removed 2 songs from the list. Their files were kept.');
      expect(server.calls.search.length).toBeGreaterThan(0);
    });

    it('Delete files too has its own question and sends delete_files true; the result counts the files that could not be deleted', async () => {
      const { el, row, fixture, button, settle, server } = await setup();
      server.handlers.removeSelected = { removed: 2, filesDeleted: 1, filesFailed: 1 };
      tick(box(row('00001')), fixture);
      tick(box(row('00002')), fixture);
      button(bar(el)!, 'Delete files too').click();
      await settle();
      expect(bar(el)?.querySelector('[role="alert"]')?.textContent).toContain('Delete 2 songs and their files? This cannot be undone.');
      button(bar(el)!, 'Yes, delete').click();
      await settle();
      expect(server.calls.removeSelected[0].deleteFiles).toBe(true);
      const result = el.querySelector('.selection-result')?.textContent ?? '';
      expect(result).toContain('Removed 2 songs from the list');
      expect(result).toContain('1 file deleted');
      expect(result).toContain('1 file could not be deleted');
    });

    it('Cancel sends nothing and keeps the choice', async () => {
      const { el, row, fixture, button, settle, server } = await setup();
      tick(box(row('00002')), fixture);
      button(bar(el)!, 'Remove from list').click();
      await settle();
      button(bar(el)!, 'Cancel').click();
      await settle();
      expect(server.calls.removeSelected).toEqual([]);
      expect(bar(el)?.textContent).toContain('1 song selected');
      expect(bar(el)?.querySelector('[role="alert"]')).toBeNull();
    });

    it('a refusal is shown and the choice stays', async () => {
      const { el, row, fixture, button, settle, server } = await setup();
      tick(box(row('00001')), fixture);
      button(bar(el)!, 'Remove from list').click();
      await settle();
      server.failNext(new ConnectError('boom', Code.Internal));
      button(bar(el)!, 'Yes, remove').click();
      await settle();
      expect(bar(el)?.querySelector('.error')?.textContent).toBeTruthy();
      expect(bar(el)?.textContent).toContain('1 song selected');
    });

    it('at 1000 chosen no more can be added and the bar says so', async () => {
      const many = Array.from({ length: 1001 }, (_, i) => song(String(10000 + i), `Song ${i}`, 'Artist', Format.MP3));
      const { el, fixture, settle, server, button } = await setup(many, 200);
      await settle(10);
      // twenty pages of fifty, each chosen with its header checkbox
      for (let page = 0; page < 20; page++) {
        tick(pageBox(el), fixture);
        button(el, 'Next').click();
        await settle(10);
      }
      expect(bar(el)?.textContent).toContain('1000 songs selected');
      const last = el.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!;
      tick(last, fixture);
      expect(last.checked).toBe(false);
      expect(bar(el)?.textContent).toContain('1000 songs selected');
      expect(bar(el)?.textContent).toMatch(/at most 1000/i);
      expect(server.calls.removeSelected).toEqual([]);
    });
  });

  it('a failed Rescan says so', async () => {
    const { button, settle, server, el } = await setup();
    server.failNext(new ConnectError('scan is already running', Code.FailedPrecondition));
    button(el, 'Rescan').click();
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('scan is already running');
  });

  it('every button names its song', async () => {
    const { row } = await setup();
    const labels = Array.from(row('00001').querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Edit Alpha', 'Delete Alpha', 'Download Alpha', 'Replace file: Alpha', 'More actions for Alpha']);
  });

  describe('download and replace', () => {
    /** Chooses a file in the page's one file picker, as the browser does after the Replace file button opened it. */
    const choose = async (el: HTMLElement, settle: () => Promise<void>, file: File) => {
      const input = el.querySelector<HTMLInputElement>('#replace-file')!;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };
    const file = (name = 'new.karmp3', bytes = [80, 75, 3, 4]) => new File([new Uint8Array(bytes)], name);

    it('every row has Download and Replace file, named for screen readers', async () => {
      const { el, row } = await setup();
      for (const [n, title] of [['00001', 'Alpha'], ['00002', 'Bravo']]) {
        const labels = Array.from(row(n).querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
        expect(labels).toContain(`Download ${title}`);
        expect(labels).toContain(`Replace file: ${title}`);
      }
      const input = el.querySelector<HTMLInputElement>('#replace-file')!;
      expect(input.type).toBe('file');
      expect(input.accept).toBe('.kar,.karmp3');
      expect(input.multiple).toBe(false);
    });

    it('Download asks for the address of that song and saves it under the name the server gave', async () => {
      const { row, server, settle, saved } = await setup();
      (row('00002').querySelector('button[aria-label="Download Bravo"]') as HTMLButtonElement).click();
      await settle();
      expect(server.calls.download).toEqual(['00002']);
      expect(saved).toEqual([{ url: `${location.origin}/media/download/00002?u=u1&exp=1&sig=s`, name: '00002 - Artist - Title.karmp3' }]);
    });

    it('a failed Download says so on the row and saves nothing', async () => {
      const { row, server, settle, saved } = await setup();
      server.failNext(new ConnectError('no such song', Code.NotFound));
      (row('00001').querySelector('button[aria-label="Download Alpha"]') as HTMLButtonElement).click();
      await settle();
      expect(saved).toEqual([]);
      expect(row('00001').querySelector('[role="alert"]')?.textContent).toContain('no such song');
      server.failNext(new ConnectError('internal error', Code.Internal));
      (row('00001').querySelector('button[aria-label="Download Alpha"]') as HTMLButtonElement).click();
      await settle();
      expect(row('00001').querySelector('[role="alert"]')?.textContent).toContain('Something went wrong');
    });

    it('Replace file sends the chosen file with the number of the song and shows the result', async () => {
      const { el, row, server, settle } = await setup();
      server.handlers.upload = () => ({ status: UploadStatus.UPDATED, number: '00002' });
      (row('00002').querySelector('button[aria-label="Replace file: Bravo"]') as HTMLButtonElement).click();
      await choose(el, settle, file('new-bravo.kar', [77, 84, 104, 100]));
      expect(server.calls.upload.length).toBe(1);
      const req = server.calls.upload[0];
      expect([req.filename, req.replaceNumber, Array.from(req.content)]).toEqual(['new-bravo.kar', '00002', [77, 84, 104, 100]]);
      expect(row('00002').querySelector('[role="status"]')?.textContent).toContain('Replaced 00002.');
      expect(row('00002').textContent).toContain('new-bravo.kar'); // the row shows the song the server answered
    });

    it('a rejected replace shows the reason and a duplicate says the file is the song already', async () => {
      const { el, row, server, settle } = await setup();
      server.handlers.upload = () => ({ status: UploadStatus.REJECTED, reason: 'the file must be a .kar, like the song it replaces' });
      (row('00002').querySelector('button[aria-label="Replace file: Bravo"]') as HTMLButtonElement).click();
      await choose(el, settle, file('x.karmp3'));
      expect(row('00002').querySelector('[role="alert"]')?.textContent).toContain('the file must be a .kar');
      server.handlers.upload = () => ({ status: UploadStatus.DUPLICATE, number: '00002' });
      (row('00002').querySelector('button[aria-label="Replace file: Bravo"]') as HTMLButtonElement).click();
      await choose(el, settle, file('same.kar'));
      expect(row('00002').textContent).toContain('That file is already this song.');
      expect(row('00002').querySelector('[role="alert"]')).toBeNull();
    });

    it('a call that fails shows the server text for a refusal and the general one otherwise', async () => {
      const { el, row, server, settle } = await setup();
      server.failNext(new ConnectError('administrator access required', Code.PermissionDenied));
      (row('00001').querySelector('button[aria-label="Replace file: Alpha"]') as HTMLButtonElement).click();
      await choose(el, settle, file());
      expect(row('00001').querySelector('[role="alert"]')?.textContent).toContain('administrator access required');
    });

    it('both buttons of the row are off while its call runs', async () => {
      const { el, row, server, settle } = await setup();
      let release!: () => void;
      server.handlers.upload = () => new Promise((resolve) => (release = () => resolve({ status: UploadStatus.UPDATED, number: '00001' })));
      (row('00001').querySelector('button[aria-label="Replace file: Alpha"]') as HTMLButtonElement).click();
      await choose(el, settle, file());
      const buttons = () => Array.from(row('00001').querySelectorAll<HTMLButtonElement>('button[aria-label^="Download"], button[aria-label^="Replace"]'));
      expect(buttons().length).toBe(2);
      expect(buttons().every((b) => b.disabled)).toBe(true);
      expect(row('00002').querySelector<HTMLButtonElement>('button[aria-label^="Download"]')!.disabled).toBe(false);
      release();
      await settle();
      expect(buttons().every((b) => !b.disabled)).toBe(true);
    });

    it('choosing nothing sends nothing', async () => {
      const { el, row, server, settle } = await setup();
      (row('00001').querySelector('button[aria-label="Replace file: Alpha"]') as HTMLButtonElement).click();
      const input = el.querySelector<HTMLInputElement>('#replace-file')!;
      Object.defineProperty(input, 'files', { value: [], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      expect(server.calls.upload).toEqual([]);
    });
  });

  describe('filters and sorting', () => {
    const MIXED = [
      song('00001', 'Alpha', 'Abba', Format.MP3, false, { lyricTiming: LyricTiming.WORD, hasVocals: true }),
      song('00002', 'Bravo', 'Beatles', Format.MP3, false, { lyricTiming: LyricTiming.LINE }),
      song('00003', 'Charlie', 'Cher', Format.MIDI, false, { lyricTiming: LyricTiming.LINE }),
      song('00004', 'Delta', 'Dido', Format.MP3, false, { lyricTiming: LyricTiming.WORD }),
    ];
    const lastSearch = (server: { calls: { search: SearchSongsRequest[] } }) => server.calls.search.filter((c) => c.pageToken === '').at(-1)!;
    const numbers = (el: HTMLElement) => Array.from(el.querySelectorAll('tbody tr')).map((r) => r.querySelectorAll('td')[1].textContent?.trim());
    const choose = async (el: HTMLElement, id: string, value: string, settle: () => Promise<void>) => {
      const select = el.querySelector<HTMLSelectElement>('#' + id)!;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };
    const header = (el: HTMLElement, name: string) => el.querySelector<HTMLButtonElement>(`th button[aria-label="${name}, sort"]`)!;
    const sortOf = (el: HTMLElement) => Array.from(el.querySelectorAll('thead th')).map((th) => th.getAttribute('aria-sort'));

    it('every filter is sent to the server from the first page', async () => {
      const { el, server, settle } = await setup(MIXED, 10);
      await choose(el, 'filter-format', String(Format.MIDI), settle);
      expect(lastSearch(server)).toMatchObject({ format: Format.MIDI });
      expect(numbers(el)).toEqual(['00003']);
      await choose(el, 'filter-format', '0', settle);
      await choose(el, 'filter-vocals', 'with', settle);
      expect(lastSearch(server).hasVocals).toBe(true);
      expect(numbers(el)).toEqual(['00001']);
      await choose(el, 'filter-vocals', 'without', settle);
      expect(lastSearch(server).hasVocals).toBe(false);
      expect(numbers(el)).toEqual(['00002', '00003', '00004']);
      await choose(el, 'filter-vocals', 'any', settle);
      expect(lastSearch(server).hasVocals).toBeUndefined();
      await choose(el, 'filter-timing', 'word', settle);
      expect(lastSearch(server).lyricTiming).toBe(LyricTiming.WORD);
      expect(numbers(el)).toEqual(['00001', '00004']);
      await choose(el, 'filter-timing', 'line', settle);
      expect(lastSearch(server).lyricTiming).toBe(LyricTiming.LINE);
      expect(numbers(el)).toEqual(['00002', '00003']);
    });

    it('filters combine, and Clear filters resets them and is shown only while one is set', async () => {
      const { el, server, settle, button } = await setup(MIXED, 10);
      expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Clear filters')).toBe(false);
      await choose(el, 'filter-format', String(Format.MP3), settle);
      await choose(el, 'filter-timing', 'word', settle);
      expect(numbers(el)).toEqual(['00001', '00004']);
      button(el, 'Clear filters').click();
      await settle();
      expect(lastSearch(server)).toMatchObject({ format: Format.UNSPECIFIED, lyricTiming: LyricTiming.UNSPECIFIED });
      expect(lastSearch(server).hasVocals).toBeUndefined();
      expect(numbers(el)).toHaveLength(4);
      expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Clear filters')).toBe(false);
    });

    it('the next pages of a filtered and sorted list carry the same filters and order', async () => {
      const many = Array.from({ length: 7 }, (_, i) => song(String(20000 + i), `Midi ${i}`, 'Band', Format.MIDI, false, { lyricTiming: LyricTiming.LINE }));
      const { el, server, settle } = await setup([...many, song('30000', 'Plain mp3', 'Band', Format.MP3)], 2);
      await choose(el, 'filter-format', String(Format.MIDI), settle);
      header(el, 'Title').click();
      await settle(10);
      header(el, 'Title').click();
      await settle(10);
      // the last request is a later page (read ahead), and it asks for the same list as the first page of the new order
      const last = server.calls.search.at(-1)!;
      expect(last.pageToken).not.toBe('');
      expect(last).toMatchObject({ format: Format.MIDI, sort: SongSort.TITLE, descending: true });
    });

    it('says that no song matches the filters, and not that there are no songs', async () => {
      const { el, settle } = await setup(MIXED, 10);
      await choose(el, 'filter-format', String(Format.MIDI), settle);
      await choose(el, 'filter-vocals', 'with', settle);
      expect(el.textContent).toContain('No songs match these filters');
      expect(el.textContent).not.toContain('No songs found.');
    });

    it('REGRESSION: the headers are buttons: a click sorts ascending, the same header again descending, another header starts again', async () => {
      const { el, server, settle } = await setup(MIXED, 10);
      header(el, 'Title').click();
      await settle();
      expect(lastSearch(server)).toMatchObject({ sort: SongSort.TITLE, descending: false });
      expect(sortOf(el)).toEqual([null, 'none', 'ascending', 'none', 'none', 'none', 'none', null]);
      expect(numbers(el)).toEqual(['00001', '00002', '00003', '00004']);
      header(el, 'Title').click();
      await settle();
      expect(lastSearch(server)).toMatchObject({ sort: SongSort.TITLE, descending: true });
      expect(sortOf(el)[2]).toBe('descending');
      expect(numbers(el)).toEqual(['00004', '00003', '00002', '00001']);
      header(el, 'Artist').click();
      await settle();
      expect(lastSearch(server)).toMatchObject({ sort: SongSort.ARTIST, descending: false });
      expect(sortOf(el)).toEqual([null, 'none', 'none', 'ascending', 'none', 'none', 'none', null]);
    });

    it('every sortable column asks for its own order', async () => {
      const { el, server, settle } = await setup(MIXED, 10);
      for (const [name, sort] of [
        ['Number', SongSort.NUMBER],
        ['Format', SongSort.FORMAT],
        ['Lyrics', SongSort.LYRIC_TIMING],
        ['Vocals', SongSort.VOCALS],
      ] as const) {
        header(el, name).click();
        await settle();
        expect(lastSearch(server).sort, name).toBe(sort);
      }
      header(el, 'Vocals').click(); // twice: descending, the songs with vocals first
      await settle();
      expect(numbers(el)[0]).toBe('00001');
    });

    it('with no header clicked a text search keeps its relevance order, and no header says it is sorted', async () => {
      const { el, server, settle, type } = await setup(MIXED, 10);
      type('admin-search', 'a');
      await vi.advanceTimersByTimeAsync(300);
      await settle();
      expect(lastSearch(server).sort).toBe(SongSort.UNSPECIFIED);
      expect(sortOf(el).filter((v) => v !== null)).toEqual(['none', 'none', 'none', 'none', 'none', 'none']);
    });

    it('a sort and a filter stay when the search text changes', async () => {
      const { el, server, settle, type } = await setup(MIXED, 10);
      header(el, 'Title').click();
      await settle();
      await choose(el, 'filter-format', String(Format.MP3), settle);
      type('admin-search', 'a');
      await vi.advanceTimersByTimeAsync(300);
      await settle();
      expect(lastSearch(server)).toMatchObject({ query: 'a', sort: SongSort.TITLE, format: Format.MP3 });
    });

    it('the Format, Lyrics and Vocals columns each show one badge', async () => {
      const { el, row, settle } = await setup(MIXED, 10);
      await settle();
      const cells = (n: string) => Array.from(row(n).querySelectorAll('td')).map((td) => td.textContent?.trim());
      // pick, number, title, artist, format, lyrics, vocals, actions
      expect(cells('00001').slice(4, 7)).toEqual(['MP3', 'W', 'V']);
      expect(cells('00003').slice(4, 7)).toEqual(['MIDI', 'L', '']);
      expect(el.querySelectorAll('thead th')).toHaveLength(8);
    });

    it('the songs that are chosen stay chosen when a filter changes', async () => {
      const { el, settle } = await setup(MIXED, 10);
      const box = el.querySelector<HTMLInputElement>('input[aria-label="Select song 00001"]')!;
      box.click();
      await settle();
      await choose(el, 'filter-format', String(Format.MIDI), settle);
      expect(el.textContent).toContain('1 song selected');
      await choose(el, 'filter-format', '0', settle);
      expect(el.querySelector<HTMLInputElement>('input[aria-label="Select song 00001"]')!.checked).toBe(true);
    });

    it('REGRESSION: where the table turns into blocks the header buttons are hidden from the keyboard and the screen reader (the Sort by select takes over)', async () => {
      await setup(MIXED, 10);
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
      const narrow = css.slice(css.indexOf('@container (max-width: 44rem)'));
      expect(narrow).toMatch(/thead[^{]*button\.sort[^{]*\{[^}]*visibility:\s*hidden/);
      // and at a wide size they are shown: the rule is not outside the container query
      expect(css.slice(0, css.indexOf('@container (max-width: 44rem)'))).not.toMatch(/button\.sort[^{]*\{[^}]*visibility:\s*hidden/);
    });

    it('regression: where the header buttons are hidden each column header still has its name for screen readers (axe empty-table-header)', async () => {
      const { el } = await setup(MIXED, 10);
      const headers = Array.from(el.querySelectorAll('thead th[aria-sort]'));
      expect(headers.length).toBeGreaterThan(0);
      for (const th of headers) expect(th.querySelector('.narrow-label')?.textContent?.trim(), th.innerHTML).toBe(th.querySelector('button.sort')!.firstChild!.textContent!.trim());
      const css = Array.from(document.querySelectorAll('style')).map((st) => st.textContent ?? '').join('\n');
      const narrow = css.slice(css.indexOf('@container (max-width: 44rem)'));
      expect(css.slice(0, css.indexOf('@container (max-width: 44rem)')), 'hidden at a wide size').toMatch(/\.narrow-label[^{]*\{[^}]*display:\s*none/);
      expect(narrow, 'shown (to screen readers) in the narrow layout').toMatch(/\.narrow-label[^{]*\{[^}]*display:\s*inline/);
    });

    it('the Sort by select and its direction button drive the same order (for a phone, where the header row is hidden)', async () => {
      const { el, server, settle } = await setup(MIXED, 10);
      await choose(el, 'sort-by', 'title', settle);
      expect(lastSearch(server)).toMatchObject({ sort: SongSort.TITLE, descending: false });
      const direction = el.querySelector<HTMLButtonElement>('#sort-direction')!;
      expect(direction.textContent).toContain('Ascending');
      direction.click();
      await settle();
      expect(lastSearch(server)).toMatchObject({ sort: SongSort.TITLE, descending: true });
      expect(direction.textContent).toContain('Descending');
      expect(sortOf(el)[2]).toBe('descending');
      await choose(el, 'sort-by', '', settle);
      expect(lastSearch(server).sort).toBe(SongSort.UNSPECIFIED);
    });
  });
});
