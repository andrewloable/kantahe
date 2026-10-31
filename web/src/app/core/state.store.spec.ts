import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport, HandlerContext } from '@connectrpc/connect';
import { AuthTokenSchema, UserSchema } from '../../gen/kantahe/v1/common_pb';
import {
  GetStateResponseSchema,
  NowPlayingSchema,
  PlayStatus,
  SessionService,
  State,
  StateSchema,
  WatchStateResponse,
} from '../../gen/kantahe/v1/session_pb';
import { apiInterceptors, TRANSPORT } from './api';
import { AuthStore } from './auth.store';
import { StateStore } from './state.store';

type Attempt = (ctx: HandlerContext) => AsyncGenerator<Partial<WatchStateResponse>>;

function st(id: string, serverTimeMs = 1000, status = PlayStatus.PLAYING): State {
  return create(StateSchema, {
    playerDeviceId: id,
    status,
    serverTimeMs: BigInt(serverTimeMs),
    now: create(NowPlayingSchema, { positionMs: 41200n, positionAtMs: 1000n }),
  });
}

// eslint-disable-next-line require-yield -- a stream that fails before sending anything
const fail: Attempt = async function* () {
  throw new ConnectError('down', Code.Unavailable);
};

let holdAborts = 0; // streams kept open by hold() that the client closed

// yields the states, then keeps the stream open until the client goes away
const hold =
  (...states: State[]): Attempt =>
  async function* (ctx) {
    for (const s of states) yield { state: s };
    await new Promise<void>((resolve) =>
      ctx.signal.addEventListener('abort', () => {
        holdAborts++;
        resolve();
      }),
    );
  };

// yields the states, then fails
const thenFail =
  (...states: State[]): Attempt =>
  async function* () {
    for (const s of states) yield { state: s };
    throw new ConnectError('dropped', Code.Unavailable);
  };

interface Harness {
  store: StateStore;
  attempts: number[]; // Date.now() of each WatchState attempt
  polls: number[]; // Date.now() of each GetState call
  aborted: () => number;
  setPolled: (s: State) => void;
  /** Holds every GetState answer back until the returned function is called. */
  holdPolls: () => () => void;
}

function setup(script: Attempt[]): Harness {
  const attempts: number[] = [];
  const polls: number[] = [];
  let polled = st('polled');
  let gate: Promise<void> = Promise.resolve();
  const queue = [...script];
  const transport = createRouterTransport(({ service }) =>
    service(SessionService, {
      async *watchState(_req, ctx) {
        attempts.push(Date.now());
        yield* (queue.shift() ?? hold())(ctx);
      },
      async getState() {
        polls.push(Date.now());
        const answer = polled; // what the server knew when the call arrived
        await gate;
        return create(GetStateResponseSchema, { state: answer });
      },
    }),
  );
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: transport }] });
  return { store: TestBed.inject(StateStore), attempts, polls, aborted: () => holdAborts, setPolled: (s) => (polled = s),
    holdPolls: () => {
      let release!: () => void;
      gate = new Promise<void>((r) => (release = r));
      return release;
    },
  };
}

