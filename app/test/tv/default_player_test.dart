import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/shell/app_shell.dart';

import '../queue/fakes.dart';

const playerScreen = 'PLAYER SCREEN';

Future<QueueRig> open(WidgetTester tester, {bool tv = true, bool withState = true}) async {
  final r = QueueRig(isTv: tv);
  await r.signIn('me');
  if (withState) r.setState(stateOf(player: 'tv', devices: [device('tv', 'Other TV')], now: nowPlaying(song('1', 'On air', 'Star'))));
  await r.pump(
    tester,
    AppShell(
      playerBuilder: (_) => Scaffold(
        appBar: AppBar(leading: const BackButton()),
        body: const Text(playerScreen),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return r;
}

void main() {
  testWidgets('on a TV the app opens in the player, as soon as the state is known', (tester) async {
    await open(tester);
    expect(find.text(playerScreen), findsOneWidget);
  });

  testWidgets('on a phone or tablet it opens on the library as before', (tester) async {
    await open(tester, tv: false);
    expect(find.text(playerScreen), findsNothing);
    expect(find.text('Search songs'), findsOneWidget);
  });

  testWidgets('it waits for the state: nothing opens while the server has not answered, then the player opens', (tester) async {
    final r = await open(tester, withState: false);
    expect(find.text(playerScreen), findsNothing);
    r.setState(stateOf());
    await tester.pumpAndSettle();
    expect(find.text(playerScreen), findsOneWidget);
  });

  testWidgets('regression: after Close the app stays on the library and later state changes do not open the player again', (tester) async {
    final r = await open(tester);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text(playerScreen), findsNothing);
    r.setState(stateOf(player: 'tv', devices: [device('tv', 'Other TV')], now: nowPlaying(song('2', 'Next', 'Star'))));
    await tester.pumpAndSettle();
    expect(find.text(playerScreen), findsNothing);
    expect(find.text('Search songs'), findsOneWidget);
  });

  testWidgets('opening in the player sends no command: it never starts music by itself', (tester) async {
    final r = await open(tester);
    expect(r.server.controls, isEmpty);
  });
}
