import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { AuthService, GetServerInfoResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { batches, BATCH, candidates, FIND_SERVERS, MAX_PARALLEL, PROBE_MS, probeAll, SERVER_PROBE } from './server-sweep';

const answer = (name = '', setupRequired = false) => ({ version: '1.0', name, setupRequired });
const refuse = () => Promise.reject(new Error('no server'));

describe('candidates', () => {
  it('every other host of the /24, on both ports, the TV itself left out', () => {
    const list = candidates('192.168.1.37');
    expect(list).toHaveLength(253 * 2);
    expect(list).toContain('http://192.168.1.1:8080');
    expect(list).toContain('http://192.168.1.1'); // port 80 is written without the port
    expect(list).toContain('http://192.168.1.254:8080');
    for (const own of ['http://192.168.1.37:8080', 'http://192.168.1.37']) expect(list).not.toContain(own);
    for (const edge of ['192.168.1.0', '192.168.1.255']) expect(list.some((u) => u.includes(edge)), edge).toBe(false);
  });

  it('nearest the TV first: its neighbours come before hosts far away', () => {
    expect(candidates('192.168.1.37').slice(0, 8)).toEqual([
      'http://192.168.1.36:8080',
      'http://192.168.1.36',
      'http://192.168.1.38:8080',
      'http://192.168.1.38',
      'http://192.168.1.35:8080',
      'http://192.168.1.35',
      'http://192.168.1.39:8080',
      'http://192.168.1.39',
    ]);
  });

  it('at the edge of the range the order goes on one way', () => {
    expect(candidates('10.0.0.1').slice(0, 4)).toEqual(['http://10.0.0.2:8080', 'http://10.0.0.2', 'http://10.0.0.3:8080', 'http://10.0.0.3']);
  });

  it('is empty for something that is not an IPv4 address', () => {
    expect(candidates('nonsense')).toEqual([]);
  });
});

describe('batches', () => {
  it('cuts the candidates into batches of 100, nearest first, so that no batch asks more hosts than the engine can hold', () => {
    const all = candidates('192.168.1.37');
    const parts = batches('192.168.1.37');
    expect(BATCH).toBe(100);
    expect(parts.map((b) => b.length)).toEqual([100, 100, 100, 100, 100, 6]);
    expect(parts.flat()).toEqual(all);
  });

  it('has none for something that is not an address', () => {
    expect(batches('nonsense')).toEqual([]);
  });
});

describe('probeAll', () => {
  const urls = candidates('192.168.1.37');
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('never has more than 64 probes in flight', async () => {
    let inFlight = 0;
    let most = 0;
    const done = probeAll(urls, async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      throw new Error('no server');
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
    expect(MAX_PARALLEL).toBe(64);
    expect(most).toBe(64);
  });

  it('a probe that does not answer in 800 ms is cut off, aborted, and not found', async () => {
    const signals: AbortSignal[] = [];
    const done = probeAll(urls, (_url, signal) => {
      signals.push(signal);
      return new Promise(() => undefined); // the host never answers, and ignores the signal
    });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await done).toEqual([]);
    expect(PROBE_MS).toBe(800);
    expect(signals).toHaveLength(506);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it('a probe is cut off at 800 ms, not before', async () => {
    let aborted = false;
    const done = probeAll(urls, (_url, signal) => {
      signal.addEventListener('abort', () => (aborted = true));
      return new Promise(() => undefined);
    });
    await vi.advanceTimersByTimeAsync(799);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    await done;
  });

  it('returns only the hosts that answered, in candidate order, with their name, version and setup state', async () => {
    const done = probeAll(urls, async (url) => {
      if (url === 'http://192.168.1.9:8080') return answer('Den');
      if (url === 'http://192.168.1.2:8080') return answer('', true);
      if (url === 'http://192.168.1.5') return answer('Office');
      throw new Error('no server');
    });
    await vi.advanceTimersByTimeAsync(10_000);
    // nearest the TV (.37) first: .9 is nearer than .5, which is nearer than .2
    expect(await done).toEqual([
      { url: 'http://192.168.1.9:8080', name: 'Den', version: '1.0', setupRequired: false },
      { url: 'http://192.168.1.5', name: 'Office', version: '1.0', setupRequired: false },
      { url: 'http://192.168.1.2:8080', name: '', version: '1.0', setupRequired: true },
    ]);
  });

  it('reports its progress up to the total', async () => {
    const seen: [number, number][] = [];
    const done = probeAll(urls, refuse, (d, t) => seen.push([d, t]));
    await vi.advanceTimersByTimeAsync(10_000);
    await done;
    expect(seen.at(-1)).toEqual([506, 506]);
    expect(seen.every(([d, t], i) => t === 506 && (i === 0 || d >= seen[i - 1][0]))).toBe(true);
  });

  it('with nothing to ask there is nothing found', async () => {
    const ask = vi.fn(refuse);
    expect(await probeAll([], ask)).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });
});

describe('FIND_SERVERS: the search in batches', () => {
  const tv = globalThis as { webapis?: unknown };

  /** A transport that answers only for the server at [live], like a network where one host has a server. */
  function network(live: string, asked: string[] = []) {
    const answering = createRouterTransport(({ service }) =>
      service(AuthService, { getServerInfo: async () => create(GetServerInfoResponseSchema, { version: '1.0', name: 'Den' }) }),
    );
    const silent = createRouterTransport(({ service }) =>
      service(AuthService, {
        getServerInfo: async () => {
          throw new ConnectError('refused', Code.Unavailable);
        },
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SERVER_PROBE,
          useValue: (url: string) => {
            asked.push(url);
            return url === live ? answering : silent;
          },
        },
      ],
    });
    return TestBed.inject(FIND_SERVERS);
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    delete tv.webapis;
  });

  const run = async <T>(p: Promise<T>) => {
    await vi.advanceTimersByTimeAsync(10_000);
    return p;
  };

  it('a TV that cannot tell its own address finds nothing and has nothing more to look at', async () => {
    const find = network('http://192.168.1.40:8080');
    expect(await run(find({ next: false }))).toEqual({ servers: [], more: false });
  });

  it('the first batch is the nearest 100 probes: a server near the TV is found at once', async () => {
    tv.webapis = { network: { getIp: () => '192.168.1.37' } };
    const asked: string[] = [];
    const find = network('http://192.168.1.40:8080', asked);
    const result = await run(find({ next: false }));
    expect(result.servers.map((s) => s.url)).toEqual(['http://192.168.1.40:8080']);
    expect(result.more).toBe(true);
    expect(asked).toHaveLength(BATCH);
  });

  it('a server far from the TV is found by a later batch, asked for with next, and nothing is asked twice', async () => {
    tv.webapis = { network: { getIp: () => '192.168.1.37' } };
    const asked: string[] = [];
    const find = network('http://192.168.1.200:8080', asked);
    expect((await run(find({ next: false }))).servers).toEqual([]);
    let batchesRun = 1;
    let found = [] as { url: string }[];
    while (found.length === 0 && batchesRun < 10) {
      found = (await run(find({ next: true }))).servers;
      batchesRun++;
    }
    expect(found.map((s) => s.url)).toEqual(['http://192.168.1.200:8080']);
    expect(batchesRun).toBeGreaterThan(1);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('after the last batch more is false, and next goes round to the nearest again', async () => {
    tv.webapis = { network: { getIp: () => '192.168.1.37' } };
    const find = network('http://192.168.1.40:8080');
    let last = await run(find({ next: false }));
    for (let i = 1; i < 6; i++) last = await run(find({ next: true }));
    expect(last.more).toBe(false);
    const again = await run(find({ next: true }));
    expect(again.servers.map((s) => s.url)).toEqual(['http://192.168.1.40:8080']); // back at the nearest batch
  });

  it('a new search (next: false) starts at the nearest batch again, whatever came before', async () => {
    tv.webapis = { network: { getIp: () => '192.168.1.37' } };
    const find = network('http://192.168.1.40:8080');
    await run(find({ next: false }));
    await run(find({ next: true }));
    const again = await run(find({ next: false }));
    expect(again.servers.map((s) => s.url)).toEqual(['http://192.168.1.40:8080']);
  });
  it('a web page on port 80 (a router, a printer) is not a server: only a real GetServerInfo answer counts', async () => {
    tv.webapis = { network: { getIp: () => '192.168.1.37' } };
    const page = async () => new Response('<html><body>Router login</body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    TestBed.configureTestingModule({
      providers: [{ provide: SERVER_PROBE, useValue: (baseUrl: string) => createConnectTransport({ baseUrl, useBinaryFormat: false, fetch: page }) }],
    });
    const find = TestBed.inject(FIND_SERVERS);
    expect(await run(find({ next: false }))).toEqual({ servers: [], more: true });
  });
});
