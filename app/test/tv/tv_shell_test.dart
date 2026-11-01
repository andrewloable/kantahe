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

  group('the rail keeps UP and DOWN to itself', () {
    FocusNode railNode(WidgetTester tester, String label) =>
        Focus.of(tester.element(find.descendant(of: find.byType(NavigationRail), matching: find.text(label))));
    bool inRail(WidgetTester tester) {
      final context = FocusManager.instance.primaryFocus?.context;
      return context != null &&
          find.descendant(of: find.byType(NavigationRail), matching: find.byElementPredicate((e) => identical(e, context))).evaluate().isNotEmpty;
    }

    testWidgets('REGRESSION: DOWN on the last item (Me) stays on it, and UP on the first item (Library) stays on it', (tester) async {
      await open(tester);
      final me = railNode(tester, 'Me');
      me.requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, same(me), reason: 'DOWN on Me must not leave the rail');
      final library = railNode(tester, 'Library');
      library.requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, same(library), reason: 'UP on Library must not leave the rail');
    });

    testWidgets('UP and DOWN between the items still work, RIGHT enters the content and LEFT comes back to the rail', (tester) async {
      await open(tester);
      railNode(tester, 'Library').requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, same(railNode(tester, 'Queue')));
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, same(railNode(tester, 'Me')));
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
      await tester.pump();
      expect(FocusManager.instance.primaryFocus, same(railNode(tester, 'Queue')));
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(inRail(tester), isFalse, reason: 'RIGHT enters the content');
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.pump();
      expect(inRail(tester), isTrue, reason: 'LEFT comes back to the rail');
    });
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

  testWidgets('REGRESSION: the remote on a rail destination makes it a solid block with a bold label (the rail only tinted a small pill)', (tester) async {
    await open(tester);
    expect(find.byKey(const Key('rail-focus')), findsNothing);
    Focus.of(tester.element(find.descendant(of: find.byType(NavigationRail), matching: find.text('Queue')))).requestFocus();
    await tester.pump();
    await tester.pump();
    expect(find.byKey(const Key('rail-focus')), findsOneWidget);
    final label = tester.widget<Text>(find.descendant(of: find.byType(NavigationRail), matching: find.text('Queue')));
    expect(label.style?.fontWeight, FontWeight.w800);
    final other = tester.widget<Text>(find.descendant(of: find.byType(NavigationRail), matching: find.text('Library')));
    expect(other.style?.fontWeight, isNot(FontWeight.w800));
    final box = tester.widget<DecoratedBox>(find.byKey(const Key('rail-focus'))).decoration as BoxDecoration;
    final scheme = Theme.of(tester.element(find.byKey(const Key('rail-focus')))).colorScheme;
    expect(box.color, scheme.inverseSurface);
    expect(box.boxShadow!.single.color, scheme.surface);
  });
}
