import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/main.dart';

import 'queue/fakes.dart';

Future<QueueRig> open(WidgetTester tester, {bool tv = false}) async {
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

MaterialApp app(WidgetTester tester) => tester.widget<MaterialApp>(find.byType(MaterialApp));

void main() {
  for (final tv in [false, true]) {
    group(tv ? 'on a TV' : 'on a phone', () {
      testWidgets('follows the system until a choice is made', (tester) async {
        await open(tester, tv: tv);
        expect(app(tester).themeMode, ThemeMode.system);
        expect(app(tester).darkTheme, isNotNull);
      });

      testWidgets('Light, Dark and Auto apply at once, without a restart', (tester) async {
        final r = await open(tester, tv: tv);
        await r.services.theme.set(ThemeMode.dark);
        await tester.pumpAndSettle(); // the theme change is animated
        expect(app(tester).themeMode, ThemeMode.dark);
        expect(Theme.of(tester.element(find.byType(Scaffold).first)).brightness, Brightness.dark);
        await r.services.theme.set(ThemeMode.light);
        await tester.pumpAndSettle(); // the theme change is animated
        expect(Theme.of(tester.element(find.byType(Scaffold).first)).brightness, Brightness.light);
        await r.services.theme.set(ThemeMode.system);
        await tester.pumpAndSettle(); // the theme change is animated
        expect(app(tester).themeMode, ThemeMode.system);
      });
    });
  }

  testWidgets('the dark theme of a TV keeps the thick focus ring', (tester) async {
    await open(tester, tv: true);
    expect(app(tester).darkTheme!.outlinedButtonTheme.style, isNotNull);
    expect(app(tester).theme!.outlinedButtonTheme.style, isNotNull);
  });
}
