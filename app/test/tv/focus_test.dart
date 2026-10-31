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
}

/// How many rings are drawn right now.
int ringsShown(WidgetTester tester) =>
    tester.widgetList<DecoratedBox>(find.byKey(focusRingKey)).where((b) => (b.decoration as BoxDecoration).border != null).length;
