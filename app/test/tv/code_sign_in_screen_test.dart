import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:connectrpc/test.dart';
import 'package:fixnum/fixnum.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/auth_gate.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/tv/code_sign_in_screen.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// A server for StartCodeLogin and WaitCodeLogin that the test steers.
class Rig {
  final starts = <StartCodeLoginRequest>[];
  final waits = <String>[];
  final waitStreams = <StreamController<WaitCodeLoginResponse>>[];
  int aborted = 0;
  bool failNextWait = false; // the next wait ends with an error at once
  Code failWith = Code.unavailable; // ... with this code
  int codes = 0;
  FutureOr<void> Function()? onStart;
  late final AppServices services;
  late final AuthStore auth;

  Rig({String? server = 'http://srv:1'}) {
    auth = AuthStore(MemoryStore());
    final api = Api(
      FakeTransportBuilder()
          .unary(AuthService.startCodeLogin, (req, ctx) async {
            starts.add(req);
            await onStart?.call();
            codes++;
            return StartCodeLoginResponse(
              loginId: 'login-$codes',
              code: 'ABCD2$codes',
              expiresAtUnix: Int64(DateTime.now().millisecondsSinceEpoch ~/ 1000 + 300),
              approveUrl: 'http://srv:1/code?c=ABCD2$codes',
            );
          })
          .server(AuthService.waitCodeLogin, (req, ctx) {
            waits.add(req.loginId);
            ctx.signal.future.then((_) => aborted++);
            if (failNextWait) {
              failNextWait = false;
              Stream<WaitCodeLoginResponse> failing() async* {
                throw ConnectException(failWith, failWith == Code.permissionDenied ? 'account disabled' : 'down');
              }

              return failing();
            }
            final c = StreamController<WaitCodeLoginResponse>();
            waitStreams.add(c);
            return c.stream;
          })
          .build(),
    );
    final serverUrl = ServerUrl(MemoryStore());
    services = AppServices(
      serverUrl: serverUrl,
      auth: auth,
      api: api,
      state: StateStore(client: api.session, auth: auth)..dispose(),
      isTv: true,
    );
    if (server != null) serverUrl.set(server);
  }

  void send(WaitCodeLoginResponse r) => waitStreams.last.add(r);

  Future<void> pump(WidgetTester tester, Widget child) async {
    // a 1080p TV: 960 x 540 logical pixels
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      AppRoot(
        services: services,
        child: MaterialApp(home: child),
      ),
    );
    await settle(tester);
  }
}

