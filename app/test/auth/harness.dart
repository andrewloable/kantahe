import 'dart:async';

import 'package:connectrpc/test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_discovery.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.spec.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

/// Fake services for the screens: the auth RPCs answer what the test says, nothing touches the network.
class Harness {
  Harness({String? server = 'http://srv:1', bool tv = false}) {
    final auth = AuthStore(MemoryStore());
    serverUrl = ServerUrl(
      MemoryStore(),
      makeTransport: (url) {
        infoAsked.add(url);
        return FakeTransportBuilder().unary(AuthService.getServerInfo, (req, ctx) async {
          await infoGate?.future;
          return info(url);
        }).build();
      },
    );
    final handlers = ApiHandlers(token: () => auth.token, onUnauthenticated: auth.signOut, onPasswordChange: auth.markMustChangePassword);
    final api = Api(
      FakeTransportBuilder()
          .unary(AuthService.login, (req, ctx) async {
            logins.add(req); // recorded when it arrives, before the (maybe slow) answer
            await loginGate?.future;
            return loginHandler(req);
          })
          .unary(AuthService.changePassword, (req, ctx) => changePassword(req))
          .unary(AuthService.approveCode, (req, ctx) => approveCode(req))
          .build(interceptors: apiInterceptors(handlers)),
    );
    final state = StateStore(client: api.session, auth: auth)..dispose(); // the screens under test do not stream
    services = AppServices(
      serverUrl: serverUrl,
      auth: auth,
      api: api,
      state: state,
      isTv: tv,
      findServers: (window) {
        searches++;
        return find(window);
      },
    );
    if (server != null) serverUrl.set(server);
  }

  late final ServerUrl serverUrl;
  late final AppServices services;
  AuthStore get auth => services.auth;

  /// While set and not completed, the server does not answer: the screen stays busy.
  Completer<void>? infoGate;
  Completer<void>? loginGate;

  /// What the search for servers on the network turns up (nothing, unless a test says so).
  Future<List<ServerCandidate>> Function(Duration window) find = noServers;
  int searches = 0;

  final infoAsked = <String>[];
  final logins = <LoginRequest>[];
  final changes = <ChangePasswordRequest>[];
  final approvals = <ApproveCodeRequest>[];

  GetServerInfoResponse Function(String url) info = (url) => GetServerInfoResponse(version: '1.0', setupRequired: false);

  FutureOr<LoginResponse> Function(LoginRequest) loginHandler = (r) => LoginResponse(
    auth: AuthToken(
      token: 'tok',
      deviceId: 'dev',
      user: User(id: 'u', email: 'a@b.c'),
    ),
  );
  FutureOr<ChangePasswordResponse> Function(ChangePasswordRequest) changeHandler = (r) => ChangePasswordResponse();
  FutureOr<ApproveCodeResponse> Function(ApproveCodeRequest) approveHandler = (r) => ApproveCodeResponse(deviceName: 'Living room TV');

  FutureOr<ChangePasswordResponse> changePassword(ChangePasswordRequest r) {
    changes.add(r);
    return changeHandler(r);
  }

  FutureOr<ApproveCodeResponse> approveCode(ApproveCodeRequest r) {
    approvals.add(r);
    return approveHandler(r);
  }

  /// Shows [child] inside the app root, like the real app does.
  Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
    AppRoot(
      services: services,
      child: MaterialApp(home: child),
    ),
  );
}

Future<void> enter(WidgetTester tester, String key, String text) async {
  await tester.enterText(find.byKey(Key(key)), text);
  await tester.pump();
}

/// Taps the button with this label (the last match: a screen's title may say the same words).
Future<void> tapText(WidgetTester tester, String label) async {
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

/// The text shown in an error or status line.
bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

String fieldText(WidgetTester tester, String key) => tester.widget<TextField>(find.byKey(Key(key))).controller!.text;
