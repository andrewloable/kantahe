import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/library/number_pad.dart';

import 'fakes.dart';

class Rig {
  final fake = FakeLibrary();
  final messages = <String>[];
}

Future<Rig> open(WidgetTester tester, {Rig? rig}) async {
  final r = rig ?? Rig();
  final services = await r.fake.services();
  final actions = LibraryActions(api: services.api, auth: services.auth, notify: (m, {bool error = false}) => r.messages.add(error ? 'ERROR: $m' : m));
  await pumpScreen(tester, services, Scaffold(body: NumberPad(actions: actions)));
  return r;
}

Future<void> key(WidgetTester tester, String label) async {
  await tester.tap(find.widgetWithText(OutlinedButton, label));
  await tester.pump();
}

String digits(WidgetTester tester) => tester.widget<Text>(find.byKey(const Key('digits'))).data!;

void main() {
  testWidgets('has a key for every digit, backspace and clear, each with a label', (tester) async {
    await open(tester);
    for (final d in '0123456789'.split('')) {
      expect(find.widgetWithText(OutlinedButton, d), findsOneWidget, reason: d);
    }
    expect(find.byTooltip('Backspace'), findsOneWidget);
    expect(find.byTooltip('Clear'), findsOneWidget);
  });

  testWidgets('looks the number up once, 150 ms after the last key, and shows the song', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => song('00123', 'Yesterday', 'The Band');
    await open(tester, rig: r);
    await key(tester, '1');
    await tester.pump(const Duration(milliseconds: 100));
    await key(tester, '2');
    await tester.pump(const Duration(milliseconds: 100));
    await key(tester, '3');
    expect(shows('Looking'), isTrue);
    await tester.pump(const Duration(milliseconds: 149));
    expect(r.fake.gets, isEmpty);
    await settle(tester, 1);
    expect(r.fake.gets.map((g) => g.number), ['123']);
    expect(shows('Yesterday'), isTrue);
    expect(shows('The Band'), isTrue);
    expect(find.text('MP3'), findsOneWidget);
  });

  testWidgets('Add queues the song and clears the pad', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => song('00123', 'Yesterday', 'The Band');
    await open(tester, rig: r);
    await key(tester, '1');
    await settle(tester, 150);
    await tester.tap(find.text('Add to queue'));
    await settle(tester);
    expect(r.fake.adds.single.number, '00123');
    expect(r.messages, ['Added Yesterday']);
    expect(digits(tester), '');
  });

  testWidgets('a failed add keeps the number so it can be tried again', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => song('00123', 'Yesterday', 'The Band');
    r.fake.onAdd = (_) => throw ConnectException(Code.unavailable, 'down');
    await open(tester, rig: r);
    await key(tester, '1');
    await settle(tester, 150);
    await tester.tap(find.text('Add to queue'));
    await settle(tester);
    expect(digits(tester), '1');
  });

  testWidgets('Add is off until a song is found', (tester) async {
    await open(tester);
    FilledButton add() => tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Add to queue'));
    expect(add().onPressed, isNull);
    await key(tester, '9');
    expect(add().onPressed, isNull); // still looking
  });

  testWidgets('an unknown number says so and keeps Add off', (tester) async {
    await open(tester); // GetSong answers with no song
    await key(tester, '9');
    await settle(tester, 150);
    expect(shows('No song with this number'), isTrue);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Add to queue')).onPressed, isNull);
  });

  testWidgets('NotFound from the server also means no such song', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => throw ConnectException(Code.notFound, 'nope');
    await open(tester, rig: r);
    await key(tester, '9');
    await settle(tester, 150);
    expect(shows('No song with this number'), isTrue);
  });

  testWidgets('another failure is reported as such, not as an unknown number', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => throw ConnectException(Code.unavailable, 'down');
    await open(tester, rig: r);
    await key(tester, '9');
    await settle(tester, 150);
    expect(shows('Could not reach the server'), isTrue);
    expect(shows('No song with this number'), isFalse);
  });

  testWidgets('backspace and clear', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => song('1', 'A', 'B');
    await open(tester, rig: r);
    await key(tester, '4');
    await key(tester, '2');
    expect(digits(tester), '42');
    await tester.tap(find.byTooltip('Backspace'));
    await tester.pump();
    expect(digits(tester), '4');
    await tester.tap(find.byTooltip('Clear'));
    await tester.pump();
    expect(digits(tester), '');
    await tester.pump(const Duration(seconds: 1));
    expect(r.fake.gets, isEmpty); // an empty pad asks nothing
  });

  testWidgets('an old answer does not replace the answer for what is typed now', (tester) async {
    final r = Rig();
    final slow = Completer<Song?>();
    r.fake.onGet = (req) => req.number == '1' ? slow.future : song('12', 'Twelve', 'B');
    await open(tester, rig: r);
    await key(tester, '1');
    await settle(tester, 150); // asks for 1, which does not answer yet
    await key(tester, '2');
    await settle(tester, 150);
    expect(shows('Twelve'), isTrue);
    slow.complete(song('1', 'One', 'B'));
    await settle(tester);
    expect(shows('Twelve'), isTrue);
    expect(shows('One'), isFalse);
  });

  testWidgets('typing on abandons the lookup that is still running', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => Completer<Song?>().future; // never answers
    await open(tester, rig: r);
    await key(tester, '1');
    await settle(tester, 150);
    await key(tester, '2');
    await settle(tester, 150);
    expect(r.fake.gets.map((g) => g.number), ['1', '12']);
  });

  testWidgets('stops at 20 digits', (tester) async {
    await open(tester);
    for (var i = 0; i < 25; i++) {
      await key(tester, '7');
    }
    expect(digits(tester).length, 20);
  });

  testWidgets('shows the typed digits to screen readers', (tester) async {
    await open(tester);
    await key(tester, '3');
    expect(find.bySemanticsLabel(RegExp('Song number')), findsOneWidget);
  });

  testWidgets('leaving the screen cancels the pending lookup', (tester) async {
    final r = Rig();
    await open(tester, rig: r);
    await key(tester, '5');
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
    expect(r.fake.gets, isEmpty);
  });

  testWidgets('regression: the result of a lookup is announced to screen readers', (tester) async {
    final r = Rig();
    r.fake.onGet = (_) => song('1', 'Yesterday', 'B');
    await open(tester, rig: r);
    await key(tester, '1');
    await settle(tester, 150);
    expect(tester.getSemantics(find.textContaining('Yesterday')), isSemantics(isLiveRegion: true));
  });
}
