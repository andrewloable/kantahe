import { TestBed } from '@angular/core/testing';
import { Format } from '../../gen/kantahe/v1/common_pb';
import { Code, ConnectError } from '@connectrpc/connect';
import { provideRouter } from '@angular/router';
import { create } from '@bufbuild/protobuf';
import { UserSchema } from '../../gen/kantahe/v1/common_pb';
import { TRANSPORT } from '../core/api';
import { AuthStore } from '../core/auth.store';
import { KeyboardShortcuts } from '../core/shortcuts';
import { LibraryPage } from './library.page';
import { fakeLibrary, FakeLibrary, song, untilAborted } from './testing';

function setup(h: FakeLibrary = {}) {
  const f = fakeLibrary(h);
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: TRANSPORT, useValue: f.transport }] });
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

  describe('the / shortcut (kantahe-tlf.4.7)', () => {
    const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) => {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(e);
      return e;
    };

    it('focuses the search box (and the / is not typed into it)', async () => {
      const { el, settle } = setup();
      document.body.appendChild(el);
      await settle();
      const e = press('/');
      await settle();
      expect(document.activeElement).toBe(el.querySelector('#search'));
      expect(e.defaultPrevented).toBe(true);
      el.remove();
    });

    it('from the Number tab it goes back to Search first', async () => {
      const { el, tab, settle } = setup();
      document.body.appendChild(el);
      await settle();
      tab('Number').click();
      await settle();
      press('/');
      await settle();
      await settle();
      expect(tab('Search').getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(el.querySelector('#search'));
      el.remove();
    });

    it('REGRESSION: a / typed in a field stays there, and Ctrl or turned-off shortcuts do nothing', async () => {
      const { el, settle } = setup();
      document.body.appendChild(el);
      await settle();
      const search = el.querySelector<HTMLInputElement>('#search')!;
      const other = document.createElement('input');
      document.body.appendChild(other);
      other.focus();
      press('/', other);
      press('/', document.body, { ctrlKey: true });
      TestBed.inject(KeyboardShortcuts).setEnabled(false);
      press('/');
      await settle();
      expect(document.activeElement).toBe(other);
      expect(document.activeElement).not.toBe(search);
      other.remove();
      el.remove();
    });
  });

  describe('an empty library (first run, kantahe-tlf.4.5)', () => {
    it('tells an administrator how songs get in, with a link to Upload', async () => {
      const { el, settle } = setup();
      TestBed.inject(AuthStore).setUser(create(UserSchema, { admin: true }));
      await settle();
      const text = el.querySelector('.empty-library')?.textContent ?? '';
      expect(text).toContain('The library is empty.');
      expect(text).toContain('watched folder');
      expect(el.querySelector('.empty-library a')?.getAttribute('href')).toBe('/admin/upload');
      expect(el.textContent).not.toContain('No songs found.');
    });

    it('tells a user to ask the administrator', async () => {
      const { el, settle } = setup();
      await settle();
      expect(el.querySelector('.empty-library')?.textContent).toContain('Ask your administrator to add songs.');
      expect(el.querySelector('.empty-library a')).toBeNull();
    });

    it('a search with no result is still "No songs found."', async () => {
      const { el, settle, type } = setup();
      await settle();
      await type('zzz');
      await settle(300); // the search starts a moment after typing
      expect(el.querySelector('.empty-library')).toBeNull();
      expect(el.textContent).toContain('No songs found.');
    });

    it('a library with songs shows neither', async () => {
      const { el, settle } = setup({ searchSongs: () => ({ items: [song('1', 'Hello', 'Adele')] }) });
      await settle();
      expect(el.querySelector('.empty-library')).toBeNull();
      expect(el.textContent).not.toContain('No songs found.');
    });
  });

  describe('tabs', () => {
    it('is a tablist of Search and Number with Search selected', async () => {
      const { el, tab, settle } = setup();
      await settle();
      expect(Array.from(el.querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim())).toEqual(['Search', 'Number']);
      expect(el.querySelector('[role="tablist"]')).not.toBeNull();
      expect(tab('Search').getAttribute('aria-selected')).toBe('true');
      expect(tab('Number').getAttribute('aria-selected')).toBe('false');
      expect(tab('Number').tabIndex).toBe(-1);
      expect(el.querySelectorAll('[role="tabpanel"]').length).toBe(1);
      expect(tab('Search').getAttribute('aria-controls')).toBe(el.querySelector('[role="tabpanel"]')?.id);
    });

    it('clicking and the arrow keys move between the two tabs, Home and End jump', async () => {
      const { el, tab, settle } = setup();
      await settle();
      tab('Number').click();
      await settle();
      expect(el.querySelector('app-number-pad')).not.toBeNull();
      tab('Number').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await settle();
      expect(tab('Search').getAttribute('aria-selected')).toBe('true'); // wraps
      tab('Search').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await settle();
      expect(tab('Number').getAttribute('aria-selected')).toBe('true');
      tab('Number').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await settle();
      expect(tab('Search').getAttribute('aria-selected')).toBe('true');
      tab('Search').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await settle();
      expect(tab('Number').getAttribute('aria-selected')).toBe('true');
    });

    it('there is no Browse: no tab of that name and no browse component', async () => {
      const { el, settle } = setup();
      await settle();
      expect(Array.from(el.querySelectorAll('[role="tab"]')).some((t) => /browse/i.test(t.textContent ?? ''))).toBe(false);
      expect(el.querySelector('app-alpha-browse')).toBeNull();
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

    it('regression: the next page is asked for with the query of the list on screen, not with text typed since', async () => {
      const hundred = Array.from({ length: 100 }, (_, i) => song(String(i + 1), `S${i}`, 'x'));
      const { el, calls, settle, type } = setup({
        searchSongs: (req) => (req.pageToken === '' ? { items: hundred, next: 'P2' } : { items: [] }),
      });
      await settle();
      expect(calls.search.map((c) => c.pageToken)).toEqual(['']); // two pages are in hand: nothing is read ahead yet
      await type('zzz'); // typed, the 250 ms have not passed
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Next')!.click();
      await settle();
      const next = calls.search.find((r) => r.pageToken === 'P2')!;
      expect(next.query).toBe('');
    });

    it('regression: a failed next page is not asked for again and again', async () => {
      const { el, calls, settle } = setup({
        searchSongs: (req) => {
          if (req.pageToken === 'P2') throw new ConnectError('down', Code.Unavailable);
          return { items: [song('1', 'A', 'x')], next: 'P2' };
        },
      });
      await settle(100);
      const asked = calls.search.length;
      expect(asked).toBe(2); // the opening page and the one that failed
      await settle(5000);
      expect(calls.search.length).toBe(asked);
      expect(el.textContent).toContain('Try again');
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

    it('reads the next page ahead with the returned token and appends', async () => {
      const { el, calls, settle } = setup({
        searchSongs: (r) => (r.pageToken === '' ? { items: [song('1', 'First', 'A')], next: 'p2' } : { items: [song('2', 'Second', 'B')] }),
      });
      await settle(); // the next page is read ahead by itself
      expect(calls.search.map((c) => c.pageToken)).toEqual(['', 'p2']);
      expect(el.textContent).toContain('First');
      expect(el.textContent).toContain('Second');
    });

    it('a new search starts again from the first page', async () => {
      const { calls, settle, type } = setup({ searchSongs: (r) => ({ items: [song('1', r.query || 'all', 'A')], next: r.pageToken === '' ? 'p2' : '' }) });
      await settle();
      await type('x');
      await settle(300);
      expect(calls.search.find((r) => r.query === 'x')?.pageToken).toBe('');
    });

    it('regression: thousands of songs stay 50 rows in the page; Next reads on', async () => {
      const all = Array.from({ length: 3000 }, (_, i) => song(String(10000 + i), `Song ${i}`, 'x'));
      const { el, calls, settle } = setup({
        searchSongs: (r) => {
          const from = r.pageToken ? Number(r.pageToken) : 0;
          return { items: all.slice(from, from + 50), next: from + 50 < all.length ? String(from + 50) : '' };
        },
      });
      await settle();
      for (let i = 0; i < 20; i++) {
        Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Next')!.click();
        await settle();
      }
      expect(el.querySelectorAll('li.row').length).toBe(50);
      expect(el.querySelector('li.row .title')?.textContent).toBe('Song 1000');
      expect(calls.search.length).toBe(22); // always one page ahead of the one on screen
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

  it('the format chips are toggles: the chosen one has aria-pressed and the toggle class the stylesheet fills', async () => {
    const { el, chip, settle, fixture } = setup();
    await settle();
    const chips = Array.from(el.querySelectorAll<HTMLButtonElement>('.chips button'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['All', 'MP3', 'MIDI']);
    expect(chips.every((c) => c.classList.contains('toggle'))).toBe(true);
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    chip('MP3').click();
    fixture.detectChanges();
    expect(chips.map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });
});
