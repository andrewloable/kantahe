import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { TRANSPORT } from '../core/api';
import { ToastService } from '../core/toast';
import { PlaylistsComponent } from './playlists.component';
import { fakeMe, song } from './testing';

const ONE = song('1', 'Alpha', 'A');
const TWO = song('2', 'Bravo', 'B');

async function setup(opts: { failFirst?: boolean } = {}) {
  const server = fakeMe({
    playlists: [
      { id: 'p1', name: 'Party', songs: [ONE, TWO] },
      { id: 'p2', name: 'Slow', songs: [ONE] },
    ],
  });
  if (opts.failFirst) server.failNext(new ConnectError('down', Code.Unavailable));
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(PlaylistsComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  const button = (within: ParentNode, text: string) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text));
  const row = (name: string) => Array.from(el.querySelectorAll('li')).find((li) => li.textContent?.includes(name)) as HTMLElement;
  return { fixture, el, server, settle, button, row };
}

describe('PlaylistsComponent', () => {
  it('regression: a failed load shows an inline error with Try again (not only a toast), and Try again loads the list', async () => {
    const { el, settle, button } = await setup({ failFirst: true });
    expect(el.querySelector('[role="alert"]'), 'the error is on the page').not.toBeNull();
    expect(el.querySelectorAll('li.playlist')).toHaveLength(0);
    expect(el.textContent, 'no "No playlists yet" next to the error').not.toContain('No playlists yet');
    expect(TestBed.inject(ToastService).toasts(), 'no toast for the first load').toHaveLength(0);
    button(el, 'Try again')!.click();
    await settle();
    expect(el.querySelectorAll('li.playlist')).toHaveLength(2);
  });

  it('lists the playlists with their song counts, each linking to its page', async () => {
    const { el } = await setup();
    const rows = Array.from(el.querySelectorAll('li.playlist'));
    expect(rows.map((r) => r.querySelector('a')?.textContent?.trim())).toEqual(['Party', 'Slow']);
    expect(rows[0].textContent).toContain('2 songs');
    expect(rows[1].textContent).toContain('1 song');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/me/playlists/p1');
  });

  it('creates a playlist with a name', async () => {
    const { el, server, settle, fixture } = await setup();
    const input = el.querySelector<HTMLInputElement>('#new-playlist')!;
    input.value = '  Road trip ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(server.calls.create).toEqual([{ name: 'Road trip', numbers: [] }]);
    expect(el.textContent).toContain('Road trip');
    expect(input.value).toBe('');
    void fixture;
  });

  it('asks for a name', async () => {
    const { el, server, settle } = await setup();
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(server.calls.create).toEqual([]);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Enter a name');
  });

  it('a double submit creates one playlist', async () => {
    const { el, server, settle } = await setup();
    const input = el.querySelector<HTMLInputElement>('#new-playlist')!;
    input.value = 'Once';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(server.calls.create.length).toBe(1);
  });

  it('renames a playlist: only the name is sent', async () => {
    const { el, server, settle, button, row } = await setup();
    button(row('Party'), 'Rename')!.click();
    await settle();
    const input = row('Party').querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('Party');
    input.value = 'Parties';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button(row('Party'), 'Save')!.click();
    await settle();
    expect(server.calls.update).toEqual([{ id: 'p1', name: 'Parties', replace: false, numbers: [] }]);
    expect(el.textContent).toContain('Parties');
  });

  it('renaming can be cancelled', async () => {
    const { server, settle, button, row } = await setup();
    button(row('Party'), 'Rename')!.click();
    await settle();
    button(row('Party'), 'Cancel')!.click();
    await settle();
    expect(server.calls.update).toEqual([]);
    expect(row('Party').querySelector('input')).toBeNull();
  });

  it('delete asks first; confirming deletes, cancelling does not', async () => {
    const { el, server, settle, button, row } = await setup();
    button(row('Slow'), 'Delete')!.click();
    await settle();
    expect(row('Slow').textContent).toContain('Delete "Slow"?');
    button(row('Slow'), 'Cancel')!.click();
    await settle();
    expect(server.calls.remove).toEqual([]);
    button(row('Slow'), 'Delete')!.click();
    await settle();
    button(row('Slow'), 'Yes, delete')!.click();
    await settle();
    expect(server.calls.remove).toEqual(['p2']);
    expect(el.textContent).not.toContain('Slow');
  });

  it('every button names its playlist', async () => {
    const { row } = await setup();
    const labels = Array.from(row('Party').querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Rename Party');
    expect(labels).toContain('Delete Party');
  });

  it('shows a refusal from the server as an error', async () => {
    const { el, server, settle } = await setup();
    server.failNext(new ConnectError('too long', Code.InvalidArgument));
    const input = el.querySelector<HTMLInputElement>('#new-playlist')!;
    input.value = 'x';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('too long');
  });

  it('says so when there are none', async () => {
    const server = fakeMe();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] });
    const fixture = TestBed.createComponent(PlaylistsComponent);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No playlists yet.');
  });
});
