// Runs the player screen, with the real web player page in a real WebView, against a real Kantahe server that
// serves the web app (the synthetic library of kantahe-fixtures: short MP3 and MIDI songs with lyrics):
//
//   flutter test integration_test/player_flow_test.dart -d <device> \
//     --dart-define=SERVER_URL=http://10.0.2.2:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=...
//
// The test queues one MP3 and one MIDI song, makes this device the player and waits until both have been played
// through the page. Without SERVER_URL the test is skipped. It signs in through the API first.
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/player/player_screen.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');

Future<void> until(WidgetTester tester, bool Function() done, String what, {int seconds = 60}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (done()) return;
  }
  fail('Timed out waiting for: $what');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the web player page plays an MP3 and a MIDI song for this device', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.set(serverUrl);
    final login = await services.api.auth.login(LoginRequest(email: userEmail, password: userPassword, deviceName: 'integration test', deviceType: DeviceType.DEVICE_TYPE_ANDROID));
    await services.auth.signIn(login.auth);

    Future<Song> first(Format f) async => (await services.api.catalog.searchSongs(SearchSongsRequest(format: f))).songs.first;
    final mp3 = await first(Format.FORMAT_MP3);
    final midi = await first(Format.FORMAT_MIDI);
    debugPrint('S4I songs: mp3 ${mp3.number} "${mp3.title}", midi ${midi.number} "${midi.title}"');
    await until(tester, () => services.state.connected, 'the state stream');

    await tester.pumpWidget(AppRoot(services: services, child: const MaterialApp(home: PlayerScreen())));

    // the page signs in with the token the app hands over, then this device takes over as the player
    await tester.pump(const Duration(seconds: 3));
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY_HERE));
    await services.api.session.addToQueue(AddToQueueRequest(number: mp3.number));
    await services.api.session.addToQueue(AddToQueueRequest(number: midi.number));
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY));

    final played = <String>{};
    var sawPlaying = false;
    await until(tester, () {
      final s = services.state.state;
      if (s != null && s.hasNow()) played.add('${s.now.song.number}/${s.now.song.format.name}');
      if (s != null && s.status == PlayStatus.PLAY_STATUS_PLAYING) sawPlaying = true;
      return played.any((p) => p.endsWith('FORMAT_MP3')) && played.any((p) => p.endsWith('FORMAT_MIDI'));
    }, 'both songs to become the current song', seconds: 90);
    debugPrint('S4I played: $played, playing seen: $sawPlaying');
    expect(sawPlaying, isTrue);
    expect(services.state.state!.playerDeviceId, services.auth.deviceId);

    // let the last song run to its end (the page reports the end, the queue empties)
    await until(tester, () => services.state.state!.queue.isEmpty && services.state.state!.status != PlayStatus.PLAY_STATUS_UNSPECIFIED, 'the queue to be played', seconds: 60);
    await tester.pump(const Duration(seconds: 2));

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
