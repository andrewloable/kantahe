import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';
import 'package:kantahe/me/playlist_detail_screen.dart';
import 'package:kantahe/me/playlists_screen.dart';

import 'fakes.dart';
import '../tv/ring_helper.dart';

Future<MeRig> open(WidgetTester tester, {MeRig? rig}) async {
  final r = rig ?? MeRig();
  await r.pump(tester, const PlaylistsScreen());
  await settle(tester);
  return r;
}

MeRig withPlaylists() {
  final r = MeRig();
  r.server.playlists = [PlaylistSummary(id: 'p1', name: 'Party', songCount: 3), PlaylistSummary(id: 'p2', name: 'Chill', songCount: 1)];
  return r;
}

void main() {
  testWidgets('lists the playlists with their song counts', (tester) async {
    await open(tester, rig: withPlaylists());
    expect(find.text('Party'), findsOneWidget);
    expect(find.text('3 songs'), findsOneWidget);
    expect(find.text('1 song'), findsOneWidget);
  });

  testWidgets('says so when there are none', (tester) async {
    await open(tester);
    expect(shows('No playlists yet.'), isTrue);
  });

  testWidgets('opening a playlist shows its page', (tester) async {
    final r = withPlaylists();
    r.server.onGetPlaylist = (id) => Playlist(id: id, name: 'Party', songs: [song('1', 'Opening song', 'A')]);
    await open(tester, rig: r);
    await tester.tap(find.text('Party'));
    await tester.pumpAndSettle();
    expect(find.byType(PlaylistDetailScreen), findsOneWidget);
    expect(find.text('Opening song'), findsOneWidget);
  });

  group('create', () {
    testWidgets('creates a playlist with a name', (tester) async {
      final r = await open(tester);
      await tester.enterText(find.byKey(const Key('new-playlist')), '  Road trip ');
      await tester.tap(find.text('Create'));
      await settle(tester);
      expect(r.server.created.single.name, 'Road trip');
      expect(r.server.created.single.numbers, isEmpty);
      expect(find.text('Road trip'), findsOneWidget);
      expect(tester.widget<TextField>(find.byKey(const Key('new-playlist'))).controller!.text, '');
    });

    testWidgets('asks for a name', (tester) async {
      final r = await open(tester);
      await tester.enterText(find.byKey(const Key('new-playlist')), '   ');
      await tester.tap(find.text('Create'));
      await settle(tester);
      expect(shows('Enter a name for the playlist.'), isTrue);
      expect(r.server.created, isEmpty);
    });

    testWidgets('a double tap creates one playlist', (tester) async {
      final r = await open(tester);
      final gate = Completer<void>();
      r.server.onCreate = (req) async {
        await gate.future;
        return CreatePlaylistResponse(
          playlist: Playlist(id: 'x', name: req.name),
        );
      };
      await tester.enterText(find.byKey(const Key('new-playlist')), 'One');
      await tester.tap(find.text('Create'));
      await tester.pump();
      await tester.tap(find.text('Create'), warnIfMissed: false);
      await tester.pump();
      gate.complete();
      await settle(tester);
      expect(r.server.created.length, 1);
    });

    testWidgets('the keyboard Done key creates the playlist once', (tester) async {
      final r = await open(tester);
      final gate = Completer<void>();
      r.server.onCreate = (req) async {
        await gate.future;
        return CreatePlaylistResponse(
          playlist: Playlist(id: 'x', name: req.name),
        );
      };
      await tester.enterText(find.byKey(const Key('new-playlist')), 'One');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      expect(r.server.created.length, 1);
      gate.complete();
      await settle(tester);
    });

    testWidgets('a refusal from the server is shown as an error', (tester) async {
      final r = await open(tester);
      r.server.onCreate = (_) => throw ConnectException(Code.invalidArgument, 'too many playlists');
      await tester.enterText(find.byKey(const Key('new-playlist')), 'One');
      await tester.tap(find.text('Create'));
      await settle(tester);
      expect(shows('too many playlists'), isTrue);
    });
  });

  group('rename and delete', () {
    testWidgets('renames a playlist: only the name is sent', (tester) async {
      final r = await open(tester, rig: withPlaylists());
      await tester.tap(find.byTooltip('Rename Party'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('rename')), ' Big party ');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(r.server.updated.single.id, 'p1');
      expect(r.server.updated.single.name, 'Big party');
      expect(r.server.updated.single.replaceNumbers, isFalse);
      expect(r.server.updated.single.numbers, isEmpty);
      expect(find.text('Big party'), findsOneWidget);
    });

    testWidgets('renaming can be cancelled', (tester) async {
      final r = await open(tester, rig: withPlaylists());
      await tester.tap(find.byTooltip('Rename Party'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(r.server.updated, isEmpty);
      expect(find.text('Party'), findsOneWidget);
    });

    testWidgets('delete asks first; confirming deletes, cancelling does not', (tester) async {
      final r = await open(tester, rig: withPlaylists());
      await tester.tap(find.byTooltip('Delete Party'));
      await tester.pumpAndSettle();
      expect(shows('Delete "Party"?'), isTrue);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(r.server.deleted, isEmpty);
      await tester.tap(find.byTooltip('Delete Party'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yes, delete'));
      await tester.pumpAndSettle();
      expect(r.server.deleted, ['p1']);
      expect(find.text('Party'), findsNothing);
      expect(find.text('Chill'), findsOneWidget);
    });

    testWidgets('a refused delete leaves the playlist and says why', (tester) async {
      final r = await open(tester, rig: withPlaylists());
      r.server.onDelete = (_) => throw ConnectException(Code.unavailable, 'down');
      await tester.tap(find.byTooltip('Delete Party'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yes, delete'));
      await tester.pumpAndSettle();
      expect(find.text('Party'), findsOneWidget);
      expect(shows('Could not reach the server'), isTrue);
    });
  });

  testWidgets('every button names its playlist', (tester) async {
    await open(tester, rig: withPlaylists());
    for (final n in ['Party', 'Chill']) {
      expect(find.byTooltip('Rename $n'), findsOneWidget);
      expect(find.byTooltip('Delete $n'), findsOneWidget);
    }
  });

  testWidgets('the remote\'s focus on a playlist shows the ring', (tester) async {
    await open(tester, rig: withPlaylists());
    final entry = find.widgetWithText(ListTile, 'Party');
    await expectNoRingWhenNotFocused(tester, entry);
    await expectRingOnFocus(tester, entry);
  });
}
