import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import {
  AdminService,
  CreateUserRequest,
  CreateUserResponseSchema,
  DeleteUserResponseSchema,
  ListUsersResponseSchema,
  ResetPasswordRequest,
  ResetPasswordResponseSchema,
  RevokeUserDevicesResponseSchema,
  UpdateUserRequest,
  UpdateUserResponseSchema,
} from '../../gen/kantahe/v1/admin_pb';
import { User, UserSchema } from '../../gen/kantahe/v1/common_pb';

export function user(id: string, email: string, over: Partial<Omit<User, '$typeName' | '$unknown'>> = {}): User {
  return create(UserSchema, { id, email, displayName: email.split('@')[0], ...over });
}

/** An in-memory AdminService for users; every request is recorded and a failure can be queued. */
export function fakeAdminUsers(seed: User[], opts: { devicesRevoked?: number } = {}) {
  const users = seed.map((u) => ({ ...u }) as User);
  const calls = {
    create: [] as CreateUserRequest[],
    update: [] as UpdateUserRequest[],
    reset: [] as ResetPasswordRequest[],
    remove: [] as string[],
    revoke: [] as string[],
    list: 0,
  };
  const fail: { next?: ConnectError } = {};
  const maybeFail = () => {
    const e = fail.next;
    fail.next = undefined;
    if (e) throw e;
  };
  let nextId = 100;
  const transport = createRouterTransport(({ service }) =>
    service(AdminService, {
      listUsers() {
        calls.list++;
        maybeFail();
        return create(ListUsersResponseSchema, { users });
      },
      createUser(req) {
        calls.create.push(req);
        maybeFail();
        if (users.some((u) => u.email === req.email)) throw new ConnectError('email already in use', Code.AlreadyExists);
        const u = create(UserSchema, { id: `u${nextId++}`, email: req.email, displayName: req.displayName, admin: req.admin, uploader: req.uploader, mustChangePassword: true });
        users.push(u);
        return create(CreateUserResponseSchema, { user: u });
      },
      updateUser(req) {
        calls.update.push(req);
        maybeFail();
        const i = users.findIndex((u) => u.id === req.userId);
        if (i < 0) throw new ConnectError('not found', Code.NotFound);
        users[i] = create(UserSchema, {
          ...users[i],
          ...(req.displayName !== undefined ? { displayName: req.displayName } : {}),
          ...(req.admin !== undefined ? { admin: req.admin } : {}),
          ...(req.uploader !== undefined ? { uploader: req.uploader } : {}),
          ...(req.disabled !== undefined ? { disabled: req.disabled } : {}),
        });
        return create(UpdateUserResponseSchema, { user: users[i] });
      },
      resetPassword(req) {
        calls.reset.push(req);
        maybeFail();
        return create(ResetPasswordResponseSchema, {});
      },
      deleteUser(req) {
        calls.remove.push(req.userId);
        maybeFail();
        const i = users.findIndex((u) => u.id === req.userId);
        if (i >= 0) users.splice(i, 1);
        return create(DeleteUserResponseSchema, {});
      },
      revokeUserDevices(req) {
        calls.revoke.push(req.userId);
        maybeFail();
        return create(RevokeUserDevicesResponseSchema, { revoked: opts.devicesRevoked ?? 2 });
      },
    }),
  );
  return {
    transport,
    calls,
    users,
    failNext(e: ConnectError) {
      fail.next = e;
    },
  };
}

// ---- songs, upload and settings ----

import { CatalogService, SearchSongsRequest, SearchSongsResponseSchema } from '../../gen/kantahe/v1/catalog_pb';
import {
  DeleteSongResponseSchema,
  GetServerSettingsResponseSchema,
  BrokenSongSchema,
  CheckLibraryResponseSchema,
  ListBrokenSongsRequest,
  ListBrokenSongsResponseSchema,
  RemoveScope,
  RemoveSongsRequest,
  RemoveSongsResponseSchema,
  RescanResponseSchema,
  ServerSettingsSchema,
  UpdateServerSettingsRequest,
  UpdateServerSettingsResponseSchema,
  UpdateSongRequest,
  UpdateSongResponseSchema,
} from '../../gen/kantahe/v1/admin_pb';
import { Song } from '../../gen/kantahe/v1/common_pb';
import { UploadService, UploadSongRequest, UploadSongResponseSchema, UploadStatus } from '../../gen/kantahe/v1/upload_pb';
import { song } from '../library/testing';

export { song };

export interface UploadReply {
  status: UploadStatus;
  number?: string;
  reason?: string;
}

