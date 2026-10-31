import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

/// What the screen shows about the stream.
@immutable
class WatchValue {
  const WatchValue({this.messages = 0, this.lastTimeMs = 0, this.reconnects = 0, this.lastError});

  final int messages;
  final int lastTimeMs;
  final int reconnects;
  final String? lastError;

  WatchValue copyWith({int? messages, int? lastTimeMs, int? reconnects, String? lastError}) => WatchValue(
        messages: messages ?? this.messages,
        lastTimeMs: lastTimeMs ?? this.lastTimeMs,
        reconnects: reconnects ?? this.reconnects,
        lastError: lastError ?? this.lastError,
      );
}

/// Keeps a server stream open: when it fails or ends it waits 1, 2, 4, then 5 seconds (the wait starts at
/// one second again after a message arrived) and opens it again, counting the reconnects.
class Watcher extends ValueNotifier<WatchValue> {
  Watcher(this._open, {Future<void> Function(Duration)? delay})
      : _delay = delay ?? Future<void>.delayed,
        super(const WatchValue());

  final Stream<int> Function() _open;
  final Future<void> Function(Duration) _delay;
  bool _running = false;
  Future<void>? _loop;
  Completer<void>? _connection;
  final List<(int, Completer<void>)> _waiters = [];

  bool get running => _running;

  void start() {
    if (_running) return;
    _running = true;
    _loop = _run();
  }

  Future<void> stop() async {
    _running = false;
    final c = _connection;
    if (c != null && !c.isCompleted) c.complete();
    await _loop;
  }

  /// Completes when at least [n] messages have arrived (for tests).
  Future<void> waitForMessages(int n) {
    if (value.messages >= n) return Future.value();
    final c = Completer<void>();
    _waiters.add((n, c));
    return c.future;
  }

  void _set(WatchValue v) {
    value = v;
    for (final w in List.of(_waiters)) {
      if (v.messages >= w.$1) {
        _waiters.remove(w);
        w.$2.complete();
      }
    }
  }

  Future<void> _run() async {
    var failures = 0;
    while (_running) {
      final connection = _connection = Completer<void>();
      final sub = _open().listen(
        (t) {
          failures = 0;
          _set(value.copyWith(messages: value.messages + 1, lastTimeMs: t));
        },
        onError: (Object e) {
          _set(value.copyWith(lastError: '$e'));
          if (!connection.isCompleted) connection.complete();
        },
        onDone: () {
          if (!connection.isCompleted) connection.complete();
        },
        cancelOnError: true,
      );
      await connection.future;
      await sub.cancel();
      if (!_running) break;
      _set(value.copyWith(reconnects: value.reconnects + 1));
      await _delay(Duration(seconds: min(1 << failures, 5)));
      failures++;
    }
  }

  @override
  void dispose() {
    _running = false;
    super.dispose();
  }
}
