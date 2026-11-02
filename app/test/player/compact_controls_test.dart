import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/player/compact_controls.dart';
import 'package:kantahe/tv/focus.dart';

/// A button as the player draws it, inside the way the app sets a TV up (the TV theme and its larger text).
Future<({double height, double scale})> measure(WidgetTester tester, {required bool tv}) async {
  final base = ThemeData();
  late BuildContext label;
  await tester.pumpWidget(
    MaterialApp(
      theme: tv ? tvTheme(base) : base,
      builder: (context, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: tv ? media.copyWith(textScaler: TextScaler.linear(tvTextScale)) : media,
          child: child!,
        );
      },
      home: Scaffold(
        body: CompactControls(
          tv: tv,
          child: OutlinedButton(
            onPressed: () {},
            child: Builder(
              builder: (context) {
                label = context;
                return const Text('Pause');
              },
            ),
          ),
        ),
      ),
    ),
  );
  return (height: tester.getSize(find.byType(OutlinedButton)).height, scale: MediaQuery.textScalerOf(label).scale(10));
}

void main() {
  testWidgets('tv_buttons_are_smaller: the TV buttons are shorter than the default and their text is not enlarged for the sofa', (tester) async {
    final tv = await measure(tester, tv: true);
    expect(tv.height, lessThanOrEqualTo(36.5));
    expect(tv.scale, closeTo(10, 0.01), reason: 'the 1.25 of the TV is taken out again');
  });

  testWidgets('a phone or tablet is unchanged: the default height and the system text scale', (tester) async {
    final phone = await measure(tester, tv: false);
    expect(phone.height, greaterThanOrEqualTo(40));
    expect(phone.scale, closeTo(10, 0.01));
  });

  testWidgets('without the wrapper a TV button is as large as before (the size comes from the wrapper)', (tester) async {
    final base = ThemeData();
    await tester.pumpWidget(
      MaterialApp(
        theme: tvTheme(base),
        home: Scaffold(
          body: OutlinedButton(onPressed: () {}, child: const Text('Pause')),
        ),
      ),
    );
    expect(tester.getSize(find.byType(OutlinedButton)).height, greaterThanOrEqualTo(40));
  });

  testWidgets('tv_buttons_keep_the_focus_look: the focused TV button keeps the inverse fill of the TV theme', (tester) async {
    final base = ThemeData();
    final node = FocusNode();
    addTearDown(node.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: tvTheme(base),
        home: Scaffold(
          body: CompactControls(
            tv: true,
            child: OutlinedButton(focusNode: node, onPressed: () {}, child: const Text('Pause')),
          ),
        ),
      ),
    );
    node.requestFocus();
    await tester.pumpAndSettle();
    final material = tester.widget<Material>(find.descendant(of: find.byType(OutlinedButton), matching: find.byType(Material)).first);
    expect(material.color, base.colorScheme.inverseSurface);
  });
}
