// Runs the library screens against a real Kantahe server whose library holds the synthetic songs of
// kantahe-fixtures (3 MP3 songs "Title 1".."Title 3" by "Artist 1".., 4 MIDI songs, the first in both formats):
//
//   flutter test integration_test/library_flow_test.dart -d <device> \
//     --dart-define=SERVER_URL=http://127.0.0.1:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=...
//
// USER_* is a normal account. Without SERVER_URL the test is skipped. It signs in through the API first.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/library/format_badge.dart';
import 'package:kantahe/library/library_screen.dart';

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

/// The badges in the list (the chips above it say MP3 and MIDI too).
Finder badge(String label) => find.descendant(of: find.byType(FormatBadge), matching: find.text(label));

bool shows(String text) => find.textContaining(text).evaluate().isNotEmpty;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('search, number pad, browse, queue and favourite against the real server', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.set(serverUrl);
    final login = await services.api.auth.login(LoginRequest(email: userEmail, password: userPassword, deviceName: 'integration test', deviceType: DeviceType.DEVICE_TYPE_ANDROID));
    await services.auth.signIn(login.auth);

    await tester.pumpWidget(AppRoot(services: services, child: const MaterialApp(home: LibraryScreen())));

    // 1. the library opens with every song
    await until(tester, () => shows('Title 1') && shows('Title 3'), 'the first page of the library');
    expect(badge('MIDI'), findsWidgets);
    expect(badge('MP3'), findsWidgets);

    // 2. a search narrows it down after the delay, and the format chip filters
    await tester.enterText(find.byKey(const Key('search')), 'Title 2');
    await until(tester, () => !shows('Title 1') && shows('Title 2'), 'the search result');
    await tester.enterText(find.byKey(const Key('search')), '');
    await until(tester, () => shows('Title 1') && shows('Title 3'), 'the whole library again');
    await tester.tap(find.widgetWithText(ChoiceChip, 'MIDI'));
    await until(tester, () => badge('MP3').evaluate().isEmpty && badge('MIDI').evaluate().isNotEmpty, 'only MIDI rows');
    await tester.tap(find.widgetWithText(ChoiceChip, 'All'));
    await until(tester, () => badge('MP3').evaluate().isNotEmpty, 'all formats again');

    // 3. the star saves a favourite on the server
    await tester.tap(find.byTooltip('Favourite: Title 1').first);
    await until(tester, () => find.byIcon(Icons.star).evaluate().isNotEmpty, 'the filled star');
    await Future<void>.delayed(const Duration(seconds: 1));
    final found = await services.api.catalog.searchSongs(SearchSongsRequest(query: 'Title 1'));
    expect(found.songs.any((s) => s.favourite), isTrue);

    // 4. the number pad finds a song by number and queues it
    await tester.tap(find.text('Number'));
    await tester.pump(const Duration(milliseconds: 500));
    for (final d in ['0', '0', '0', '0', '2']) {
      await tester.tap(find.widgetWithText(OutlinedButton, d));
      await tester.pump();
    }
    await until(tester, () => shows('Title 2'), 'the song with number 00002');
    await tester.tap(find.text('Add to queue'));
    await until(tester, () => tester.widget<Text>(find.byKey(const Key('digits'))).data == '', 'the pad to clear after adding');
    final state = await services.api.session.getState(GetStateRequest());
    expect(state.state.queue.map((q) => q.song.number), contains('00002'));

    // 5. browse by letter: titles, then artists with their song counts
    await tester.tap(find.text('Browse'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'T')); // the letters scroll sideways
    await tester.tap(find.widgetWithText(ChoiceChip, 'T'));
    await until(tester, () => shows('Title 1'), 'titles under T');
    await tester.tap(find.text('Artists'));
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'A'));
    await tester.tap(find.widgetWithText(ChoiceChip, 'A'));
    await until(tester, () => shows('Artist 1') && shows('song'), 'artists under A');
    await tester.tap(find.text('Artist 1'));
    await until(tester, () => shows('Back to artists') && shows('Title 1'), "the artist's songs");

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
