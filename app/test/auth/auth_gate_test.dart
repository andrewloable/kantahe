import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/auth_gate.dart';
import 'package:kantahe/auth/sign_in_screen.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

import 'harness.dart';

Widget gate() => AuthGate(signedIn: (_) => const Text('the app'), deviceName: () async => 'Pixel 8');

void main() {
  testWidgets('without a server address: the address screen', (tester) async {
    final h = Harness(server: null);
    await h.pump(tester, gate());
    await tester.pumpAndSettle();
    expect(find.text('Connect'), findsOneWidget);
    expect(find.text('the app'), findsNothing);
  });

  testWidgets('with an address but no session: sign-in', (tester) async {
    final h = Harness();
    await h.pump(tester, gate());
    await tester.pumpAndSettle();
    expect(find.byType(SignInScreen), findsOneWidget);
  });

  testWidgets('connecting moves from the address screen to sign-in', (tester) async {
    final h = Harness(server: null);
    await h.pump(tester, gate());
    await enter(tester, 'server-url', 'http://10.0.0.5:8080');
    await tapText(tester, 'Connect');
    expect(find.byType(SignInScreen), findsOneWidget);
  });

  testWidgets('signed in: the app', (tester) async {
    final h = Harness();
    await h.auth.signIn(
      AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u'),
      ),
    );
    await h.pump(tester, gate());
    await tester.pumpAndSettle();
    expect(find.text('the app'), findsOneWidget);
  });

  testWidgets('sign_in: must_change goes to the change-password screen, and changing it opens the app', (tester) async {
    final h = Harness();
    h.loginHandler = (_) => LoginResponse(
      auth: AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u', mustChangePassword: true),
      ),
    );
    await h.pump(tester, gate());
    await tester.pumpAndSettle();
    await enter(tester, 'email', 'a@b.c');
    await enter(tester, 'password', 'temporary');
    await tapText(tester, 'Sign in');
    expect(find.text('Change password'), findsWidgets);
    expect(shows('Choose a new password to continue.'), isTrue);
    expect(find.text('the app'), findsNothing);
    await enter(tester, 'current', 'temporary');
    await enter(tester, 'new', 'brand new password');
    await enter(tester, 'confirm', 'brand new password');
    await tester.tap(find.widgetWithText(FilledButton, 'Change password'));
    await tester.pumpAndSettle();
    expect(find.text('the app'), findsOneWidget);
  });

  testWidgets('a session the server refuses drops back to sign-in', (tester) async {
    final h = Harness();
    await h.auth.signIn(
      AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u'),
      ),
    );
    h.changeHandler = (_) => throw ConnectException(Code.unauthenticated, 'expired');
    await h.pump(tester, gate());
    await tester.pumpAndSettle();
    await expectLater(h.services.api.auth.changePassword(ChangePasswordRequest()), throwsA(anything));
    await tester.pumpAndSettle();
    expect(find.byType(SignInScreen), findsOneWidget);
  });

  testWidgets('a server that asks for a password change shows the change screen', (tester) async {
    final h = Harness();
    await h.auth.signIn(
      AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u'),
      ),
    );
    h.changeHandler = (_) => throw ConnectException(Code.failedPrecondition, 'password change required');
    await h.pump(tester, gate());
    await tester.pumpAndSettle();
    await expectLater(h.services.api.auth.changePassword(ChangePasswordRequest()), throwsA(anything));
    await tester.pumpAndSettle();
    expect(shows('Choose a new password to continue.'), isTrue);
  });

  testWidgets('a different server address signs the device out', (tester) async {
    final h = Harness();
    await h.auth.signIn(
      AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u'),
      ),
    );
    await h.pump(tester, gate());
    await tester.pumpAndSettle();
    await h.serverUrl.set('http://other:2');
    await tester.pumpAndSettle();
    expect(find.byType(SignInScreen), findsOneWidget);
  });
}
