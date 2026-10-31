import { TestBed } from '@angular/core/testing';
import { Code, ConnectError } from '@connectrpc/connect';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { ToastService } from '../core/toast';
import { SongListComponent } from './song-list.component';
import { provideRouter } from '@angular/router';
import { fakeMe } from '../me/testing';
import { fakeLibrary, FakeLibrary, song } from './testing';

class FakeObserver {
  static all: FakeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(private cb: IntersectionObserverCallback) {
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {
    // never called by the component
  }
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  show() {
    this.cb([{ isIntersecting: true, target: this.observed[0] } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

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
  beforeEach(() => {
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

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

  it('asks for the next page when the end of the list scrolls into view', () => {
    const { fixture, more } = setup({ songs: [song('1', 'a', 'b')], hasMore: true });
    fixture.detectChanges();
    expect(FakeObserver.all.length).toBeGreaterThan(0);
    FakeObserver.all.at(-1)!.show();
    expect(more).toHaveBeenCalledTimes(1);
  });

  it('does not ask while a page is loading, or when there is no more', () => {
    const a = setup({ songs: [song('1', 'a', 'b')], hasMore: true, loading: true });
    a.fixture.detectChanges();
    FakeObserver.all.at(-1)?.show();
    expect(a.more).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    FakeObserver.all = [];
    const b = setup({ songs: [song('1', 'a', 'b')], hasMore: false });
    b.fixture.detectChanges();
    expect(FakeObserver.all.filter((o) => o.observed.length > 0 && !o.disconnected)).toEqual([]);
  });

  it('also offers a Load more button, for keyboards and for browsers without the observer', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);
    const { el, more } = setup({ songs: [song('1', 'a', 'b')], hasMore: true });
    const btn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'))!;
    btn.click();
    expect(more).toHaveBeenCalledTimes(1);
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
});
