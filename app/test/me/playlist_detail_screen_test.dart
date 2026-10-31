import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';
import 'package:kantahe/me/playlist_detail_screen.dart';

import 'fakes.dart';

final a = song('1', 'Alpha', 'X');
final b = song('2', 'Beta', 'Y');
final c = song('3', 'Gamma', 'Z');

/// A server that keeps one playlist, like the real one: updates replace the list.
Playlist stored = Playlist();

MeRig rigWith(List<Song> songs) {
  final r = MeRig();
  stored = Playlist(id: 'p1', name: 'Party', songs: songs);
  r.server.onGetPlaylist = (_) => stored;
  r.server.onUpdatePlaylist = (req) {
    final byNumber = {
      for (final s in [...stored.songs, a, b, c]) s.number: s,
    };
    if (req.replaceNumbers) stored = Playlist(id: stored.id, name: stored.name, songs: [for (final n in req.numbers) byNumber[n]!]);
    return stored;
  };
  return r;
}

Future<void> open(WidgetTester tester, MeRig r) async {
  await r.pump(tester, const PlaylistDetailScreen(id: 'p1', name: 'Party'));
  await settle(tester);
}

List<String> order(MeRig r) => r.server.updated.last.numbers.toList();

void main() {
  testWidgets('shows the name and the songs in order', (tester) async {
    await open(tester, rigWith([a, b, c]));
    expect(find.text('Party'), findsWidgets);
    final ys = ['Alpha', 'Beta', 'Gamma'].map((t) => tester.getTopLeft(find.text(t)).dy).toList();
    expect(ys, orderedEquals([...ys]..sort()));
  });

  testWidgets('Move down sends the whole new order and shows what the server answered', (tester) async {
    final r = rigWith([a, b, c]);
    await open(tester, r);
    await tester.tap(find.byTooltip('Move Alpha down'));
    await settle(tester);
    expect(r.server.updated.single.id, 'p1');
    expect(r.server.updated.single.replaceNumbers, isTrue);
    expect(order(r), ['2', '1', '3']);
    final ys = ['Beta', 'Alpha', 'Gamma'].map((t) => tester.getTopLeft(find.text(t)).dy).toList();
    expect(ys, orderedEquals([...ys]..sort()));
  });

  testWidgets('Move up', (tester) async {
    final r = rigWith([a, b, c]);
    await open(tester, r);
    await tester.tap(find.byTooltip('Move Gamma up'));
    await settle(tester);
    expect(order(r), ['1', '3', '2']);
  });

  testWidgets('the first song cannot move up and the last cannot move down', (tester) async {
    await open(tester, rigWith([a, b, c]));
    expect(find.byTooltip('Move Alpha up'), findsNothing);
    expect(find.byTooltip('Move Gamma down'), findsNothing);
    expect(find.byTooltip('Move Beta up'), findsOneWidget);
    expect(find.byTooltip('Move Beta down'), findsOneWidget);
  });

  testWidgets('Remove sends the list without that song', (tester) async {
    final r = rigWith([a, b, c]);
    await open(tester, r);
    await tester.tap(find.byTooltip('Remove Beta from the playlist'));
    await settle(tester);
    expect(order(r), ['1', '3']);
    expect(find.text('Beta'), findsNothing);
  });

  testWidgets('works by position, so a song that is in the list twice moves correctly', (tester) async {
    final r = rigWith([a, b, a]);
    await open(tester, r);
    await tester.tap(find.byTooltip('Remove Alpha from the playlist').last);
    await settle(tester);
    expect(order(r), ['1', '2']);
  });

  testWidgets('regression: a playlist that changed elsewhere is not overwritten by an old order; the page shows the new content', (tester) async {
    final r = rigWith([a, b]);
    await open(tester, r);
    stored = Playlist(id: 'p1', name: 'Party renamed', songs: [a, b, c]); // another device added a song
    await tester.tap(find.byTooltip('Move Alpha down'));
    await settle(tester);
    expect(r.server.updated, isEmpty);
    expect(find.text('Gamma'), findsOneWidget);
    expect(shows('changed on another device'), isTrue);
  });

  testWidgets('a double tap sends one change, and the next one works afterwards', (tester) async {
    final r = rigWith([a, b, c]);
    await open(tester, r);
    final gate = Completer<void>();
    final inner = r.server.onUpdatePlaylist!;
    r.server.onUpdatePlaylist = (req) async {
      await gate.future;
      return inner(req);
    };
    await tester.tap(find.byTooltip('Move Alpha down'));
    await tester.pump();
    await tester.tap(find.byTooltip('Move Beta up'), warnIfMissed: false);
    await tester.pump();
    gate.complete();
    await settle(tester);
    expect(r.server.updated.length, 1);
    await tester.tap(find.byTooltip('Move Alpha down'));
    await settle(tester);
    expect(r.server.updated.length, 2);
  });

  testWidgets('Add all to queue appends the playlist and says how many', (tester) async {
    final r = rigWith([a, b, c]);
    r.server.onAddPlaylist = (_) => 3;
    await open(tester, r);
    await tester.tap(find.text('Add all to queue'));
    await settle(tester);
    expect(r.server.queued, ['p1']);
    expect(find.text('Added 3 songs to the queue'), findsOneWidget);
  });

  testWidgets('one song is "1 song"', (tester) async {
    final r = rigWith([a]);
    r.server.onAddPlaylist = (_) => 1;
    await open(tester, r);
    await tester.tap(find.text('Add all to queue'));
    await settle(tester);
    expect(find.text('Added 1 song to the queue'), findsOneWidget);
  });

  testWidgets('an empty playlist says so and has nothing to add', (tester) async {
    await open(tester, rigWith([]));
    expect(shows('This playlist is empty.'), isTrue);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Add all to queue')).onPressed, isNull);
  });

  testWidgets('a playlist that is gone says so', (tester) async {
    final r = MeRig();
    r.server.onGetPlaylist = (_) => throw ConnectException(Code.notFound, 'gone');
    await open(tester, r);
    expect(shows('This playlist no longer exists.'), isTrue);
  });

  testWidgets('a failed save is shown and the list stays as it was', (tester) async {
    final r = rigWith([a, b]);
    await open(tester, r);
    r.server.onUpdatePlaylist = (_) => throw ConnectException(Code.unavailable, 'down');
    await tester.tap(find.byTooltip('Move Alpha down'));
    await settle(tester);
    expect(shows('Could not reach the server'), isTrue);
    final ys = ['Alpha', 'Beta'].map((t) => tester.getTopLeft(find.text(t)).dy).toList();
    expect(ys, orderedEquals([...ys]..sort()));
  });

  testWidgets('every button names its song', (tester) async {
    await open(tester, rigWith([a, b]));
    for (final t in ['Alpha', 'Beta']) {
      expect(find.byTooltip('Remove $t from the playlist'), findsOneWidget);
    }
  });
}
