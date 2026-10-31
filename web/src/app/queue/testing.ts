import { create, MessageInitShape } from '@bufbuild/protobuf';
import { createRouterTransport } from '@connectrpc/connect';
import { Device, DeviceSchema, DeviceType, Format, Song } from '../../gen/kantahe/v1/common_pb';
import {
  AddToQueueRequest,
  AddToQueueResponseSchema,
  ControlAction,
  ControlRequest,
  ControlResponseSchema,
  GetStateResponseSchema,
  MoveToTopRequest,
  MoveToTopResponseSchema,
  NowPlayingSchema,
  PlayStatus,
  QueueItemSchema,
  RemoveFromQueueRequest,
  RemoveFromQueueResponseSchema,
  SessionService,
  SongSource,
  State,
  StateSchema,
  UpNextSchema,
} from '../../gen/kantahe/v1/session_pb';
import { song } from '../library/testing';

export { song };

export function device(id: string, name: string, over: MessageInitShape<typeof DeviceSchema> = {}): Device {
  return create(DeviceSchema, { id, name, type: DeviceType.WEB, online: true, ...over });
}

export interface StateInit {
  status?: PlayStatus;
  player?: string;
  devices?: Device[];
  now?: { song: Song; source?: SongSource; positionMs: number; positionAtMs: number };
  queue?: { id: string; song: Song }[];
  upNext?: { song: Song; source?: SongSource };
  serverTimeMs?: number;
}

export function stateOf(i: StateInit = {}): State {
  return create(StateSchema, {
    status: i.status ?? PlayStatus.PAUSED,
    playerDeviceId: i.player ?? '',
    devices: i.devices ?? [],
    now: i.now && create(NowPlayingSchema, { song: i.now.song, source: i.now.source ?? SongSource.QUEUE, positionMs: BigInt(i.now.positionMs), positionAtMs: BigInt(i.now.positionAtMs) }),
    queue: (i.queue ?? []).map((q) => create(QueueItemSchema, q)),
    upNext: i.upNext && create(UpNextSchema, { song: i.upNext.song, source: i.upNext.source ?? SongSource.QUEUE }),
    serverTimeMs: BigInt(i.serverTimeMs ?? 1000),
  });
}

/** A server whose WatchState the test drives with push(); every command is recorded. */
export function fakeSession() {
  const calls = {
    control: [] as ControlRequest[],
    remove: [] as RemoveFromQueueRequest[],
    top: [] as MoveToTopRequest[],
    add: [] as AddToQueueRequest[],
  };
  const pending: State[] = [];
  let wake: (() => void) | undefined;
  let fail: ((req: unknown) => Error | undefined) | undefined;
  let hold: Promise<void> | undefined;
  const transport = createRouterTransport(({ service }) =>
    service(SessionService, {
      async *watchState(_req, ctx) {
        while (!ctx.signal.aborted) {
          const next = pending.shift();
          if (next) yield { state: next };
          else await new Promise<void>((resolve) => ((wake = resolve), ctx.signal.addEventListener('abort', () => resolve())));
        }
      },
      getState: () => create(GetStateResponseSchema, {}),
      async control(req) {
        calls.control.push(req);
        await hold; // a command that is slow to answer
        const e = fail?.(req);
        if (e) throw e;
        return create(ControlResponseSchema, {});
      },
      removeFromQueue(req) {
        calls.remove.push(req);
        return create(RemoveFromQueueResponseSchema, {});
      },
      moveToTop(req) {
        calls.top.push(req);
        return create(MoveToTopResponseSchema, {});
      },
      addToQueue(req) {
        calls.add.push(req);
        return create(AddToQueueResponseSchema, {});
      },
    }),
  );
  return {
    transport,
    calls,
    push(s: State) {
      pending.push(s);
      wake?.();
    },
    failControl(e: (req: unknown) => Error | undefined) {
      fail = e;
    },
    /** Control commands do not answer until this promise settles. */
    holdControl(p: Promise<void>) {
      hold = p;
    },
  };
}

export { ControlAction, DeviceType, Format, PlayStatus, SongSource };
