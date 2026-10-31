import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe_s2/watcher.dart';

/// Delivers the items and then stays open, like a live stream.
Stream<int> thenHang(List<int> items) async* {
  yield* Stream.fromIterable(items);
  await Completer<void>().future;
}

void main() {
  test('counts the messages and remembers the last server time', () async {
    final w = Watcher(() => thenHang([10, 20, 30]), delay: (_) async {});
    w.start();
    await w.waitForMessages(3);
    await w.stop();
    expect(w.value.messages, 3);
    expect(w.value.lastTimeMs, 30);
  });

  test('reconnects after the stream ends or fails, and counts the reconnects', () async {
    var opened = 0;
    final delays = <Duration>[];
    final w = Watcher(() {
      opened++;
      if (opened == 1) return Stream<int>.error(Exception('connection reset'));
      if (opened == 2) return Stream.fromIterable([1]); // ends: the server went away
      return thenHang([2, 3]);
    }, delay: (d) async => delays.add(d));
    w.start();
    await w.waitForMessages(3);
    await w.stop();
    expect(w.value.reconnects, greaterThanOrEqualTo(2));
    expect(w.value.lastTimeMs, 3);
    expect(delays.first, const Duration(seconds: 1));
  });

  test('backs off 1, 2, 4, 5, 5 seconds while the server stays away, and starts again at one after a message', () async {
    var opened = 0;
    final delays = <Duration>[];
    final sixth = Completer<void>();
    final w = Watcher(() {
      opened++;
      if (opened == 6) return Stream.fromIterable([1, 2, 3, 4]); // a good connection that ends
      if (opened > 6) return thenHang([]);
      return Stream<int>.error(Exception('down'));
    }, delay: (d) async {
      delays.add(d);
      if (delays.length == 6) sixth.complete();
    });
    w.start();
    await sixth.future;
    await w.stop();
    expect(delays.take(5).map((d) => d.inSeconds), [1, 2, 4, 5, 5]);
    expect(delays[5], const Duration(seconds: 1));
  });

  test('stop ends the loop while it waits for a message', () async {
    final never = StreamController<int>();
    final w = Watcher(() => never.stream, delay: (_) async {});
    w.start();
    await Future<void>.delayed(Duration.zero);
    await w.stop().timeout(const Duration(seconds: 2));
    expect(w.running, isFalse);
    await never.close();
  });

  test('the last error is kept for display', () async {
    var opened = 0;
    final w = Watcher(() => ++opened == 1 ? Stream<int>.error(Exception('boom')) : thenHang([1]), delay: (_) async {});
    w.start();
    await w.waitForMessages(1);
    await w.stop();
    expect(w.value.lastError, contains('boom'));
  });
}
