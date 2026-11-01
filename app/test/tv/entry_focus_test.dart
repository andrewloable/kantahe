import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/tv/entry_focus.dart';

import '../library/fakes.dart';

Future<void> pumpPushed(WidgetTester tester, {required bool tv, required Widget page}) async {
  final services = await FakeLibrary().services(isTv: tv);
  await pumpScreen(
    tester,
    services,
    Builder(
      builder: (context) => TextButton(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => TvEntryFocus(child: page))),
        child: const Text('open'),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  tearDown(() => FocusManager.instance.highlightStrategy = FocusHighlightStrategy.automatic);

  testWidgets('on a TV the first control of a pushed screen gets the focus', (tester) async {
    await pumpPushed(
      tester,
      tv: true,
      page: Scaffold(
        body: Column(
          children: [
            TextButton(onPressed: () {}, child: const Text('first')),
            TextButton(onPressed: () {}, child: const Text('second')),
          ],
        ),
      ),
    );
    final focus = FocusManager.instance.primaryFocus;
    expect(focus, isNot(isA<FocusScopeNode>()));
    expect(
      find.descendant(of: find.widgetWithText(TextButton, 'first'), matching: find.byElementPredicate((e) => identical(e, focus?.context))),
      findsOneWidget,
    );
  });

  testWidgets('a control that asked for the focus itself keeps it', (tester) async {
    await pumpPushed(
      tester,
      tv: true,
      page: Scaffold(
        body: Column(
          children: [
            TextButton(onPressed: () {}, child: const Text('first')),
            TextButton(autofocus: true, onPressed: () {}, child: const Text('second')),
          ],
        ),
      ),
    );
    final focus = FocusManager.instance.primaryFocus;
    expect(
      find.descendant(of: find.widgetWithText(TextButton, 'second'), matching: find.byElementPredicate((e) => identical(e, focus?.context))),
      findsOneWidget,
    );
  });

  testWidgets('a screen without any control is left alone', (tester) async {
    await pumpPushed(tester, tv: true, page: const Scaffold(body: Text('nothing to focus')));
    expect(tester.takeException(), isNull);
  });

  testWidgets('on a phone nothing is focused by the helper', (tester) async {
    await pumpPushed(
      tester,
      tv: false,
      page: Scaffold(
        body: TextButton(onPressed: () {}, child: const Text('first')),
      ),
    );
    expect(FocusManager.instance.primaryFocus is FocusScopeNode || FocusManager.instance.primaryFocus == null, isTrue);
  });
}
