import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/library/alpha_browse.dart';
import 'package:kantahe/library/library_actions.dart';

import 'fakes.dart';
import '../tv/ring_helper.dart';

class Rig {
  final fake = FakeLibrary();
}

Future<Rig> open(WidgetTester tester, {Rig? rig}) async {
  final r = rig ?? Rig();
  final services = await r.fake.services();
  final actions = LibraryActions(api: services.api, auth: services.auth, notify: (m, {bool error = false}) {});
  await pumpScreen(tester, services, Scaffold(body: AlphaBrowse(actions: actions)));
  await settle(tester);
  return r;
}

void main() {
  testWidgets('offers A to Z and #, each a labelled button', (tester) async {
    await open(tester);
    for (final l in [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#']) {
      expect(find.widgetWithText(ChoiceChip, l), findsOneWidget, reason: l);
    }
    expect(find.widgetWithText(ChoiceChip, 'A').evaluate().isNotEmpty, isTrue);
    expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'A')).selected, isTrue);
  });

  testWidgets('starts with the titles under A, sorted by title', (tester) async {
    final r = await open(tester);
    expect(r.fake.searches.single.letter, 'A');
    expect(r.fake.searches.single.sort, SongSort.SONG_SORT_TITLE);
    expect(r.fake.searches.single.query, '');
  });

  testWidgets('a letter in Titles mode searches that letter and starts again', (tester) async {
    final r = await open(tester);
    r.fake.onSearch = (_) => Reply([song('1', 'Bravo', 'X')]);
    await tester.tap(find.widgetWithText(ChoiceChip, 'B'));
    await settle(tester);
    expect(r.fake.searches.last.letter, 'B');
    expect(r.fake.searches.last.pageToken, '');
    expect(shows('Bravo'), isTrue);
  });

  testWidgets('Artists mode lists the artists of the letter with their song counts', (tester) async {
    final r = Rig();
    r.fake.onArtists = (_) => Reply([Artist(name: 'Abba', songCount: 3), Artist(name: 'Adele', songCount: 1)]);
    await open(tester, rig: r);
    await tester.tap(find.text('Artists'));
    await settle(tester);
    expect(r.fake.artistRequests.single.letter, 'A');
    expect(shows('Abba'), isTrue);
    expect(shows('3 songs'), isTrue);
    expect(shows('1 song'), isTrue);
    expect(shows('1 songs'), isFalse);
  });

  testWidgets("choosing an artist shows that artist's songs by title, and Back returns to the artists", (tester) async {
    final r = Rig();
    r.fake.onArtists = (_) => Reply([Artist(name: 'Abba', songCount: 1)]);
    await open(tester, rig: r);
    await tester.tap(find.text('Artists'));
    await settle(tester);
    r.fake.onSearch = (_) => Reply([song('7', 'Waterloo', 'Abba')]);
    await tester.tap(find.text('Abba'));
    await settle(tester);
    expect(r.fake.searches.last.query, 'Abba');
    expect(r.fake.searches.last.sort, SongSort.SONG_SORT_TITLE);
    expect(shows('Waterloo'), isTrue);
    await tester.tap(find.text('← Back to artists'));
    await settle(tester);
    expect(shows('Waterloo'), isFalse);
    expect(shows('Abba'), isTrue);
  });

  testWidgets('changing the letter while looking at an artist goes back to the list', (tester) async {
    final r = Rig();
    r.fake.onArtists = (_) => Reply([Artist(name: 'Abba', songCount: 1)]);
    await open(tester, rig: r);
    await tester.tap(find.text('Artists'));
    await settle(tester);
    await tester.tap(find.text('Abba'));
    await settle(tester);
    await tester.tap(find.widgetWithText(ChoiceChip, 'C'));
    await settle(tester);
    expect(find.text('← Back to artists'), findsNothing);
    expect(r.fake.artistRequests.last.letter, 'C');
  });

  testWidgets('says when no artist starts with the letter', (tester) async {
    await open(tester); // no artists
    await tester.tap(find.text('Artists'));
    await settle(tester);
    expect(shows('No artists under this letter.'), isTrue);
  });

  testWidgets('Load more pages the artists with the returned token', (tester) async {
    final r = Rig();
    r.fake.onArtists = (req) => req.pageToken == '' ? Reply([Artist(name: 'Abba', songCount: 1)], next: 'P2') : Reply([Artist(name: 'Adele', songCount: 2)]);
    await open(tester, rig: r);
    await tester.tap(find.text('Artists'));
    await settle(tester);
    await tester.tap(find.text('Load more'));
    await settle(tester);
    expect(r.fake.artistRequests.map((a) => a.pageToken), ['', 'P2']);
    expect(shows('Adele'), isTrue);
    expect(shows('Abba'), isTrue);
    expect(find.text('Load more'), findsNothing);
  });

  testWidgets('a failed list shows the error with a way to try again', (tester) async {
    final r = Rig();
    var fail = true;
    r.fake.onArtists = (_) {
      if (fail) throw Exception('boom');
      return Reply([Artist(name: 'Abba', songCount: 1)]);
    };
    await open(tester, rig: r);
    await tester.tap(find.text('Artists'));
    await settle(tester);
    expect(shows('Try again'), isTrue);
    fail = false;
    await tester.tap(find.text('Try again'));
    await settle(tester);
    expect(shows('Abba'), isTrue);
  });

  testWidgets('the remote\'s focus on a letter, on the Titles/Artists switch and on an artist shows the ring', (tester) async {
    final r = Rig();
    r.fake.onArtists = (_) => Reply([Artist(name: 'Abba', songCount: 3), Artist(name: 'Adele', songCount: 1)]);
    await open(tester, rig: r);
    final letter = find.widgetWithText(ChoiceChip, 'B');
    await expectNoRingWhenNotFocused(tester, letter);
    await expectRingOnFocus(tester, letter);
    expect(tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'A')).selected, isTrue, reason: 'focus is not selection');
    await expectRingOnFocus(tester, find.byWidgetPredicate((w) => w is SegmentedButton));
    await tester.tap(find.text('Artists'));
    await settle(tester);
    await expectRingOnFocus(tester, find.widgetWithText(ListTile, 'Abba'));
  });
}
