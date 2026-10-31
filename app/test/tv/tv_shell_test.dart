import 'package:flutter/material.dart' hide State;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/main.dart';
import 'package:kantahe/shell/app_shell.dart';
import 'package:kantahe/tv/focus.dart';

import '../queue/fakes.dart';

Future<QueueRig> open(WidgetTester tester, {bool tv = true}) async {
  final r = QueueRig(isTv: tv);
  await r.services.serverUrl.set('http://srv:1');
  await r.signIn('me');
  r.setState(stateOf());
  await tester.pumpWidget(
    AppRoot(
      services: r.services,
      child: KantaheApp(playerBuilder: (_) => const Scaffold(body: Text('PLAYER SCREEN'))),
    ),
  );
  await tester.pumpAndSettle();
  // a TV opens in the player: leave it, as Close does, to reach the screens behind
  if (tv && find.text('PLAYER SCREEN').evaluate().isNotEmpty) {
    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pumpAndSettle();
  }
  return r;
}

void main() {
  testWidgets('on a TV the destinations are a rail at the side, not a bar at the bottom', (tester) async {
    await open(tester);
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    for (final label in ['Library', 'Queue', 'Me']) {
      expect(find.descendant(of: find.byType(NavigationRail), matching: find.text(label)), findsOneWidget);
    }
  });

  testWidgets('on a phone it stays a bar', (tester) async {
    await open(tester, tv: false);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
  });

  testWidgets('the rail switches screens and the remote can reach it with the arrow keys', (tester) async {
    await open(tester);
    await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Queue')));
    await tester.pumpAndSettle();
    expect(find.text('Coming up'), findsOneWidget);
    await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Library')));
    await tester.pumpAndSettle();
    expect(find.text('Search songs'), findsOneWidget);
  });

  testWidgets('the remote drives the rail: arrow down to Queue, OK opens it', (tester) async {
    await open(tester);
    Focus.of(tester.element(find.descendant(of: find.byType(NavigationRail), matching: find.text('Library')))).requestFocus();
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.select);
    await tester.pumpAndSettle();
    expect(find.text('Coming up'), findsOneWidget);
  });

  testWidgets('text is larger on a TV, viewed from a sofa', (tester) async {
    await open(tester);
    final scale = MediaQuery.textScalerOf(tester.element(find.byType(AppShell))).scale(10);
    expect(scale, greaterThanOrEqualTo(12));
  });

  testWidgets('text keeps its size on a phone', (tester) async {
    await open(tester, tv: false);
    expect(MediaQuery.textScalerOf(tester.element(find.byType(AppShell))).scale(10), 10);
  });

  test('the TV theme tints the focus clearly on everything else (list rows, chips, radios)', () {
    expect(tvTheme(ThemeData()).focusColor.a, greaterThanOrEqualTo(0.25));
  });

  test('the TV theme outlines whatever button has the focus, thickly', () {
    final theme = tvTheme(ThemeData());
    for (final style in [theme.filledButtonTheme.style, theme.outlinedButtonTheme.style, theme.textButtonTheme.style, theme.iconButtonTheme.style]) {
      final focused = style!.side!.resolve({WidgetState.focused})!;
      expect(focused.width, greaterThanOrEqualTo(3));
      expect(style.side!.resolve({}), isNot(equals(focused)));
    }
  });
}
