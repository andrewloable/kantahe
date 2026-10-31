// The whole phone app against a real Kantahe server with the web app and the synthetic library of
// kantahe-fixtures: server address, sign-in, search, queue an MP3 and a MIDI song, Play here, the player
// screen with the real web player in a WebView, and the state on the server. Run it with
// scripts/flutter-integration.sh (it starts the server and passes these values):
//
//   flutter test integration_test/flow_test.dart -d <device> \
//     --dart-define=SERVER_URL=http://10.0.2.2:8080 --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=...
//
// Without SERVER_URL the test is skipped.
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart' show DeviceType;
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/main.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');

Future<void> until(WidgetTester tester, bool Function() done, String what, {int seconds = 30}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (done()) return;
  }
  final texts = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
  fail('Timed out waiting for: $what. The screen shows: $texts');
}

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('server, sign-in, search, queue, Play here and the player', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(AppRoot(services: services, child: const KantaheApp()));
    await tester.pump();

    // 1. the server address
    expect(find.text('Connect to your server'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('server-url')), serverUrl);
    await tester.tap(find.text('Connect'));
    await until(tester, () => find.byKey(const Key('email')).evaluate().isNotEmpty, 'the sign-in screen');

    // 2. sign in
    await tester.enterText(find.byKey(const Key('email')), userEmail);
    await tester.enterText(find.byKey(const Key('password')), userPassword);
    await tester.tap(find.text('Sign in').last);
    await until(tester, () => find.byType(NavigationBar).evaluate().isNotEmpty, 'the app after signing in');

    // 3. search, then queue the MP3 and the MIDI entry of "Title 1" with a tap each
    await tester.enterText(find.byKey(const Key('search')), 'Title 1');
    await until(tester, () => find.bySemanticsLabel(RegExp('Add Title 1 by Artist 1 to the queue, MP3 file')).evaluate().isNotEmpty, 'the MP3 entry');
    await tester.tap(find.bySemanticsLabel(RegExp('Add Title 1 by Artist 1 to the queue, MP3 file')));
    await until(tester, () => shows('Added Title 1'), 'the added message');
    await tester.tap(find.bySemanticsLabel(RegExp('Add Title 1 by Artist 1 to the queue, MIDI file')));
    await tester.pump(const Duration(milliseconds: 500));

    // 4. the queue: both songs are there (the first may already be "now playing" if a player is open)
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Queue')));
    await until(tester, () => services.state.connected && services.state.state!.queue.length + (services.state.state!.hasNow() ? 1 : 0) >= 2, 'both songs in the queue');

    // 5. another device (a TV that stays connected) is the player; Play here takes the player over and opens the
    //    player screen. Plain Play would leave the TV as the player, so this also tells PLAY_HERE from PLAY.
    String? tvToken;
    final tv = Api(httpTransportFactory(apiInterceptors(ApiHandlers(token: () => tvToken, onUnauthenticated: () {}, onPasswordChange: () {})))(serverUrl));
    tvToken = (await tv.auth.login(LoginRequest(email: userEmail, password: userPassword, deviceName: 'Living room TV', deviceType: DeviceType.DEVICE_TYPE_ANDROID_TV))).auth.token;
    final tvStream = tv.session.watchState(WatchStateRequest()).listen((_) {}, onError: (Object _) {}); // keeps the TV online
    addTearDown(tvStream.cancel);
    await tv.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY_HERE));
    await until(tester, () => shows('on Living room TV'), 'the queue to say the TV plays');
    expect(services.state.state!.playerDeviceId, isNot(services.auth.deviceId));
    await tester.tap(find.text('Play here'));
    await until(tester, () => find.text('Close').evaluate().isNotEmpty, 'the player screen');
    final state = (await services.api.session.getState(GetStateRequest())).state;
    expect(state.playerDeviceId, services.auth.deviceId, reason: 'Play here must make this device the player');

    // 6. the real web player page signs in through the bridge and the song plays on the server's clock
    await tester.pump(const Duration(seconds: 1)); // the queue screen stays under the player until the route is done
    if (services.state.state?.status != PlayStatus.PLAY_STATUS_PLAYING) await tester.tap(find.text('Play').last);
    await until(tester, () => services.state.state?.status == PlayStatus.PLAY_STATUS_PLAYING, 'the state to say PLAYING', seconds: 60);

    // leaving the player leaves playback as it is
    await tester.tap(find.text('Close'));
    await tester.pump(const Duration(seconds: 1)); // not pumpAndSettle: the progress bar of the queue keeps animating
    expect(services.state.state!.playerDeviceId, services.auth.deviceId);

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