/** An in-memory server for song administration, upload and settings. */
export function fakeAdminSongs(seed: { songs?: Song[]; broken?: { song: Song; reason: string }[]; maxUploadBytes?: number; scoreSeconds?: number; pageSize?: number } = {}) {
  const songs = [...(seed.songs ?? [])];
  let broken = [...(seed.broken ?? [])];
  const calls = {
    search: [] as SearchSongsRequest[],
    upload: [] as UploadSongRequest[],
    update: [] as UpdateSongRequest[],
    remove: [] as string[],
    /** keepFile of each DeleteSong, in the order of remove. */
    removeKeep: [] as boolean[],
    removeSongs: [] as RemoveScope[],
    /** The whole RemoveSongs request, scope and deleteFiles. */
    removeRequests: [] as RemoveSongsRequest[],
    checks: 0,
    listBroken: [] as ListBrokenSongsRequest[],
    rescan: 0,
    settings: [] as UpdateServerSettingsRequest[],
    getSettings: 0,
  };
  let settings = { maxUploadBytes: BigInt(seed.maxUploadBytes ?? 50 * 1024 * 1024), scoreSeconds: seed.scoreSeconds ?? 6, maxVideoBytes: BigInt(500 * 1024 * 1024) };
  const concurrency = { now: 0, max: 0, startedAfterFinished: [] as boolean[] };
  const fail: { next?: ConnectError } = {};
  const maybeFail = () => {
    const e = fail.next;
    fail.next = undefined;
    if (e) throw e;
  };
  /** What UploadSong answers; may be async to hold a file back. */
  const handlers = {
    upload: ((req: UploadSongRequest, index: number): UploadReply | Promise<UploadReply> => ({ status: UploadStatus.ADDED, number: String(index + 1).padStart(5, '0'), reason: req.filename && '' })) as (
      req: UploadSongRequest,
      index: number,
    ) => UploadReply | Promise<UploadReply>,
    rescan: { added: 3, updated: 1, removed: 0, failed: 2 },
    removeSongs: { removed: 5 },
    /** What CheckLibrary streams: the songs checked at each step (the last one is the total) and how many are broken at the end. */
    check: { steps: [2, 4], broken: 1 },
  };
  const transport = createRouterTransport(({ service }) => {
    service(UploadService, {
      async uploadSong(req) {
        const index = calls.upload.length;
        calls.upload.push(req);
        concurrency.now++;
        concurrency.max = Math.max(concurrency.max, concurrency.now);
        try {
          maybeFail();
          const r = await handlers.upload(req, index);
          return create(UploadSongResponseSchema, { status: r.status, reason: r.reason ?? '', song: r.number ? song(r.number, req.filename, '') : undefined });
        } finally {
          concurrency.now--;
        }
      },
    });
    service(CatalogService, {
      searchSongs(req) {
        calls.search.push(req);
        const q = req.query.toLowerCase();
        const found = songs.filter((s) => !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
        const pageSize = seed.pageSize ?? 2;
        const start = req.pageToken ? Number(req.pageToken) : 0;
        const next = start + pageSize < found.length ? String(start + pageSize) : '';
        return create(SearchSongsResponseSchema, { songs: found.slice(start, start + pageSize), nextPageToken: next });
      },
    });
    service(AdminService, {
      updateSong(req) {
        calls.update.push(req);
        maybeFail();
        const i = songs.findIndex((s) => s.number === req.number);
        if (i < 0) throw new ConnectError('song not found', Code.NotFound);
        songs[i] = { ...songs[i], title: req.title === undefined ? songs[i].title : req.title || 'File title', artist: req.artist === undefined ? songs[i].artist : req.artist || 'File artist' } as Song;
        return create(UpdateSongResponseSchema, { song: songs[i] });
      },
      deleteSong(req) {
        calls.remove.push(req.number);
        calls.removeKeep.push(req.keepFile);
        maybeFail();
        const i = songs.findIndex((s) => s.number === req.number);
        if (i >= 0) songs.splice(i, 1);
        broken = broken.filter((b) => b.song.number !== req.number);
        return create(DeleteSongResponseSchema, {});
      },
      removeSongs(req) {
        calls.removeSongs.push(req.scope);
        calls.removeRequests.push(req);
        maybeFail();
        if (req.scope === RemoveScope.BROKEN) {
          const removed = broken.length;
          broken = [];
          return create(RemoveSongsResponseSchema, { removed, filesDeleted: req.deleteFiles ? removed : 0, filesFailed: 0 });
        }
        return create(RemoveSongsResponseSchema, handlers.removeSongs);
      },
      async *checkLibrary() {
        calls.checks++;
        maybeFail();
        const total = handlers.check.steps[handlers.check.steps.length - 1];
        for (const checked of handlers.check.steps) {
          await Promise.resolve();
          yield create(CheckLibraryResponseSchema, { checked, total, broken: checked === total ? handlers.check.broken : 0 });
        }
        yield create(CheckLibraryResponseSchema, { checked: total, total, broken: handlers.check.broken, done: true });
      },
      listBrokenSongs(req) {
        calls.listBroken.push(req);
        maybeFail();
        const size = req.pageSize || seed.pageSize || 2;
        const start = req.pageToken ? Number(req.pageToken) : 0;
        const next = start + size < broken.length ? String(start + size) : '';
        return create(ListBrokenSongsResponseSchema, {
          songs: broken.slice(start, start + size).map((b) => create(BrokenSongSchema, b)),
          nextPageToken: next,
          total: broken.length,
        });
      },
      rescan() {
        calls.rescan++;
        maybeFail();
        return create(RescanResponseSchema, handlers.rescan);
      },
      getServerSettings() {
        calls.getSettings++;
        maybeFail();
        return create(GetServerSettingsResponseSchema, { settings: create(ServerSettingsSchema, settings) });
      },
      updateServerSettings(req) {
        calls.settings.push(req);
        maybeFail();
        settings = { maxUploadBytes: req.maxUploadBytes ?? settings.maxUploadBytes, scoreSeconds: req.scoreSeconds ?? settings.scoreSeconds, maxVideoBytes: req.maxVideoBytes ?? settings.maxVideoBytes };
        return create(UpdateServerSettingsResponseSchema, { settings: create(ServerSettingsSchema, settings) });
      },
    });
  });
  return {
    transport,
    calls,
    songs,
    /** Marks songs as broken from now on (what a check finds). */
    setBroken(list: { song: Song; reason: string }[]) {
      broken = [...list];
    },
    handlers,
    concurrency,
    failNext(e: ConnectError) {
      fail.next = e;
    },
  };
}

export { RemoveScope, UploadStatus };
