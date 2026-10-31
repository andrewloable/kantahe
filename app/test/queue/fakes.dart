import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:fixnum/fixnum.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

Song song(String number, String title, String artist, {Format format = Format.FORMAT_MP3, int durationMs = 0}) =>
    Song(number: number, title: title, artist: artist, format: format, durationMs: Int64(durationMs));

QueueItem item(String id, Song s) => QueueItem(id: id, song: s);

Device device(String id, String name, {DeviceType type = DeviceType.DEVICE_TYPE_ANDROID, bool online = true, bool isCaller = false}) =>
    Device(id: id, name: name, type: type, online: online, isCaller: isCaller);

State stateOf({
  PlayStatus status = PlayStatus.PLAY_STATUS_PAUSED,
  String player = '',
  List<Device> devices = const [],
  NowPlaying? now,
  List<QueueItem> queue = const [],
  UpNext? upNext,
  UserSettings? settings,
  int serverTimeMs = 0,
}) => State(
  status: status,
  playerDeviceId: player,
  devices: devices,
  now: now,
  queue: queue,
  upNext: upNext,
  settings: settings,
  serverTimeMs: Int64(serverTimeMs),
);

NowPlaying nowPlaying(Song s, {SongSource source = SongSource.SONG_SOURCE_QUEUE, int positionMs = 0, int positionAtMs = 0}) =>
    NowPlaying(song: s, source: source, positionMs: Int64(positionMs), positionAtMs: Int64(positionAtMs));

/// An in-memory session server for the queue screens; every command is recorded.
class FakeQueueServer {
  final controls = <ControlAction>[];
  final removes = <String>[];
  final moves = <String>[];
  final adds = <String>[];

  FutureOr<void> Function(ControlAction action)? onControl;
  FutureOr<void> Function(String id)? onRemove;
  FutureOr<void> Function(String id)? onMove;
  FutureOr<void> Function(String number)? onAdd;

  Transport build() => FakeTransportBuilder()
      .unary(SessionService.control, (req, ctx) async {
        controls.add(req.action);
        await onControl?.call(req.action);
        return ControlResponse();
      })
      .unary(SessionService.removeFromQueue, (req, ctx) async {
        removes.add(req.itemId);
        await onRemove?.call(req.itemId);
        return RemoveFromQueueResponse();
      })
      .unary(SessionService.moveToTop, (req, ctx) async {
        moves.add(req.itemId);
        await onMove?.call(req.itemId);
        return MoveToTopResponse();
      })
      .unary(SessionService.addToQueue, (req, ctx) async {
        adds.add(req.number);
        await onAdd?.call(req.number);
        return AddToQueueResponse();
      })
      .build();
}

/// Services whose state the test sets by hand, with a clock the test moves.
class QueueRig {
  QueueRig({bool isTv = false}) {
    auth = AuthStore(MemoryStore());
    api = Api(server.build());
    // the store follows its own, never signed-in auth: it must not open a stream, the tests set its state by hand
    store = StateStore(client: api.session, auth: AuthStore(MemoryStore()), monotonicMs: () => clockMs);
    services = AppServices(serverUrl: ServerUrl(MemoryStore()), auth: auth, api: api, state: store, isTv: isTv);
  }

  final server = FakeQueueServer();
  late final AuthStore auth;
  late final Api api;
  late final StateStore store;
  late final AppServices services;

  /// The local monotonic clock, in ms.
  int clockMs = 0;

  void setState(State s, {bool connected = true}) => store.setForTest(state: s, connected: connected);

  Future<void> signIn(String deviceId) => auth.signIn(
    AuthToken(
      token: 't',
      deviceId: deviceId,
      user: User(id: 'u'),
    ),
  );

  Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
    AppRoot(
      services: services,
      child: MaterialApp(home: child),
    ),
  );
}

Future<void> settle(WidgetTester tester, [int ms = 0]) async {
  await tester.pump(Duration(milliseconds: ms));
  await tester.pump();
  await tester.pump();
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;
