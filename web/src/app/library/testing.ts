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
import { Format, Song, SongSchema } from '../../gen/kantahe/v1/common_pb';
import { AddToQueueRequest, AddToQueueResponseSchema, SessionService } from '../../gen/kantahe/v1/session_pb';
import { SetFavouriteRequest, SetFavouriteResponseSchema, UserLibraryService } from '../../gen/kantahe/v1/user_library_pb';

export function song(number: string, title: string, artist: string, format: Format = Format.MP3, favourite = false): Song {
  return create(SongSchema, { number, title, artist, format, favourite });
}

export interface Reply<T> {
  items: T[];
  next?: string;
}

export interface FakeLibrary {
  searchSongs?: (req: SearchSongsRequest, signal: AbortSignal) => Reply<Song> | Promise<Reply<Song>>;
  listArtists?: (req: ListArtistsRequest, signal: AbortSignal) => Reply<Artist> | Promise<Reply<Artist>>;
  getSong?: (req: GetSongRequest, signal: AbortSignal) => Song | Promise<Song>;
  addToQueue?: (req: AddToQueueRequest) => void | Promise<void>;
  setFavourite?: (req: SetFavouriteRequest) => void | Promise<void>;
}

/** An in-memory server for the library pages; every request is recorded in calls. */
export function fakeLibrary(h: FakeLibrary = {}) {
  const calls = {
    search: [] as SearchSongsRequest[],
    artists: [] as ListArtistsRequest[],
    get: [] as GetSongRequest[],
    add: [] as AddToQueueRequest[],
    fav: [] as SetFavouriteRequest[],
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
        await h.addToQueue?.(req);
        return create(AddToQueueResponseSchema, {});
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
