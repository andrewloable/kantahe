import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/shell/app_shell.dart';

import '../queue/fakes.dart';

const playerScreen = 'PLAYER SCREEN';

/// The app opens in the player; unless [keepPlayer], it is closed (as Close does) to reach the screens behind it.
Future<QueueRig> open(WidgetTester tester, {WidgetBuilder? playerBuilder, bool keepPlayer = false}) async {
  final r = QueueRig();
  await r.signIn('me');
  r.setState(stateOf(player: 'tv', devices: [device('tv', 'TV')], now: nowPlaying(song('1', 'On air', 'Star'))));
  await r.pump(
    tester,
    AppShell(
      playerBuilder:
          playerBuilder ??
          (_) => Scaffold(
            appBar: AppBar(leading: const BackButton()),
            body: const Text(playerScreen),
          ),
    ),
  );
  await tester.pumpAndSettle();
  if (!keepPlayer && find.text(playerScreen).evaluate().isNotEmpty) {
    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pumpAndSettle();
  }
  return r;
}

Finder inBar(String label) => find.descendant(of: find.byType(NavigationBar), matching: find.text(label));

void main() {
  testWidgets('four_destinations_in_order: Library, Queue, Player and Me, left to right; the library is shown', (tester) async {
    await open(tester);
    final xs = [
      for (final l in ['Library', 'Queue', 'Player', 'Me']) tester.getTopLeft(inBar(l)).dx,
    ];
    expect(xs, orderedEquals([...xs]..sort()), reason: 'the order of the labels');
    expect(xs.toSet(), hasLength(4));
    expect(find.text('Search songs'), findsOneWidget); // the library screen
  });

  testWidgets('opens_in_the_player_on_a_phone: as soon as the state is known, and it sends no command', (tester) async {
    final r = await open(tester, keepPlayer: true);
    expect(find.text(playerScreen), findsOneWidget);
    expect(r.server.controls, isEmpty);
  });

  testWidgets('player_destination_reopens_the_player_after_close', (tester) async {
    await open(tester);
    expect(find.text(playerScreen), findsNothing);
    expect(find.text('Search songs'), findsOneWidget);
    await tester.tap(inBar('Player'));
    await tester.pumpAndSettle();
    expect(find.text(playerScreen), findsOneWidget);
    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pumpAndSettle();
    expect(find.text(playerScreen), findsNothing);
    expect(find.text('Search songs'), findsOneWidget);
  });

  testWidgets('player_destination_keeps_the_selected_screen: Me stays the screen, and Player is not shown as selected', (tester) async {
    await open(tester);
    await tester.tap(inBar('Me'));
    await tester.pumpAndSettle();
    await tester.tap(inBar('Player'));
    await tester.pumpAndSettle();
    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pumpAndSettle();
    expect(find.text('Favourites'), findsOneWidget); // the Me screen
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.selectedIndex, 3); // Library 0, Queue 1, Player 2, Me 3
  });

  testWidgets('no_second_player_while_one_is_open', (tester) async {
    await open(tester);
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    bar.onDestinationSelected!(2);
    bar.onDestinationSelected!(2);
    await tester.pumpAndSettle();
    expect(find.text(playerScreen), findsOneWidget);
    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pumpAndSettle();
    expect(find.text(playerScreen), findsNothing, reason: 'one Close leaves the player: there was only one');
  });

  testWidgets('each destination shows its screen', (tester) async {
    await open(tester);
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Queue')));
    await tester.pumpAndSettle();
    expect(find.text('Coming up'), findsOneWidget);
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Me')));
    await tester.pumpAndSettle();
    expect(find.text('Favourites'), findsOneWidget);
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Library')));
    await tester.pumpAndSettle();
    expect(find.text('Search songs'), findsOneWidget);
  });

  testWidgets('Play here on the queue opens the player screen', (tester) async {
    final r = await open(tester);
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Queue')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Play here'));
    await tester.pumpAndSettle();
    expect(r.server.controls.length, 1);
    expect(find.text('PLAYER SCREEN'), findsOneWidget);
  });

  testWidgets('the screens that are left keep what they showed (the search text stays)', (tester) async {
    await open(tester);
    await tester.enterText(find.byKey(const Key('search')), 'abba');
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Me')));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Library')));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byKey(const Key('search'))).controller!.text, 'abba');
  });
}
