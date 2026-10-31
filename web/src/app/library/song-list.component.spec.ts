import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Format, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { AuthStore } from '../core/auth.store';
import { TRANSPORT } from '../core/api';
import { ToastService } from '../core/toast';
import { SongListComponent } from './song-list.component';
import { provideRouter } from '@angular/router';
import { fakeMe } from '../me/testing';
import { fakeLibrary, FakeLibrary, song } from './testing';

const many = (n: number) => Array.from({ length: n }, (_, i) => song(String(1000 + i), `Song ${i}`, 'Artist'));
const rowCount = (el: HTMLElement) => el.querySelectorAll('li.row').length;
const btn = (el: HTMLElement, text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;

function setup(inputs: Record<string, unknown>, h: FakeLibrary = {}) {
  const f = fakeLibrary(h);
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
  const fixture = TestBed.createComponent(SongListComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  const more = vi.fn();
  fixture.componentInstance.more.subscribe(more);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, more, ...f, toasts: TestBed.inject(ToastService) };
}

describe('SongListComponent', () => {
  it('shows number, title, artist and a badge on every row', async () => {
    const { fixture, el } = setup({ songs: [song('01052', 'Hello', 'Adele', Format.MP3), song('21628', 'Hello', 'Adele', Format.MIDI)] });
    await fixture.whenStable();
    const rows = Array.from(el.querySelectorAll('li'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('01052');
    expect(rows[0].textContent).toContain('Hello');
    expect(rows[0].textContent).toContain('Adele');
    expect(rows[0].textContent).toContain('MP3');
    expect(rows[1].textContent).toContain('21628');
    expect(rows[1].textContent).toContain('MIDI');
  });

  it('clicking (or pressing Enter on) a row queues that entry and says so', async () => {
    const { fixture, el, calls, toasts } = setup({ songs: [song('01052', 'Hello', 'Adele'), song('21628', 'Hello', 'Adele', Format.MIDI)] });
    const mains = el.querySelectorAll<HTMLButtonElement>('button.main');
    mains[1].click();
    await fixture.whenStable();
    expect(calls.add.map((c) => c.number)).toEqual(['21628']);
    expect(toasts.toasts().map((t) => t.message)).toEqual(['Added Hello']);
    expect(mains[1].tagName).toBe('BUTTON'); // a real button: Enter and Space work without extra code
    expect(mains[1].getAttribute('aria-label')).toBe('Add Hello by Adele to the queue');
  });

  it('the star toggles the favourite and shows it', async () => {
    const { fixture, el, calls } = setup({ songs: [song('1', 'Hello', 'Adele')] });
    const star = el.querySelector<HTMLButtonElement>('button.star')!;
    expect(star.getAttribute('aria-pressed')).toBe('false');
    expect(star.getAttribute('aria-label')).toBe('Favourite: Hello');
    star.click();
    fixture.detectChanges();
    expect(star.getAttribute('aria-pressed')).toBe('true'); // before the server has answered
    await vi.waitFor(() => expect(calls.fav.map((c) => [c.number, c.favourite])).toEqual([['1', true]]));
    star.click();
    await vi.waitFor(() => expect(calls.fav.map((c) => c.favourite)).toEqual([true, false]));
    fixture.detectChanges();
    expect(star.getAttribute('aria-pressed')).toBe('false');
  });

  it('reverts the star when the server refuses', async () => {
    const { fixture, el } = setup(
      { songs: [song('1', 'Hello', 'Adele')] },
      {
        setFavourite: () => {
          throw new ConnectError('x', Code.Internal);
        },
      },
    );
    const star = el.querySelector<HTMLButtonElement>('button.star')!;
    star.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(star.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows a star that the server already set', () => {
    const { el } = setup({ songs: [song('1', 'Hello', 'Adele', Format.MP3, true)] });
    expect(el.querySelector('button.star')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('a song that cannot be played cannot be queued', () => {
    const bad = song('1', 'Broken', 'A');
    bad.failed = true;
    const { el } = setup({ songs: [bad] });
    expect((el.querySelector('button.main') as HTMLButtonElement).disabled).toBe(true);
    expect(el.textContent).toContain("can't be played");
  });

  describe('pages', () => {
    it('regression: 500 songs put 50 rows in the page, not 500', () => {
      const { el } = setup({ songs: many(500) });
      expect(rowCount(el)).toBe(50);
      expect(el.textContent).toContain('Song 0');
      expect(el.textContent).not.toContain('Song 50 ');
    });

    it('Next shows the following 50 and Previous comes back; the page is announced', () => {
      const { fixture, el } = setup({ songs: many(120) });
      btn(el, 'Next').click();
      fixture.detectChanges();
      expect(rowCount(el)).toBe(50);
      expect(el.querySelector('li.row .title')?.textContent).toBe('Song 50');
      expect(el.querySelector('[role="status"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Page 2 of 3');
      btn(el, 'Previous').click();
      fixture.detectChanges();
      expect(el.querySelector('li.row .title')?.textContent).toBe('Song 0');
    });

    it('keeps the buttons that cannot be used marked, not removed (the focus stays where it is)', () => {
      const { fixture, el } = setup({ songs: many(60) });
      expect(btn(el, 'Previous').getAttribute('aria-disabled')).toBe('true');
      expect(btn(el, 'Next').getAttribute('aria-disabled')).toBe('false');
      btn(el, 'Next').click();
      fixture.detectChanges();
      expect(btn(el, 'Next').getAttribute('aria-disabled')).toBe('true');
    });

    it('shows no page bar for a short list that is complete', () => {
      const { el } = setup({ songs: many(5) });
      expect(el.querySelector('nav')).toBeNull();
    });

    it('reads the next page ahead by itself while it is short, and not when autoMore is off', () => {
      const a = setup({ songs: many(50), hasMore: true });
      expect(a.more).toHaveBeenCalledTimes(1);
      TestBed.resetTestingModule();
      const b = setup({ songs: many(50), hasMore: true, autoMore: false });
      expect(b.more).not.toHaveBeenCalled();
      btn(b.el, 'Next').click(); // after a failure, Next is the way on
      expect(b.more).toHaveBeenCalledTimes(1);
    });

    it('does not ask while a page is loading, or when there is no more', () => {
      const a = setup({ songs: many(50), hasMore: true, loading: true });
      expect(a.more).not.toHaveBeenCalled();
      TestBed.resetTestingModule();
      const b = setup({ songs: many(50), hasMore: false });
      expect(b.more).not.toHaveBeenCalled();
    });

    it('a song deleted on page 2 leaves the list on page 2', async () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      TestBed.inject(AuthStore).setUser(create(UserSchema, { admin: true }));
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', many(120));
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      btn(el, 'Next').click();
      fixture.detectChanges();
      el.querySelectorAll<HTMLButtonElement>('button.delete')[3].click();
      fixture.detectChanges();
      btn(el, 'Yes, delete').click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(f.calls.remove.map((c) => c.number)).toEqual(['1053']);
      expect(el.querySelector('li.row .title')?.textContent).toBe('Song 50');
      expect(el.textContent).not.toContain('Song 53');
      expect(rowCount(el)).toBe(50);
    });
  });

  it('says what is going on when there is nothing to show', async () => {
    const empty = setup({ songs: [], emptyText: 'No songs found.' });
    await empty.fixture.whenStable();
    expect(empty.el.textContent).toContain('No songs found.');
    TestBed.resetTestingModule();
    const loading = setup({ songs: [], loading: true });
    await loading.fixture.whenStable();
    expect(loading.el.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(loading.el.textContent).not.toContain('No songs found.');
  });

  describe('Add to playlist…', () => {
    function withPlaylists() {
      const hello = song('21628', 'Hello', 'Adele');
      const server = fakeMe({ playlists: [{ id: 'p1', name: 'Party', songs: [] }], catalog: [hello] });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: server.transport }] });
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [hello, song('2', 'Other', 'X')]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const settle = async () => {
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        fixture.detectChanges();
      };
      return { fixture, el, server, settle };
    }

    it('opens the picker under that row only, and a second press closes it', async () => {
      const { el, fixture, settle } = withPlaylists();
      const menus = el.querySelectorAll<HTMLButtonElement>('button.menu');
      expect(menus[0].getAttribute('aria-label')).toBe('Add Hello to a playlist');
      expect(menus[0].getAttribute('aria-expanded')).toBe('false');
      menus[0].click();
      await settle();
      expect(el.querySelectorAll('app-playlist-picker').length).toBe(1);
      expect(el.querySelectorAll('li.row')[0].querySelector('app-playlist-picker')).not.toBeNull();
      expect(menus[0].getAttribute('aria-expanded')).toBe('true');
      menus[0].click();
      fixture.detectChanges();
      expect(el.querySelector('app-playlist-picker')).toBeNull();
    });

    it('choosing a playlist appends the song and closes the picker', async () => {
      const { el, server, settle } = withPlaylists();
      el.querySelector<HTMLButtonElement>('button.menu')!.click();
      await settle();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-playlist-picker li button')).find((b) => b.textContent?.trim() === 'Party')!.click();
      await settle();
      expect(server.calls.update).toEqual([{ id: 'p1', name: undefined, replace: false, numbers: ['21628'] }]);
      expect(el.querySelector('app-playlist-picker')).toBeNull();
    });
  });

  it('regression: the row actions are compact icon buttons with labels (a wide text button wrapped every row to two lines on a phone)', async () => {
    const { el } = setup({ songs: [song('1', 'Hello', 'Adele')] });
    const row = el.querySelector('li.row')!;
    const actions = Array.from(row.querySelectorAll<HTMLButtonElement>('button.star, button.menu'));
    expect(actions.map((b) => b.getAttribute('aria-label'))).toEqual(['Favourite: Hello', 'Add Hello to a playlist']);
    expect(actions.every((b) => (b.textContent ?? '').trim().length <= 2)).toBe(true); // an icon, not a sentence
    expect(row.textContent).not.toContain('Add to playlist…');
  });

  it('regression: a very long title or artist is cut to two lines (a phone row grew to 400 px), and the whole text stays available', () => {
    const long = 'A very long song title that goes on and on and on for a very long time indeed';
    const { el } = setup({ songs: [song('1', long, 'An artist with a name that is also far too long to fit anywhere nicely')] });
    const title = el.querySelector<HTMLElement>('.title')!;
    const artist = el.querySelector<HTMLElement>('.artist')!;
    expect(title.getAttribute('title')).toBe(long);
    expect(artist.getAttribute('title')).toContain('far too long');
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
    expect(css).toMatch(/\.title[^{]*\{[^}]*-webkit-line-clamp:\s*2\s*;/);
    expect(css).toMatch(/\.artist[^{]*\{[^}]*-webkit-line-clamp:\s*2\s*;/);
  });

  describe('deleting (administrators)', () => {
    const admin = () => TestBed.inject(AuthStore).setUser(create(UserSchema, { admin: true }));
    const deleteButtons = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('button.delete'));
    const button = (el: HTMLElement, text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

    it('a user who is not an administrator sees no Delete', () => {
      const { el } = setup({ songs: [song('1', 'Hello', 'Adele')] });
      expect(deleteButtons(el).length).toBe(0);
    });

    it('an administrator has a Delete on every row, named after the song', () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      admin();
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele'), song('2', 'Skyfall', 'Adele')]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(deleteButtons(el).map((b) => b.getAttribute('aria-label'))).toEqual(['Delete Hello by Adele', 'Delete Skyfall by Adele']);
    });

    it('Delete follows the user\'s role without a reload (gone when the administrator is demoted, there when promoted)', () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele')]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(deleteButtons(el).length).toBe(0);
      admin();
      fixture.detectChanges();
      expect(deleteButtons(el).length).toBe(1);
      TestBed.inject(AuthStore).setUser(create(UserSchema, { admin: false }));
      fixture.detectChanges();
      expect(deleteButtons(el).length).toBe(0);
    });

    function adminSetup(h: FakeLibrary = {}) {
      const f = fakeLibrary(h);
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      admin();
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele'), song('2', 'Skyfall', 'Adele')]);
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement, ...f, toasts: TestBed.inject(ToastService) };
    }

    it('regression: Delete is an icon button like the others, so the administrator\'s row stays on one line on a phone', () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      admin();
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele')]);
      fixture.detectChanges();
      const del = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.delete')!;
      expect((del.textContent ?? '').trim()).toBe(''); // an icon, no word that takes the song's room
      expect(del.querySelector('svg')).not.toBeNull();
      expect(del.getAttribute('aria-label')).toBe('Delete Hello by Adele');
      expect(del.getAttribute('title')).toBe('Delete');
    });

    it('asks first: it says the file goes too, and nothing is sent until it is confirmed', async () => {
      const { fixture, el, calls } = adminSetup();
      deleteButtons(el)[0].click();
      fixture.detectChanges();
      expect(el.textContent).toContain('Delete "Hello" and its file?');
      expect(calls.remove.length).toBe(0);
    });

    it('regression: the question is announced to a screen reader when it opens (it appeared silently)', () => {
      const { fixture, el } = adminSetup();
      deleteButtons(el)[0].click();
      fixture.detectChanges();
      expect(el.querySelector('.confirm')?.getAttribute('role')).toBe('alert');
    });

    it('Cancel closes the question and sends nothing', () => {
      const { fixture, el, calls } = adminSetup();
      deleteButtons(el)[0].click();
      fixture.detectChanges();
      button(el, 'Cancel')!.click();
      fixture.detectChanges();
      expect(el.textContent).not.toContain('and its file?');
      expect(calls.remove.length).toBe(0);
      expect(el.querySelectorAll('li').length).toBe(2);
    });

    it('Yes, delete removes the song on the server and from the list, and says so', async () => {
      const { fixture, el, calls, toasts } = adminSetup();
      deleteButtons(el)[0].click();
      fixture.detectChanges();
      button(el, 'Yes, delete')!.click();
      await vi.waitFor(() => expect(calls.remove.map((c) => c.number)).toEqual(['1']));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(Array.from(el.querySelectorAll('li')).map((r) => r.textContent)).toEqual([expect.stringContaining('Skyfall')]);
      expect(toasts.toasts().map((t) => t.message)).toEqual(['Deleted Hello']);
    });

    it('a song that is already gone (another administrator) just leaves the list', async () => {
      const { fixture, el } = adminSetup({
        deleteSong: () => {
          throw new ConnectError('song not found', Code.NotFound);
        },
      });
      deleteButtons(el)[0].click();
      fixture.detectChanges();
      button(el, 'Yes, delete')!.click();
      await vi.waitFor(() => expect(el.querySelectorAll('li').length).toBe(1));
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('when the file cannot be deleted the song stays and the reason is shown', async () => {
      const { fixture, el } = adminSetup({
        deleteSong: () => {
          throw new ConnectError('the library folder is read-only', Code.FailedPrecondition);
        },
      });
      deleteButtons(el)[0].click();
      fixture.detectChanges();
      button(el, 'Yes, delete')!.click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(el.querySelector('.error[role="alert"]')?.textContent).toContain('the library folder is read-only');
      });
      expect(el.querySelectorAll('li').length).toBe(2);
    });
  });
});
