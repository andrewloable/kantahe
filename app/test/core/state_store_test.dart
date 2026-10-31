import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

import 'fakes.dart';

/// A store, its fake server and a fake clock, all driven by one FakeAsync.
class Rig {
  Rig(this.async, {List<String> script = const []}) {
    server.script.addAll(script);
    store = StateStore(client: SessionServiceClient(server.build()), auth: auth, monotonicMs: () => async.elapsed.inMilliseconds);
  }

  final FakeAsync async;
  final server = FakeSessionServer();
  final auth = AuthStore(MemoryStore());
  late final StateStore store;

  void settle() => async.flushMicrotasks();

  void elapseMs(int ms) {
    async.elapse(Duration(milliseconds: ms));
    async.flushMicrotasks();
  }

  void elapse(int seconds) => elapseMs(seconds * 1000);

  /// Starts the store and lets it open its first stream.
  void start() {
    store.start();
    settle();
  }
}

AuthToken signedIn({bool mustChange = false, bool withUser = true}) => AuthToken(
  token: 't',
  deviceId: 'd',
  user: withUser ? User(id: 'u', mustChangePassword: mustChange) : null,
);

void main() {
  test('the first message sets the state', () {
    fakeAsync((async) {
      final r = Rig(async)..start();
      expect(r.server.opened, 1);
      expect(r.store.state, isNull);
      expect(r.store.connected, isFalse);
      r.server.send(stateAt(5));
      r.settle();
      expect(r.store.state!.serverTimeMs.toInt(), 5);
      expect(r.store.connected, isTrue);
      r.store.stop();
    });
  });

  test('later messages replace the state', () {
    fakeAsync((async) {
      final r = Rig(async)..start();
      r.server.send(stateAt(5));
      r.settle();
      r.server.send(stateAt(9));
      r.settle();
      expect(r.store.state!.serverTimeMs.toInt(), 9);
      expect(r.server.opened, 1);
      r.store.stop();
    });
  });

  test('every message notifies listeners', () {
    fakeAsync((async) {
      final r = Rig(async);
      var n = 0;
      r.store.addListener(() => n++);
      r.start();
      r.server.send(stateAt(1));
      r.settle();
      final afterFirst = n;
      r.server.send(stateAt(2));
      r.settle();
      expect(n, greaterThan(afterFirst));
      r.store.stop();
    });
  });

  group('failures', () {
    test('retries after 1 s, then 2 s', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail', 'fail'])..start();
        expect(r.server.opened, 1);
        r.elapseMs(999);
        expect(r.server.opened, 1);
        r.elapseMs(1);
        expect(r.server.opened, 2);
        r.elapseMs(1999);
        expect(r.server.opened, 2);
        r.elapseMs(1);
        expect(r.server.opened, 3);
        r.store.stop();
      });
    });

    test('keeps doubling up to 30 s', () {
      fakeAsync((async) {
        final r = Rig(async, script: List.filled(20, 'fail'))..start();
        // attempts start at 0, 1, 3, 7, 15, 31, 61, 91 s
        r.elapseMs(60999);
        expect(r.server.opened, 6);
        r.elapseMs(1);
        expect(r.server.opened, 7);
        r.elapseMs(29999);
        expect(r.server.opened, 7);
        r.elapseMs(1);
        expect(r.server.opened, 8);
        r.store.stop();
      });
    });

    test('a stream that ends cleanly is retried', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.server.send(stateAt(1));
        r.settle();
        r.server.streams.last.close();
        r.settle();
        expect(r.store.connected, isFalse);
        r.elapseMs(1000);
        expect(r.server.opened, 2);
        r.store.stop();
      });
    });

    test('resets the back-off after a message', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'open'])..start();
        r.elapse(1); // second attempt opens
        expect(r.server.opened, 2);
        r.server.send(stateAt(1));
        r.settle();
        r.server.streams.last.close(); // the stream ends after a message
        r.settle();
        r.elapseMs(999);
        expect(r.server.opened, 2); // 1 s wait, not the 2 s a doubled wait would be
        r.elapseMs(1);
        expect(r.server.opened, 3);
        r.store.stop();
      });
    });
  });

  group('polling', () {
    test('starts polling GetState every 2 s after two failed attempts', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail'])..start();
        r.elapse(1); // second failure: polling is on
        expect(r.store.polling, isTrue);
        expect(r.server.polls, 0);
        r.server.pollAnswer = stateAt(77);
        r.elapse(2);
        expect(r.server.polls, 1);
        expect(r.store.state!.serverTimeMs.toInt(), 77);
        expect(r.store.connected, isFalse);
        r.elapse(2);
        expect(r.server.polls, 2);
        r.store.stop();
      });
    });

    test('does not poll after a single failure', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail'])..start();
        r.elapse(10);
        expect(r.server.opened, 2);
        expect(r.server.polls, 0);
        expect(r.store.polling, isFalse);
        r.store.stop();
      });
    });

    test('stops polling as soon as a stream message arrives', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail'])..start();
        r.elapse(3); // polling since 1 s; third attempt open since 3 s
        expect(r.store.polling, isTrue);
        final polls = r.server.polls;
        r.server.send(stateAt(500));
        r.settle();
        expect(r.store.polling, isFalse);
        r.elapse(10);
        expect(r.server.polls, polls);
        expect(r.store.state!.serverTimeMs.toInt(), 500);
        r.store.stop();
      });
    });

    test('a poll answer that arrives after the stream is back does not overwrite the stream state', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail']);
        r.server.pollGate = Completer<void>();
        r.start();
        r.elapse(3); // first poll is waiting on the gate
        expect(r.server.polls, 1);
        r.server.send(stateAt(500));
        r.settle();
        r.server.pollAnswer = stateAt(1);
        r.server.pollGate!.complete();
        r.settle();
        expect(r.store.state!.serverTimeMs.toInt(), 500);
        r.store.stop();
      });
    });

    test('one poll at a time', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail']);
        r.server.pollGate = Completer<void>();
        r.start();
        r.elapse(9); // beats at 3, 5, 7, 9 s while the first answer is still pending
        expect(r.server.polls, 1);
        r.store.stop();
      });
    });
  });

  group('regressions found in review', () {
    test('regression: a poll that never answers is given up after 10 s so polling goes on', () {
      fakeAsync((async) {
        final r = Rig(async, script: List.filled(40, 'fail'));
        r.server.pollGate = Completer<void>(); // GetState hangs: a dead link that never closes
        r.start();
        r.elapse(3);
        expect(r.server.polls, 1);
        r.elapse(9); // 12 s: the first poll is still pending (given up at 13 s)
        expect(r.server.polls, 1);
        r.elapse(6); // 18 s
        expect(r.server.polls, greaterThan(1));
        r.store.stop();
      });
    });

    test('regression: a poll in flight when the app pauses does not block polling after it resumes', () {
      fakeAsync((async) {
        final r = Rig(async, script: List.filled(40, 'fail'));
        r.server.pollGate = Completer<void>();
        r.start();
        r.elapse(3);
        expect(r.server.polls, 1);
        r.store.pause();
        r.settle();
        r.store.resume();
        r.elapse(3); // new run: attempts fail at 0 s and 1 s, first beat at 3 s
        expect(r.server.polls, 2);
        r.store.stop();
      });
    });

    test('regression: a message without a state is not a state', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.server.streams.last.add(WatchStateResponse());
        r.settle();
        expect(r.store.state, isNull);
        expect(r.store.connected, isFalse);
        r.server.send(stateAt(3));
        r.settle();
        expect(r.store.state!.serverTimeMs.toInt(), 3);
        r.store.stop();
      });
    });

    test('a message without a state still counts as the stream being alive', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.elapse(50);
        r.server.streams.last.add(WatchStateResponse());
        r.settle();
        r.elapse(50); // 100 s in all, 50 s after the last message
        expect(r.server.aborted, 0);
        r.store.stop();
      });
    });

    test('the stream request carries the bearer token', () {
      fakeAsync((async) {
        final server = FakeSessionServer();
        final auth = AuthStore(MemoryStore());
        final handlers = ApiHandlers(token: () => 'stream-token', onUnauthenticated: () {}, onPasswordChange: () {});
        final store = StateStore(
          client: SessionServiceClient(server.build(interceptors: apiInterceptors(handlers))),
          auth: auth,
          monotonicMs: () => async.elapsed.inMilliseconds,
        );
        store.start();
        async.flushMicrotasks();
        server.send(stateAt(1));
        async.flushMicrotasks();
        expect(server.lastWatchHeaders!['authorization'], 'Bearer stream-token');
        store.stop();
      });
    });
  });

  group('silence', () {
    test('a stream that says nothing for 60 s is closed and opened again', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.server.send(stateAt(1));
        r.settle();
        r.elapseMs(59999);
        expect(r.server.aborted, 0);
        expect(r.store.connected, isTrue);
        r.elapseMs(1);
        expect(r.server.aborted, 1);
        expect(r.store.connected, isFalse);
        r.elapse(1);
        expect(r.server.opened, 2);
        r.store.stop();
      });
    });

    test('a stream that keeps delivering is left alone', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        for (var i = 0; i < 10; i++) {
          r.server.send(stateAt(i));
          r.elapse(30);
        }
        expect(r.server.opened, 1);
        expect(r.server.aborted, 0);
        r.store.stop();
      });
    });

    test('a stream that never delivers its first message is also given up after 60 s', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.elapse(60);
        expect(r.server.aborted, 1);
        r.elapse(1);
        expect(r.server.opened, 2);
        r.store.stop();
      });
    });

    test('stop cancels the silence timer too', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.server.send(stateAt(1));
        r.settle();
        r.store.stop();
        r.settle();
        expect(r.server.aborted, 1);
        r.elapse(300);
        expect(r.server.opened, 1);
        expect(async.pendingTimers, isEmpty);
      });
    });
  });

  group('start and stop', () {
    test('stop aborts the stream and every timer, and clears the state', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail'])..start();
        r.elapse(3);
        r.server.send(stateAt(4));
        r.settle();
        r.store.stop();
        r.settle();
        expect(r.server.aborted, 3); // the two failed attempts and the open stream
        expect(r.store.state, isNull);
        expect(r.store.connected, isFalse);
        expect(r.store.polling, isFalse);
        expect(async.pendingTimers, isEmpty);
      });
    });

    test('stop during a back-off wait cancels the retry', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail'])..start();
        r.elapseMs(500);
        r.store.stop();
        r.elapse(60);
        expect(r.server.opened, 1);
      });
    });

    test('start twice opens one stream; start after stop opens a new one', () {
      fakeAsync((async) {
        final r = Rig(async);
        r.store.start();
        r.store.start();
        r.settle();
        expect(r.server.opened, 1);
        r.store.stop();
        r.settle();
        r.store.start();
        r.settle();
        expect(r.server.opened, 2);
        r.store.stop();
      });
    });
  });

  group('clock', () {
    test('keeps the server clock offset of the latest state', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.elapseMs(250);
        r.server.send(stateAt(1000));
        r.settle();
        expect(r.store.offsetMs, 750);
        r.elapseMs(750); // now at 1000 local
        r.server.send(stateAt(3000));
        r.settle();
        expect(r.store.offsetMs, 2000);
        r.store.stop();
      });
    });

    test('positionMs extrapolates a playing song', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.server.send(stateAt(1000, positionMs: 41200, positionAtMs: 1000)); // received at local 0
        r.settle();
        r.elapse(2);
        expect(r.store.positionMs(), 43200);
        expect(r.store.positionMs(0), 41200);
        r.store.stop();
      });
    });

    test('positionMs is 0 without a state', () {
      fakeAsync((async) {
        expect(Rig(async).store.positionMs(), 0);
      });
    });
  });

  group('follows the sign-in', () {
    test('opens when a token appears, closes on sign-out', () {
      fakeAsync((async) {
        final r = Rig(async);
        r.settle();
        expect(r.server.opened, 0);
        r.auth.signIn(signedIn());
        r.settle();
        expect(r.server.opened, 1);
        r.server.send(stateAt(1));
        r.settle();
        r.auth.signOut();
        r.settle();
        expect(r.server.aborted, 1);
        expect(r.store.state, isNull);
        r.store.dispose();
      });
    });

    test('stays closed while a password change is required, and opens once it is done', () {
      fakeAsync((async) {
        final r = Rig(async);
        r.auth.signIn(signedIn(mustChange: true));
        r.settle();
        expect(r.server.opened, 0);
        r.auth.passwordChanged();
        r.settle();
        expect(r.server.opened, 1);
        r.store.dispose();
      });
    });

    test('regression: a required password change closes the stream even when the user is not loaded yet', () {
      fakeAsync((async) {
        final r = Rig(async);
        r.auth.signIn(signedIn(withUser: false));
        r.settle();
        expect(r.server.opened, 1);
        r.auth.markMustChangePassword();
        r.settle();
        expect(r.server.aborted, 1);
        r.store.dispose();
      });
    });

    test('dispose stops the stream and stops following the sign-in', () {
      fakeAsync((async) {
        final r = Rig(async);
        r.auth.signIn(signedIn());
        r.settle();
        r.store.dispose();
        r.settle();
        expect(r.server.aborted, 1);
        r.auth.signOut();
        r.auth.signIn(signedIn());
        r.settle();
        expect(r.server.opened, 1);
      });
    });
  });

  group('app lifecycle', () {
    test('pause cancels the stream and the timers but keeps the last state', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.server.send(stateAt(8));
        r.settle();
        r.store.pause();
        r.settle();
        expect(r.server.aborted, 1);
        expect(r.store.connected, isFalse);
        expect(r.store.state!.serverTimeMs.toInt(), 8);
        r.elapse(300);
        expect(r.server.opened, 1);
        expect(async.pendingTimers, isEmpty);
      });
    });

    test('resume opens the stream again, once', () {
      fakeAsync((async) {
        final r = Rig(async)..start();
        r.store.pause();
        r.settle();
        r.store.resume();
        r.store.resume();
        r.settle();
        expect(r.server.opened, 2);
        r.store.stop();
      });
    });

    test('pause stops polling', () {
      fakeAsync((async) {
        final r = Rig(async, script: ['fail', 'fail'])..start();
        r.elapse(3);
        expect(r.store.polling, isTrue);
        r.store.pause();
        r.settle();
        expect(r.store.polling, isFalse);
        final polls = r.server.polls;
        r.elapse(20);
        expect(r.server.polls, polls);
      });
    });

    test('resume does nothing for a store that was never started or was stopped', () {
      fakeAsync((async) {
        final r = Rig(async);
        r.store.pause();
        r.store.resume();
        r.settle();
        expect(r.server.opened, 0);
        r.start();
        r.store.stop();
        r.store.pause();
        r.store.resume();
        r.settle();
        expect(r.server.opened, 1);
      });
    });

    test('a sign-in while the app is in the background opens nothing until it is back', () {
      fakeAsync((async) {
        final r = Rig(async);
        r.store.pause();
        r.auth.signIn(signedIn());
        r.settle();
        expect(r.server.opened, 0);
        r.store.resume();
        r.settle();
        expect(r.server.opened, 1);
        r.store.dispose();
      });
    });
  });
}
