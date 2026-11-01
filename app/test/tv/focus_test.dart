import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/library/song_list.dart';
import 'package:kantahe/tv/focus.dart';

import '../library/fakes.dart';

class Rig {
  final fake = FakeLibrary();
  late LibraryActions actions;
}

Future<Rig> open(WidgetTester tester, {bool tv = true, int count = 4}) async {
  final r = Rig();
  final services = await r.fake.services(isTv: tv);
  r.actions = LibraryActions(api: services.api, auth: services.auth, notify: (m, {bool error = false}) {});
  final songs = [for (var i = 1; i <= count; i++) song('0000$i', 'Title $i', 'Artist $i')];
  await pumpScreen(
    tester,
    services,
    Scaffold(
      body: SongList(songs: songs, actions: r.actions),
    ),
  );
  await tester.pump();
  return r;
}

/// The row of [title] holds the focus (its tap target is the focused node).
bool focused(WidgetTester tester, String title) => Focus.of(tester.element(find.text(title))).hasPrimaryFocus;

void main() {
  testWidgets('on a TV the first song has the focus from the start', (tester) async {
    await open(tester);
    expect(focused(tester, 'Title 1'), isTrue);
  });

  testWidgets('on a phone nothing takes the focus by itself', (tester) async {
    await open(tester, tv: false);
    expect(focused(tester, 'Title 1'), isFalse);
  });

  testWidgets('arrow down moves the focus one song at a time, arrow up goes back', (tester) async {
    await open(tester);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    expect(focused(tester, 'Title 2'), isTrue);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    expect(focused(tester, 'Title 3'), isTrue);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
    await tester.pump();
    expect(focused(tester, 'Title 2'), isTrue);
  });

  testWidgets('OK (select) on a song adds it to the queue', (tester) async {
    final r = await open(tester);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.select);
    await settle(tester);
    expect(r.fake.adds.single.number, '00002');
  });

  testWidgets('the focused song shows a ring, the others do not', (tester) async {
    await open(tester);
    expect(ringsShown(tester), 1);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    expect(ringsShown(tester), 1);
  });

  testWidgets('FocusRing draws its border only while something inside has the focus', (tester) async {
    final inside = FocusNode();
    final outside = FocusNode();
    addTearDown(inside.dispose);
    addTearDown(outside.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              FocusRing(
                child: Focus(focusNode: inside, child: const SizedBox(width: 50, height: 50)),
              ),
              Focus(focusNode: outside, child: const SizedBox(width: 50, height: 50)),
            ],
          ),
        ),
      ),
    );
    expect(ringsShown(tester), 0);
    inside.requestFocus();
    await tester.pump();
    expect(ringsShown(tester), 1);
    outside.requestFocus();
    await tester.pump();
    await tester.pump(); // the ring learns of the loss of focus one frame later
    expect(ringsShown(tester), 0);
  });
  group('TV buttons stand out when they have the focus', () {
    double contrast(Color a, Color b) {
      final hi = a.computeLuminance() > b.computeLuminance() ? a : b;
      final lo = identical(hi, a) ? b : a;
      return (hi.computeLuminance() + 0.05) / (lo.computeLuminance() + 0.05);
    }

    for (final brightness in Brightness.values) {
      final base = ThemeData(brightness: brightness);
      final scheme = base.colorScheme;
      final theme = tvTheme(base);
      final kinds = {
        'filled': theme.filledButtonTheme.style!,
        'outlined': theme.outlinedButtonTheme.style!,
        'text': theme.textButtonTheme.style!,
        'icon': theme.iconButtonTheme.style!,
      };

      test('REGRESSION ($brightness): a focused button changes its colours, not only its border (a border in the fill colour was invisible)', () {
        for (final e in kinds.entries) {
          final focused = {WidgetState.focused};
          expect(e.value.backgroundColor!.resolve(focused), scheme.inverseSurface, reason: '${e.key} background');
          expect(e.value.foregroundColor!.resolve(focused), scheme.onInverseSurface, reason: '${e.key} text');
          // unfocused: the button keeps its own quiet look; a filled one is tonal, never the loud primary colour
          expect(e.value.backgroundColor!.resolve({}), e.key == 'filled' ? scheme.secondaryContainer : isNull, reason: '${e.key} unfocused');
        }
      });

      test('REGRESSION ($brightness): a disabled button keeps its dimmed default look (the tonal colour is for enabled buttons only)', () {
        for (final e in kinds.entries) {
          final disabled = {WidgetState.disabled};
          expect(e.value.backgroundColor!.resolve(disabled), isNull, reason: '${e.key} background');
          expect(e.value.foregroundColor!.resolve(disabled), isNull, reason: '${e.key} text');
        }
      });

      test('REGRESSION ($brightness): the focused segment of a segmented button is a solid block (the ring only surrounds the whole control)', () {
        final style = theme.segmentedButtonTheme.style!;
        final focused = {WidgetState.focused};
        expect(style.backgroundColor!.resolve(focused), scheme.inverseSurface);
        expect(style.foregroundColor!.resolve(focused), scheme.onInverseSurface);
        // selected or not, an unfocused segment keeps its own look (the check mark and fill of the selection)
        expect(style.backgroundColor!.resolve({WidgetState.selected}), isNull);
        expect(style.foregroundColor!.resolve({WidgetState.selected}), isNull);
        // focused and selected: still the focus look (the selection stays shown by its check mark)
        expect(style.backgroundColor!.resolve({WidgetState.focused, WidgetState.selected}), scheme.inverseSurface);
      });

      test('($brightness) the focused look has a thick border in the opposite tone, so it also shows on a dark or light picture', () {
        for (final e in kinds.entries) {
          final side = e.value.side!.resolve({WidgetState.focused})!;
          expect(side.width, greaterThanOrEqualTo(4), reason: e.key);
          expect(side.color, scheme.surface, reason: e.key);
          expect(e.value.side!.resolve({}), isNull, reason: '${e.key} unfocused');
        }
      });

      test('($brightness) the focused background contrasts at least 3:1 with the surface and with an unfocused filled button', () {
        expect(contrast(scheme.inverseSurface, scheme.surface), greaterThanOrEqualTo(3));
        expect(contrast(scheme.inverseSurface, scheme.secondaryContainer), greaterThanOrEqualTo(3));
        expect(contrast(scheme.inverseSurface, scheme.onInverseSurface), greaterThanOrEqualTo(4.5), reason: 'the text on it');
      });
    }

    testWidgets('FocusGrow makes only the focused control larger, by a clear step', (tester) async {
      final a = FocusNode();
      final b = FocusNode();
      addTearDown(a.dispose);
      addTearDown(b.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                FocusGrow(
                  key: const Key('a'),
                  child: Focus(focusNode: a, child: const SizedBox(width: 50, height: 50)),
                ),
                FocusGrow(
                  key: const Key('b'),
                  child: Focus(focusNode: b, child: const SizedBox(width: 50, height: 50)),
                ),
              ],
            ),
          ),
        ),
      );
      double scale(String k) => tester.widget<AnimatedScale>(find.descendant(of: find.byKey(Key(k)), matching: find.byType(AnimatedScale))).scale;
      expect(scale('a'), 1);
      a.requestFocus();
      await tester.pump();
      expect(scale('a'), greaterThanOrEqualTo(1.08));
      expect(scale('b'), 1);
      b.requestFocus();
      await tester.pump();
      expect(scale('a'), 1);
      expect(scale('b'), greaterThanOrEqualTo(1.08));
    });

    testWidgets('with animations switched off the control still grows, but at once', (tester) async {
      final a = FocusNode();
      addTearDown(a.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(disableAnimations: true),
            child: FocusGrow(
              key: const Key('a'),
              child: Focus(focusNode: a, child: const SizedBox(width: 50, height: 50)),
            ),
          ),
        ),
      );
      expect(tester.widget<AnimatedScale>(find.byType(AnimatedScale)).duration, Duration.zero);
    });
  });
  group('FocusRing look', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'REGRESSION ($brightness): the ring is two-toned (an inverseSurface border and a halo in the tone of the page) and never covers what it surrounds',
        (tester) async {
          final node = FocusNode();
          addTearDown(node.dispose);
          await tester.pumpWidget(
            MaterialApp(
              theme: ThemeData(brightness: brightness),
              home: FocusRing(
                child: Focus(
                  focusNode: node,
                  child: const SizedBox(key: Key('inside'), width: 50, height: 50, child: Text('label')),
                ),
              ),
            ),
          );
          expect(find.byKey(focusHaloKey), findsNothing, reason: 'no halo without focus');
          node.requestFocus();
          await tester.pump();
          final scheme = ThemeData(brightness: brightness).colorScheme;
          final ring = tester.widget<DecoratedBox>(find.byKey(focusRingKey)).decoration as BoxDecoration;
          expect(ring.border!.top.color, scheme.inverseSurface);
          expect(ring.border!.top.width, greaterThanOrEqualTo(4));
          expect(ring.boxShadow, isNull, reason: 'a shadow in a foreground box is a filled shape that hides the control');
          final halo = tester.widget<DecoratedBox>(find.byKey(focusHaloKey)).decoration as BoxDecoration;
          expect(halo.border!.top.color, scheme.surface);
          expect(halo.border!.top.width, greaterThanOrEqualTo(2));
          expect(halo.color, isNull, reason: 'the halo is a line, not a fill');
          // the halo sits outside the control, the ring inside it
          final box = tester.getRect(find.byKey(const Key('inside')));
          final haloRect = tester.getRect(find.byKey(focusHaloKey));
          expect(haloRect.left, lessThan(box.left));
          expect(haloRect.right, greaterThan(box.right));
          expect(find.text('label'), findsOneWidget);
        },
      );
    }

    testWidgets('FocusAware knows when the control that holds it has the focus', (tester) async {
      final node = FocusNode();
      addTearDown(node.dispose);
      final seen = <bool>[];
      await tester.pumpWidget(
        MaterialApp(
          home: Focus(
            focusNode: node,
            child: FocusAware(
              builder: (context, focused) {
                seen.add(focused);
                return Text(focused ? 'focused' : 'idle');
              },
            ),
          ),
        ),
      );
      expect(find.text('idle'), findsOneWidget);
      node.requestFocus();
      await tester.pump();
      expect(find.text('focused'), findsOneWidget);
      node.unfocus();
      await tester.pump();
      await tester.pump(); // the loss of focus is learnt one frame later
      expect(find.text('idle'), findsOneWidget);
    });
  });
}

/// How many rings are drawn right now.
int ringsShown(WidgetTester tester) =>
    tester.widgetList<DecoratedBox>(find.byKey(focusRingKey)).where((b) => (b.decoration as BoxDecoration).border != null).length;
