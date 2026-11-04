import { create } from '@bufbuild/protobuf';
import { createRouterTransport } from '@connectrpc/connect';
import {
  Artist,
  CatalogService,
  GetSongRequest,
  GetSongResponseSchema,
  ListArtistsRequest,
  ListArtistsResponseSchema,
  SearchSongsRequest,
  SearchSongsResponseSchema,
} from '../../gen/kantahe/v1/catalog_pb';
import { AdminService, DeleteSongRequest, DeleteSongResponseSchema } from '../../gen/kantahe/v1/admin_pb';
import { Format, LyricTiming, Song, SongSchema } from '../../gen/kantahe/v1/common_pb';
import {
  AddToQueueRequest,
  AddToQueueResponseSchema,
  MoveToTopRequest,
  MoveToTopResponseSchema,
  QueueItemSchema,
  RemoveFromQueueRequest,
  RemoveFromQueueResponseSchema,
  SessionService,
} from '../../gen/kantahe/v1/session_pb';
import { SetFavouriteRequest, SetFavouriteResponseSchema, UserLibraryService } from '../../gen/kantahe/v1/user_library_pb';

export function song(number: string, title: string, artist: string, format: Format = Format.MP3, favourite = false, extra: { lyricTiming?: LyricTiming; hasVocals?: boolean } = {}): Song {
  return create(SongSchema, { number, title, artist, format, favourite, ...extra });
}

export interface Reply<T> {
  items: T[];
  next?: string;
}

export interface FakeLibrary {
  searchSongs?: (req: SearchSongsRequest, signal: AbortSignal) => Reply<Song> | Promise<Reply<Song>>;
  listArtists?: (req: ListArtistsRequest, signal: AbortSignal) => Reply<Artist> | Promise<Reply<Artist>>;
  getSong?: (req: GetSongRequest, signal: AbortSignal) => Song | Promise<Song>;
  /** May give the id of the new queue item (the fake answers q-<number> otherwise). */
  addToQueue?: (req: AddToQueueRequest) => void | string | Promise<void | string>;
  moveToTop?: (req: MoveToTopRequest) => void | Promise<void>;
  removeFromQueue?: (req: RemoveFromQueueRequest) => void | Promise<void>;
  setFavourite?: (req: SetFavouriteRequest) => void | Promise<void>;
  deleteSong?: (req: DeleteSongRequest) => void | Promise<void>;
}

/** An in-memory server for the library pages; every request is recorded in calls. */
export function fakeLibrary(h: FakeLibrary = {}) {
  const calls = {
    search: [] as SearchSongsRequest[],
    artists: [] as ListArtistsRequest[],
    get: [] as GetSongRequest[],
    add: [] as AddToQueueRequest[],
    fav: [] as SetFavouriteRequest[],
    remove: [] as DeleteSongRequest[],
    /** Every session call in order: what play next sends, and in which order. */
    session: [] as string[],
  };
  const transport = createRouterTransport(({ service }) => {
    service(CatalogService, {
      async searchSongs(req, ctx) {
        calls.search.push(req);
        const r = (await h.searchSongs?.(req, ctx.signal)) ?? { items: [] };
        return create(SearchSongsResponseSchema, { songs: r.items, nextPageToken: r.next ?? '' });
      },
      async listArtists(req, ctx) {
        calls.artists.push(req);
        const r = (await h.listArtists?.(req, ctx.signal)) ?? { items: [] };
        return create(ListArtistsResponseSchema, { artists: r.items, nextPageToken: r.next ?? '' });
      },
      async getSong(req, ctx) {
        calls.get.push(req);
        const s = await h.getSong?.(req, ctx.signal);
        return create(GetSongResponseSchema, { song: s });
      },
    });
    service(SessionService, {
      async addToQueue(req) {
        calls.add.push(req);
        calls.session.push(`add ${req.number}`);
        const id = (await h.addToQueue?.(req)) || `q-${req.number}`;
        return create(AddToQueueResponseSchema, { item: create(QueueItemSchema, { id }) });
      },
      async moveToTop(req) {
        calls.session.push(`top ${req.itemId}`);
        await h.moveToTop?.(req);
        return create(MoveToTopResponseSchema, {});
      },
      async removeFromQueue(req) {
        calls.session.push(`remove ${req.itemId}`);
        await h.removeFromQueue?.(req);
        return create(RemoveFromQueueResponseSchema, {});
      },
    });
    service(AdminService, {
      async deleteSong(req) {
        calls.remove.push(req);
        await h.deleteSong?.(req);
        return create(DeleteSongResponseSchema, {});
      },
    });
    service(UserLibraryService, {
      async setFavourite(req) {
        calls.fav.push(req);
        await h.setFavourite?.(req);
        return create(SetFavouriteResponseSchema, {});
      },
    });
  });
  return { transport, calls };
}

/** Resolves when the signal is aborted (a request that never answers by itself). */
export function untilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
}
