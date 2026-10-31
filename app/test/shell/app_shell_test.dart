import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/shell/app_shell.dart';

import '../queue/fakes.dart';

Future<QueueRig> open(WidgetTester tester, {WidgetBuilder? playerBuilder}) async {
  final r = QueueRig();
  await r.signIn('me');
  r.setState(stateOf(player: 'tv', devices: [device('tv', 'TV')], now: nowPlaying(song('1', 'On air', 'Star'))));
  await r.pump(tester, AppShell(playerBuilder: playerBuilder ?? (_) => const Scaffold(body: Text('PLAYER SCREEN'))));
  await tester.pump();
  return r;
}

void main() {
  testWidgets('three destinations: Library, Queue and Me; the library comes first', (tester) async {
    await open(tester);
    expect(find.descendant(of: find.byType(NavigationBar), matching: find.text('Library')), findsOneWidget);
    expect(find.descendant(of: find.byType(NavigationBar), matching: find.text('Queue')), findsOneWidget);
    expect(find.descendant(of: find.byType(NavigationBar), matching: find.text('Me')), findsOneWidget);
    expect(find.text('Search songs'), findsOneWidget); // the library screen
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
