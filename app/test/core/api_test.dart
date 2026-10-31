import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

import 'fakes.dart';

class Seen {
  String? token = 'tok-1';
  int unauthenticated = 0;
  int passwordChange = 0;
  String? header;
  ApiHandlers get handlers => ApiHandlers(token: () => token, onUnauthenticated: () => unauthenticated++, onPasswordChange: () => passwordChange++);
}

/// A server whose GetServerInfo does [act]; the interceptors under test sit in front of it.
AuthServiceClient authClient(Seen seen, Object? Function() act) {
  final t = FakeTransportBuilder()
      .unary(AuthService.getServerInfo, (req, ctx) {
        seen.header = ctx.requestHeaders['authorization'];
        final e = act();
        if (e != null) throw e;
        return GetServerInfoResponse(version: 'v');
      })
      .build(interceptors: apiInterceptors(seen.handlers));
  return AuthServiceClient(t);
}

void main() {
  group('apiInterceptors', () {
    test('bearer header present', () async {
      final seen = Seen();
      await authClient(seen, () => null).getServerInfo(GetServerInfoRequest());
      expect(seen.header, 'Bearer tok-1');
    });

    test('sends no header without a token', () async {
      final seen = Seen()..token = null;
      await authClient(seen, () => null).getServerInfo(GetServerInfoRequest());
      expect(seen.header, isNull);
    });

    test('an empty token counts as none', () async {
      final seen = Seen()..token = '';
      await authClient(seen, () => null).getServerInfo(GetServerInfoRequest());
      expect(seen.header, isNull);
    });

    test('unauthenticated with a token sent calls signOut, and still throws', () async {
      final seen = Seen();
      final c = authClient(seen, () => ConnectException(Code.unauthenticated, 'expired'));
      await expectLater(c.getServerInfo(GetServerInfoRequest()), throwsA(isA<ConnectException>().having((e) => e.code, 'code', Code.unauthenticated)));
      expect(seen.unauthenticated, 1);
    });

    test('a failed sign-in (no token sent) is not an expired session', () async {
      final seen = Seen()..token = null;
      final c = authClient(seen, () => ConnectException(Code.unauthenticated, 'bad credentials'));
      await expectLater(c.getServerInfo(GetServerInfoRequest()), throwsA(isA<ConnectException>()));
      expect(seen.unauthenticated, 0);
    });

    test('reports a required password change', () async {
      final seen = Seen();
      final c = authClient(seen, () => ConnectException(Code.failedPrecondition, 'password change required'));
      await expectLater(c.getServerInfo(GetServerInfoRequest()), throwsA(isA<ConnectException>()));
      expect(seen.passwordChange, 1);
      expect(seen.unauthenticated, 0);
    });

    test('ignores other failed preconditions and other errors', () async {
      final seen = Seen();
      for (final e in [
        ConnectException(Code.failedPrecondition, 'something else'),
        ConnectException(Code.permissionDenied, 'no'),
        ConnectException(Code.unavailable, 'down'),
      ]) {
        await expectLater(authClient(seen, () => e).getServerInfo(GetServerInfoRequest()), throwsA(isA<ConnectException>()));
      }
      expect(seen.unauthenticated + seen.passwordChange, 0);
    });

    test('passes stream messages through and reports a stream that fails with unauthenticated', () async {
      final seen = Seen();
      final t = FakeTransportBuilder()
          .server(SessionService.watchState, (req, ctx) async* {
            yield WatchStateResponse(state: stateAt(7));
            throw ConnectException(Code.unauthenticated, 'revoked');
          })
          .build(interceptors: apiInterceptors(seen.handlers));
      final got = <int>[];
      Object? error;
      try {
        await for (final m in SessionServiceClient(t).watchState(WatchStateRequest())) {
          got.add(m.state.serverTimeMs.toInt());
        }
      } catch (e) {
        error = e;
      }
      expect(got, [7]);
      expect(error, isA<ConnectException>());
      expect(seen.unauthenticated, 1);
    });
  });

  group('FollowingTransport', () {
    test('regression: an address set after the first call is used by the next call', () async {
      String? base = 'http://one:1';
      final made = <String>[];
      final t = FollowingTransport(() => base, (url) {
        made.add(url);
        return FakeTransportBuilder().unary(AuthService.getServerInfo, (req, ctx) => GetServerInfoResponse(version: url)).build();
      });
      final c = AuthServiceClient(t);
      expect((await c.getServerInfo(GetServerInfoRequest())).version, 'http://one:1');
      await c.getServerInfo(GetServerInfoRequest());
      expect(made, ['http://one:1']); // not rebuilt while the address is the same
      base = 'http://two:2';
      expect((await c.getServerInfo(GetServerInfoRequest())).version, 'http://two:2');
      expect(made, ['http://one:1', 'http://two:2']);
    });

    test('without an address a call fails as unavailable and builds nothing', () async {
      var built = 0;
      final t = FollowingTransport(() => null, (url) {
        built++;
        throw StateError('must not be called');
      });
      await expectLater(
        AuthServiceClient(t).getServerInfo(GetServerInfoRequest()),
        throwsA(isA<ConnectException>().having((e) => e.code, 'code', Code.unavailable)),
      );
      expect(built, 0);
    });

    test('streams go through the same transport', () async {
      final server = FakeSessionServer();
      final t = FollowingTransport(() => 'http://x:1', (url) => server.build());
      final first = SessionServiceClient(t).watchState(WatchStateRequest()).first;
      await Future<void>.delayed(Duration.zero);
      server.send(stateAt(1));
      expect((await first).state.serverTimeMs.toInt(), 1);
      expect(server.opened, 1);
    });
  });

  test('httpTransportFactory builds a transport for an address', () {
    final make = httpTransportFactory(const []);
    expect(make('http://127.0.0.1:1'), isA<Transport>());
    expect(make('http://127.0.0.1:2'), isA<Transport>()); // the previous client is closed, nothing throws
  });

  test('Api gives every generated client the one transport', () {
    final t = FakeTransportBuilder().build();
    final api = Api(t);
    expect(api.transport, same(t));
    expect([api.auth, api.session, api.catalog, api.admin, api.upload, api.userLibrary], everyElement(isNotNull));
  });
}
