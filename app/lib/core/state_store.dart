import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/foundation.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/clock.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

const _firstRetry = Duration(seconds: 1);
const _maxRetry = Duration(seconds: 30);
const _poll = Duration(seconds: 2);

/// GetState gets this long: a dead link never closes by itself, and one hung poll must not end the polling.
const _pollTimeout = Duration(seconds: 10);
const _failuresBeforePolling = 2;

/// The server repeats the state every 25 s when nothing changes; a stream silent for longer is dead.
const _silence = Duration(seconds: 60);

/// One run of the stream loop; stopping it cancels everything it started.
class _Run {
  bool cancelled = false;
  bool pollBusy = false;
  final List<void Function()> onCancel = [];

  void cancel() {
    if (cancelled) return;
    cancelled = true;
    for (final f in List.of(onCancel)) {
      f();
    }
    onCancel.clear();
  }
}

/// Keeps SessionService.WatchState open and exposes the latest State (the same rules as the web app).
/// A failed attempt is retried after 1 s, 2 s, 4 s ... at most 30 s; the wait starts over after a message.
/// After two failed attempts in a row GetState is polled every 2 s until the stream is back. A stream that
/// delivers nothing for 60 s (a dead link does not close by itself) is closed and reopened. The stream is
/// paused while the app is in the background and reopened when it returns.
class StateStore extends ChangeNotifier {
  StateStore({required this._client, required this._auth, int Function()? monotonicMs}) : _monotonicMs = monotonicMs ?? _stopwatchMs {
    _auth.addListener(_onAuth);
  }

  static final Stopwatch _stopwatch = Stopwatch()..start();
  static int _stopwatchMs() => _stopwatch.elapsedMilliseconds;

  final SessionServiceClient _client;
  final AuthStore _auth;
  final int Function() _monotonicMs;

  State? _state;
  bool _connected = false;
  bool _polling = false;
  int _offsetMs = 0;

  bool _wanted = false;
  bool _paused = false;
  bool _following = false;
  _Run? _run;
  Timer? _pollTimer;

  /// The latest state from the server.
  State? get state => _state;

  /// The stream is open and has delivered a state.
  bool get connected => _connected;

  /// GetState is being polled because the stream is down.
  bool get polling => _polling;

  /// Server time minus the local clock when the latest state arrived.
  int get offsetMs => _offsetMs;

  /// Position of the current song now, in ms (0 when nothing plays).
  int positionMs([int? nowMs]) {
    final s = _state;
    return s == null ? 0 : positionNow(s, _offsetMs, nowMs ?? _monotonicMs());
  }

  /// Sets what the screens show without a server (widget tests): the state and whether the stream is up.
  @visibleForTesting
  void setForTest({State? state, bool connected = true}) {
    if (state != null) {
      _state = state;
      _offsetMs = serverOffset(state, _monotonicMs());
    }
    _connected = connected;
    notifyListeners();
  }

  void start() {
    _wanted = true;
    _sync();
  }

  void stop() {
    _wanted = false;
    _sync();
    _state = null;
    notifyListeners();
  }

  /// The app went to the background: close the stream and the timers, keep the last state.
  void pause() {
    _paused = true;
    _sync();
  }

  /// The app is back: open the stream again if it was wanted.
  void resume() {
    _paused = false;
    _sync();
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuth);
    _wanted = false;
    _sync();
    super.dispose();
  }

  // Follow the sign-in: open when a usable token appears, close when it goes away.
  void _onAuth() {
    final on = _auth.token != null && !_auth.passwordChangeRequired;
    if (on == _following) return;
    _following = on;
    if (on) {
      start();
    } else {
      stop();
    }
  }

  void _sync() {
    final shouldRun = _wanted && !_paused;
    if (shouldRun && _run == null) {
      final run = _run = _Run();
      unawaited(_loop(run));
    } else if (!shouldRun && _run != null) {
      _run!.cancel();
      _run = null;
      _stopPolling();
      if (_connected) {
        _connected = false;
        notifyListeners();
      }
    }
  }

  void _apply(State? state, {required bool fromStream}) {
    if (state == null) return;
    _state = state;
    _offsetMs = serverOffset(state, _monotonicMs());
    if (fromStream) {
      _connected = true;
      _stopPolling();
    }
    notifyListeners();
  }

  Future<void> _loop(_Run run) async {
    var failures = 0;
    var delay = _firstRetry;
    while (!run.cancelled) {
      // this attempt ends when the app stops or when the stream has been silent for too long
      final attempt = CancelableSignal();
      final done = Completer<void>();
      void finish() {
        if (!done.isCompleted) done.complete();
      }

      run.onCancel.add(finish);
      Timer? watchdog;
      void arm() {
        watchdog?.cancel();
        watchdog = Timer(_silence, finish);
      }

      arm();
      _client
          .watchState(WatchStateRequest(), signal: attempt)
          .listen(
            (msg) {
              if (run.cancelled) return;
              arm(); // any message shows the link is alive
              if (msg.hasState()) _apply(msg.state, fromStream: true);
              failures = 0;
              delay = _firstRetry;
            },
            // an error and a stream that simply ends are handled alike: wait, then reconnect
            onError: (Object _) => finish(),
            onDone: finish,
            cancelOnError: true,
          );
      await done.future;
      watchdog?.cancel();
      run.onCancel.remove(finish);
      // Aborting the request ends the stream with a "canceled" error. The subscription stays, with its onError
      // above, to receive it: cancelling the subscription instead leaves that error with nobody to catch it,
      // and it escapes as an uncaught async error (seen with a live WatchState on a simulator).
      attempt.cancel();
      if (run.cancelled) return;
      if (_connected) {
        _connected = false;
        notifyListeners();
      }
      failures++;
      if (failures >= _failuresBeforePolling) _startPolling(run);
      await _sleep(delay, run);
      delay = delay * 2 > _maxRetry ? _maxRetry : delay * 2;
    }
  }

  void _startPolling(_Run run) {
    if (_pollTimer != null) return;
    _polling = true;
    notifyListeners();
    _pollTimer = Timer.periodic(_poll, (_) => unawaited(_pollOnce(run)));
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    if (_polling) {
      _polling = false;
      notifyListeners();
    }
  }

  Future<void> _pollOnce(_Run run) async {
    if (run.pollBusy) return;
    run.pollBusy = true;
    // stopping or pausing aborts a poll in flight; a poll that does not answer in time is given up
    final signal = CancelableSignal();
    run.onCancel.add(signal.cancel);
    try {
      final res = await _client.getState(GetStateRequest(), signal: signal).timeout(_pollTimeout);
      // a stream message that arrived meanwhile is newer than this answer
      if (!run.cancelled && !_connected && res.hasState()) _apply(res.state, fromStream: false);
    } catch (_) {
      // the next beat tries again; sign-out and password errors are handled by the interceptors
    } finally {
      run.onCancel.remove(signal.cancel);
      signal.cancel();
      run.pollBusy = false;
    }
  }

  Future<void> _sleep(Duration d, _Run run) {
    final c = Completer<void>();
    late final Timer timer;
    void done() {
      timer.cancel();
      run.onCancel.remove(done);
      if (!c.isCompleted) c.complete();
    }

    timer = Timer(d, done);
    run.onCancel.add(done);
    return c.future;
  }
}
