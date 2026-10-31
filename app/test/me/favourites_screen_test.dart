import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/me/favourites_screen.dart';

import 'fakes.dart';

Future<MeRig> open(WidgetTester tester, {MeRig? rig}) async {
  final r = rig ?? MeRig();
  await r.pump(tester, const FavouritesScreen());
  await settle(tester);
  return r;
}

void main() {
  testWidgets('lists the favourites in pages, with the next page asked for by token', (tester) async {
    final r = MeRig();
    r.server.onFavourites = (req) =>
        req.pageToken == '' ? (items: [song('1', 'First', 'A', favourite: true)], next: 'P2') : (items: [song('2', 'Second', 'B', favourite: true)], next: '');
    await open(tester, rig: r);
    await settle(tester, 100); // a short first page: the next one is asked for
    expect(r.server.favouriteRequests.map((q) => q.pageToken), ['', 'P2']);
    expect(find.text('First'), findsOneWidget);
    expect(find.text('Second'), findsOneWidget);
  });

  testWidgets('has a heading, and says so when there are no favourites', (tester) async {
    await open(tester);
    expect(find.text('Favourites'), findsWidgets);
    expect(shows('You have no favourites yet.'), isTrue);
  });

  testWidgets('un-starring a song takes it off the list', (tester) async {
    final r = MeRig();
    r.server.onFavourites = (_) => (items: [song('1', 'First', 'A', favourite: true), song('2', 'Second', 'B', favourite: true)], next: '');
    await open(tester, rig: r);
    await tester.tap(find.byTooltip('Favourite: First'));
    await settle(tester);
    expect(r.server.favs.single.favourite, isFalse);
    expect(find.text('First'), findsNothing);
    expect(find.text('Second'), findsOneWidget);
  });

  testWidgets('regression: after un-starring, Load more still shows the favourites that are left (the server pages by position, which moved)', (tester) async {
    final r = MeRig();
    // a 40 row first page, a second page behind it; one song is un-starred before the end is reached
    final first = [for (var i = 0; i < 40; i++) song('${10000 + i}', 'Song $i', 'A', favourite: true)];
    r.server.onFavourites = (req) {
      if (req.pageToken == 'P2') return (items: [song('20000', 'Late', 'Z', favourite: true)], next: '');
      return (items: first, next: 'P2');
    };
    await open(tester, rig: r);
    await tester.tap(find.byTooltip('Favourite: Song 0'));
    await settle(tester);
    final before = r.server.favouriteRequests.length;
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -20000));
    await settle(tester, 100);
    // the list was read again from the start (token '') instead of continuing with the old position
    expect(r.server.favouriteRequests.skip(before).first.pageToken, '');
  });

  testWidgets('a failed list shows the error with Try again', (tester) async {
    final r = MeRig();
    var fail = true;
    r.server.onFavourites = (_) {
      if (fail) throw ConnectException(Code.unavailable, 'down');
      return (items: [song('1', 'Back', 'A', favourite: true)], next: '');
    };
    await open(tester, rig: r);
    expect(shows('Could not reach the server'), isTrue);
    fail = false;
    await tester.tap(find.text('Try again'));
    await settle(tester);
    expect(find.text('Back'), findsOneWidget);
  });
}
