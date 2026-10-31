import { TestBed } from '@angular/core/testing';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { SongSort } from '../../gen/kantahe/v1/catalog_pb';
import { Code, ConnectError } from '@connectrpc/connect';
import { TRANSPORT } from '../core/api';
import { LibraryPage } from './library.page';
import { fakeLibrary, FakeLibrary, song, untilAborted } from './testing';

function setup(h: FakeLibrary = {}) {
  const f = fakeLibrary(h);
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: f.transport }] });
  const fixture = TestBed.createComponent(LibraryPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async (ms = 0) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const type = async (value: string) => {
    const input = el.querySelector<HTMLInputElement>('#search')!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(0);
  };
  const tab = (name: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((t) => t.textContent?.trim() === name)!;
  const chip = (name: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('.chips button')).find((t) => t.textContent?.trim() === name)!;
  return { fixture, el, settle, type, tab, chip, ...f };
}

describe('LibraryPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('tabs', () => {
    it('is a tablist of Search, Number and Browse with Search selected', async () => {
      const { el, tab, settle } = setup();
      await settle();
      expect(Array.from(el.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim())).toEqual(['Search', 'Number', 'Browse']);
      expect(el.querySelector('[role="tablist"]')).not.toBeNull();
      expect(tab('Search').getAttribute('aria-selected')).toBe('true');
      expect(tab('Number').getAttribute('aria-selected')).toBe('false');
      expect(tab('Number').tabIndex).toBe(-1);
      expect(el.querySelectorAll('[role="tabpanel"]').length).toBe(1);
      expect(tab('Search').getAttribute('aria-controls')).toBe(el.querySelector('[role="tabpanel"]')?.id);
    });

    it('clicking and the arrow keys move between tabs, Home and End jump', async () => {
      const { el, tab, settle } = setup();
      await settle();
      tab('Number').click();
      await settle();
      expect(el.querySelector('app-number-pad')).not.toBeNull();
      tab('Number').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await settle();
      expect(tab('Browse').getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('app-alpha-browse')).not.toBeNull();
      tab('Browse').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await settle();
      expect(tab('Search').getAttribute('aria-selected')).toBe('true'); // wraps
      tab('Search').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await settle();
      expect(tab('Browse').getAttribute('aria-selected')).toBe('true');
      tab('Browse').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await settle();
      expect(tab('Search').getAttribute('aria-selected')).toBe('true');
      tab('Search').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await settle();
      expect(tab('Browse').getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('search', () => {
    it('lists the library on opening', async () => {
      const { el, calls, settle } = setup({ searchSongs: () => ({ items: [song('01052', 'Hello', 'Adele')] }) });
      await settle();
      expect(calls.search.length).toBe(1);
      expect(calls.search[0].query).toBe('');
      expect(el.textContent).toContain('Hello');
    });

    it('waits 250 ms after the last keystroke and then searches once', async () => {
      const { calls, settle, type } = setup();
      await settle();
      calls.search.length = 0;
      await type('he');
      await settle(100);
      await type('het');
      await settle(249);
      expect(calls.search.length).toBe(0);
      await settle(2);
      expect(calls.search.map((c) => c.query)).toEqual(['het']);
    });

    it('trims the query', async () => {
      const { calls, settle, type } = setup();
      await settle();
      calls.search.length = 0;
      await type('  hello ');
      await settle(300);
      expect(calls.search.map((c) => c.query)).toEqual(['hello']);
    });

    it('filter chips: All, MP3, MIDI', async () => {
      const { calls, settle, chip } = setup();
      await settle();
      expect(chip('All').getAttribute('aria-pressed')).toBe('true');
      chip('MIDI').click();
      await settle();
      expect(calls.search.at(-1)?.format).toBe(Format.MIDI);
      expect(chip('MIDI').getAttribute('aria-pressed')).toBe('true');
      expect(chip('All').getAttribute('aria-pressed')).toBe('false');
      chip('MP3').click();
      await settle();
      expect(calls.search.at(-1)?.format).toBe(Format.MP3);
      chip('All').click();
      await settle();
      expect(calls.search.at(-1)?.format).toBe(Format.UNSPECIFIED);
    });

    it('keeps the query when the filter changes', async () => {
      const { calls, settle, type, chip } = setup();
      await settle();
      await type('hello');
      await settle(300);
      chip('MP3').click();
      await settle();
      expect(calls.search.at(-1)?.query).toBe('hello');
    });

    it('asks for the next page with the returned token and appends', async () => {
      const { el, calls, settle } = setup({
        searchSongs: (r) => (r.pageToken === '' ? { items: [song('1', 'First', 'A')], next: 'p2' } : { items: [song('2', 'Second', 'B')] }),
      });
      await settle();
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'))!.click();
      await settle();
      expect(calls.search.map((c) => c.pageToken)).toEqual(['', 'p2']);
      expect(el.textContent).toContain('First');
      expect(el.textContent).toContain('Second');
    });

    it('a new search starts again from the first page', async () => {
      const { calls, settle, type } = setup({ searchSongs: (r) => ({ items: [song('1', r.query || 'all', 'A')], next: r.pageToken === '' ? 'p2' : '' }) });
      await settle();
      await type('x');
      await settle(300);
      expect(calls.search.at(-1)?.pageToken).toBe('');
    });

    it('two entries of one song show as two rows with their own badges', async () => {
      const { el, settle } = setup({ searchSongs: () => ({ items: [song('01052', 'Hello', 'Adele', Format.MP3), song('21628', 'Hello', 'Adele', Format.MIDI)] }) });
      await settle();
      const rows = Array.from(el.querySelectorAll('li.row'));
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('MP3');
      expect(rows[1].textContent).toContain('MIDI');
    });

    it('says when nothing matches', async () => {
      const { el, settle, type } = setup();
      await settle();
      await type('zzz');
      await settle(300);
      expect(el.textContent).toContain('No songs found.');
    });

    it('shows a failed search with a way to try again', async () => {
      let fail = true;
      const { el, settle, calls } = setup({
        searchSongs: () => {
          if (fail) throw new ConnectError('down', Code.Unavailable);
          return { items: [song('1', 'Back again', 'A')] };
        },
      });
      await settle();
      expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/could not reach the server/i);
      fail = false;
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Try again'))!.click();
      await settle();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.textContent).toContain('Back again');
      expect(calls.search.length).toBe(2);
    });

    it('has a labelled search box', async () => {
      const { el, settle } = setup();
      await settle();
      expect(el.querySelector('label[for="search"]')).not.toBeNull();
      expect(el.querySelector<HTMLInputElement>('#search')?.type).toBe('search');
    });

    it('regression: a new search abandons the one still running', async () => {
      let first: AbortSignal | undefined;
      const { settle, type } = setup({
        searchSongs: (r, signal) => {
          if (r.query === '') {
            first = signal;
            return untilAborted(signal);
          }
          return { items: [] };
        },
      });
      await settle();
      expect(first?.aborted).toBe(false);
      await type('abc');
      await settle(300);
      expect(first?.aborted).toBe(true);
    });

    it('regression: leaving the page abandons the request that is running', async () => {
      let first: AbortSignal | undefined;
      const { fixture, settle } = setup({
        searchSongs: (_r, signal) => {
          first = signal;
          return untilAborted(signal);
        },
      });
      await settle();
      fixture.destroy();
      expect(first?.aborted).toBe(true);
    });

    it('does not search after the page is gone', async () => {
      const { fixture, calls, settle, type } = setup();
      await settle();
      calls.search.length = 0;
      await type('abc');
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(500);
      expect(calls.search.length).toBe(0);
    });
  });

  it('browse sorts by title', async () => {
    const { tab, settle, calls } = setup();
    await settle();
    tab('Browse').click();
    await settle();
    expect(calls.search.at(-1)?.sort).toBe(SongSort.TITLE);
  });
});
