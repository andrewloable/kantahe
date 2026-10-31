// Runs the queue screen against a real Kantahe server (the synthetic library of kantahe-fixtures) with the
// real state stream:
//
//   flutter test integration_test/queue_flow_test.dart -d <device> \
//     --dart-define=SERVER_URL=http://127.0.0.1:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=...
//
// USER_* is a normal account. Without SERVER_URL the test is skipped. It signs in through the API first.
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/queue/queue_screen.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');

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

  testWidgets('queue, move to top, remove and undo, devices and Play here against the real server', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.set(serverUrl);
    final login = await services.api.auth.login(LoginRequest(email: userEmail, password: userPassword, deviceName: 'integration test', deviceType: DeviceType.DEVICE_TYPE_ANDROID));
    await services.auth.signIn(login.auth); // the state store follows this and opens the real WatchState stream
    for (final n in ['00001', '00002', '00003']) {
      await services.api.session.addToQueue(AddToQueueRequest(number: n));
    }

    await tester.pumpWidget(AppRoot(services: services, child: MaterialApp(home: QueueScreen(playerBuilder: (_) => const Scaffold(body: Text('PLAYER SCREEN'))))));

    // 1. the queue arrives through the stream (the first song may already have started: it moves to now playing)
    await until(tester, () => services.state.connected && shows('Coming up') && (shows('Title 2') || shows('Title 3')), 'the queue from the stream');
    expect(shows('Devices'), isTrue);
    expect(find.text('(this device)'), findsOneWidget);

    // 2. Move to top changes the order on the server
    final before = services.state.state!.queue.map((q) => q.song.number).toList();
    expect(before.length, greaterThanOrEqualTo(2));
    final last = services.state.state!.queue.last;
    await tester.tap(find.byTooltip('Move ${last.song.title} to the top of the queue'));
    await until(tester, () => services.state.state!.queue.first.id == last.id, 'the moved song at the top');

    // 3. Remove drops the song, Undo adds it back at the end
    final victim = services.state.state!.queue.last;
    await tester.tap(find.byTooltip('Remove ${victim.song.title} from the queue'));
    await until(tester, () => !services.state.state!.queue.any((q) => q.id == victim.id) && shows('Removed ${victim.song.title}'), 'the song to be removed');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('Undo'));
    await until(tester, () => services.state.state!.queue.any((q) => q.song.number == victim.song.number), 'the song back in the queue');
    expect(services.state.state!.queue.last.song.number, victim.song.number);

    // 4. Play here makes this device the player and opens the player route
    await tester.tap(find.text('Play here'));
    await until(tester, () => shows('PLAYER SCREEN'), 'the player route');
    expect(services.state.state!.playerDeviceId, services.auth.deviceId);

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
