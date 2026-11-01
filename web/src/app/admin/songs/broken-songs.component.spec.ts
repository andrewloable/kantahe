import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { Format } from '../../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../../core/api';
import { fakeAdminSongs, RemoveScope, song } from '../testing';
import { BrokenSongsComponent } from './broken-songs.component';

const broken = (n: number, reason = 'the file is missing') => Array.from({ length: n }, (_, i) => ({ song: song(String(20000 + i), `Broken ${i}`, 'Artist', i % 2 ? Format.MIDI : Format.MP3), reason }));

async function setup(list = broken(3), pageSize = 50) {
  const server = fakeAdminSongs({ broken: list, pageSize });
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(BrokenSongsComponent);
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (n = 6) => {
    for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  };
  fixture.detectChanges();
  await settle();
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('li.broken'));
  const button = (text: string, within: ParentNode = el) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(text));
  return { fixture, el, server, settle, rows, button };
}

describe('BrokenSongsComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lists the broken songs with their reasons when the page opens, without a new check', async () => {
    const { el, rows, server } = await setup();
    expect(rows().length).toBe(3);
    expect(rows()[0].textContent).toContain('Broken 0');
    expect(rows()[0].textContent).toContain('the file is missing');
    expect(el.textContent).toContain('3 broken songs');
    expect(server.calls.checks).toBe(0);
  });

  it('shows nothing about broken songs while there are none', async () => {
    const { el, rows } = await setup([]);
    expect(rows().length).toBe(0);
    expect(el.querySelector('h4'), 'no list heading').toBeNull();
    expect(el.textContent).not.toContain('Remove all');
    expect(el.textContent).toContain('Check the library');
  });

  it('the check button streams its progress as text and reloads the list when it is done', async () => {
    const { el, button, server, settle, rows } = await setup([]);
    server.handlers.check.steps = [2, 4];
    server.handlers.check.broken = 2;
    server.setBroken(broken(2));
    button('Check for broken songs')!.click();
    await settle();
    expect(server.calls.checks).toBe(1);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Checked 4 songs, 2 broken');
    expect(rows().length).toBe(2);
    expect(button('Check for broken songs')!.disabled).toBe(false);
  });

  it('the check button is off while the check runs', async () => {
    const { button, fixture, settle } = await setup([]);
    button('Check for broken songs')!.click();
    fixture.detectChanges();
    expect(button('Check for broken songs')!.disabled).toBe(true);
    await settle();
  });

  it('shows 50 songs a page and Next shows the following ones', async () => {
    const { el, rows, button, fixture, settle } = await setup(broken(120), 50);
    await settle(10);
    expect(rows().length).toBe(50);
    expect(el.textContent).toContain('120 broken songs');
    button('Next')!.click();
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain('Broken 50');
  });

  it('a failed check is shown', async () => {
    const { el, button, server, settle } = await setup([]);
    server.failNext(new ConnectError('a check is already running', Code.FailedPrecondition));
    button('Check for broken songs')!.click();
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('a check is already running');
  });

  it('Remove all broken songs from the list asks first with the count, and sends scope BROKEN without deleting files only after the answer', async () => {
    const { el, button, server, settle, rows } = await setup(broken(3));
    button('Remove all 3 broken songs from the list')!.click();
    await settle();
    expect(server.calls.removeRequests).toEqual([]);
    expect(el.textContent).toContain('Take 3 broken songs off the list?');
    expect(el.textContent).toContain('files stay');
    button('Remove', el.querySelector('.ask')!)!.click();
    await settle();
    expect(server.calls.removeRequests.map((r) => [r.scope, r.deleteFiles])).toEqual([[RemoveScope.BROKEN, false]]);
    expect(rows().length).toBe(0);
    expect(el.textContent).toContain('Removed 3 broken songs from the list. Their files were kept.');
  });

  it('Remove them and delete their files says that the files are deleted for good, and sends deleteFiles only after the answer', async () => {
    const { el, button, server, settle } = await setup(broken(2));
    button('Remove them and delete their files')!.click();
    await settle();
    expect(server.calls.removeRequests).toEqual([]);
    expect(el.textContent).toContain('deleted for good');
    button('Delete files', el.querySelector('.ask')!)!.click();
    await settle();
    expect(server.calls.removeRequests.map((r) => [r.scope, r.deleteFiles])).toEqual([[RemoveScope.BROKEN, true]]);
    expect(el.textContent).toContain('Removed 2 broken songs and deleted 2 files');
  });

  it('Cancel sends nothing', async () => {
    const { el, button, server, settle } = await setup(broken(2));
    button('Remove all 2 broken songs from the list')!.click();
    await settle();
    button('Cancel', el.querySelector('.ask')!)!.click();
    await settle();
    expect(server.calls.removeRequests).toEqual([]);
    expect(button('Remove all 2 broken songs from the list')).toBeDefined();
  });

  it('a failure of the removal is shown and the list stays', async () => {
    const { el, button, server, settle, rows } = await setup(broken(2));
    server.failNext(new ConnectError('could not remove', Code.Internal));
    button('Remove all 2 broken songs from the list')!.click();
    await settle();
    button('Remove', el.querySelector('.ask')!)!.click();
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(rows().length).toBe(2);
  });

  it('one song: Remove from list keeps its file, Delete file too deletes it', async () => {
    const { el, rows, button, server, settle } = await setup(broken(2));
    button('Remove', rows()[0])!.click();
    await settle();
    button('Remove from list', rows()[0])!.click();
    await settle();
    button('Remove', rows()[0])!.click();
    await settle();
    button('Delete file too', rows()[0])!.click();
    await settle();
    expect(server.calls.remove).toEqual(['20000', '20001']);
    expect(server.calls.removeKeep).toEqual([true, false]);
    expect(el.textContent).not.toContain('Broken 0');
  });
});
