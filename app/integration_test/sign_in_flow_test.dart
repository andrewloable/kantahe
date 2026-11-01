// Runs the real app against a real Kantahe server on a simulator, emulator or phone:
//
//   flutter test integration_test -d <device> \
//     --dart-define=SERVER_URL=http://127.0.0.1:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=... \
//     --dart-define=TEMP_EMAIL=... --dart-define=TEMP_PASSWORD=...
//
// USER_* is a normal account, TEMP_* an account whose password the admin marked "must change". Without
// SERVER_URL the test is skipped. It signs the device out and forgets the server address first.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/main.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');
const tempEmail = String.fromEnvironment('TEMP_EMAIL');
const tempPassword = String.fromEnvironment('TEMP_PASSWORD');

Future<void> until(WidgetTester tester, bool Function() done, String what) async {
  for (var i = 0; i < 150; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (done()) return;
  }
  final texts = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
  fail('Timed out waiting for: $what. The screen shows: $texts');
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('server address, sign-in, forced password change, live state stream', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(AppRoot(services: services, child: const KantaheApp()));
    await tester.pump();

    // 1. no address yet: the address screen; an address nobody answers on is refused
    expect(find.text('Connect to your server'), findsOneWidget);
    await until(tester, () => find.byKey(const Key('server-url')).evaluate().isNotEmpty, 'the address form (the run turns discovery off, so nothing is found)');
    await tester.enterText(find.byKey(const Key('server-url')), 'http://127.0.0.1:1');
    await tester.tap(find.text('Connect'));
    await until(tester, () => shows('Could not reach the server at http://127.0.0.1:1'), 'unreachable message');

    // 2. the real address moves on to sign-in, where the device name came from the phone
    await tester.enterText(find.byKey(const Key('server-url')), serverUrl);
    await tester.tap(find.text('Connect'));
    await until(tester, () => find.text('Sign in').evaluate().isNotEmpty, 'sign-in screen');
    await until(tester, () => tester.widget<TextField>(find.byKey(const Key('device-name'))).controller!.text.isNotEmpty, 'device name');

    // 3. a wrong password is refused and the field is emptied
    await tester.enterText(find.byKey(const Key('email')), userEmail);
    await tester.enterText(find.byKey(const Key('password')), 'not the password');
    await tester.tap(find.text('Sign in').last);
    await until(tester, () => shows('Invalid email or password'), 'wrong password message');
    expect(tester.widget<TextField>(find.byKey(const Key('password'))).controller!.text, '');

    // 4. the right one signs in: the app opens, the token sits in the keystore, the state stream is live
    await tester.enterText(find.byKey(const Key('password')), userPassword);
    await tester.tap(find.text('Sign in').last);
    await until(tester, () => find.text('Kantahe').evaluate().isNotEmpty, 'the signed-in app');
    expect(services.auth.signedIn, isTrue);
    expect(await SecureStore().read('kantahe.token'), services.auth.token);
    await until(tester, () => services.state.connected, 'WatchState to deliver a state');
    expect(services.state.state, isNotNull);

    // 5. signing out (as a refused session would) goes back to sign-in and closes the stream
    await services.auth.signOut();
    await until(tester, () => find.text('Sign in').evaluate().isNotEmpty, 'sign-in again');
    expect(services.state.connected, isFalse);
    expect(await SecureStore().read('kantahe.token'), isNull);

    // 6. a temporary password: only the change-password screen, then the app
    await tester.enterText(find.byKey(const Key('email')), tempEmail);
    await tester.enterText(find.byKey(const Key('password')), tempPassword);
    await tester.tap(find.text('Sign in').last);
    await until(tester, () => shows('Choose a new password to continue.'), 'forced password change');
    await tester.enterText(find.byKey(const Key('current')), tempPassword);
    await tester.enterText(find.byKey(const Key('new')), '$tempPassword-changed');
    await tester.enterText(find.byKey(const Key('confirm')), '$tempPassword-changed');
    await tester.tap(find.widgetWithText(FilledButton, 'Change password'));
    await until(tester, () => find.text('Kantahe').evaluate().isNotEmpty, 'the app after the change');
    await until(tester, () => services.state.connected, 'WatchState after the change');

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
