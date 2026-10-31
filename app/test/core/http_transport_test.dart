import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

/// A tiny Connect server on a real socket: a unary call is a POST whose body is the binary message.
Future<(HttpServer, List<HttpRequest>)> serve({int status = 200}) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  final seen = <HttpRequest>[];
  server.listen((req) async {
    seen.add(req);
    await req.drain<void>();
    req.response.statusCode = status;
    if (status == 200) {
      req.response.headers.contentType = ContentType('application', 'proto');
      req.response.add(GetServerInfoResponse(version: '9.9', setupRequired: true).writeToBuffer());
    } else {
      req.response.headers.contentType = ContentType('application', 'json');
      req.response.write('{"code":"unauthenticated","message":"expired"}');
    }
    await req.response.close();
  });
  return (server, seen);
}

void main() {
  test('a real call over plain http carries the bearer token and decodes the answer', () async {
    final (server, seen) = await serve();
    addTearDown(() => server.close(force: true));
    final handlers = ApiHandlers(token: () => 'secret-token', onUnauthenticated: () {}, onPasswordChange: () {});
    final transport = httpTransportFactory(apiInterceptors(handlers))('http://127.0.0.1:${server.port}');
    final r = await AuthServiceClient(transport).getServerInfo(GetServerInfoRequest());
    expect(r.version, '9.9');
    expect(r.setupRequired, isTrue);
    expect(seen.single.headers.value('authorization'), 'Bearer secret-token');
    expect(seen.single.uri.path, '/kantahe.v1.AuthService/GetServerInfo');
    expect(seen.single.headers.contentType?.mimeType, 'application/proto');
  });

  test('a real 401 reaches the handler once', () async {
    final (server, _) = await serve(status: 401);
    addTearDown(() => server.close(force: true));
    var out = 0;
    final handlers = ApiHandlers(token: () => 't', onUnauthenticated: () => out++, onPasswordChange: () {});
    final transport = httpTransportFactory(apiInterceptors(handlers))('http://127.0.0.1:${server.port}');
    await expectLater(AuthServiceClient(transport).getServerInfo(GetServerInfoRequest()), throwsA(anything));
    expect(out, 1);
  });

  test('ServerUrl.validate over a real socket: a server answers, a closed port does not', () async {
    final (server, seen) = await serve();
    final u = ServerUrl(MemoryStore(), makeTransport: httpTransportFactory(const []));
    final ok = await u.validate('127.0.0.1:${server.port}/');
    expect(ok.ok, isTrue);
    expect(ok.url, 'http://127.0.0.1:${server.port}');
    expect(ok.version, '9.9');
    expect(seen.single.headers.value('authorization'), isNull); // checking an address sends no token
    final port = server.port;
    await server.close(force: true);
    final down = await u.validate('http://127.0.0.1:$port');
    expect(down.ok, isFalse);
    expect(down.error, contains('Could not reach'));
  });

  test('regression: AppServices.create loads the user of a restored session (only the token is stored)', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));
    final seen = <HttpRequest>[];
    server.listen((req) async {
      seen.add(req);
      await req.drain<void>();
      req.response.headers.contentType = ContentType('application', 'proto');
      req.response.add(
        MeResponse(
          user: User(id: 'u', email: 'a@b.c', uploader: true),
        ).writeToBuffer(),
      );
      await req.response.close();
    });
    FlutterSecureStorage.setMockInitialValues({'kantahe.token': 'restored-token', 'kantahe.deviceId': 'dev'});
    SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.withData({'kantahe.server': 'http://127.0.0.1:${server.port}'});
    final services = await AppServices.create();
    for (var i = 0; i < 100 && services.auth.user == null; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }
    expect(services.auth.user?.uploader, isTrue);
    final me = seen.where((r) => r.uri.path == '/kantahe.v1.AuthService/Me').single; // the state stream may open as well
    expect(me.headers.value('authorization'), 'Bearer restored-token');
    services.state.dispose();
  });
}
