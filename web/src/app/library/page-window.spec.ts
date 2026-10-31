import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PAGE_SIZE, PageWindow } from './page-window';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function setup(count: number, hasMore = false) {
  const items = signal<number[]>(range(count));
  const more = signal(hasMore);
  const loading = signal(false);
  const auto = signal(true);
  const asked = vi.fn();
  const win = TestBed.runInInjectionContext(() => new PageWindow<number>({ items, hasMore: more, loading, auto, more: asked }));
  TestBed.tick();
  return { win, items, more, loading, auto, asked };
}

describe('PageWindow', () => {
  it('shows one page of rows, not every row that was loaded', () => {
    const { win } = setup(120);
    expect(win.rows()).toEqual(range(PAGE_SIZE));
    expect(win.current()).toBe(0);
    expect(win.hasPrev()).toBe(false);
    expect(win.nextLoaded()).toBe(true);
  });

  it('next and prev move by a page and stop at the ends', () => {
    const { win } = setup(120);
    win.next();
    expect(win.rows()[0]).toBe(PAGE_SIZE);
    expect(win.rows().length).toBe(PAGE_SIZE);
    win.next();
    expect(win.rows()).toEqual(range(120).slice(100));
    expect(win.nextLoaded()).toBe(false);
    win.next(); // nothing beyond: stays
    expect(win.current()).toBe(2);
    win.prev();
    win.prev();
    win.prev();
    expect(win.current()).toBe(0);
  });

  it('knows the number of pages once everything is loaded, not before', () => {
    const { win, more } = setup(120);
    expect(win.total()).toBe(3);
    more.set(true);
    expect(win.total()).toBeUndefined();
  });

  it('asks for more when fewer than a full page beyond the current one is loaded, and only then', () => {
    const { asked } = setup(PAGE_SIZE, true);
    expect(asked).toHaveBeenCalledTimes(1);
    const b = setup(2 * PAGE_SIZE, true);
    expect(b.asked).not.toHaveBeenCalled();
    b.win.next();
    TestBed.tick();
    expect(b.asked).toHaveBeenCalledTimes(1);
  });

  it('does not ask while a page is loading, when nothing is left, or when auto is off', () => {
    const a = setup(PAGE_SIZE, true);
    a.asked.mockClear();
    a.loading.set(true);
    a.items.set(range(PAGE_SIZE)); // changes nothing a request would answer
    TestBed.tick();
    expect(a.asked).not.toHaveBeenCalled();
    expect(setup(PAGE_SIZE, false).asked).not.toHaveBeenCalled();
    const c = setup(PAGE_SIZE, true);
    c.asked.mockClear();
    c.auto.set(false);
    c.items.set(range(PAGE_SIZE + 1));
    c.items.set(range(PAGE_SIZE));
    TestBed.tick();
    expect(c.asked).not.toHaveBeenCalled();
  });

  it('asks again after a page arrives while the look-ahead is still short', () => {
    const { asked, items, loading } = setup(PAGE_SIZE, true);
    asked.mockClear();
    loading.set(true);
    TestBed.tick();
    loading.set(false);
    items.set(range(2 * PAGE_SIZE - 1));
    TestBed.tick();
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('next at the end of what is loaded asks for more instead of moving', () => {
    const { win, asked, auto } = setup(PAGE_SIZE, true);
    auto.set(false);
    asked.mockClear();
    win.next();
    expect(asked).toHaveBeenCalledTimes(1);
    expect(win.current()).toBe(0);
  });

  it('a list that shrinks takes the page back with it', () => {
    const { win, items } = setup(150);
    win.next();
    win.next();
    expect(win.current()).toBe(2);
    items.set(range(10));
    TestBed.tick();
    expect(win.current()).toBe(0);
    expect(win.rows()).toEqual(range(10));
  });

  it('regression: after a new, shorter list the page does not jump when the look-ahead page arrives', () => {
    const { win, items, more } = setup(150, true);
    win.next();
    win.next();
    items.set(range(PAGE_SIZE)); // a new search: the first page only
    TestBed.tick();
    more.set(true);
    items.set(range(2 * PAGE_SIZE)); // the look-ahead arrives
    TestBed.tick();
    expect(win.current()).toBe(0);
    expect(win.rows()[0]).toBe(0);
  });

  it('removing a row on a later page keeps that page', () => {
    const { win, items } = setup(150);
    win.next();
    items.set(range(150).filter((n) => n !== 60));
    TestBed.tick();
    expect(win.current()).toBe(1);
  });
});
