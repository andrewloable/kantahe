import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { Format } from '../../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../../core/api';
import { fakeAdminSongs, RemoveScope, song } from '../testing';
import { SongsAdminPage } from './songs-admin.page';

const SONGS = [song('00001', 'Alpha', 'Abba', Format.MP3), song('00002', 'Bravo', 'Beatles', Format.MIDI), song('00003', 'Charlie', 'Cher', Format.MIDI)];

async function setup(songs = SONGS, pageSize?: number) {
  const server = fakeAdminSongs({ songs, pageSize });
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
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
  return { fixture, el, server, settle, row, button, type };
}

describe('SongsAdminPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lists songs page by page with number, title, artist and format', async () => {
    const { el, settle, server } = await setup();
    await settle();
    expect(Array.from(el.querySelectorAll('tbody tr')).map((r) => r.querySelectorAll('td')[0].textContent?.trim())).toEqual(['00001', '00002', '00003']);
    expect(el.textContent).toContain('MP3');
    expect(server.calls.search.map((c) => c.pageToken)).toEqual(['', '2']); // the second page is read ahead by itself
  });

  it('regression: 500 songs are 50 table rows, and Next shows the following 50', async () => {
    const many = Array.from({ length: 500 }, (_, i) => song(String(10000 + i), `Song ${i}`, 'Artist', Format.MP3));
    const { el, settle, button, fixture } = await setup(many, 50);
    await settle(10);
    const rows = () => Array.from(el.querySelectorAll('tbody tr')).map((r) => r.querySelectorAll('td')[1].textContent);
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

  it('has the section "Check the library" above the removal buttons', async () => {
    const { el, settle } = await setup();
    await settle();
    const headings = Array.from(el.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(headings.indexOf('Check the library')).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf('Check the library')).toBeLessThan(headings.indexOf('Remove songs from the list'));
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

  describe('removing many songs from the list', () => {
    const askFor = async (label: string) => {
      const env = await setup();
      env.button(env.el, label).click();
      await env.settle();
      return env;
    };

    it('asks first, says the files stay, and sends nothing until it is confirmed', async () => {
      const { el, server } = await askFor('Remove songs with no music');
      expect(el.querySelector('.bulk [role="alert"]')?.textContent).toContain('The files stay where they are');
      expect(server.calls.removeSongs).toEqual([]);
    });

    it('Cancel closes the question and sends nothing', async () => {
      const { el, server, button, settle } = await askFor('Remove all songs');
      button(el.querySelector('.bulk')!, 'Cancel').click();
      await settle();
      expect(el.querySelector('.bulk [role="alert"]')).toBeNull();
      expect(server.calls.removeSongs).toEqual([]);
    });

    it('songs with no music: the scope is NO_MUSIC, the result is shown and the list is read again', async () => {
      const { el, server, button, settle } = await askFor('Remove songs with no music');
      server.calls.search.length = 0;
      button(el.querySelector('.bulk')!, 'Remove').click();
      await settle();
      expect(server.calls.removeSongs).toEqual([RemoveScope.NO_MUSIC]);
      expect(el.querySelector('.bulk [role="status"]')?.textContent).toContain('Removed 5 songs from the list. Their files were kept.');
      expect(server.calls.search.length).toBeGreaterThan(0);
    });

    it('all songs: the scope is ALL; one song is said in the singular', async () => {
      const { el, server, button, settle } = await askFor('Remove all songs');
      expect(el.querySelector('.bulk [role="alert"]')?.textContent).toContain('every song');
      server.handlers.removeSongs.removed = 1;
      button(el.querySelector('.bulk')!, 'Remove').click();
      await settle();
      expect(server.calls.removeSongs).toEqual([RemoveScope.ALL]);
      expect(el.querySelector('.bulk [role="status"]')?.textContent).toContain('Removed 1 song from the list. Its file was kept.');
    });

    it('a failure is shown and nothing else changes', async () => {
      const { el, server, button, settle } = await askFor('Remove all songs');
      server.failNext(new ConnectError('boom', Code.Internal));
      button(el.querySelector('.bulk')!, 'Remove').click();
      await settle();
      expect(el.querySelector('.bulk .error')?.textContent).toBeTruthy();
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
    expect(labels).toEqual(['Edit Alpha', 'Delete Alpha']);
  });
});
