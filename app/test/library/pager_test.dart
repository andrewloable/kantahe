import 'dart:async';
import 'dart:collection';

import 'package:connectrpc/connect.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/library/pager.dart';

/// A page source whose answers the test completes by hand.
class Source {
  final tokens = <String>[];
  final gates = <Completer<ListPage<String>>>[];
  final signals = <AbortSignal>[];
  int aborted = 0;

  Future<ListPage<String>> fetch(String token, AbortSignal signal) {
    tokens.add(token);
    signals.add(signal);
    signal.future.then((_) => aborted++);
    final c = Completer<ListPage<String>>();
    gates.add(c);
    return c.future;
  }
}

Future<void> turn() => Future<void>.delayed(Duration.zero);

void main() {
  test('loads the first page, then the next one with the returned token, and appends', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final first = p.reset();
    expect(p.loading, isTrue);
    s.gates[0].complete(ListPage(['a', 'b'], 'T2'));
    await first;
    expect(p.items, ['a', 'b']);
    expect(p.hasMore, isTrue);
    expect(p.loaded, isTrue);
    expect(p.loading, isFalse);
    final more = p.more();
    s.gates[1].complete(ListPage(['c'], ''));
    await more;
    expect(s.tokens, ['', 'T2']);
    expect(p.items, ['a', 'b', 'c']);
    expect(p.hasMore, isFalse);
  });

  test('does not ask twice for the same page while one is running, or when there is no more', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final first = p.reset();
    s.gates[0].complete(ListPage(['a'], 'T2'));
    await first;
    final m1 = p.more();
    final m2 = p.more();
    expect(s.tokens, ['', 'T2']);
    s.gates[1].complete(ListPage(['b'], ''));
    await Future.wait([m1, m2]);
    await p.more(); // nothing left
    expect(s.tokens.length, 2);
  });

  test('reset starts over and drops the answer of an older request', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final old = p.reset();
    final fresh = p.reset();
    s.gates[1].complete(ListPage(['new'], ''));
    await fresh;
    s.gates[0].complete(ListPage(['old'], 'X')); // arrives late
    await old;
    expect(p.items, ['new']);
    expect(p.hasMore, isFalse);
  });

  test('reset clears the old items at once', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final first = p.reset();
    s.gates[0].complete(ListPage(['a'], ''));
    await first;
    final again = p.reset();
    expect(p.items, isEmpty);
    expect(p.loaded, isFalse);
    s.gates[1].complete(ListPage(['b'], ''));
    await again;
  });

  test('a failed load is a sentence, keeps what was loaded, and retries the same page', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final first = p.reset();
    s.gates[0].complete(ListPage(['a'], 'T2'));
    await first;
    final bad = p.more();
    s.gates[1].completeError(ConnectException(Code.unavailable, 'down'));
    await bad;
    expect(p.error, 'Could not reach the server. Check the connection and try again.');
    expect(p.items, ['a']);
    expect(p.hasMore, isTrue);
    final retry = p.retry();
    s.gates[2].complete(ListPage(['b'], ''));
    await retry;
    expect(s.tokens, ['', 'T2', 'T2']);
    expect(p.items, ['a', 'b']);
    expect(p.error, '');
  });

  test('a failed first page leaves an empty list with the error, and retry starts again', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final bad = p.reset();
    s.gates[0].completeError(ConnectException(Code.internal, 'boom'));
    await bad;
    expect(p.error, 'Something went wrong. Try again.');
    expect(p.items, isEmpty);
    expect(p.loaded, isFalse);
    final retry = p.retry();
    s.gates[1].complete(ListPage(['a'], ''));
    await retry;
    expect(s.tokens, ['', '']);
    expect(p.items, ['a']);
  });

  test('the request of a replaced list is aborted, and cancel aborts the current one', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    unawaited(p.reset());
    unawaited(p.reset());
    await turn();
    expect(s.aborted, 1);
    p.cancel();
    await turn();
    expect(s.aborted, 2);
    expect(p.loading, isFalse);
  });

  test('an item that is already shown is not added again (pages can overlap when the library changes)', () async {
    final s = Source();
    final p = Pager<String>(s.fetch, key: (x) => x);
    final first = p.reset();
    s.gates[0].complete(ListPage(['a', 'b'], 'T2'));
    await first;
    final more = p.more();
    s.gates[1].complete(ListPage(['b', 'c'], ''));
    await more;
    expect(p.items, ['a', 'b', 'c']);
  });

  test('without a key every item is kept', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final first = p.reset();
    s.gates[0].complete(ListPage(['a', 'a'], ''));
    await first;
    expect(p.items, ['a', 'a']);
  });

  test('listeners hear about every change, and a disposed pager ignores a late answer', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    var n = 0;
    p.addListener(() => n++);
    final first = p.reset();
    expect(n, greaterThan(0));
    final before = n;
    p.dispose();
    s.gates[0].complete(ListPage(['a'], ''));
    await first; // must not throw or notify
    expect(n, before);
  });

  test('items is a read-only view of the list, not a copy made on every read', () async {
    final s = Source();
    final p = Pager<String>(s.fetch);
    final first = p.reset();
    s.gates[0].complete(ListPage(['a'], ''));
    await first;
    expect(() => p.items.add('x'), throwsUnsupportedError);
    expect(p.items, isA<UnmodifiableListView<String>>());
  });
}
