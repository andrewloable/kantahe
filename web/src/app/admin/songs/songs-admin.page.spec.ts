import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { Format } from '../../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../../core/api';
import { fakeAdminSongs, song } from '../testing';
import { SongsAdminPage } from './songs-admin.page';

const SONGS = [song('00001', 'Alpha', 'Abba', Format.MP3), song('00002', 'Bravo', 'Beatles', Format.MIDI), song('00003', 'Charlie', 'Cher', Format.MIDI)];

async function setup() {
  const server = fakeAdminSongs({ songs: SONGS });
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
    const { el, settle, button, server } = await setup();
    expect(Array.from(el.querySelectorAll('tbody tr')).map((r) => r.querySelectorAll('td')[0].textContent?.trim())).toEqual(['00001', '00002']);
    expect(el.textContent).toContain('MP3');
    button(el, 'Load more').click();
    await settle();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(server.calls.search.map((c) => c.pageToken)).toEqual(['', '2']);
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

  it('Delete asks first; confirming deletes the song from the list', async () => {
    const { row, button, settle, server, el } = await setup();
    button(row('00002'), 'Delete').click();
    await settle();
    expect(row('00002').textContent).toContain('Delete "Bravo" and its file?');
    expect(server.calls.remove).toEqual([]);
    button(row('00002'), 'Yes, delete').click();
    await settle();
    expect(server.calls.remove).toEqual(['00002']);
    expect(el.textContent).not.toContain('Bravo');
  });

  it('Cancel on the question keeps the song', async () => {
    const { row, button, settle, server } = await setup();
    button(row('00002'), 'Delete').click();
    await settle();
    button(row('00002'), 'Cancel').click();
    await settle();
    expect(server.calls.remove).toEqual([]);
    expect(row('00002').textContent).not.toContain('Yes, delete');
  });

  it('a refused delete shows the server\'s message, for example a read-only folder', async () => {
    const { row, button, settle, server } = await setup();
    server.failNext(new ConnectError("the song's file could not be deleted: read-only file system", Code.FailedPrecondition));
    button(row('00002'), 'Delete').click();
    await settle();
    button(row('00002'), 'Yes, delete').click();
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
    button(row('00002'), 'Yes, delete').click();
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
    expect(server.calls.search.length).toBe(1);
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