Future<void> settle(WidgetTester tester, [int ms = 0]) async {
  await tester.pump(Duration(milliseconds: ms));
  await tester.pump();
  await tester.pump();
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

CodeSignInScreen screen() => CodeSignInScreen(deviceName: () async => 'Living room TV');

void main() {
  testWidgets('asks for a code for this TV and shows it large, with the QR of the approval address', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    expect(r.starts.single.deviceName, 'Living room TV');
    expect(r.starts.single.deviceType, DeviceType.DEVICE_TYPE_ANDROID_TV);
    expect(find.text('ABCD21'), findsOneWidget);
    expect(find.byKey(const ValueKey('qr:http://srv:1/code?c=ABCD21')), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    expect(shows('Approve'), isTrue); // says what to do on the phone
    expect(tester.widget<Text>(find.text('ABCD21')).style!.fontSize, greaterThanOrEqualTo(48));
  });

  testWidgets('keeps WaitCodeLogin open with the secret of this login', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    expect(r.waits, ['login-1']);
  });

  testWidgets('approved: the TV is signed in with the token the server sent', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    r.send(
      WaitCodeLoginResponse(
        approved: AuthToken(
          token: 'tv-token',
          deviceId: 'tv-1',
          user: User(id: 'u'),
        ),
      ),
    );
    await settle(tester);
    expect(r.auth.signedIn, isTrue);
    expect(r.auth.token, 'tv-token');
    expect(r.auth.deviceId, 'tv-1');
  });

  testWidgets('approved with the gate around: the app opens', (tester) async {
    final r = Rig();
    await r.pump(tester, AuthGate(signedIn: (_) => const Text('the app'), deviceName: () async => 'Living room TV'));
    expect(find.text('ABCD21'), findsOneWidget); // on a TV the gate shows the code screen
    r.send(
      WaitCodeLoginResponse(
        approved: AuthToken(
          token: 't',
          deviceId: 'd',
          user: User(id: 'u'),
        ),
      ),
    );
    await settle(tester);
    expect(find.text('the app'), findsOneWidget);
  });

  testWidgets('expired: says so and offers a new code, which starts a new login', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    r.send(WaitCodeLoginResponse(expired: true));
    await settle(tester);
    expect(shows('Code expired'), isTrue);
    expect(find.text('ABCD21'), findsNothing);
    await tester.tap(find.text('New code'));
    await settle(tester);
    expect(r.starts.length, 2);
    expect(find.text('ABCD22'), findsOneWidget);
    expect(r.waits, ['login-1', 'login-2']);
    expect(shows('Code expired'), isFalse);
  });

  testWidgets('a wait that drops while the code is still valid is opened again with the same secret', (tester) async {
    final r = Rig()..failNextWait = true;
    await r.pump(tester, screen());
    await settle(tester, 1100);
    expect(r.waits, ['login-1', 'login-1']);
    expect(find.text('ABCD21'), findsOneWidget);
    r.send(
      WaitCodeLoginResponse(
        approved: AuthToken(
          token: 't',
          deviceId: 'd',
          user: User(id: 'u'),
        ),
      ),
    );
    await settle(tester);
    expect(r.auth.signedIn, isTrue);
  });

  testWidgets('regression: a login the server no longer knows (restart, or purged after expiry) is an expired code, not a wait to repeat forever', (
    tester,
  ) async {
    final r = Rig()
      ..failNextWait = true
      ..failWith = Code.notFound;
    await r.pump(tester, screen());
    await settle(tester, 15000);
    expect(shows('Code expired'), isTrue);
    expect(find.text('New code'), findsOneWidget);
    expect(r.waits, ['login-1'], reason: 'the same secret is not tried again');
  });

  testWidgets('regression: a refused account is told so, not waited on forever', (tester) async {
    final r = Rig()
      ..failNextWait = true
      ..failWith = Code.permissionDenied;
    await r.pump(tester, screen());
    await settle(tester, 15000);
    expect(shows('account disabled'), isTrue);
    expect(find.text('Try again'), findsOneWidget);
    expect(r.waits, ['login-1']);
  });

  testWidgets('a stream that ends without an answer is also opened again', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    await r.waitStreams.last.close();
    await settle(tester, 1100);
    expect(r.waits.length, 2);
  });

  testWidgets('a code the server could not give shows why, with a way to try again', (tester) async {
    final r = Rig();
    var fail = true;
    r.onStart = () {
      if (fail) throw ConnectException(Code.unavailable, 'down');
    };
    await r.pump(tester, screen());
    expect(shows('Could not reach the server'), isTrue);
    expect(find.byType(QrImageView), findsNothing);
    fail = false;
    await tester.tap(find.text('Try again'));
    await settle(tester);
    expect(find.text('ABCD21'), findsOneWidget);
  });

  testWidgets('leaving the screen ends the wait', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    await tester.pumpWidget(const SizedBox());
    await settle(tester);
    expect(r.aborted, greaterThan(0));
    r.waitStreams.last.add(
      WaitCodeLoginResponse(
        approved: AuthToken(
          token: 'late',
          deviceId: 'd',
          user: User(id: 'u'),
        ),
      ),
    );
    await settle(tester);
    expect(r.auth.signedIn, isFalse); // an answer that comes after leaving is not used
  });

  testWidgets('the button to start again takes the focus, so the remote can press it', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    r.send(WaitCodeLoginResponse(expired: true));
    await settle(tester);
    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'New code'));
    expect(button.autofocus, isTrue);
  });

  testWidgets('"Use another server" forgets the address', (tester) async {
    final r = Rig();
    await r.pump(tester, screen());
    await tester.tap(find.text('Use another server'));
    await settle(tester);
    expect(r.services.serverUrl.value, isNull);
  });
}
