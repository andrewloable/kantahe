import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';
import { AuthService, ListMyDevicesResponseSchema, RevokeDeviceResponseSchema } from '../../gen/kantahe/v1/auth_pb';
import { Device, MidiMode, Song } from '../../gen/kantahe/v1/common_pb';
import {
  AddPlaylistToQueueResponseSchema,
  AddToQueueResponseSchema,
  SessionService,
  SetMidiModeResponseSchema,
  UpdateUserSettingsRequest,
  UpdateUserSettingsResponseSchema,
  UserSettingsSchema,
} from '../../gen/kantahe/v1/session_pb';
import {
  CreatePlaylistResponseSchema,
  DeletePlaylistResponseSchema,
  GetPlaylistResponseSchema,
  HistoryEntry,
  HistoryEntrySchema,
  ListFavouritesResponseSchema,
  ListHistoryResponseSchema,
  ListPlaylistsResponseSchema,
  PlaylistSchema,
  PlaylistSummarySchema,
  SetFavouriteResponseSchema,
  UpdatePlaylistResponseSchema,
  UserLibraryService,
} from '../../gen/kantahe/v1/user_library_pb';
import { song } from '../library/testing';

export { song };

export interface PlaylistData {
  id: string;
  name: string;
  songs: Song[];
}

export function historyEntry(s: Song, over: Partial<{ sungAtUnix: bigint; skipped: boolean; hasScore: boolean; score: number }> = {}): HistoryEntry {
  return create(HistoryEntrySchema, { song: s, sungAtUnix: 1_767_268_800n, ...over });
}

