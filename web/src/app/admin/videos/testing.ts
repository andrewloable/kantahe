import { create } from '@bufbuild/protobuf';
import { Client, Code, ConnectError, createClient, createRouterTransport } from '@connectrpc/connect';
import {
  AdminService,
  DeleteVideoResponseSchema,
  GetServerSettingsResponseSchema,
  ListVideosResponseSchema,
  ReorderVideosResponseSchema,
  ServerSettingsSchema,
  UpdateServerSettingsRequest,
  UpdateServerSettingsResponseSchema,
  UpdateVideoRequest,
  UpdateVideoResponseSchema,
} from '../../../gen/kantahe/v1/admin_pb';
import { Video, VideoSchema } from '../../../gen/kantahe/v1/common_pb';
import {
  AbortVideoUploadResponseSchema,
  BeginVideoUploadResponseSchema,
  CompleteVideoUploadResponseSchema,
  UploadService,
  UploadStatus,
  UploadVideoChunkResponseSchema,
} from '../../../gen/kantahe/v1/upload_pb';
import { ResumeStore } from './video-uploader';

export const MIB = 1024 * 1024;

/** A file that can only be read through slice(): the whole file in one piece is refused, as it must never be needed. */
export function bigFile(name: string, size: number, lastModified = 1): File {
  const slice = (start: number, end: number) => ({ size: end - start, arrayBuffer: async () => new ArrayBuffer(end - start) });
  return {
    name,
    size,
    lastModified,
    type: 'video/mp4',
    slice,
    arrayBuffer: () => Promise.reject(new Error('the whole file must never be read at once')),
    text: () => Promise.reject(new Error('the whole file must never be read at once')),
    stream: () => {
      throw new Error('the whole file must never be read at once');
    },
  } as unknown as File;
}

export function memoryStore(initial: Record<string, { uploadId: string; lastModified: number }> = {}): ResumeStore & { data: Record<string, { uploadId: string; lastModified: number }> } {
  const data = { ...initial };
  return { data, get: (k) => data[k], set: (k, v) => void (data[k] = v), remove: (k) => void delete data[k] };
}

/** What a test says about the video upload RPCs of the fake server. */
export interface UploadScript {
  /** Bytes the server already has when begin is called (a resume). */
  received: number;
  chunkSize: number;
  /** Begin refuses the file with this reason. */
  reject?: string;
  /** The nth chunk call (counting from 1) is stored but its answer is lost: the client sees an Unavailable error. */
  loseAnswerAt: number[];
  /** The nth chunk call fails before anything is stored, with this error. */
  failAt: Map<number, ConnectError>;
  /** The nth chunk call does not answer until the client gives up. */
  hangAt: number[];
  complete: { status: UploadStatus; video?: Video; reason?: string };
}

