import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/me/appearance_screen.dart';

import '../library/fakes.dart';

Future<AppServices> open(WidgetTester tester) async {
  final services = await FakeLibrary().services();
  await pumpScreen(tester, services, const AppearanceScreen());
  await settle(tester);
  return services;
}

ListTile tile(WidgetTester tester, String title) => tester.widget<ListTile>(find.widgetWithText(ListTile, title));

void main() {
  testWidgets('offers Auto (system), Light and Dark, with the current one marked', (tester) async {
    await open(tester);
    expect(find.text('Auto (system)'), findsOneWidget);
    expect(find.text('Light'), findsOneWidget);
    expect(find.text('Dark'), findsOneWidget);
    expect(tile(tester, 'Auto (system)').selected, isTrue);
    expect(tile(tester, 'Dark').selected, isFalse);
  });

  testWidgets('choosing Dark changes the setting and the mark', (tester) async {
    final services = await open(tester);
    await tester.tap(find.text('Dark'));
    await settle(tester);
    expect(services.theme.mode, ThemeMode.dark);
    expect(tile(tester, 'Dark').selected, isTrue);
    expect(tile(tester, 'Auto (system)').selected, isFalse);
    await tester.tap(find.text('Light'));
    await settle(tester);
    expect(services.theme.mode, ThemeMode.light);
  });
}
