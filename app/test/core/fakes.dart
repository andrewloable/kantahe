import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:fixnum/fixnum.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

/// A store whose every call fails, like a keystore that is locked or broken.
class ThrowingStore implements KeyValueStore {
  @override
  Future<String?> read(String key) async => throw StateError('locked');
  @override
  Future<void> write(String key, String value) async => throw StateError('locked');
  @override
  Future<void> delete(String key) async => throw StateError('locked');
}

State stateAt(int serverTimeMs, {PlayStatus status = PlayStatus.PLAY_STATUS_PLAYING, int positionMs = 0, int positionAtMs = 0, bool withNow = true}) => State(
  status: status,
  serverTimeMs: Int64(serverTimeMs),
  now: withNow ? NowPlaying(positionMs: Int64(positionMs), positionAtMs: Int64(positionAtMs)) : null,
);

// An async generator: the fake transport does not deliver a Stream.error that is the first event under fake time.
Stream<WatchStateResponse> _refused() async* {
  throw ConnectException(Code.unavailable, 'down');
}

/// A server for SessionService.WatchState and GetState that the test steers.
class FakeSessionServer {
  /// What the next WatchState call does: [open] keeps the stream until the test closes it, [fail] refuses it.
  final List<String> script = [];
  final List<StreamController<WatchStateResponse>> streams = [];
  int opened = 0;
  int aborted = 0;
  int polls = 0;
  State pollAnswer = stateAt(1);
  Completer<void>? pollGate;
  Headers? lastWatchHeaders;

  Transport build({List<Interceptor>? interceptors}) => FakeTransportBuilder()
      .server(SessionService.watchState, (req, ctx) {
        opened++;
        lastWatchHeaders = ctx.requestHeaders;
        ctx.signal.future.then((_) => aborted++);
        final mode = script.isEmpty ? 'open' : script.removeAt(0);
        if (mode == 'fail') return _refused();
        final c = StreamController<WatchStateResponse>();
        streams.add(c);
        return c.stream;
      })
      .unary(SessionService.getState, (req, ctx) async {
        polls++;
        await pollGate?.future;
        return GetStateResponse(state: pollAnswer);
      })
      .build(interceptors: interceptors);

  /// Sends a state on the newest stream.
  void send(State s) => streams.last.add(WatchStateResponse(state: s));
}
