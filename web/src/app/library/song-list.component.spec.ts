import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { Format, LyricTiming, UserSchema } from '../../gen/kantahe/v1/common_pb';
import { AuthStore } from '../core/auth.store';
import { TRANSPORT } from '../core/api';
import { ToastService } from '../core/toast';
import { SongListComponent } from './song-list.component';
import { provideRouter } from '@angular/router';
import { fakeMe } from '../me/testing';
import { ENVIRONMENT } from '../core/environment';
import { environment } from '../../environments/environment';
import { fakeLibrary, FakeLibrary, song } from './testing';

const many = (n: number) => Array.from({ length: n }, (_, i) => song(String(1000 + i), `Song ${i}`, 'Artist'));
const rowCount = (el: HTMLElement) => el.querySelectorAll('li.row').length;
const btn = (el: HTMLElement, text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
/** Opens the More menu of a row and gives its items. */
const openMenu = (fixture: ComponentFixture<unknown>, row: Element) => {
  row.querySelector<HTMLButtonElement>('button.more')!.click();
  fixture.detectChanges();
  return Array.from(row.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
};
const menuLabels = (fixture: ComponentFixture<unknown>, row: Element) => {
  const labels = openMenu(fixture, row).map((b) => b.textContent?.trim());
  row.querySelector<HTMLButtonElement>('button.more')!.click(); // closes it again
  fixture.detectChanges();
  return labels;
};
/** Delete from the More menu of the i-th row on the page: opens the question. */
const askDelete = (fixture: ComponentFixture<unknown>, el: HTMLElement, i: number) => {
  openMenu(fixture, el.querySelectorAll('li.row')[i]).find((b) => b.textContent?.trim() === 'Delete')!.click();
  fixture.detectChanges();
};

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
  it('regression: a failed load does not say that no songs were found', () => {
    const { el } = setup({ songs: [], failed: true, emptyText: 'No songs found.' });
    expect(el.textContent).not.toContain('No songs found.');
  });

  it('shows the badge legend under a list that has songs, and not under an empty one', () => {
    localStorage.removeItem('kantahe.legend.hidden');
    const full = setup({ songs: [song('1', 'Hello', 'Adele')] });
    expect(full.el.querySelector('app-badge-legend')).not.toBeNull();
    TestBed.resetTestingModule();
    const empty = setup({ songs: [] });
    expect(empty.el.querySelector('app-badge-legend')).toBeNull();
  });

  it('an empty text of nothing leaves the place to the page (no paragraph)', () => {
    const { el } = setup({ songs: [], emptyText: '' });
    expect(el.querySelector('p')).toBeNull();
  });

  it('an empty result without a failure says that no songs were found', () => {
    const { el } = setup({ songs: [], emptyText: 'No songs found.' });
    expect(el.textContent).toContain('No songs found.');
  });

  it('shows W or L and V beside the format badge of a row', async () => {
    const { fixture, el } = setup({
      songs: [
        song('1', 'A', 'X', Format.MP3, false, { lyricTiming: LyricTiming.WORD, hasVocals: true }),
        song('2', 'B', 'X', Format.MIDI, false, { lyricTiming: LyricTiming.LINE }),
        song('3', 'C', 'X'),
      ],
    });
    await fixture.whenStable();
    const rows = Array.from(el.querySelectorAll('li'));
    expect(rows[0].querySelector('.timing-badge')?.textContent).toBe('W');
    expect(rows[0].querySelector('.vocals-badge')?.textContent).toBe('V');
    expect(rows[1].querySelector('.timing-badge')?.textContent).toBe('L');
    expect(rows[1].querySelector('.vocals-badge')).toBeNull();
    expect(rows[2].querySelector('.timing-badge')).toBeNull();
    expect(rows[2].querySelector('.vocals-badge')).toBeNull();
  });

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
    // the name is what the row shows, then what pressing it does (WCAG 2.5.3: a speech user says what they see)
    expect(mains[1].getAttribute('aria-label')).toBeNull();
    const name = (mains[1].textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(name).toMatch(/^21628\s*Hello\s*Adele/);
    expect(name).toMatch(/, add to the queue$/);
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
      fixture.componentRef.setInput('allowDelete', true);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      btn(el, 'Next').click();
      fixture.detectChanges();
      askDelete(fixture, el, 3);
      btn(el, 'Delete file too').click();
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

    it('Add to a playlist in the More menu opens the picker under that row only; its Close closes it', async () => {
      const { el, fixture, settle } = withPlaylists();
      const rows = el.querySelectorAll('li.row');
      openMenu(fixture, rows[0]).find((b) => b.textContent?.trim() === 'Add to a playlist')!.click();
      await settle();
      expect(el.querySelectorAll('app-playlist-picker').length).toBe(1);
      expect(rows[0].querySelector('app-playlist-picker')).not.toBeNull();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-playlist-picker button')).find((b) => b.textContent?.trim() === 'Close')!.click();
      fixture.detectChanges();
      expect(el.querySelector('app-playlist-picker')).toBeNull();
    });

    it('choosing a playlist appends the song and closes the picker', async () => {
      const { el, fixture, server, settle } = withPlaylists();
      openMenu(fixture, el.querySelector('li.row')!).find((b) => b.textContent?.trim() === 'Add to a playlist')!.click();
      await settle();
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-playlist-picker li button')).find((b) => b.textContent?.trim() === 'Party')!.click();
      await settle();
      expect(server.calls.update).toEqual([{ id: 'p1', name: undefined, replace: false, numbers: ['21628'] }]);
      expect(el.querySelector('app-playlist-picker')).toBeNull();
    });
  });

  it('regression: a row has the star and one More actions button (+ and Delete wrapped every phone row to two lines)', async () => {
    const { el, fixture } = setup({ songs: [song('1', 'Hello', 'Adele')] });
    const row = el.querySelector('li.row')!;
    const actions = Array.from(row.querySelectorAll<HTMLButtonElement>('.actions button'));
    expect(actions.map((b) => b.getAttribute('aria-label'))).toEqual(['Favourite: Hello', 'More actions for Hello']);
    expect(actions[1].getAttribute('aria-haspopup')).toBe('menu');
    expect(menuLabels(fixture, row)).toEqual(['Play next', 'Add to a playlist']);
  });

  it('Play next in the More menu puts the song right after the current one', async () => {
    const { el, fixture, calls } = setup({ songs: [song('1', 'Hello', 'Adele')] });
    openMenu(fixture, el.querySelector('li.row')!).find((b) => b.textContent?.trim() === 'Play next')!.click();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.session).toEqual(['add 1', 'top q-1']);
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
    const deleteItems = (fixture: ComponentFixture<unknown>, el: HTMLElement) => Array.from(el.querySelectorAll('li.row')).filter((row) => menuLabels(fixture, row).includes('Delete'));
    const button = (el: HTMLElement, text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

    it('regression: an administrator sees no Delete unless the page allows it (only the Library does; Favourites deleted songs from the library)', () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      admin();
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele')]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(deleteItems(fixture, el).length).toBe(0);
      fixture.componentRef.setInput('allowDelete', true);
      fixture.detectChanges();
      expect(deleteItems(fixture, el).length).toBe(1);
    });

    it('a user who is not an administrator sees no Delete', () => {
      const { el, fixture } = setup({ songs: [song('1', 'Hello', 'Adele')] });
      expect(deleteItems(fixture, el).length).toBe(0);
    });

    it('an administrator has a Delete in the More menu of every row, whose name says the song', () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      admin();
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele'), song('2', 'Skyfall', 'Adele')]);
      fixture.componentRef.setInput('allowDelete', true);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(deleteItems(fixture, el).map((row) => row.querySelector('button.more')!.getAttribute('aria-label'))).toEqual(['More actions for Hello', 'More actions for Skyfall']);
      openMenu(fixture, el.querySelector('li.row')!);
      expect(el.querySelector('[role="menu"]')!.getAttribute('aria-label')).toBe('More actions for Hello');
      expect(Array.from(el.querySelectorAll('[role="menuitem"]')).find((b) => b.textContent?.trim() === 'Delete')!.classList.contains('danger')).toBe(true);
    });

    it('Delete follows the user\'s role without a reload (gone when the administrator is demoted, there when promoted)', () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele')]);
      fixture.componentRef.setInput('allowDelete', true);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(deleteItems(fixture, el).length).toBe(0);
      admin();
      fixture.detectChanges();
      expect(deleteItems(fixture, el).length).toBe(1);
      TestBed.inject(AuthStore).setUser(create(UserSchema, { admin: false }));
      fixture.detectChanges();
      expect(deleteItems(fixture, el).length).toBe(0);
    });

    function adminSetup(h: FakeLibrary = {}) {
      const f = fakeLibrary(h);
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
      admin();
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele'), song('2', 'Skyfall', 'Adele')]);
      fixture.componentRef.setInput('allowDelete', true);
      fixture.detectChanges();
      return { fixture, el: fixture.nativeElement as HTMLElement, ...f, toasts: TestBed.inject(ToastService) };
    }

    it('on a TV build the row keeps its inline + and Delete (no menu to steer with a remote)', () => {
      const f = fakeLibrary();
      TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }, { provide: ENVIRONMENT, useValue: { ...environment, isTv: true } }] });
      admin();
      const fixture = TestBed.createComponent(SongListComponent);
      fixture.componentRef.setInput('songs', [song('1', 'Hello', 'Adele')]);
      fixture.componentRef.setInput('allowDelete', true);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('button.more')).toBeNull();
      expect(el.querySelector('button.menu')?.getAttribute('aria-label')).toBe('Add Hello to a playlist');
      expect(el.querySelector('button.delete')?.getAttribute('aria-label')).toBe('Delete Hello by Adele');
    });

    it('asks first: remove from the list or delete the file too, and nothing is sent until one is chosen', async () => {
      const { fixture, el, calls } = adminSetup();
      askDelete(fixture, el, 0);
      expect(el.textContent).toContain('Take "Hello" off the list, or delete its file too?');
      expect(calls.remove.length).toBe(0);
    });

    it('regression: the question is announced to a screen reader when it opens (it appeared silently)', () => {
      const { fixture, el } = adminSetup();
      askDelete(fixture, el, 0);
      expect(el.querySelector('.confirm')?.getAttribute('role')).toBe('alert');
    });

    it('Cancel closes the question and sends nothing', () => {
      const { fixture, el, calls } = adminSetup();
      askDelete(fixture, el, 0);
      button(el, 'Cancel')!.click();
      fixture.detectChanges();
      expect(el.textContent).not.toContain('off the list, or delete');
      expect(calls.remove.length).toBe(0);
      expect(el.querySelectorAll('li').length).toBe(2);
    });

    it('Delete file too deletes the file on the server, takes the song off the list, and says so', async () => {
      const { fixture, el, calls, toasts } = adminSetup();
      askDelete(fixture, el, 0);
      button(el, 'Delete file too')!.click();
      await vi.waitFor(() => expect(calls.remove.map((c) => [c.number, c.keepFile])).toEqual([['1', false]]));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(Array.from(el.querySelectorAll('li')).map((r) => r.textContent)).toEqual([expect.stringContaining('Skyfall')]);
      expect(toasts.toasts().map((t) => t.message)).toEqual(['Deleted Hello and its file']);
    });

    it('Remove from list keeps the file: the request says so, the song leaves the list, and it is said in the toast', async () => {
      const { fixture, el, calls, toasts } = adminSetup();
      askDelete(fixture, el, 1);
      button(el, 'Remove from list')!.click();
      await vi.waitFor(() => expect(calls.remove.map((c) => [c.number, c.keepFile])).toEqual([['2', true]]));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(Array.from(el.querySelectorAll('li')).map((r) => r.textContent)).toEqual([expect.stringContaining('Hello')]);
      expect(toasts.toasts().map((t) => t.message)).toEqual(['Removed Skyfall from the list']);
    });

    it('a song that is already gone (another administrator) just leaves the list', async () => {
      const { fixture, el } = adminSetup({
        deleteSong: () => {
          throw new ConnectError('song not found', Code.NotFound);
        },
      });
      askDelete(fixture, el, 0);
      button(el, 'Delete file too')!.click();
      await vi.waitFor(() => expect(el.querySelectorAll('li').length).toBe(1));
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('when the file cannot be deleted the song stays and the reason is shown', async () => {
      const { fixture, el } = adminSetup({
        deleteSong: () => {
          throw new ConnectError('the library folder is read-only', Code.FailedPrecondition);
        },
      });
      askDelete(fixture, el, 0);
      button(el, 'Delete file too')!.click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(el.querySelector('.error[role="alert"]')?.textContent).toContain('the library folder is read-only');
      });
      expect(el.querySelectorAll('li').length).toBe(2);
    });
  });
});
