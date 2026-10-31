import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { SessionService, State } from '../../gen/kantahe/v1/session_pb';
import { injectClient } from './api';
import { AuthStore } from './auth.store';
import { positionNow, serverOffset } from './clock';

const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
const POLL_MS = 2000;
const FAILURES_BEFORE_POLLING = 2;
/** The server repeats the state every 25 s when nothing changes; a stream silent for longer is dead. */
const SILENCE_MS = 60_000;

/**
 * Keeps SessionService.WatchState open and exposes the latest State.
 * A failed attempt is retried after 1 s, 2 s, 4 s ... at most 30 s; the wait starts over after a
 * message. After two failed attempts in a row GetState is polled every 2 s until the stream is back.
 * A stream that delivers nothing for 60 s (a dead link does not close by itself) is closed and reopened.
 */
@Injectable({ providedIn: 'root' })
export class StateStore {
  private readonly client = injectClient(SessionService);
  private readonly auth = inject(AuthStore);

  readonly state = signal<State | undefined>(undefined);
  /** The stream is open and has delivered a state. */
  readonly connected = signal(false);
  /** GetState is being polled because the stream is down. */
  readonly polling = signal(false);
  /** Server time minus performance.now() when the latest state arrived. */
  readonly offsetMs = signal(0);

  private abort?: AbortController;
  private pollTimer?: ReturnType<typeof setInterval>;
  private pollBusy = false;

  constructor() {
    // follow the sign-in: open when a usable token appears, close when it goes away
    let wasOn = false;
    effect(() => {
      const on = this.auth.token() !== undefined && !this.auth.passwordChangeRequired();
      if (on === wasOn) return;
      wasOn = on;
      untracked(() => (on ? this.start() : this.stop()));
    });
  }

  start(): void {
    if (this.abort) return;
    const ac = new AbortController();
    this.abort = ac;
    void this.run(ac.signal);
  }

  stop(): void {
    this.abort?.abort();
    this.abort = undefined;
    this.stopPolling();
    this.connected.set(false);
    this.state.set(undefined);
  }

  /** Position of the current song now, in ms (0 when nothing plays). */
  positionMs(perfNowMs = performance.now()): number {
    const s = this.state();
    return s ? positionNow(s, this.offsetMs(), perfNowMs) : 0;
  }

  private apply(state: State | undefined, fromStream: boolean): void {
    if (!state) return;
    this.state.set(state);
    this.offsetMs.set(serverOffset(state, performance.now()));
    if (fromStream) {
      this.connected.set(true);
      this.stopPolling();
    }
  }

  private async run(signal: AbortSignal): Promise<void> {
    let failures = 0;
    let delay = FIRST_RETRY_MS;
    while (!signal.aborted) {
      // this attempt ends when the app stops or when the stream has been silent for too long
      const attempt = new AbortController();
      const stop = () => attempt.abort();
      signal.addEventListener('abort', stop);
      let watchdog = setTimeout(stop, SILENCE_MS);
      try {
        for await (const msg of this.client.watchState({}, { signal: attempt.signal })) {
          if (signal.aborted) return;
          clearTimeout(watchdog);
          watchdog = setTimeout(stop, SILENCE_MS);
          this.apply(msg.state, true);
          failures = 0;
          delay = FIRST_RETRY_MS;
        }
      } catch {
        // an error and a stream that simply ends are handled alike: wait, then reconnect
      } finally {
        clearTimeout(watchdog);
        signal.removeEventListener('abort', stop);
      }
      if (signal.aborted) return;
      this.connected.set(false);
      failures++;
      if (failures >= FAILURES_BEFORE_POLLING) this.startPolling(signal);
      await sleep(delay, signal);
      delay = Math.min(delay * 2, MAX_RETRY_MS);
    }
  }

  private startPolling(signal: AbortSignal): void {
    if (this.pollTimer) return;
    this.polling.set(true);
    this.pollTimer = setInterval(() => void this.poll(signal), POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
    this.polling.set(false);
  }

  private async poll(signal: AbortSignal): Promise<void> {
    if (this.pollBusy) return;
    this.pollBusy = true;
    try {
      const res = await this.client.getState({}, { signal });
      // a stream message that arrived meanwhile is newer than this answer
      if (!signal.aborted && !this.connected()) this.apply(res.state, false);
    } catch {
      // the next beat tries again; sign-out and password errors are handled by the interceptors
    } finally {
      this.pollBusy = false;
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });
}