/** An in-memory server for the Me pages: playlists really change, every request is recorded. */
export function fakeMe(seed: { playlists?: PlaylistData[]; favourites?: Song[]; history?: HistoryEntry[]; devices?: Device[]; catalog?: Song[] } = {}) {
  const favourites = [...(seed.favourites ?? [])];
  const playlists = new Map((seed.playlists ?? []).map((p) => [p.id, { ...p, songs: [...p.songs] }]));
  const catalog = new Map((seed.catalog ?? []).map((s) => [s.number, s]));
  for (const p of seed.playlists ?? []) for (const s of p.songs) catalog.set(s.number, s);
  for (const s of seed.favourites ?? []) catalog.set(s.number, s);
  let devices = [...(seed.devices ?? [])];
  const calls = {
    favourites: [] as string[],
    history: [] as string[],
    create: [] as { name: string; numbers: string[] }[],
    update: [] as { id: string; name?: string; replace: boolean; numbers: string[] }[],
    remove: [] as string[],
    get: [] as string[],
    toQueue: [] as string[],
    add: [] as string[],
    midi: [] as { deviceId: string; mode: MidiMode }[],
    settings: [] as UpdateUserSettingsRequest[],
    revoke: [] as string[],
    listDevices: 0,
  };
  const fail: { next?: ConnectError } = {};
  const maybeFail = () => {
    const e = fail.next;
    fail.next = undefined;
    if (e) throw e;
  };
  let nextId = 100;
  const asPlaylist = (p: PlaylistData) => create(PlaylistSchema, { id: p.id, name: p.name, songs: p.songs });
  const transport = createRouterTransport(({ service }) => {
    service(UserLibraryService, {
      listFavourites(req) {
        calls.favourites.push(req.pageToken);
        const all = favourites;
        const pageSize = 2;
        const start = req.pageToken ? Number(req.pageToken) : 0;
        const next = start + pageSize < all.length ? String(start + pageSize) : '';
        return create(ListFavouritesResponseSchema, { songs: all.slice(start, start + pageSize), nextPageToken: next });
      },
      listHistory(req) {
        calls.history.push(req.pageToken);
        const all = seed.history ?? [];
        const pageSize = 2;
        const start = req.pageToken ? Number(req.pageToken) : 0;
        const next = start + pageSize < all.length ? String(start + pageSize) : '';
        return create(ListHistoryResponseSchema, { entries: all.slice(start, start + pageSize), nextPageToken: next });
      },
      setFavourite(req) {
        const at = favourites.findIndex((x) => x.number === req.number);
        if (!req.favourite && at >= 0) favourites.splice(at, 1);
        if (req.favourite && at < 0 && catalog.has(req.number)) favourites.push(catalog.get(req.number) as Song);
        return create(SetFavouriteResponseSchema, {});
      },
      listPlaylists() {
        return create(ListPlaylistsResponseSchema, {
          playlists: [...playlists.values()].map((p) => create(PlaylistSummarySchema, { id: p.id, name: p.name, songCount: p.songs.length })),
        });
      },
      getPlaylist(req) {
        calls.get.push(req.id);
        const p = playlists.get(req.id);
        if (!p) throw new ConnectError('not found', Code.NotFound);
        return create(GetPlaylistResponseSchema, { playlist: asPlaylist(p) });
      },
      createPlaylist(req) {
        maybeFail();
        calls.create.push({ name: req.name, numbers: req.numbers });
        const p: PlaylistData = { id: `p${nextId++}`, name: req.name, songs: req.numbers.map((n) => catalog.get(n) as Song) };
        playlists.set(p.id, p);
        return create(CreatePlaylistResponseSchema, { playlist: asPlaylist(p) });
      },
      updatePlaylist(req) {
        maybeFail();
        calls.update.push({ id: req.id, name: req.name, replace: req.replaceNumbers, numbers: req.numbers });
        const p = playlists.get(req.id);
        if (!p) throw new ConnectError('not found', Code.NotFound);
        if (req.name !== undefined) p.name = req.name;
        const songs = req.numbers.map((n) => catalog.get(n) as Song);
        p.songs = req.replaceNumbers ? songs : [...p.songs, ...songs];
        return create(UpdatePlaylistResponseSchema, { playlist: asPlaylist(p) });
      },
      deletePlaylist(req) {
        maybeFail();
        calls.remove.push(req.id);
        playlists.delete(req.id);
        return create(DeletePlaylistResponseSchema, {});
      },
    });
    service(SessionService, {
      // eslint-disable-next-line require-yield -- the stream just stays quiet
      async *watchState(_req, ctx) {
        await new Promise<void>((resolve) => ctx.signal.addEventListener('abort', () => resolve()));
      },
      addToQueue(req) {
        calls.add.push(req.number);
        return create(AddToQueueResponseSchema, {});
      },
      addPlaylistToQueue(req) {
        maybeFail();
        calls.toQueue.push(req.playlistId);
        return create(AddPlaylistToQueueResponseSchema, { added: playlists.get(req.playlistId)?.songs.length ?? 0 });
      },
      setMidiMode(req) {
        maybeFail();
        calls.midi.push({ deviceId: req.deviceId, mode: req.mode });
        devices = devices.map((d) => (d.id === req.deviceId ? { ...d, midiMode: req.mode } : d));
        return create(SetMidiModeResponseSchema, { device: devices.find((d) => d.id === req.deviceId) });
      },
      updateUserSettings(req) {
        maybeFail();
        calls.settings.push(req);
        return create(UpdateUserSettingsResponseSchema, { settings: create(UserSettingsSchema, { scoreMode: req.scoreMode, scoreLevel: req.scoreLevel }) });
      },
    });
    service(AuthService, {
      listMyDevices() {
        calls.listDevices++;
        return create(ListMyDevicesResponseSchema, { devices });
      },
      revokeDevice(req) {
        maybeFail();
        calls.revoke.push(req.deviceId);
        devices = devices.filter((d) => d.id !== req.deviceId);
        return create(RevokeDeviceResponseSchema, {});
      },
    });
  });
  return {
    transport,
    calls,
    playlists,
    catalog,
    favourites,
    failNext(e: ConnectError) {
      fail.next = e;
    },
  };
}
