import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:fixnum/fixnum.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

/// One Connect envelope: a flag byte, a 4-byte length and the message.
Uint8List envelope(List<int> message) {
  final n = message.length;
  return (BytesBuilder()
        ..addByte(0)
        ..add([(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255])
        ..add(message))
      .toBytes();
}

void main() {
  test('regression: stopping a live WatchState over a real socket leaves no uncaught error', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));
    var opened = 0;
    bool? connected;
    int? serverTime;
    final held = <HttpResponse>[];
    server.listen((req) async {
      opened++;
      req.listen((_) {}); // the request body is not needed
      req.response.bufferOutput = false; // a held-open stream must reach the client at once
      req.response.headers.contentType = ContentType('application', 'connect+proto');
      req.response.add(envelope(WatchStateResponse(state: State(serverTimeMs: Int64(5))).writeToBuffer()));
      await req.response.flush();
      held.add(req.response); // the stream stays open, like the real one
    });

    final uncaught = <Object>[];
    final finished = Completer<void>();
    runZonedGuarded(() async {
      try {
        final client = SessionServiceClient(httpTransportFactory(const [])('http://127.0.0.1:${server.port}'));
        final store = StateStore(client: client, auth: AuthStore(MemoryStore()));
        store.start();
        final until = DateTime.now().add(const Duration(seconds: 10));
        while (!store.connected && DateTime.now().isBefore(until)) {
          await Future<void>.delayed(const Duration(milliseconds: 20));
        }
        connected = store.connected;
        serverTime = store.state?.serverTimeMs.toInt();
        store.stop(); // aborts the request: the stream ends with a canceled error
        await Future<void>.delayed(const Duration(milliseconds: 500));
        store.dispose();
      } finally {
        if (!finished.isCompleted) finished.complete();
      }
    }, (e, st) => uncaught.add(e));
    await finished.future;
    expect(connected, isTrue, reason: 'the stream should have delivered the state');
    expect(serverTime, 5);
    expect(opened, 1);
    expect(uncaught, isEmpty);
  });
}
