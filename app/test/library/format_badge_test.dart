import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/format_badge.dart';

Future<void> pump(WidgetTester tester, Format f, {Brightness brightness = Brightness.light}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: ThemeData(brightness: brightness),
      home: Scaffold(body: FormatBadge(f)),
    ),
  );
  await tester.pumpAndSettle(); // a theme change is animated
}

Color background(WidgetTester tester) =>
    (tester.widget<DecoratedBox>(find.descendant(of: find.byType(FormatBadge), matching: find.byType(DecoratedBox))).decoration as BoxDecoration).color!;

void main() {
  testWidgets('says MP3 or MIDI in text', (tester) async {
    await pump(tester, Format.FORMAT_MP3);
    expect(find.text('MP3'), findsOneWidget);
    await pump(tester, Format.FORMAT_MIDI);
    expect(find.text('MIDI'), findsOneWidget);
  });

  testWidgets('says nothing for an unknown format', (tester) async {
    await pump(tester, Format.FORMAT_UNSPECIFIED);
    expect(find.byType(DecoratedBox), findsNothing);
    expect(find.text('MP3'), findsNothing);
  });

  testWidgets('the two formats look different, not only in words', (tester) async {
    await pump(tester, Format.FORMAT_MP3);
    final mp3 = background(tester);
    await pump(tester, Format.FORMAT_MIDI);
    expect(background(tester), isNot(mp3));
  });

  testWidgets('has a spoken label', (tester) async {
    await pump(tester, Format.FORMAT_MIDI);
    expect(find.bySemanticsLabel('MIDI file'), findsOneWidget);
  });

  testWidgets('uses exactly the palette, in light and dark themes', (tester) async {
    await pump(tester, Format.FORMAT_MP3);
    expect(background(tester), badgePalette.light.mp3.bg);
    await pump(tester, Format.FORMAT_MIDI, brightness: Brightness.dark);
    expect(background(tester), badgePalette.dark.midi.bg);
    expect(tester.widget<Text>(find.text('MIDI')).style!.color, badgePalette.dark.midi.fg);
  });

  test('every badge text reads at WCAG AA (4.5:1) in both themes', () {
    for (final pair in [badgePalette.light.mp3, badgePalette.light.midi, badgePalette.dark.mp3, badgePalette.dark.midi]) {
      expect(contrastRatio(pair.bg, pair.fg), greaterThanOrEqualTo(4.5));
    }
  });

  test('contrastRatio is the WCAG ratio', () {
    expect(contrastRatio(const Color(0xFF000000), const Color(0xFFFFFFFF)), closeTo(21, 0.01));
    expect(contrastRatio(const Color(0xFF777777), const Color(0xFF777777)), closeTo(1, 0.001));
    expect(contrastRatio(const Color(0xFFFFFFFF), const Color(0xFF000000)), closeTo(21, 0.01)); // order does not matter
  });
}
