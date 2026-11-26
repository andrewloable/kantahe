// Song tempo on a device (docs/PLAN.md, D15): the web player inside the app plays at NowPlaying.tempo_pct without changing the pitch, and shows nothing about it.
// The test plays a song of about nine seconds, sets the tempo to 75 percent from "another device" (the same call the queue screen makes), and measures how fast
// the song time moves between the player's position reports (GetState returns the last report as the pair position_ms and position_at_ms): about 0.75 of
// the wall time. The server must have the song with a vocals track (kantahe-fixtures -guide 90); scripts/legacy-webview-check.sh --tempo does all of it:
//
//   flutter test integration_test/tempo_flow_test.dart -d <device> --dart-define=SERVER_URL=http://10.0.2.2:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=... --dart-define=GUIDE_NUMBER=00090
//
// Without SERVER_URL the test is skipped.
import 'package:material_ui/material_ui.dart' hide State;
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

/// Lets real time pass (the page and the server run on it), drawing frames now and then.
Future<void> wait(WidgetTester tester, int ms) async {
  for (var i = 0; i < ms ~/ 100; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
    await tester.pump();
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the player plays at 75 percent when another device asks, and shows nothing about it', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.set(serverUrl);
    final login = await services.api.auth.login(
      LoginRequest(email: userEmail, password: userPassword, deviceName: 'integration test', deviceType: DeviceType.DEVICE_TYPE_ANDROID),
    );
    await services.auth.signIn(login.auth);
    for (var i = 0; i < 100 && !services.state.connected; i++) {
      await wait(tester, 100);
    }
    expect(services.state.connected, isTrue, reason: 'the state stream is up');

    await tester.pumpWidget(
      AppRoot(
        services: services,
        child: const MaterialApp(home: PlayerScreen()),
      ),
    );
    await wait(tester, 3000); // the page signs in with the token the app hands over
    await tester.runAsync(() async {
      // the song first: with nothing current it becomes the current one, and Play here then plays it (not a random song of three seconds)
      await services.api.session.addToQueue(AddToQueueRequest(number: guideNumber));
      await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY_HERE));
      await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY));
    });

    // the song plays: the player reports a position that moves
    Future<(int, int)> report() async {
      final s = (await services.api.session.getState(GetStateRequest())).state;
      expect(s.now.song.number, guideNumber, reason: 'the song of nine seconds is the one that plays');
      return (s.now.positionMs.toInt(), s.now.positionAtMs.toInt());
    }

    var first = (await tester.runAsync(report))!;
    for (var i = 0; i < 300 && first.$1 < 500; i++) {
      await wait(tester, 100);
      first = await tester.runAsync(report) ?? first;
    }
    expect(first.$1, greaterThanOrEqualTo(500), reason: 'the song is playing and reports its position');

    final before = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
    await tester.runAsync(() => services.api.session.setTempo(SetTempoRequest(pct: 75)));
    await wait(tester, 2000); // the page has the new state and the rate
    final a = (await tester.runAsync(report))!;
    await wait(tester, 4000);
    final b = (await tester.runAsync(report))!;
    final wall = b.$2 - a.$2;
    expect(wall, greaterThan(2000), reason: 'two reports far enough apart');
    final speed = (b.$1 - a.$1) / wall;
    debugPrint('S4I tempo: song time moved ${b.$1 - a.$1} ms in $wall ms of wall time: speed $speed');
    expect(speed, inInclusiveRange(0.6, 0.9), reason: 'the song plays at about 75 percent (1.0 would be normal speed)');
    expect(services.state.state!.now.tempoPct, 75);

    // the player screen shows nothing about it
    expect(find.textContaining('empo'), findsNothing);
    expect(find.text('Slower'), findsNothing);
    final after = find.byType(Text).evaluate().map((e) => (e.widget as Text).data).whereType<String>().toList();
    expect(after, before, reason: 'no new text on the player screen');

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
