import { TestBed } from '@angular/core/testing';
import { create } from '@bufbuild/protobuf';
import { AuthTokenSchema } from '../../gen/kantahe/v1/common_pb';
import { PlayStatus, ScoreSchema } from '../../gen/kantahe/v1/session_pb';
import { device, fakeSession, stateOf } from '../queue/testing';
import { TRANSPORT } from './api';
import { AuthStore } from './auth.store';
import { ScoreNotifier } from './score-notifier';
import { StateStore } from './state.store';
import { ToastService } from './toast';

const ME = 'me';

function setup() {
  const server = fakeSession();
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: TRANSPORT, useValue: server.transport }] });
  TestBed.inject(AuthStore).signIn(create(AuthTokenSchema, { token: 't', deviceId: ME }));
  TestBed.inject(StateStore);
  TestBed.inject(ScoreNotifier);
  const toasts = TestBed.inject(ToastService);
  TestBed.tick();
  const push = async (player: string, score?: Parameters<typeof create<typeof ScoreSchema>>[1]) => {
    const s = stateOf({ status: PlayStatus.PAUSED, player, devices: [device(ME, 'Phone', { isCaller: true }), device('tv', 'TV')] });
    if (score) s.score = create(ScoreSchema, { number: '1', untilMs: 5000n, ...score });
    server.push(s);
    await vi.advanceTimersByTimeAsync(20);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(20);
  };
  return { push, toasts };
}

describe('ScoreNotifier', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(StateStore).stop();
    vi.useRealTimers();
  });

  it('a remote device shows the score as a toast, once', async () => {
    const { push, toasts } = setup();
    await push('tv', { hasValue: true, value: 87 });
    await push('tv', { hasValue: true, value: 87 }); // the same score pushed again
    expect(toasts.toasts().map((t) => t.message)).toEqual(['Score 87']);
  });

  it('the player device does not (it shows the overlay)', async () => {
    const { push, toasts } = setup();
    await push(ME, { hasValue: true, value: 87 });
    expect(toasts.toasts()).toEqual([]);
  });

  it('a score without a value says so', async () => {
    const { push, toasts } = setup();
    await push('tv', { hasValue: false });
    expect(toasts.toasts().map((t) => t.message)).toEqual(['No score this time']);
  });

  it('nothing for a state without a score', async () => {
    const { push, toasts } = setup();
    await push('tv');
    expect(toasts.toasts()).toEqual([]);
  });

  it('every new score gets its toast', async () => {
    const { push, toasts } = setup();
    await push('tv', { number: '1', hasValue: true, value: 87, untilMs: 5000n });
    await push('tv');
    await push('tv', { number: '2', hasValue: true, value: 91, untilMs: 15000n });
    expect(toasts.toasts().map((t) => t.message)).toEqual(['Score 87', 'Score 91']);
  });
});
