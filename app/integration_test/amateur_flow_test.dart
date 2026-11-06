// Amateur singer mode on a device (docs/PLAN.md, "Amateur singer mode"): the web player inside the app plays the guide vocals by itself, and the app's
// own Vocals button follows it with no code of its own: "Vocals: on" while the first two lyric lines play, "Vocals: off" after the third line has started.
// The server must have the mode switched on and a song with a vocals track and four lyric lines (kantahe-fixtures -guide 90); scripts/legacy-webview-check.sh
// --amateur does all of it:
//
//   flutter test integration_test/amateur_flow_test.dart -d <device> --dart-define=SERVER_URL=http://10.0.2.2:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=... --dart-define=GUIDE_NUMBER=00090
//
// Without SERVER_URL the test is skipped.
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/player/player_screen.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');
const guideNumber = String.fromEnvironment('GUIDE_NUMBER');

Future<void> until(WidgetTester tester, bool Function() done, String what, {int seconds = 40}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (done()) return;
  }
  final texts = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
  fail('Timed out waiting for: $what. The screen shows: $texts');
}

bool shows(String text) => find.text(text).evaluate().isNotEmpty;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the guide vocals play by themselves in the first two lines and the Vocals button follows', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.set(serverUrl);
    final login = await services.api.auth.login(
      LoginRequest(email: userEmail, password: userPassword, deviceName: 'integration test', deviceType: DeviceType.DEVICE_TYPE_ANDROID),
    );
    await services.auth.signIn(login.auth);
    await until(tester, () => services.state.connected, 'the state stream');

    await tester.pumpWidget(
      AppRoot(
        services: services,
        child: const MaterialApp(home: PlayerScreen()),
      ),
    );
    await tester.pump(const Duration(seconds: 3)); // the page signs in with the token the app hands over
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY_HERE));
    await services.api.session.addToQueue(AddToQueueRequest(number: guideNumber));
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY));

    // nobody pressed Vocals: the page starts the voice by itself and tells the app
    await until(tester, () => shows('Vocals: on') || shows('Vocals: loading…'), 'the vocals to start by themselves');
    debugPrint('S4I guide: vocals started by themselves');
    await until(tester, () => shows('Vocals: on'), 'Vocals: on');
    // after the third line has started (3 s) the voice is gone, while the song goes on
    await until(tester, () => shows('Vocals: off'), 'the vocals to stop at the third line', seconds: 20);
    expect(services.state.state!.status, PlayStatus.PLAY_STATUS_PLAYING, reason: 'the song itself went on');
    debugPrint('S4I guide: vocals stopped at the third line');

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
