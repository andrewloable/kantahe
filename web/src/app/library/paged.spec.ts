import { Code, ConnectError } from '@connectrpc/connect';
import { Pager } from './paged';

function server(pages: Record<string, { items: number[]; next: string }>) {
  const asked: string[] = [];
  const fetch = async (token: string) => {
    asked.push(token);
    return pages[token];
  };
  return { asked, fetch };
}

describe('Pager', () => {
  it('loads the first page, then the next one with the returned token and appends', async () => {
    const s = server({ '': { items: [1, 2], next: 'p2' }, p2: { items: [3], next: '' } });
    const p = new Pager<number>(s.fetch);
    await p.reset();
    expect(p.items()).toEqual([1, 2]);
    expect(p.hasMore()).toBe(true);
    await p.more();
    expect(p.items()).toEqual([1, 2, 3]);
    expect(p.hasMore()).toBe(false);
    await p.more(); // nothing left: no request
    expect(s.asked).toEqual(['', 'p2']);
  });

  it('does not ask twice for the same page while one is running', async () => {
    const s = server({ '': { items: [1], next: 'p2' }, p2: { items: [2], next: '' } });
    const p = new Pager<number>(s.fetch);
    await p.reset();
    await Promise.all([p.more(), p.more(), p.more()]);
    expect(s.asked).toEqual(['', 'p2']);
  });

  it('reset starts over and drops the answer of an older request', async () => {
    let release!: (v: { items: number[]; next: string }) => void;
    const slow = new Promise<{ items: number[]; next: string }>((r) => (release = r));
    let n = 0;
    const p = new Pager<number>(() => (n++ === 0 ? slow : Promise.resolve({ items: [9], next: '' })));
    const first = p.reset();
    const second = p.reset();
    await second;
    release({ items: [1, 2, 3], next: 'x' });
    await first;
    expect(p.items()).toEqual([9]);
    expect(p.hasMore()).toBe(false);
  });

  it('reset clears the old items at once', async () => {
    const p = new Pager<number>(async (t) => (t === '' ? { items: [1], next: '' } : { items: [], next: '' }));
    await p.reset();
    expect(p.items()).toEqual([1]);
    const again = p.reset();
    expect(p.items()).toEqual([]);
    expect(p.loading()).toBe(true);
    await again;
    expect(p.loading()).toBe(false);
    expect(p.loaded()).toBe(true);
  });

  it('shows a failed load as a sentence, keeps what was loaded, and retries the same page', async () => {
    let fail = false;
    const p = new Pager<number>(async (t) => {
      if (t === 'p2' && fail) throw new ConnectError('down', Code.Unavailable);
      return t === '' ? { items: [1], next: 'p2' } : { items: [2], next: '' };
    });
    await p.reset();
    fail = true;
    await p.more();
    expect(p.error()).toMatch(/could not reach the server/i);
    expect(p.items()).toEqual([1]);
    expect(p.hasMore()).toBe(true);
    fail = false;
    await p.retry();
    expect(p.error()).toBe('');
    expect(p.items()).toEqual([1, 2]);
  });

  it('a failed first page leaves an empty list with the error', async () => {
    const p = new Pager<number>(async () => {
      throw new ConnectError('x', Code.Internal);
    });
    await p.reset();
    expect(p.items()).toEqual([]);
    expect(p.error()).toMatch(/something went wrong/i);
    expect(p.loaded()).toBe(false);
  });

  it('regression: the request of a replaced list is aborted, and cancel aborts the current one', async () => {
    const signals: AbortSignal[] = [];
    const p = new Pager<number>((_t, signal) => {
      signals.push(signal);
      return new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    });
    const first = p.reset();
    expect(signals[0].aborted).toBe(false);
    const second = p.reset();
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    p.cancel();
    expect(signals[1].aborted).toBe(true);
    await Promise.all([first, second]);
    expect(p.error()).toBe(''); // an aborted request is not an error to show
    expect(p.loading()).toBe(false);
  });

  it('regression: an item that is already shown is not added again (pages can overlap when the library changes)', async () => {
    const pages: Record<string, { items: { id: string }[]; next: string }> = {
      '': { items: [{ id: 'a' }, { id: 'b' }], next: 'p2' },
      p2: { items: [{ id: 'b' }, { id: 'c' }], next: '' },
    };
    const p = new Pager<{ id: string }>(async (t) => pages[t], (x) => x.id);
    await p.reset();
    await p.more();
    expect(p.items().map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
});
