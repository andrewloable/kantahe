import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/sign_in_screen.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

import 'harness.dart';

Future<String> pixel() async => 'Pixel 8';

Future<void> signIn(WidgetTester tester, {String email = 'a@b.c', String password = 'correct horse'}) async {
  await enter(tester, 'email', email);
  await enter(tester, 'password', password);
  await tapText(tester, 'Sign in');
}

void main() {
  testWidgets('shows the server it talks to, with the device name filled in', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(shows('http://srv:1'), isTrue);
    expect(fieldText(tester, 'device-name'), 'Pixel 8');
  });

  testWidgets('signs in: trimmed email, the typed password, device name and type', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel, deviceType: DeviceType.DEVICE_TYPE_ANDROID));
    await tester.pumpAndSettle();
    await signIn(tester, email: '  a@b.c ');
    expect(h.logins.single.email, 'a@b.c');
    expect(h.logins.single.password, 'correct horse');
    expect(h.logins.single.deviceName, 'Pixel 8');
    expect(h.logins.single.deviceType, DeviceType.DEVICE_TYPE_ANDROID);
    expect(h.auth.signedIn, isTrue);
    expect(h.auth.token, 'tok');
  });

  testWidgets('the device type follows the platform: iOS sends IOS', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await signIn(tester);
    expect(h.logins.single.deviceType, DeviceType.DEVICE_TYPE_IOS);
    debugDefaultTargetPlatformOverride = null; // the test binding checks this before tearDown runs
  });

  testWidgets('the device name can be changed', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await enter(tester, 'device-name', 'Kitchen phone');
    await signIn(tester);
    expect(h.logins.single.deviceName, 'Kitchen phone');
  });

  testWidgets('wrong password: the text, and the password field is emptied', (tester) async {
    final h = Harness();
    h.loginHandler = (_) => throw ConnectException(Code.unauthenticated, 'bad credentials');
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await signIn(tester);
    expect(shows('Invalid email or password'), isTrue);
    expect(fieldText(tester, 'password'), '');
    expect(fieldText(tester, 'email'), 'a@b.c');
    expect(h.auth.signedIn, isFalse);
    expect(shows('Enter your password'), isFalse); // the emptied field is not a mistake to flag
  });

  testWidgets('ResourceExhausted shows the server message', (tester) async {
    final h = Harness();
    h.loginHandler = (_) => throw ConnectException(Code.resourceExhausted, 'too many attempts, try again in 30 s');
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await signIn(tester);
    expect(shows('too many attempts, try again in 30 s'), isTrue);
  });

  testWidgets('a disabled account and an unreachable server have their own text', (tester) async {
    final h = Harness();
    h.loginHandler = (_) => throw ConnectException(Code.permissionDenied, 'disabled');
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await signIn(tester);
    expect(shows('This account is disabled.'), isTrue);
    h.loginHandler = (_) => throw ConnectException(Code.unavailable, 'down');
    await signIn(tester);
    expect(shows('Could not reach the server'), isTrue);
    expect(shows('This account is disabled.'), isFalse);
  });

  testWidgets('empty fields are named and nothing is sent', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await tapText(tester, 'Sign in');
    expect(shows('Enter your email address.'), isTrue);
    expect(shows('Enter your password.'), isTrue);
    await enter(tester, 'device-name', '   ');
    await enter(tester, 'email', 'a@b.c');
    await enter(tester, 'password', 'secret');
    await tapText(tester, 'Sign in');
    expect(shows('Enter a name for this device.'), isTrue);
    expect(h.logins, isEmpty);
  });

  testWidgets('a reply without a session is an error, not a sign-in', (tester) async {
    final h = Harness();
    h.loginHandler = (_) => LoginResponse();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await signIn(tester);
    expect(h.auth.signedIn, isFalse);
    expect(shows('Something went wrong'), isTrue);
  });

  testWidgets('a double tap signs in once', (tester) async {
    final h = Harness();
    h.loginGate = Completer<void>(); // the server is slow to answer
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await enter(tester, 'email', 'a@b.c');
    await enter(tester, 'password', 'secret');
    await tester.tap(find.text('Sign in').last);
    await tester.pump();
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
    await tester.tap(find.text('Sign in').last, warnIfMissed: false);
    await tester.pump();
    expect(h.logins.length, 1);
    h.loginGate!.complete();
    await tester.pumpAndSettle();
    expect(h.logins.length, 1);
  });

  testWidgets('the keyboard\'s Done key cannot send a second sign-in while the first waits', (tester) async {
    final h = Harness();
    h.loginGate = Completer<void>();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await enter(tester, 'email', 'a@b.c');
    await enter(tester, 'password', 'secret');
    await tester.tap(find.text('Sign in').last);
    await tester.pump();
    await tester.tap(find.byKey(const Key('device-name')));
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(h.logins.length, 1);
    h.loginGate!.complete();
    await tester.pumpAndSettle();
  });

  testWidgets('regression: the fields form an autofill group so a password manager can offer and save the login', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    expect(find.byType(AutofillGroup), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const Key('email'))).autofillHints, [AutofillHints.username]);
    expect(tester.widget<TextField>(find.byKey(const Key('password'))).autofillHints, [AutofillHints.password]);
    expect(tester.widget<TextField>(find.byKey(const Key('email'))).keyboardType, TextInputType.emailAddress);
  });

  testWidgets('regression: a good sign-in lets the platform save the login, a refused one keeps the group open for the retry', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    List<Object?> finishes() => tester.testTextInput.log.where((c) => c.method == 'TextInput.finishAutofillContext').map((c) => c.arguments).toList();
    h.loginHandler = (_) => throw ConnectException(Code.unauthenticated, 'bad');
    await signIn(tester);
    expect(finishes(), isEmpty);
    h.loginHandler = (_) => LoginResponse(
      auth: AuthToken(
        token: 't',
        deviceId: 'd',
        user: User(id: 'u'),
      ),
    );
    await signIn(tester);
    expect(finishes(), [true]);
  });

  testWidgets('the device name stops at 100 characters, which is what the server accepts', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byKey(const Key('device-name'))).maxLength, 100);
  });

  testWidgets('a failure message stays in view on a small screen', (tester) async {
    tester.view.physicalSize = const Size(360, 420);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final h = Harness();
    h.loginHandler = (_) => throw ConnectException(Code.unauthenticated, 'bad');
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await enter(tester, 'email', 'a@b.c');
    await enter(tester, 'password', 'secret');
    await tester.ensureVisible(find.text('Sign in').last);
    await tester.tap(find.text('Sign in').last);
    await tester.pumpAndSettle();
    final rect = tester.getRect(find.text('Invalid email or password'));
    expect(rect.top, greaterThanOrEqualTo(0));
    expect(rect.bottom, lessThanOrEqualTo(420));
  });

  testWidgets('"Use another server" forgets the address', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    await tapText(tester, 'Use another server');
    expect(h.serverUrl.value, isNull);
  });

  testWidgets('the password is hidden', (tester) async {
    final h = Harness();
    await h.pump(tester, SignInScreen(deviceName: pixel));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byKey(const Key('password'))).obscureText, isTrue);
  });
}
