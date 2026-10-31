import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:fixnum/fixnum.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';

export '../queue/fakes.dart' show device, item, nowPlaying, stateOf;
export '../library/fakes.dart' show song, Reply;

/// An in-memory server for the Me screens; every request is recorded.
class FakeMeServer {
  final favouriteRequests = <ListFavouritesRequest>[];
  final historyRequests = <ListHistoryRequest>[];
  final favs = <SetFavouriteRequest>[];
  final created = <CreatePlaylistRequest>[];
  final updated = <UpdatePlaylistRequest>[];
  final deleted = <String>[];
  final gets = <String>[];
  final queued = <String>[]; // playlists added to the queue
  final added = <String>[]; // songs added to the queue
  final modes = <SetMidiModeRequest>[];
  final settings = <UpdateUserSettingsRequest>[];
  final revoked = <String>[];
  int deviceListings = 0;

  FutureOr<({List<Song> items, String next})> Function(ListFavouritesRequest req)? onFavourites;
  FutureOr<({List<HistoryEntry> items, String next})> Function(ListHistoryRequest req)? onHistory;
  List<PlaylistSummary> playlists = [];
  FutureOr<Playlist> Function(String id)? onGetPlaylist;
  FutureOr<Playlist> Function(UpdatePlaylistRequest req)? onUpdatePlaylist;
  FutureOr<CreatePlaylistResponse> Function(CreatePlaylistRequest req)? onCreate;
  FutureOr<void> Function(String id)? onDelete;
  FutureOr<void> Function(SetFavouriteRequest req)? onFav;
  FutureOr<int> Function(String playlistId)? onAddPlaylist;
  FutureOr<Device> Function(SetMidiModeRequest req)? onMode;
  FutureOr<void> Function(UpdateUserSettingsRequest req)? onSettings;
  List<Device> devices = [];
  FutureOr<void> Function(String id)? onRevoke;
  FutureOr<void> Function(String number)? onAdd;
  FutureOr<void> Function()? onListPlaylists;

  Transport build() => FakeTransportBuilder()
      .unary(UserLibraryService.listFavourites, (req, ctx) async {
        favouriteRequests.add(req);
        final r = await onFavourites?.call(req) ?? (items: <Song>[], next: '');
        return ListFavouritesResponse(songs: r.items, nextPageToken: r.next);
      })
      .unary(UserLibraryService.listHistory, (req, ctx) async {
        historyRequests.add(req);
        final r = await onHistory?.call(req) ?? (items: <HistoryEntry>[], next: '');
        return ListHistoryResponse(entries: r.items, nextPageToken: r.next);
      })
      .unary(UserLibraryService.setFavourite, (req, ctx) async {
        favs.add(req);
        await onFav?.call(req);
        return SetFavouriteResponse();
      })
      .unary(UserLibraryService.listPlaylists, (req, ctx) async {
        await onListPlaylists?.call();
        return ListPlaylistsResponse(playlists: playlists);
      })
      .unary(UserLibraryService.createPlaylist, (req, ctx) async {
        created.add(req);
        return await onCreate?.call(req) ??
            CreatePlaylistResponse(
              playlist: Playlist(id: 'new${created.length}', name: req.name),
            );
      })
      .unary(UserLibraryService.updatePlaylist, (req, ctx) async {
        updated.add(req);
        final p = await onUpdatePlaylist?.call(req);
        return UpdatePlaylistResponse(playlist: p);
      })
      .unary(UserLibraryService.deletePlaylist, (req, ctx) async {
        deleted.add(req.id);
        await onDelete?.call(req.id);
        return DeletePlaylistResponse();
      })
      .unary(UserLibraryService.getPlaylist, (req, ctx) async {
        gets.add(req.id);
        final p = await onGetPlaylist?.call(req.id) ?? Playlist(id: req.id, name: 'Playlist');
        return GetPlaylistResponse(playlist: p);
      })
      .unary(SessionService.addPlaylistToQueue, (req, ctx) async {
        queued.add(req.playlistId);
        final n = await onAddPlaylist?.call(req.playlistId) ?? 0;
        return AddPlaylistToQueueResponse(added: n);
      })
      .unary(SessionService.addToQueue, (req, ctx) async {
        added.add(req.number);
        await onAdd?.call(req.number);
        return AddToQueueResponse();
      })
      .unary(SessionService.setMidiMode, (req, ctx) async {
        modes.add(req);
        final d = await onMode?.call(req);
        return SetMidiModeResponse(device: d);
      })
      .unary(SessionService.updateUserSettings, (req, ctx) async {
        settings.add(req);
        await onSettings?.call(req);
        return UpdateUserSettingsResponse();
      })
      .unary(AuthService.listMyDevices, (req, ctx) async {
        deviceListings++;
        return ListMyDevicesResponse(devices: devices);
      })
      .unary(AuthService.revokeDevice, (req, ctx) async {
        revoked.add(req.deviceId);
        await onRevoke?.call(req.deviceId);
        return RevokeDeviceResponse();
      })
      .build();
}

/// Services over the fake server, signed in as device [deviceId]; the state is set by hand.
class MeRig {
  MeRig({String deviceId = 'me', bool uploader = false, bool admin = false}) {
    auth = AuthStore(MemoryStore());
    api = Api(server.build());
    store = StateStore(client: api.session, auth: AuthStore(MemoryStore()), monotonicMs: () => 0);
    services = AppServices(serverUrl: ServerUrl(MemoryStore()), auth: auth, api: api, state: store);
    _signedIn = auth.signIn(
      AuthToken(
        token: 't',
        deviceId: deviceId,
        user: User(id: 'u', uploader: uploader, admin: admin),
      ),
    );
  }

  final server = FakeMeServer();
  late final AuthStore auth;
  late final Api api;
  late final StateStore store;
  late final AppServices services;
  late final Future<void> _signedIn;

  void setState(State s, {bool connected = true}) => store.setForTest(state: s, connected: connected);

  Future<void> pump(WidgetTester tester, Widget child) async {
    await _signedIn;
    await tester.pumpWidget(
      AppRoot(
        services: services,
        child: MaterialApp(home: child),
      ),
    );
    await tester.pump();
  }
}

Future<void> settle(WidgetTester tester, [int ms = 0]) async {
  await tester.pump(Duration(milliseconds: ms));
  await tester.pump();
  await tester.pump();
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

HistoryEntry entry(Song s, {int at = 1700000000, bool skipped = false, bool hasScore = false, int score = 0}) =>
    HistoryEntry(song: s, sungAtUnix: Int64(at), skipped: skipped, hasScore: hasScore, score_5: score);
