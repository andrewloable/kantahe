import { computed, effect, signal, untracked } from '@angular/core';

/** Rows on screen at once; the server's default page is the same size, so one request fills one page. */
export const PAGE_SIZE = 50;

export interface PageWindowSource<T> {
  /** Everything read from the server so far. */
  items: () => readonly T[];
  hasMore: () => boolean;
  loading: () => boolean;
  /** Read ahead by itself; off while an error is showing, so a dead link is not asked again and again. */
  auto: () => boolean;
  /** Ask the server for its next page. */
  more: () => void;
}

/**
 * One page of rows out of a list that is read from the server a page at a time. Only the rows of the current
 * page are drawn, so the page stays light however many songs the library has. A page of look-ahead is read
 * so that Next is almost always instant. Build it in an injection context (it owns two effects).
 */
export class PageWindow<T> {
  private readonly page = signal(0);
  private readonly last = computed(() => Math.max(0, Math.ceil(this.src.items().length / PAGE_SIZE) - 1));
  /** The page on screen (0 based). */
  readonly current = computed(() => Math.min(this.page(), this.last()));
  readonly rows = computed(() => this.src.items().slice(this.current() * PAGE_SIZE, (this.current() + 1) * PAGE_SIZE));
  readonly hasPrev = computed(() => this.current() > 0);
  readonly nextLoaded = computed(() => this.src.items().length > (this.current() + 1) * PAGE_SIZE);
  /** How many pages there are, once all of them are read; not known before. */
  readonly total = computed(() => (this.src.hasMore() ? undefined : this.last() + 1));
  /** The next page is being read. */
  readonly busy = computed(() => !this.nextLoaded() && this.src.hasMore() && this.src.loading());

  constructor(private readonly src: PageWindowSource<T>) {
    // a list that got shorter (a new search, a song removed) takes the page back with it, so a stale page
    // number cannot reappear when the list grows again
    effect(() => {
      const c = this.current();
      untracked(() => {
        if (this.page() !== c) this.page.set(c);
      });
    });
    effect(() => {
      const short = src.hasMore() && !src.loading() && src.auto() && src.items().length < (this.current() + 2) * PAGE_SIZE;
      if (short) untracked(() => src.more());
    });
  }

  next(): void {
    if (this.nextLoaded()) this.page.set(this.current() + 1);
    else if (this.src.hasMore() && !this.src.loading()) this.src.more();
  }

  prev(): void {
    this.page.set(Math.max(0, this.current() - 1));
  }
}
