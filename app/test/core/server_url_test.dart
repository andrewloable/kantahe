import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fake_async/fake_async.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

import 'fakes.dart';

Transport Function(String) serverInfo(List<String> seen, {Object? Function()? fail, bool setup = false}) => (url) {
  seen.add(url);
  return FakeTransportBuilder().unary(AuthService.getServerInfo, (req, ctx) async {
    final f = fail?.call();
    if (f != null) throw f;
    return GetServerInfoResponse(version: '1.2.3', setupRequired: setup);
  }).build();
};

void main() {
  group('normalize', () {
    test('keeps http and https addresses, with a path or port', () {
      expect(ServerUrl.normalize('http://192.168.1.20:8080'), 'http://192.168.1.20:8080');
      expect(ServerUrl.normalize('https://karaoke.example.com/kantahe'), 'https://karaoke.example.com/kantahe');
    });

    test('trailing slash normalised away', () {
      expect(ServerUrl.normalize('http://192.168.1.20:8080/'), 'http://192.168.1.20:8080');
      expect(ServerUrl.normalize('http://192.168.1.20:8080///'), 'http://192.168.1.20:8080');
    });

    test('trims spaces and adds http when no scheme was typed', () {
      expect(ServerUrl.normalize('  192.168.1.20:8080 '), 'http://192.168.1.20:8080');
      expect(ServerUrl.normalize('karaoke.lan'), 'http://karaoke.lan');
    });

    test('rejects anything else', () {
      for (final bad in [
        '',
        '   ',
        'ftp://x',
        'http://',
        'http://u:p@host',
        'http://host?x=1',
        'http://host#frag',
        'http://exa mple.com',
        'file:///etc/passwd',
      ]) {
        expect(ServerUrl.normalize(bad), isNull, reason: bad);
      }
    });
  });

  group('stored address', () {
    test('is empty until one is set', () async {
      final u = ServerUrl(MemoryStore());
      await u.load();
      expect(u.value, isNull);
    });

    test('set stores the normalised address, notifies, and load reads it back', () async {
      final store = MemoryStore();
      final u = ServerUrl(store);
      var notified = 0;
      u.addListener(() => notified++);
      await u.set('192.168.1.20:8080/');
      expect(u.value, 'http://192.168.1.20:8080');
      expect(notified, 1);
      final again = ServerUrl(store);
      await again.load();
      expect(again.value, 'http://192.168.1.20:8080');
    });

    test('set refuses an invalid address and keeps the old one', () async {
      final u = ServerUrl(MemoryStore());
      await u.set('http://good:1');
      await expectLater(u.set('ftp://bad'), throwsArgumentError);
      expect(u.value, 'http://good:1');
    });

    test('ignores a stored value that is not a valid address', () async {
      final store = MemoryStore();
      await store.write('kantahe.server', 'ftp://nope');
      final u = ServerUrl(store);
      await u.load();
      expect(u.value, isNull);
    });

    test('clear forgets the address', () async {
      final store = MemoryStore();
      final u = ServerUrl(store);
      await u.set('http://a:1');
      await u.clear();
      expect(u.value, isNull);
      expect(await store.read('kantahe.server'), isNull);
    });

    test('works when storage throws', () async {
      final u = ServerUrl(ThrowingStore());
      await u.load();
      await u.set('http://a:1');
      expect(u.value, 'http://a:1'); // kept in memory for this run
      await u.clear();
      expect(u.value, isNull);
    });
  });

  group('validate', () {
    test('a server that answers is OK and reports version and first-run state', () async {
      final seen = <String>[];
      final u = ServerUrl(MemoryStore(), makeTransport: serverInfo(seen, setup: true));
      final r = await u.validate('192.168.1.20:8080/');
      expect(r.ok, isTrue);
      expect(r.url, 'http://192.168.1.20:8080');
      expect(r.version, '1.2.3');
      expect(r.setupRequired, isTrue);
      expect(r.error, isNull);
      expect(seen, ['http://192.168.1.20:8080']);
    });

    test('validating does not store the address', () async {
      final u = ServerUrl(MemoryStore(), makeTransport: serverInfo([]));
      await u.validate('http://a:1');
      expect(u.value, isNull);
    });

    test('unreachable gives an error text naming the address', () async {
      final u = ServerUrl(MemoryStore(), makeTransport: serverInfo([], fail: () => ConnectException(Code.unavailable, 'refused')));
      final r = await u.validate('http://10.0.0.9:8080');
      expect(r.ok, isFalse);
      expect(r.error, contains('http://10.0.0.9:8080'));
      expect(r.error, contains('Could not reach'));
    });

    test('an address that is not an address never calls the server', () async {
      final seen = <String>[];
      final u = ServerUrl(MemoryStore(), makeTransport: serverInfo(seen));
      final r = await u.validate('ftp://x');
      expect(r.ok, isFalse);
      expect(r.error, contains('http://'));
      expect(seen, isEmpty);
    });

    test('a server that never answers is given up after 5 seconds', () {
      fakeAsync((async) {
        final u = ServerUrl(
          MemoryStore(),
          makeTransport: (url) => FakeTransportBuilder()
              .unary(AuthService.getServerInfo, (req, ctx) => Future<GetServerInfoResponse>.delayed(const Duration(hours: 1), () => GetServerInfoResponse()))
              .build(),
        );
        ServerCheck? result;
        u.validate('http://slow:1').then((r) => result = r);
        async.elapse(const Duration(seconds: 4));
        expect(result, isNull);
        async.elapse(const Duration(seconds: 2));
        expect(result!.ok, isFalse);
        expect(result!.error, contains('5 seconds'));
      });
    });
  });
}
