import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';

Song song(String number, String title, String artist, {Format format = Format.FORMAT_MP3, bool favourite = false, bool failed = false}) =>
    Song(number: number, title: title, artist: artist, format: format, favourite: favourite, failed: failed);

class Reply<T> {
  Reply(this.items, {this.next = ''});
  final List<T> items;
  final String next;
}

/// An in-memory server for the library screens; every request is recorded.
class FakeLibrary {
  final searches = <SearchSongsRequest>[];
  final artistRequests = <ListArtistsRequest>[];
  final gets = <GetSongRequest>[];
  final adds = <AddToQueueRequest>[];
  final favs = <SetFavouriteRequest>[];

  /// How many requests were aborted by the client (the signal of a call completed).
  int aborted = 0;

  FutureOr<Reply<Song>> Function(SearchSongsRequest req)? onSearch;
  FutureOr<Reply<Artist>> Function(ListArtistsRequest req)? onArtists;
  FutureOr<Song?> Function(GetSongRequest req)? onGet;
  FutureOr<void> Function(AddToQueueRequest req)? onAdd;
  FutureOr<void> Function(SetFavouriteRequest req)? onFav;

  Transport build() => FakeTransportBuilder()
      .unary(CatalogService.searchSongs, (req, ctx) async {
        ctx.signal.future.then((_) => aborted++);
        searches.add(req);
        final r = await onSearch?.call(req) ?? Reply<Song>([]);
        return SearchSongsResponse(songs: r.items, nextPageToken: r.next);
      })
      .unary(CatalogService.listArtists, (req, ctx) async {
        artistRequests.add(req);
        final r = await onArtists?.call(req) ?? Reply<Artist>([]);
        return ListArtistsResponse(artists: r.items, nextPageToken: r.next);
      })
      .unary(CatalogService.getSong, (req, ctx) async {
        gets.add(req);
        final s = await onGet?.call(req);
        return GetSongResponse(song: s);
      })
      .unary(SessionService.addToQueue, (req, ctx) async {
        adds.add(req);
        await onAdd?.call(req);
        return AddToQueueResponse();
      })
      .unary(UserLibraryService.setFavourite, (req, ctx) async {
        favs.add(req);
        await onFav?.call(req);
        return SetFavouriteResponse();
      })
      .build(interceptors: null);

  /// Services over this server: signed in, with a server address.
  Future<AppServices> services({bool isTv = false}) async {
    final auth = AuthStore(MemoryStore());
    await auth.signIn(
      AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u'),
      ),
    );
    final api = Api(build());
    final state = StateStore(client: api.session, auth: auth)..dispose(); // the screens under test do not stream
    return AppServices(serverUrl: ServerUrl(MemoryStore()), auth: auth, api: api, state: state, isTv: isTv);
  }
}

/// Shows [child] inside the app root and a Scaffold-capable MaterialApp.
Future<void> pumpScreen(WidgetTester tester, AppServices services, Widget child) => tester.pumpWidget(
  AppRoot(
    services: services,
    child: MaterialApp(home: child),
  ),
);

/// Lets debounce timers and the fake server's answers run.
Future<void> settle(WidgetTester tester, [int ms = 0]) async {
  await tester.pump(Duration(milliseconds: ms));
  await tester.pump();
  await tester.pump();
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;