describe('StateStore', () => {
  beforeEach(() => {
    localStorage.clear();
    holdAborts = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('the first message sets the state', async () => {
    const h = setup([hold(st('d1'))]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.store.state()?.playerDeviceId).toBe('d1');
    expect(h.store.connected()).toBe(true);
    expect(h.store.polling()).toBe(false);
  });

  it('later messages replace the state', async () => {
    const h = setup([hold(st('d1'), st('d2'))]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.store.state()?.playerDeviceId).toBe('d2');
  });

  it('retries after 1 s, then 2 s', async () => {
    const h = setup([fail, fail, hold()]);
    const t0 = Date.now();
    h.store.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.attempts.map((t) => t - t0)).toEqual([0, 1000, 3000]);
  });

  it('keeps doubling up to 30 s', async () => {
    const h = setup([fail, fail, fail, fail, fail, fail, fail, hold()]);
    const t0 = Date.now();
    h.store.start();
    await vi.advanceTimersByTimeAsync(100_000); // the last attempt opens at 91 s; its 60 s of silence has not passed yet
    const gaps = h.attempts.slice(1).map((t, i) => t - h.attempts[i]);
    expect(gaps).toEqual([1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]);
    expect(h.attempts[0]).toBe(t0);
  });

  it('starts polling GetState every 2 s after two failed attempts', async () => {
    const h = setup([fail, fail, hold()]);
    const t0 = Date.now();
    h.store.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(h.store.polling()).toBe(true);
    expect(h.polls).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000); // t = 3100: polls at 3000 (second failure was at 1000)
    expect(h.polls.map((t) => t - t0)).toEqual([3000]);
    expect(h.store.state()?.playerDeviceId).toBe('polled');
    expect(h.store.connected()).toBe(false);
  });

  it('does not poll after a single failure', async () => {
    const h = setup([fail, hold(st('d1'))]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.polls).toEqual([]);
    expect(h.store.polling()).toBe(false);
    expect(h.store.state()?.playerDeviceId).toBe('d1');
  });

  it('polls on a 2 s beat while the stream stays down', async () => {
    const h = setup([fail, fail, fail, fail, fail, fail, fail, hold()]);
    const t0 = Date.now();
    h.store.start();
    await vi.advanceTimersByTimeAsync(11_000);
    // polling began at t=1000, so polls fall at 3000, 5000, 7000, 9000, 11000
    expect(h.polls.map((t) => t - t0)).toEqual([3000, 5000, 7000, 9000, 11_000]);
  });

  it('stops polling as soon as a stream message arrives', async () => {
    const h = setup([fail, fail, fail, hold(st('back'))]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 100); // 4th attempt at t=7000
    expect(h.store.state()?.playerDeviceId).toBe('back');
    expect(h.store.polling()).toBe(false);
    expect(h.store.connected()).toBe(true);
    const polled = h.polls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(h.polls.length).toBe(polled);
  });

  it('a poll answer that arrives after the stream is back does not overwrite the stream state', async () => {
    const h = setup([fail, fail, hold(st('stream'))]);
    h.setPolled(st('stale-poll'));
    const release = h.holdPolls();
    h.store.start();
    await vi.advanceTimersByTimeAsync(3100); // the poll at 3000 is still waiting when the stream delivers
    expect(h.polls.length).toBe(1);
    expect(h.store.state()?.playerDeviceId).toBe('stream');
    release();
    await vi.advanceTimersByTimeAsync(100);
    expect(h.store.state()?.playerDeviceId).toBe('stream');
  });

  it('resets the back-off after a message', async () => {
    const h = setup([fail, fail, thenFail(st('d1')), hold()]);
    const t0 = Date.now();
    h.store.start();
    await vi.advanceTimersByTimeAsync(10_000);
    // attempts: 0, +1 s, +2 s (message then drop), then the wait is 1 s again, not 4 s
    expect(h.attempts.map((t) => t - t0)).toEqual([0, 1000, 3000, 4000]);
  });

  it('a stream that ends cleanly is retried', async () => {
    const h = setup([
      async function* () {
        yield { state: st('d1') };
      },
      hold(st('d2')),
    ]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(h.attempts.length).toBe(2);
    expect(h.store.state()?.playerDeviceId).toBe('d2');
  });

  describe('silence', () => {
    it('a stream that says nothing for 60 s is closed and opened again', async () => {
      const h = setup([hold(st('d1')), hold(st('d2'))]);
      const t0 = Date.now();
      h.store.start();
      await vi.advanceTimersByTimeAsync(59_000);
      expect(h.attempts.length).toBe(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(h.aborted()).toBe(1);
      await vi.advanceTimersByTimeAsync(1500); // the first retry wait is 1 s
      expect(h.attempts.map((t) => t - t0)).toEqual([0, 61_000]);
      expect(h.store.state()?.playerDeviceId).toBe('d2');
    });

    it('a stream that keeps delivering is left alone', async () => {
      let send!: (s: State) => void;
      const h = setup([
        async function* (ctx) {
          const queue: State[] = [];
          let wake: (() => void) | undefined;
          send = (s) => {
            queue.push(s);
            wake?.();
          };
          while (!ctx.signal.aborted) {
            const next = queue.shift();
            if (next) yield { state: next };
            else await new Promise<void>((r) => ((wake = r), ctx.signal.addEventListener('abort', () => r())));
          }
        },
      ]);
      h.store.start();
      await vi.advanceTimersByTimeAsync(10);
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(40_000); // each gap is shorter than 60 s: 200 s in all
        send(st('d' + i));
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(h.attempts.length).toBe(1);
      expect(h.store.connected()).toBe(true);
    });

    it('a stream that never delivers its first message is also given up after 60 s', async () => {
      const h = setup([hold(), hold(st('d1'))]);
      h.store.start();
      await vi.advanceTimersByTimeAsync(62_500);
      expect(h.attempts.length).toBe(2);
      expect(h.store.state()?.playerDeviceId).toBe('d1');
    });

    it('stop cancels the silence timer too', async () => {
      const h = setup([hold(st('d1'))]);
      h.store.start();
      await vi.advanceTimersByTimeAsync(10);
      h.store.stop();
      await vi.advanceTimersByTimeAsync(10);
      expect(vi.getTimerCount()).toBe(0); // nothing is left to fire later
      await vi.advanceTimersByTimeAsync(120_000);
      expect(h.attempts.length).toBe(1);
    });
  });

  it('stop aborts the stream and every timer, and clears the state', async () => {
    const h = setup([fail, fail, hold(st('d1'))]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(3100);
    expect(h.aborted()).toBe(0);
    h.store.stop();
    expect(h.store.state()).toBeUndefined();
    expect(h.store.connected()).toBe(false);
    expect(h.store.polling()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.aborted()).toBe(1);
    const attempts = h.attempts.length;
    const polls = h.polls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.attempts.length).toBe(attempts);
    expect(h.polls.length).toBe(polls);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop during a back-off wait cancels the retry', async () => {
    const h = setup([fail, hold()]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(500);
    h.store.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.attempts.length).toBe(1);
  });

  it('start twice opens one stream; start after stop opens a new one', async () => {
    const h = setup([hold(st('a')), hold(st('b'))]);
    h.store.start();
    h.store.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.attempts.length).toBe(1);
    h.store.stop();
    h.store.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.attempts.length).toBe(2);
    expect(h.store.state()?.playerDeviceId).toBe('b');
  });

  it('keeps the server clock offset of the latest state', async () => {
    const h = setup([hold(st('d1', 5000))]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(0); // the fake clock has not moved since the message arrived
    expect(h.store.offsetMs()).toBe(5000 - performance.now());
  });

  it('positionMs extrapolates a playing song', async () => {
    const h = setup([hold(st('d1', 1000))]);
    h.store.start();
    await vi.advanceTimersByTimeAsync(10);
    const base = h.store.positionMs();
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.store.positionMs() - base).toBe(2000);
  });

  it('positionMs is 0 without a state', () => {
    expect(setup([]).store.positionMs()).toBe(0);
  });

  it('follows the sign-in: opens when a token appears, closes on sign-out', async () => {
    const h = setup([hold(st('d1'))]);
    const auth = TestBed.inject(AuthStore);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.attempts.length).toBe(0);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, {}) }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.attempts.length).toBe(1);
    expect(h.store.state()?.playerDeviceId).toBe('d1');
    auth.signOut();
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.store.state()).toBeUndefined();
    expect(h.aborted()).toBe(1);
  });

  it('stays closed while a password change is required', async () => {
    const h = setup([hold(st('d1'))]);
    const auth = TestBed.inject(AuthStore);
    auth.signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd', user: create(UserSchema, { mustChangePassword: true }) }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.attempts.length).toBe(0);
    auth.setUser(create(UserSchema, { mustChangePassword: false }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.attempts.length).toBe(1);
  });

  it('regression: a required password change closes the stream even when the user is not loaded yet', async () => {
    // a reload leaves a token but no user; the server then refuses everything with "password change required"
    const attempts: number[] = [];
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TRANSPORT,
          useFactory: () => {
            const auth = inject(AuthStore);
            const interceptors = apiInterceptors({
              token: () => auth.token(),
              onUnauthenticated: () => auth.signOut(),
              onPasswordChange: () => auth.markMustChangePassword(),
            });
            return createRouterTransport(
              ({ service }) =>
                service(SessionService, {
                  // eslint-disable-next-line require-yield -- always refused
                  async *watchState() {
                    attempts.push(Date.now());
                    throw new ConnectError('password change required', Code.FailedPrecondition);
                  },
                  getState() {
                    throw new ConnectError('password change required', Code.FailedPrecondition);
                  },
                }),
              { transport: { interceptors } },
            );
          },
        },
      ],
    });
    const store = TestBed.inject(StateStore);
    TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: 'd' }));
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(100); // the first attempt is refused and the flag is set
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts.length).toBe(1);
    expect(store.polling()).toBe(false);
  });
});
