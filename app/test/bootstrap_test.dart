import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/auth_gate.dart';
import 'package:kantahe/bootstrap.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/brand.dart';

import 'auth/harness.dart';

/// A stand-in for the app: it says whether the services say TV.
Widget standIn(AppServices s) => Text('the app, tv: ${s.isTv}', textDirection: TextDirection.ltr);

class Factory {
  Factory(this.make);

  final Future<AppServices> Function(int call) make;
  int calls = 0;

  Future<AppServices> call() => make(++calls);
}

void main() {
  testWidgets('the first frame is the splash, and the app waits for the services', (tester) async {
    final semantics = tester.ensureSemantics();
    final h = Harness();
    final factory = Factory((_) => Future<AppServices>.delayed(const Duration(milliseconds: 500), () => h.services));
    await tester.pumpWidget(Bootstrap(create: factory.call, app: standIn));

    // the logo, named for a screen reader, on the official splash colour
    expect(find.bySemanticsLabel('Kantahe'), findsOneWidget);
    expect(find.image(const AssetImage(kSplashLogoAsset)), findsOneWidget);
    final background = tester.widget<ColoredBox>(find.byType(ColoredBox).first);
    expect(background.color, kSplashBackground);
    expect(kSplashBackground, const Color(0xFF0A0E22));
    // nothing of the app is built yet: no MaterialApp, no sign-in gate, not even the stand-in
    expect(find.byType(MaterialApp), findsNothing);
    expect(find.byType(AuthGate), findsNothing);
    expect(find.textContaining('the app'), findsNothing);
    expect(factory.calls, 1);

    await tester.pump(const Duration(milliseconds: 499));
    expect(find.textContaining('the app'), findsNothing, reason: 'the app must not show before the services are ready');
    await tester.pump(const Duration(milliseconds: 2));
    expect(find.textContaining('the app'), findsOneWidget);
    expect(find.bySemanticsLabel('Kantahe'), findsNothing, reason: 'the splash is gone');
    expect(find.byType(Image), findsNothing);
    expect(factory.calls, 1, reason: 'the services are made once');
    semantics.dispose();
  });

  testWidgets('the services are made once, however often the splash is rebuilt', (tester) async {
    final h = Harness();
    final gate = Completer<AppServices>();
    final factory = Factory((_) => gate.future);
    await tester.pumpWidget(Bootstrap(create: factory.call, app: standIn));
    for (var i = 0; i < 3; i++) {
      await tester.pumpWidget(Bootstrap(create: factory.call, app: standIn)); // a parent that rebuilds
      await tester.pump();
    }
    expect(factory.calls, 1);
    gate.complete(h.services);
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('the app'), findsOneWidget);
    expect(factory.calls, 1);
  });

  testWidgets('the splash has nothing to focus', (tester) async {
    final factory = Factory((_) => Completer<AppServices>().future);
    await tester.pumpWidget(Bootstrap(create: factory.call, app: standIn));
    expect(tester.binding.focusManager.rootScope.traversalDescendants.where((n) => n is! FocusScopeNode), isEmpty);
  });

  testWidgets('a start that fails says so and offers Retry, which has the focus', (tester) async {
    final h = Harness();
    final factory = Factory((call) => call == 1 ? Future<AppServices>.error(StateError('no keystore')) : Future<AppServices>.value(h.services));
    await tester.pumpWidget(Bootstrap(create: factory.call, app: standIn));
    await tester.pump();

    expect(find.text('Kantahe could not start.'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
    expect(find.textContaining('the app'), findsNothing);
    expect(find.textContaining('no keystore'), findsNothing, reason: 'no technical text on a TV screen');
    final focusable = tester.binding.focusManager.rootScope.traversalDescendants.where((n) => n is! FocusScopeNode).toList();
    expect(focusable, hasLength(1), reason: 'Retry is the only focusable thing');
    expect(focusable.single.hasPrimaryFocus, isTrue);

    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();
    expect(factory.calls, 2);
    expect(find.textContaining('the app'), findsOneWidget, reason: 'a second try that works shows the app');
    expect(find.text('Kantahe could not start.'), findsNothing);
  });

  testWidgets('Select on the remote presses Retry', (tester) async {
    final h = Harness();
    final factory = Factory((call) => call < 3 ? Future<AppServices>.error(StateError('down')) : Future<AppServices>.value(h.services));
    await tester.pumpWidget(Bootstrap(create: factory.call, app: standIn));
    await tester.pump();
    expect(find.text('Retry'), findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.select);
    await tester.pump();
    await tester.pump();
    expect(factory.calls, 2, reason: 'Select pressed Retry once');
    expect(find.text('Kantahe could not start.'), findsOneWidget, reason: 'the second try failed too');

    await tester.sendKeyEvent(LogicalKeyboardKey.select);
    await tester.pump();
    await tester.pump();
    expect(factory.calls, 3);
    expect(find.textContaining('the app'), findsOneWidget);
  });

  testWidgets('a factory that throws at once is a failed start, not a crash', (tester) async {
    await tester.pumpWidget(Bootstrap(create: () => throw StateError('at once'), app: standIn));
    await tester.pump();
    expect(find.text('Kantahe could not start.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final tv in [true, false]) {
    testWidgets('the services decide the shell: isTv $tv', (tester) async {
      final h = Harness(tv: tv);
      final factory = Factory((_) async => h.services);
      await tester.pumpWidget(Bootstrap(create: factory.call, app: standIn));
      await tester.pump();
      expect(find.text('the app, tv: $tv'), findsOneWidget);
    });
  }
}
