// Runs the TV app against a real Kantahe server on an Android TV emulator or box (it expects the TV to
// report the leanback feature; on a phone the test fails at the first check):
//
//   flutter test integration_test/tv_flow_test.dart -d <device> \
//     --dart-define=SERVER_URL=http://10.0.2.2:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=...
//
// The server's library holds the synthetic songs of kantahe-fixtures. The test plays the person with a phone: it
// reads the code the TV shows and approves it through the API. Without SERVER_URL the test is skipped.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/main.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');

Future<void> until(WidgetTester tester, bool Function() done, String what) async {
  for (var i = 0; i < 150; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (done()) return;
  }
  final texts = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
  fail('Timed out waiting for: $what. The screen shows: $texts. The focus is on: ${FocusManager.instance.primaryFocus} (scope: ${FocusManager.instance.primaryFocus?.enclosingScope})');
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

/// The song row of [title] holds the focus.
bool focused(WidgetTester tester, String title) => Focus.of(tester.element(find.text(title).first)).hasPrimaryFocus;

Future<void> key(WidgetTester tester, LogicalKeyboardKey k) async {
  await tester.sendKeyEvent(k);
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('a TV signs in with a code and is driven with the remote', (tester) async {
    final services = await AppServices.create();
    expect(services.isTv, isTrue, reason: 'the platform did not report the leanback feature: run this on an Android TV');
    await services.auth.signOut();
    await services.serverUrl.set(serverUrl);

    // the phone: a plain client that signs in as the user
    String? phoneToken;
    final phone = Api(
      FollowingTransport(
        () => serverUrl,
        httpTransportFactory(apiInterceptors(ApiHandlers(token: () => phoneToken, onUnauthenticated: () {}, onPasswordChange: () {}))),
      ),
    );
    phoneToken = (await phone.auth.login(
      LoginRequest(email: userEmail, password: userPassword, deviceName: 'test phone', deviceType: DeviceType.DEVICE_TYPE_ANDROID),
    )).auth.token;

    await tester.pumpWidget(AppRoot(services: services, child: const KantaheApp()));

    // 1. no session: the code screen, with a six character code
    await until(tester, () => find.byKey(const Key('login-code')).evaluate().isNotEmpty, 'the code');
    final code = (tester.widget<Text>(find.byKey(const Key('login-code'))).data)!;
    expect(code.length, 6);
    expect(shows('Sign in to Kantahe'), isTrue);

    // 2. the phone approves it: the TV signs in, opens the player by itself, and after Close shows the library with the remote on the first song
    final approved = await phone.auth.approveCode(ApproveCodeRequest(code: code));
    expect(approved.deviceName, isNotEmpty);
    await until(tester, () => services.auth.signedIn && find.byType(NavigationRail).evaluate().isNotEmpty, 'the signed-in TV app');
    // a TV opens the player by itself, once per start (AppShell._openPlayerOnTv), and it covers the library: the test
    // notes that on purpose, then closes it with the remote as a person does
    await until(tester, () => find.text('Close').evaluate().isNotEmpty, 'the player that opens by itself');
    expect(find.text('Close'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1)); // the page has finished arriving: before that the keys go to the library underneath
    // Left from Play reaches Close at the top left (measured on a BRAVIA: Up from Play does not). While a song plays here
    // the controls fade away after 4 s and the first key only wakes them and puts the focus on Play/Pause (the first
    // Left is then used up): so press Left until Close has the focus, then OK
    for (var i = 0; i < 4 && !focused(tester, 'Close'); i++) {
      await key(tester, LogicalKeyboardKey.arrowLeft);
    }
    if (!focused(tester, 'Close')) debugDumpFocusTree();
    expect(focused(tester, 'Close'), isTrue, reason: 'the remote reached Close; the focus is on ${FocusManager.instance.primaryFocus} (${FocusManager.instance.primaryFocus?.rect}); the screen shows ${find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList()}');
    await key(tester, LogicalKeyboardKey.select);
    await until(tester, () => find.text('Close').evaluate().isEmpty, 'the player closed');
    await until(tester, () => shows('Title 1') && shows('Title 3'), 'the library');
    await until(tester, () => focused(tester, 'Title 1'), 'the first song focused');

    // 3. arrow down moves one song at a time, OK queues the focused one
    await key(tester, LogicalKeyboardKey.arrowDown);
    expect(focused(tester, 'Title 2'), isTrue);
    await key(tester, LogicalKeyboardKey.select);
    await until(tester, () => shows('Added Title 2'), 'the confirmation');
    final queue = (await phone.session.getState(GetStateRequest())).state.queue;
    expect(queue.map((i) => i.song.number), contains('00002'));

    // 4. left reaches the rail (at the destination nearest in height, here Me, the last of three), up twice
    // is Library, down is Queue and OK opens it
    await key(tester, LogicalKeyboardKey.arrowLeft);
    expect(FocusManager.instance.primaryFocus!.rect.right, lessThan(100), reason: 'the focus is in the rail at the left');
    await key(tester, LogicalKeyboardKey.arrowUp);
    await key(tester, LogicalKeyboardKey.arrowUp);
    await key(tester, LogicalKeyboardKey.arrowDown);
    await key(tester, LogicalKeyboardKey.select);
    await until(tester, () => shows('Coming up'), 'the queue screen');
    expect(shows('Title 2'), isTrue);

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
