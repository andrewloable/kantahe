import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/library/song_list.dart';

import 'fakes.dart';

class Rig {
  late LibraryActions actions;
  final fake = FakeLibrary();
  final messages = <String>[];
  int more = 0;
}

Future<Rig> open(WidgetTester tester, List<Song> songs, {bool hasMore = false, bool loading = false, Rig? rig}) async {
  final r = rig ?? Rig();
  final services = await fake(r).services();
  r.actions = LibraryActions(api: services.api, auth: services.auth, notify: (m, {bool error = false}) => r.messages.add(error ? 'ERROR: $m' : m));
  await pumpScreen(
    tester,
    services,
    Scaffold(
      body: SongList(songs: songs, actions: r.actions, hasMore: hasMore, loading: loading, onMore: () => r.more++),
    ),
  );
  return r;
}

FakeLibrary fake(Rig r) => r.fake;

void main() {
  testWidgets('shows number, title, artist and a badge on every row', (tester) async {
    await open(tester, [song('00001', 'Yesterday', 'The Band'), song('00002', 'Tomorrow', 'Other', format: Format.FORMAT_MIDI)]);
    expect(find.text('00001'), findsOneWidget);
    expect(find.text('Yesterday'), findsOneWidget);
    expect(find.text('The Band'), findsOneWidget);
    expect(find.text('MP3'), findsOneWidget);
    expect(find.text('MIDI'), findsOneWidget);
  });

  testWidgets('tapping a row queues that entry and says so', (tester) async {
    final r = await open(tester, [song('00001', 'Yesterday', 'The Band')]);
    await tester.tap(find.text('Yesterday'));
    await settle(tester);
    expect(r.fake.adds.single.number, '00001');
    expect(r.messages, ['Added Yesterday']);
  });

  testWidgets('a row is announced with what tapping does', (tester) async {
    await open(tester, [song('00001', 'Yesterday', 'The Band')]);
    expect(find.bySemanticsLabel('Add Yesterday by The Band to the queue, MP3 file'), findsOneWidget);
  });

  testWidgets('the star toggles the favourite and shows it', (tester) async {
    final r = await open(tester, [song('00001', 'Yesterday', 'The Band')]);
    expect(find.byIcon(Icons.star_border), findsOneWidget);
    await tester.tap(find.byTooltip('Favourite: Yesterday'));
    await settle(tester);
    expect(find.byIcon(Icons.star), findsOneWidget);
    expect(r.fake.favs.single.favourite, isTrue);
  });

  testWidgets('reverts the star when the server refuses', (tester) async {
    final r = Rig();
    r.fake.onFav = (_) => throw ConnectException(Code.unavailable, 'down');
    await open(tester, [song('00001', 'Yesterday', 'The Band')], rig: r);
    await tester.tap(find.byTooltip('Favourite: Yesterday'));
    await settle(tester);
    expect(find.byIcon(Icons.star_border), findsOneWidget);
    expect(r.messages.single, startsWith('ERROR:'));
  });

  testWidgets('shows a star that the server already set', (tester) async {
    await open(tester, [song('00001', 'Yesterday', 'The Band', favourite: true)]);
    expect(find.byIcon(Icons.star), findsOneWidget);
  });

  testWidgets('a song that cannot be played cannot be queued, and says why', (tester) async {
    final r = await open(tester, [song('00001', 'Broken', 'X', failed: true)]);
    expect(shows("This song can't be played."), isTrue);
    await tester.tap(find.text('Broken'), warnIfMissed: false);
    await settle(tester);
    expect(r.fake.adds, isEmpty);
    expect(r.messages, isEmpty); // the row is off: not even an error is shown
  });

  testWidgets('asks for the next page when the end of the list scrolls into view', (tester) async {
    final songs = [for (var i = 0; i < 40; i++) song('${10000 + i}', 'Song $i', 'Artist')];
    final r = await open(tester, songs, hasMore: true);
    expect(r.more, 0); // the end is far away
    await tester.drag(find.byType(ListView), const Offset(0, -20000));
    await settle(tester);
    expect(r.more, greaterThan(0));
  });

  testWidgets('asks when the first page does not even fill the screen', (tester) async {
    final r = await open(tester, [song('1', 'A', 'B')], hasMore: true);
    await settle(tester);
    expect(r.more, greaterThan(0));
  });

  testWidgets('does not ask while a page is loading, or when there is no more', (tester) async {
    final songs = [for (var i = 0; i < 40; i++) song('${10000 + i}', 'Song $i', 'Artist')];
    var r = await open(tester, songs, hasMore: true, loading: true);
    await tester.drag(find.byType(ListView), const Offset(0, -20000));
    await settle(tester);
    expect(r.more, 0);
    r = await open(tester, songs);
    await tester.drag(find.byType(ListView), const Offset(0, -20000));
    await settle(tester);
    expect(r.more, 0);
  });

  testWidgets('says what is going on when there is nothing to show', (tester) async {
    await open(tester, []);
    expect(shows('No songs found.'), isTrue);
    await open(tester, [], loading: true);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(shows('No songs found.'), isFalse);
  });

  testWidgets('regression: two entries of one song are told apart by a screen reader (the format is in the label)', (tester) async {
    await open(tester, [song('00001', 'Twin', 'A'), song('90001', 'Twin', 'A', format: Format.FORMAT_MIDI)]);
    expect(find.bySemanticsLabel('Add Twin by A to the queue, MP3 file'), findsOneWidget);
    expect(find.bySemanticsLabel('Add Twin by A to the queue, MIDI file'), findsOneWidget);
  });

  testWidgets('regression: the star tells a screen reader whether the song is a favourite', (tester) async {
    await open(tester, [song('1', 'Off', 'A'), song('2', 'On', 'B', favourite: true)]);
    expect(tester.getSemantics(find.byTooltip('Favourite: Off')), isSemantics(hasToggledState: true, isToggled: false));
    expect(tester.getSemantics(find.byTooltip('Favourite: On')), isSemantics(hasToggledState: true, isToggled: true));
  });
}
