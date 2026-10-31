import { signal } from '@angular/core';
import { problem } from '../core/errors';

export interface Page<T> {
  items: T[];
  /** Token of the next page; '' when this was the last. */
  next: string;
}

/**
 * A list that is read page by page. Starting again, or cancelling, aborts the request that is
 * running and drops its answer; an item whose key is already in the list is not added twice
 * (offset-based pages overlap when the library changes between two requests).
 */
export class Pager<T> {
  readonly items = signal<T[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly hasMore = signal(false);
  /** The first page has arrived. */
  readonly loaded = signal(false);

  private token = '';
  private generation = 0;
  private running?: AbortController;
  private readonly seen = new Set<string>();

  constructor(
    private readonly fetch: (pageToken: string, signal: AbortSignal) => Promise<Page<T>>,
    private readonly key?: (item: T) => string,
  ) {}

  /** Starts again from the first page (the request parameters are read when the page is asked for). */
  reset(): Promise<void> {
    this.running?.abort();
    this.generation++;
    this.token = '';
    this.seen.clear();
    this.items.set([]);
    this.hasMore.set(false);
    this.loaded.set(false);
    return this.load(this.generation);
  }

  more(): Promise<void> {
    if (!this.hasMore() || this.loading()) return Promise.resolve();
    return this.load(this.generation);
  }

  /** Asks again for whatever failed last. */
  retry(): Promise<void> {
    return this.loaded() ? this.more() : this.reset();
  }

  /** Abandons the request that is running (the page is going away). */
  cancel(): void {
    this.running?.abort();
    this.generation++;
    this.loading.set(false);
  }

  private fresh(items: T[]): T[] {
    if (!this.key) return items;
    return items.filter((item) => {
      const k = this.key!(item);
      if (this.seen.has(k)) return false;
      this.seen.add(k);
      return true;
    });
  }

  private async load(generation: number): Promise<void> {
    const request = new AbortController();
    this.running = request;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.fetch(this.token, request.signal);
      if (generation !== this.generation) return;
      const added = this.fresh(page.items);
      this.items.update((all) => [...all, ...added]);
      this.token = page.next;
      this.hasMore.set(page.next !== '');
      this.loaded.set(true);
    } catch (e) {
      if (generation === this.generation) this.error.set(problem(e, {}));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