/** A server for the video RPCs of the administrator: it keeps the videos and the bytes of one upload, and records every call. */
export function fakeVideoServer(opts: { videos?: Video[]; maxVideoBytes?: number; script?: Partial<UploadScript> } = {}) {
  let videos = (opts.videos ?? []).map((v) => ({ ...v }) as Video);
  let settings = { maxUploadBytes: 50n * 1048576n, scoreSeconds: 6, maxVideoBytes: BigInt(opts.maxVideoBytes ?? 500 * MIB), backgroundEnabled: true, backgroundShuffle: false };
  const script: UploadScript = { received: 0, chunkSize: 4 * MIB, loseAnswerAt: [], failAt: new Map(), hangAt: [], complete: { status: UploadStatus.ADDED }, ...opts.script };
  const calls = {
    list: 0,
    getSettings: 0,
    update: [] as UpdateVideoRequest[],
    reorder: [] as string[][],
    remove: [] as string[],
    settings: [] as UpdateServerSettingsRequest[],
    begin: [] as { filename: string; sizeBytes: bigint }[],
    chunks: [] as { uploadId: string; offset: number; size: number }[],
    complete: [] as string[],
    abort: [] as string[],
  };
  const fail: { next?: ConnectError; reorder?: ConnectError; list?: ConnectError } = {};
  /** While a promise is set here, every chunk call waits for it (the test then decides when an upload goes on). */
  const hold: { promise?: Promise<void> } = {};
  let have = script.received;
  let chunkCalls = 0;
  let nextVideo = 1;

  const transport = createRouterTransport(({ service }) => {
    service(AdminService, {
      listVideos() {
        calls.list++;
        if (fail.list) {
          const e = fail.list;
          fail.list = undefined;
          throw e;
        }
        return create(ListVideosResponseSchema, { videos });
      },
      updateVideo(req) {
        calls.update.push(req);
        if (fail.next) {
          const e = fail.next;
          fail.next = undefined;
          throw e;
        }
        const i = videos.findIndex((v) => v.id === req.id);
        if (i < 0) throw new ConnectError('video not found', Code.NotFound);
        const name = req.name === undefined ? videos[i].name : req.name.trim();
        if (name.length < 1 || [...name].length > 200) throw new ConnectError('the name must be 1 to 200 characters', Code.InvalidArgument);
        videos[i] = create(VideoSchema, { ...videos[i], name, enabled: req.enabled ?? videos[i].enabled });
        return create(UpdateVideoResponseSchema, { video: videos[i] });
      },
      reorderVideos(req) {
        calls.reorder.push([...req.ids]);
        if (fail.reorder) {
          const e = fail.reorder;
          fail.reorder = undefined;
          throw e;
        }
        videos = req.ids.map((id, i) => create(VideoSchema, { ...videos.find((v) => v.id === id)!, position: i + 1 }));
        return create(ReorderVideosResponseSchema, { videos });
      },
      deleteVideo(req) {
        calls.remove.push(req.id);
        if (fail.next) {
          const e = fail.next;
          fail.next = undefined;
          throw e;
        }
        videos = videos.filter((v) => v.id !== req.id).map((v, i) => create(VideoSchema, { ...v, position: i + 1 }));
        return create(DeleteVideoResponseSchema, {});
      },
      getServerSettings() {
        calls.getSettings++;
        return create(GetServerSettingsResponseSchema, { settings: create(ServerSettingsSchema, settings) });
      },
      updateServerSettings(req) {
        calls.settings.push(req);
        if (fail.next) {
          const e = fail.next;
          fail.next = undefined;
          throw e;
        }
        settings = {
          maxUploadBytes: req.maxUploadBytes ?? settings.maxUploadBytes,
          scoreSeconds: req.scoreSeconds ?? settings.scoreSeconds,
          maxVideoBytes: req.maxVideoBytes ?? settings.maxVideoBytes,
          backgroundEnabled: req.backgroundEnabled ?? settings.backgroundEnabled,
          backgroundShuffle: req.backgroundShuffle ?? settings.backgroundShuffle,
        };
        return create(UpdateServerSettingsResponseSchema, { settings: create(ServerSettingsSchema, settings) });
      },
    });
    service(UploadService, {
      beginVideoUpload(req) {
        calls.begin.push({ filename: req.filename, sizeBytes: req.sizeBytes });
        if (script.reject) return create(BeginVideoUploadResponseSchema, { status: UploadStatus.REJECTED, reason: script.reject });
        return create(BeginVideoUploadResponseSchema, { uploadId: 'up1', chunkSize: script.chunkSize, received: BigInt(have) });
      },
      async uploadVideoChunk(req, ctx) {
        chunkCalls++;
        calls.chunks.push({ uploadId: req.uploadId, offset: Number(req.offset), size: req.content.length });
        if (hold.promise) await hold.promise;
        const failure = script.failAt.get(chunkCalls);
        if (failure) throw failure;
        if (script.hangAt.includes(chunkCalls)) {
          await new Promise<void>((resolve) => ctx.signal.addEventListener('abort', () => resolve()));
          throw new ConnectError('canceled', Code.Canceled);
        }
        if (Number(req.offset) !== have) throw new ConnectError(`offset ${req.offset} expected ${have}`, Code.FailedPrecondition);
        have += req.content.length;
        if (script.loseAnswerAt.includes(chunkCalls)) throw new ConnectError('the connection was lost', Code.Unavailable);
        return create(UploadVideoChunkResponseSchema, { received: BigInt(have) });
      },
      completeVideoUpload(req) {
        calls.complete.push(req.uploadId);
        have = script.received; // the next upload starts again
        const video = script.complete.video ?? create(VideoSchema, { id: `v-new-${nextVideo++}`, name: 'New', enabled: true, position: videos.length + 1, width: 1920, height: 1080, durationMs: 30_000n, sizeBytes: BigInt(have), codec: 'avc1' });
        if (script.complete.status === UploadStatus.ADDED) videos = [...videos, video];
        return create(CompleteVideoUploadResponseSchema, { status: script.complete.status, video: script.complete.status === UploadStatus.REJECTED ? undefined : video, reason: script.complete.reason ?? '' });
      },
      abortVideoUpload(req) {
        calls.abort.push(req.uploadId);
        return create(AbortVideoUploadResponseSchema, {});
      },
    });
  });
  return {
    transport,
    calls,
    fail,
    hold,
    script,
    /** The client the uploader uses. */
    uploadClient: createClient(UploadService, transport) as Client<typeof UploadService>,
    videos: () => videos,
  };
}

/** A video as the server lists it. */
export function listed(id: string, name: string, over: Partial<Omit<Video, '$typeName' | '$unknown'>> = {}): Video {
  return create(VideoSchema, {
    id,
    name,
    sizeBytes: BigInt(42 * MIB),
    durationMs: 30_000n,
    width: 1920,
    height: 1080,
    codec: 'avc1',
    hasAudio: false,
    faststart: true,
    enabled: true,
    url: `/media/video/${id}?u=u1&exp=1900000000&sig=s`,
    warnings: [],
    ...over,
  });
}
