import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

import 'fakes.dart';

AppServices fakeServices(FakeSessionServer server, {ServerUrl? serverUrl, AuthStore? auth}) {
  final a = auth ?? AuthStore(MemoryStore());
  final api = Api(server.build());
  return AppServices(
    serverUrl: serverUrl ?? ServerUrl(MemoryStore()),
    auth: a,
    api: api,
    state: StateStore(client: api.session, auth: a),
  );
}

void main() {
  testWidgets('AppScope.of gives every screen the same services', (tester) async {
    final services = fakeServices(FakeSessionServer());
    AppServices? seen;
    await tester.pumpWidget(
      AppRoot(
        services: services,
        child: Builder(
          builder: (context) {
            seen = AppScope.of(context);
            return const SizedBox();
          },
        ),
      ),
    );
    expect(seen, same(services));
  });

  group('focus highlight', () {
    AppServices services({required bool isTv}) {
      final a = AuthStore(MemoryStore());
      final api = Api(FakeSessionServer().build());
      return AppServices(
        serverUrl: ServerUrl(MemoryStore()),
        auth: a,
        api: api,
        state: StateStore(client: api.session, auth: a),
        isTv: isTv,
      );
    }

    tearDown(() => FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic);

    testWidgets('REGRESSION: on a TV the Material focus highlight is always shown (the default mode follows touch events, which a remote never sends)', (
      tester,
    ) async {
      FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
      await tester.pumpWidget(AppRoot(services: services(isTv: true), child: const SizedBox()));
      expect(FocusManager.instance.highlightStrategy, FocusHighlightStrategy.alwaysTraditional);
      expect(FocusManager.instance.highlightMode, FocusHighlightMode.traditional);
    });

    testWidgets('a phone or tablet keeps the automatic strategy', (tester) async {
      FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic;
      await tester.pumpWidget(AppRoot(services: services(isTv: false), child: const SizedBox()));
      expect(FocusManager.instance.highlightStrategy, FocusHighlightStrategy.automatic);
    });
  });

  testWidgets('without an AppScope above, of() says so', (tester) async {
    await tester.pumpWidget(
      Builder(
        builder: (context) {
          expect(() => AppScope.of(context), throwsA(isA<FlutterError>()));
          return const SizedBox();
        },
      ),
    );
  });

  testWidgets('going to the background pauses the stream, coming back resumes it', (tester) async {
    final server = FakeSessionServer();
    final services = fakeServices(server);
    await tester.pumpWidget(AppRoot(services: services, child: const SizedBox()));
    services.state.start();
    await tester.pump();
    expect(server.opened, 1);

    final b = tester.binding;
    // "inactive" is a short interruption (a system sheet): the stream stays open
    b.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(server.aborted, 0);
    b.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    b.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    expect(server.aborted, 1);

    b.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    b.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    b.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(server.opened, 2);
    services.state.stop();
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('removing the root stops listening to the lifecycle', (tester) async {
    final server = FakeSessionServer();
    final services = fakeServices(server);
    await tester.pumpWidget(AppRoot(services: services, child: const SizedBox()));
    services.state.start();
    await tester.pump();
    await tester.pumpWidget(const SizedBox());
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    expect(server.aborted, 0); // nobody was listening any more
    services.state.stop();
  });

  test('a new server address signs the device out (the token belongs to the old server)', () async {
    final auth = AuthStore(MemoryStore());
    final serverUrl = ServerUrl(MemoryStore());
    fakeServices(FakeSessionServer(), serverUrl: serverUrl, auth: auth);
    await serverUrl.set('http://one:1');
    await auth.signIn(AuthToken(token: 't', deviceId: 'd'));
    await serverUrl.set('http://one:1'); // same address again: nothing changes
    expect(auth.signedIn, isTrue);
    await serverUrl.set('http://two:2');
    expect(auth.signedIn, isFalse);
  });

  test('create wires the real storage, the bearer interceptor and the stored address', () async {
    FlutterSecureStorage.setMockInitialValues({'kantahe.token': 'tok', 'kantahe.deviceId': 'dev'});
    SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.withData({'kantahe.server': 'http://192.168.1.20:8080'});
    final services = await AppServices.create();
    expect(services.serverUrl.value, 'http://192.168.1.20:8080');
    expect(services.auth.token, 'tok');
    expect(services.auth.deviceId, 'dev');
    expect(services.api.session, isNotNull);
    services.state.dispose();
  });

  group('loadUser (the user is not stored: after a restart only the token is known)', () {
    Future<(AppServices, AuthStore)> restored(User? user, {bool fail = false}) async {
      final auth = AuthStore(MemoryStore());
      await auth.signIn(AuthToken(token: 't', deviceId: 'd')); // a restored session: no user
      final api = Api(
        FakeTransportBuilder().unary(AuthService.me, (req, ctx) {
          if (fail) throw ConnectException(Code.unavailable, 'down');
          return MeResponse(user: user);
        }).build(),
      );
      return (
        AppServices(
          serverUrl: ServerUrl(MemoryStore()),
          auth: auth,
          api: api,
          state: StateStore(client: api.session, auth: AuthStore(MemoryStore())),
        ),
        auth,
      );
    }

    test('regression: asks the server who this is and keeps the roles', () async {
      final (services, auth) = await restored(User(id: 'u', email: 'a@b.c', uploader: true));
      expect(auth.user, isNull);
      await services.loadUser();
      expect(auth.user!.uploader, isTrue);
      expect(auth.user!.email, 'a@b.c');
    });

    test('a user whose password must change is known after a restart too', () async {
      final (services, auth) = await restored(User(id: 'u', mustChangePassword: true));
      await services.loadUser();
      expect(auth.passwordChangeRequired, isTrue);
    });

    test('a failed call leaves things as they were (the interceptors handle a refused session)', () async {
      final (services, auth) = await restored(null, fail: true);
      await services.loadUser();
      expect(auth.user, isNull);
      expect(auth.signedIn, isTrue);
    });

    test('nothing is asked when signed out or when the user is already known', () async {
      final auth = AuthStore(MemoryStore());
      var asked = 0;
      final api = Api(
        FakeTransportBuilder().unary(AuthService.me, (req, ctx) {
          asked++;
          return MeResponse(user: User(id: 'u'));
        }).build(),
      );
      final services = AppServices(
        serverUrl: ServerUrl(MemoryStore()),
        auth: auth,
        api: api,
        state: StateStore(client: api.session, auth: AuthStore(MemoryStore())),
      );
      await services.loadUser();
      expect(asked, 0);
      await auth.signIn(
        AuthToken(
          token: 't',
          deviceId: 'd',
          user: User(id: 'known'),
        ),
      );
      await services.loadUser();
      expect(asked, 0);
    });
  });
}
