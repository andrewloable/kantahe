import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/messages.dart';

Future<void> pumpMessage(WidgetTester tester, {String? actionLabel}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => showMessage(context, 'Done', actionLabel: actionLabel),
            child: const Text('go'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('go'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500)); // slides in
  await tester.pump(); // the rebuild after the slide-in starts the timer
}

Future<void> after(WidgetTester tester, Duration d) async {
  await tester.pump(d);
  await tester.pump(const Duration(milliseconds: 500)); // slides out
  await tester.pump();
}

void main() {
  testWidgets('a message without an action goes away after the default time', (tester) async {
    await pumpMessage(tester);
    expect(find.text('Done'), findsOneWidget);
    await after(tester, const Duration(seconds: 5));
    expect(find.text('Done'), findsNothing);
  });

  testWidgets('REGRESSION: a message with an action is still there after 5 seconds and goes away by itself after 9', (tester) async {
    await pumpMessage(tester, actionLabel: 'Undo');
    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(milliseconds: 500)); // an exit animation would have ended by now
    expect(find.text('Done'), findsOneWidget);
    await after(tester, const Duration(seconds: 4));
    expect(find.text('Done'), findsNothing);
  });
}
