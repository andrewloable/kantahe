import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Code, ConnectError } from '@connectrpc/connect';
import { TRANSPORT } from '../core/api';
import { ToastService } from '../core/toast';
import { fakeMe, song } from '../me/testing';
import { PlaylistPickerComponent } from './playlist-picker.component';

const HELLO = song('21628', 'Hello', 'Adele');

async function setup(playlists = [{ id: 'p1', name: 'Party', songs: [] }, { id: 'p2', name: 'Slow', songs: [] }]) {
  const server = fakeMe({ playlists, catalog: [HELLO] });
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] });
  const fixture = TestBed.createComponent(PlaylistPickerComponent);
  fixture.componentRef.setInput('song', HELLO);
  const done = vi.fn();
  fixture.componentInstance.closed.subscribe(done);
  fixture.detectChanges();
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  await settle();
  return { fixture, el: fixture.nativeElement as HTMLElement, server, settle, done };
}

describe('PlaylistPickerComponent', () => {
  it('lists the playlists', async () => {
    const { el } = await setup();
    expect(Array.from(el.querySelectorAll('li button')).map((b) => b.textContent?.trim())).toEqual(['Party', 'Slow']);
    expect(el.getAttribute('role') ?? el.firstElementChild?.getAttribute('role')).toBeTruthy();
  });

  it('choosing one appends the song (one number, no replace) and says so', async () => {
    const { el, server, settle, done } = await setup();
    Array.from(el.querySelectorAll('li button')).find((b) => b.textContent?.trim() === 'Slow')!.dispatchEvent(new Event('click'));
    await settle();
    expect(server.calls.update).toEqual([{ id: 'p2', name: undefined, replace: false, numbers: ['21628'] }]);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Added Hello to Slow');
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('a failure is shown and the picker stays open', async () => {
    const { el, server, settle, done } = await setup();
    server.failNext(new ConnectError('full', Code.InvalidArgument));
    (el.querySelector('li button') as HTMLButtonElement).click();
    await settle();
    expect(TestBed.inject(ToastService).toasts()[0].kind).toBe('error');
    expect(done).not.toHaveBeenCalled();
  });

  it('with no playlists it points to where they are made', async () => {
    const { el } = await setup([]);
    expect(el.textContent).toContain('No playlists yet.');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/me/playlists');
  });

  it('Escape and the Close button close it', async () => {
    const { el, done } = await setup();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(done).toHaveBeenCalledTimes(1);
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Close')!.click();
    expect(done).toHaveBeenCalledTimes(2);
  });
});
