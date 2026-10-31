import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TRANSPORT } from '../core/api';
import { ToastService } from '../core/toast';
import { PlaylistDetailComponent } from './playlist-detail.component';
import { fakeMe, song } from './testing';

const A = song('1', 'Alpha', 'A');
const B = song('2', 'Bravo', 'B');
const C = song('3', 'Charlie', 'C');

async function setup(songs = [A, B, C]) {
  const server = fakeMe({ playlists: [{ id: 'p1', name: 'Party', songs }] });
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'me/playlists/:id', component: PlaylistDetailComponent }]), { provide: TRANSPORT, useValue: server.transport }],
  });
  const harness = await RouterTestingHarness.create();
  const open = async (id = 'p1') => {
    await harness.navigateByUrl(`/me/playlists/${id}`, PlaylistDetailComponent);
    await settle();
  };
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    harness.fixture.detectChanges();
  };
  await open();
  const el = harness.fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('li.entry'));
  const titles = () => rows().map((r) => r.querySelector('.title')?.textContent);
  const click = (row: HTMLElement, text: string) => Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!.click();
  return { harness, el, server, settle, rows, titles, click, open };
}

describe('PlaylistDetailComponent', () => {
  it('shows the name and the songs in order', async () => {
    const { el, titles } = await setup();
    expect(el.querySelector('h2')?.textContent).toContain('Party');
    expect(titles()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('Move down sends the whole new order and replaces the songs', async () => {
    const { server, click, rows, settle, titles } = await setup();
    click(rows()[0], 'Move down');
    await settle();
    expect(server.calls.update).toEqual([{ id: 'p1', name: undefined, replace: true, numbers: ['2', '1', '3'] }]);
    expect(titles()).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });

  it('Move up', async () => {
    const { server, click, rows, settle, titles } = await setup();
    click(rows()[2], 'Move up');
    await settle();
    expect(server.calls.update[0].numbers).toEqual(['1', '3', '2']);
    expect(server.calls.update[0].replace).toBe(true);
    expect(titles()).toEqual(['Alpha', 'Charlie', 'Bravo']);
  });

  it('the first song cannot move up and the last cannot move down', async () => {
    const { rows } = await setup();
    const labels = (r: HTMLElement) => Array.from(r.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels(rows()[0])).not.toContain('Move up');
    expect(labels(rows()[0])).toContain('Move down');
    expect(labels(rows()[2])).not.toContain('Move down');
    expect(labels(rows()[2])).toContain('Move up');
  });

  it('Remove sends the list without that song', async () => {
    const { server, click, rows, settle, titles } = await setup();
    click(rows()[1], 'Remove');
    await settle();
    expect(server.calls.update).toEqual([{ id: 'p1', name: undefined, replace: true, numbers: ['1', '3'] }]);
    expect(titles()).toEqual(['Alpha', 'Charlie']);
  });

  it('regression: a playlist that changed elsewhere is not overwritten by an old order; the page shows the new content instead', async () => {
    const { server, click, rows, settle, titles } = await setup();
    // another device appended a song after this page was opened
    server.playlists.get('p1')!.songs.push(song('9', 'Delta', 'D'));
    server.catalog.set('9', song('9', 'Delta', 'D'));
    click(rows()[0], 'Move down');
    await settle();
    expect(server.calls.update).toEqual([]);
    expect(titles()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('This playlist was changed on another device. Look at it again and repeat the change.');
    click(rows()[0], 'Move down'); // now it matches what the server has
    await settle();
    expect(server.calls.update[0].numbers).toEqual(['2', '1', '3', '9']);
  });

  it('a playlist that is the same on the server is saved straight away', async () => {
    const { server, click, rows, settle } = await setup();
    click(rows()[0], 'Move down');
    await settle();
    expect(server.calls.update.length).toBe(1);
  });

  it('works by position, so a song that is in the list twice moves correctly', async () => {
    const { server, click, rows, settle } = await setup([A, B, A]);
    click(rows()[2], 'Move up');
    await settle();
    expect(server.calls.update[0].numbers).toEqual(['1', '1', '2']);
  });

  it('a double click sends one change, and the next one works afterwards', async () => {
    const { server, click, rows, settle } = await setup();
    click(rows()[0], 'Move down');
    click(rows()[0], 'Move down');
    await settle();
    expect(server.calls.update.length).toBe(1);
    click(rows()[1], 'Move down');
    await settle();
    expect(server.calls.update.length).toBe(2);
  });

  it('every button names its song', async () => {
    const { rows } = await setup();
    const labels = Array.from(rows()[1].querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(expect.arrayContaining(['Move Bravo up', 'Move Bravo down', 'Remove Bravo from the playlist']));
  });

  it('Add all to queue appends the playlist and says how many', async () => {
    const { el, server, settle } = await setup();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Add all to queue'))!.click();
    await settle();
    expect(server.calls.toQueue).toEqual(['p1']);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Added 3 songs to the queue');
  });

  it('an empty playlist says so and has nothing to add', async () => {
    const { el } = await setup([]);
    expect(el.textContent).toContain('This playlist is empty. Add songs from the library.');
    expect((Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Add all to queue')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a playlist that is gone says so', async () => {
    const { el, open } = await setup();
    await open('nope');
    expect(el.textContent).toContain('This playlist no longer exists.');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/me/playlists');
  });

  it('has a way back to the list', async () => {
    const { el } = await setup();
    expect(el.querySelector('a[href="/me/playlists"]')).not.toBeNull();
  });
});
