import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/me/history_screen.dart';

import 'fakes.dart';

Future<MeRig> open(WidgetTester tester, {MeRig? rig}) async {
  final r = rig ?? MeRig();
  await r.pump(tester, const HistoryScreen());
  await settle(tester);
  return r;
}

void main() {
  testWidgets('shows title, artist and the format badge', (tester) async {
    final r = MeRig();
    r.server.onHistory = (_) => (items: [entry(song('1', 'Yesterday', 'The Band'))], next: '');
    await open(tester, rig: r);
    expect(find.text('Yesterday'), findsOneWidget);
    expect(find.text('The Band'), findsOneWidget);
    expect(find.text('MP3'), findsOneWidget);
  });

  testWidgets('shows the score, "skipped", or that there was no score', (tester) async {
    final r = MeRig();
    r.server.onHistory = (_) => (
      items: [entry(song('1', 'Scored', 'A'), hasScore: true, score: 87), entry(song('2', 'Passed', 'B'), skipped: true), entry(song('3', 'Plain', 'C'))],
      next: '',
    );
    await open(tester, rig: r);
    expect(find.text('Score 87'), findsOneWidget);
    expect(find.text('skipped'), findsOneWidget);
    expect(find.text('No score'), findsOneWidget);
  });

  testWidgets('shows when it was, in the local time', (tester) async {
    final r = MeRig();
    r.server.onHistory = (_) => (items: [entry(song('1', 'A', 'B'), at: 1700000000)], next: '');
    await open(tester, rig: r);
    final t = DateTime.fromMillisecondsSinceEpoch(1700000000 * 1000);
    String two(int n) => n.toString().padLeft(2, '0');
    expect(find.text('${t.year}-${two(t.month)}-${two(t.day)} ${two(t.hour)}:${two(t.minute)}'), findsOneWidget);
  });

  testWidgets('pages with the returned token (Load more)', (tester) async {
    final r = MeRig();
    r.server.onHistory = (req) =>
        req.pageToken == '' ? (items: [entry(song('1', 'First', 'A'))], next: 'P2') : (items: [entry(song('2', 'Second', 'B'))], next: '');
    await open(tester, rig: r);
    await tester.tap(find.text('Load more'));
    await settle(tester);
    expect(r.server.historyRequests.map((q) => q.pageToken), ['', 'P2']);
    expect(find.text('Second'), findsOneWidget);
    expect(find.text('Load more'), findsNothing);
  });

  testWidgets('Sing again adds the song to the queue', (tester) async {
    final r = MeRig();
    r.server.onHistory = (_) => (items: [entry(song('00042', 'Yesterday', 'A'))], next: '');
    await open(tester, rig: r);
    await tester.tap(find.byTooltip('Sing Yesterday again'));
    await settle(tester);
    expect(r.server.added, ['00042']);
  });

  testWidgets('says so when nothing was sung yet', (tester) async {
    await open(tester);
    expect(shows('Nothing sung yet.'), isTrue);
  });
}
