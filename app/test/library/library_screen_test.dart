import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/library_screen.dart';

import 'fakes.dart';

class Rig {
  final fake = FakeLibrary();
}

Future<Rig> open(WidgetTester tester, {Rig? rig}) async {
  final r = rig ?? Rig();
  await pumpScreen(tester, await r.fake.services(), const LibraryScreen());
  await settle(tester);
  return r;
}

void main() {
  group('tabs', () {
    testWidgets('Search, Number and Browse, with Search first', (tester) async {
      await open(tester);
      expect(find.text('Search'), findsOneWidget);
      expect(find.text('Number'), findsOneWidget);
      expect(find.text('Browse'), findsOneWidget);
      expect(find.text('Search songs'), findsOneWidget);
    });

    testWidgets('tapping a tab shows its page', (tester) async {
      await open(tester);
      await tester.tap(find.text('Number'));
      await settle(tester, 400);
      expect(find.text('Add to queue'), findsOneWidget);
      await tester.tap(find.text('Browse'));
      await settle(tester, 400);
      expect(find.text('Titles'), findsOneWidget);
      expect(find.text('Artists'), findsOneWidget);
    });
  });

  group('search', () {
    testWidgets('regression: on a TV the remote leaves Search songs with Down (the arrow keys were kept by the text field and the focus stuck)', (
      tester,
    ) async {
      await open(tester);
      await tester.tap(find.byKey(const Key('search')));
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      final focus = FocusManager.instance.primaryFocus;
      expect(focus?.context?.findAncestorWidgetOfExactType<EditableText>(), isNull);
      expect(focus?.context?.findAncestorWidgetOfExactType<ChoiceChip>(), isNotNull);
    });

    testWidgets('lists the library on opening', (tester) async {
      final r = Rig();
      r.fake.onSearch = (_) => Reply([song('1', 'Yesterday', 'A'), song('2', 'Tomorrow', 'B')]);
      await open(tester, rig: r);
      expect(r.fake.searches.single.query, '');
      expect(r.fake.searches.single.format, Format.FORMAT_UNSPECIFIED);
      expect(shows('Yesterday'), isTrue);
      expect(shows('Tomorrow'), isTrue);
    });

    testWidgets('waits 250 ms after the last keystroke and then searches once', (tester) async {
      final r = await open(tester);
      await tester.enterText(find.byKey(const Key('search')), 'y');
      await tester.pump(const Duration(milliseconds: 200));
      await tester.enterText(find.byKey(const Key('search')), 'ye');
      await tester.pump(const Duration(milliseconds: 249));
      expect(r.fake.searches.length, 1); // only the opening list
      await settle(tester, 1);
      expect(r.fake.searches.length, 2);
      expect(r.fake.searches.last.query, 'ye');
    });

    testWidgets('trims the query', (tester) async {
      final r = await open(tester);
      await tester.enterText(find.byKey(const Key('search')), '  waterloo  ');
      await settle(tester, 250);
      expect(r.fake.searches.last.query, 'waterloo');
    });

    testWidgets('the format chips filter: All, MP3, MIDI, and keep the query', (tester) async {
      final r = await open(tester);
      await tester.enterText(find.byKey(const Key('search')), 'abba');
      await settle(tester, 250);
      await tester.tap(find.widgetWithText(ChoiceChip, 'MP3'));
      await settle(tester);
      expect(r.fake.searches.last.format, Format.FORMAT_MP3);
      expect(r.fake.searches.last.query, 'abba');
      await tester.tap(find.widgetWithText(ChoiceChip, 'MIDI'));
      await settle(tester);
      expect(r.fake.searches.last.format, Format.FORMAT_MIDI);
      await tester.tap(find.widgetWithText(ChoiceChip, 'All'));
      await settle(tester);
      expect(r.fake.searches.last.format, Format.FORMAT_UNSPECIFIED);
    });

    testWidgets('asks for the next page with the returned token and appends', (tester) async {
      final r = Rig();
      r.fake.onSearch = (req) => req.pageToken == '' ? Reply([song('1', 'First', 'A')], next: 'P2') : Reply([song('2', 'Second', 'B')]);
      await open(tester, rig: r);
      await settle(tester, 100); // the short list does not fill the screen: the next page is asked for
      expect(r.fake.searches.map((s) => s.pageToken), ['', 'P2']);
      expect(shows('First'), isTrue);
      expect(shows('Second'), isTrue);
    });

    testWidgets('a new search starts again from the first page', (tester) async {
      final r = Rig();
      r.fake.onSearch = (req) => req.pageToken == '' ? Reply([song('1', 'First', 'A')], next: 'P2') : Reply([song('2', 'Second', 'B')]);
      await open(tester, rig: r);
      await settle(tester, 100);
      await tester.enterText(find.byKey(const Key('search')), 'x');
      await settle(tester, 250);
      expect(r.fake.searches.where((s) => s.query == 'x').first.pageToken, '');
    });

    testWidgets('two entries of one song show as two rows with their own badges', (tester) async {
      final r = Rig();
      r.fake.onSearch = (_) => Reply([song('00001', 'Twin', 'A'), song('90001', 'Twin', 'A', format: Format.FORMAT_MIDI)]);
      await open(tester, rig: r);
      expect(find.text('Twin'), findsNWidgets(2));
      expect(find.text('MP3'), findsWidgets);
      expect(find.text('MIDI'), findsWidgets);
    });

    testWidgets('says when nothing matches', (tester) async {
      await open(tester);
      expect(shows('No songs found.'), isTrue);
    });

    testWidgets('shows a failed search with a way to try again', (tester) async {
      final r = Rig();
      var fail = true;
      r.fake.onSearch = (_) {
        if (fail) throw ConnectException(Code.unavailable, 'down');
        return Reply([song('1', 'Back again', 'A')]);
      };
      await open(tester, rig: r);
      expect(shows('Could not reach the server'), isTrue);
      fail = false;
      await tester.tap(find.text('Try again'));
      await settle(tester);
      expect(shows('Back again'), isTrue);
      expect(shows('Could not reach the server'), isFalse);
    });

    testWidgets('has a labelled search box', (tester) async {
      await open(tester);
      expect(find.text('Search songs'), findsOneWidget);
    });

    testWidgets('a new search abandons the one still running', (tester) async {
      final r = Rig();
      r.fake.onSearch = (req) => req.query == 'slow' ? Completer<Reply<Song>>().future : Reply([song('1', 'Quick', 'A')]);
      await open(tester, rig: r);
      await tester.enterText(find.byKey(const Key('search')), 'slow');
      await settle(tester, 250);
      await tester.enterText(find.byKey(const Key('search')), 'quick');
      await settle(tester, 250);
      expect(r.fake.aborted, greaterThanOrEqualTo(1));
      expect(shows('Quick'), isTrue);
    });

    testWidgets('leaving the screen abandons the request and does not search after', (tester) async {
      final r = await open(tester);
      await tester.enterText(find.byKey(const Key('search')), 'x');
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 1));
      expect(r.fake.searches.length, 1);
    });

    testWidgets('regression: the next page is asked for with the query of the list on screen, not with text typed since', (tester) async {
      final r = Rig();
      r.fake.onSearch = (req) => Reply([for (var i = 0; i < 40; i++) song('${10000 + i}', 'Song $i', 'A')], next: req.pageToken == '' ? 'P2' : '');
      await open(tester, rig: r);
      await tester.enterText(find.byKey(const Key('search')), 'zzz'); // typed, the 250 ms have not passed
      await tester.drag(find.byType(ListView).first, const Offset(0, -20000)); // the end comes into view
      await settle(tester);
      final next = r.fake.searches.firstWhere((s) => s.pageToken == 'P2');
      expect(next.query, '', reason: 'a token of the empty search must not be used with another query');
    });

    testWidgets('regression: a failed next page is not asked for again and again', (tester) async {
      final r = Rig();
      r.fake.onSearch = (req) {
        if (req.pageToken == 'P2') throw ConnectException(Code.unavailable, 'down');
        return Reply([song('1', 'First', 'A')], next: 'P2');
      };
      await open(tester, rig: r);
      await settle(tester, 100);
      final asked = r.fake.searches.length;
      expect(asked, 2); // the opening page and the one that failed
      await settle(tester, 2000);
      expect(r.fake.searches.length, asked);
      expect(shows('Could not reach the server'), isTrue);
      r.fake.onSearch = (_) => Reply([song('2', 'Second', 'B')]);
      await tester.tap(find.text('Try again'));
      await settle(tester);
      expect(shows('Second'), isTrue);
    });

    testWidgets('regression: the keyboard Search key searches at once', (tester) async {
      final r = await open(tester);
      await tester.enterText(find.byKey(const Key('search')), 'abba');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await settle(tester);
      expect(r.fake.searches.last.query, 'abba');
      await settle(tester, 300);
      expect(r.fake.searches.where((s) => s.query == 'abba').length, 1); // the debounce does not ask again
    });

    testWidgets('pull to refresh reads the list again', (tester) async {
      final r = Rig();
      r.fake.onSearch = (_) => Reply([for (var i = 0; i < 30; i++) song('${10000 + i}', 'Song $i', 'A')]);
      await open(tester, rig: r);
      await tester.fling(find.byType(ListView).first, const Offset(0, 400), 1000);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      expect(r.fake.searches.length, 2);
    });
  });

  testWidgets('Add to queue from the list shows a message', (tester) async {
    final r = Rig();
    r.fake.onSearch = (_) => Reply([song('1', 'Yesterday', 'A')]);
    await open(tester, rig: r);
    await tester.tap(find.text('Yesterday'));
    await settle(tester);
    expect(find.text('Added Yesterday'), findsOneWidget); // in the snack bar
  });
}
