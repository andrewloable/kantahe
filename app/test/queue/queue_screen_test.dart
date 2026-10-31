import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/queue/queue_screen.dart';

import 'fakes.dart';

Future<QueueRig> open(WidgetTester tester, {State? state, bool connected = true, WidgetBuilder? playerBuilder}) async {
  final rig = QueueRig();
  await rig.signIn('me');
  if (state != null) rig.setState(state, connected: connected);
  await rig.pump(tester, QueueScreen(playerBuilder: playerBuilder));
  return rig;
}

State twoSongs() => stateOf(
  queue: [
    item('i1', song('00001', 'First', 'A')),
    item('i2', song('00002', 'Second', 'B', format: Format.FORMAT_MIDI)),
    item('i3', song('00003', 'Third', 'C')),
  ],
);

void main() {
  testWidgets('lists the queue in order with title, artist and badge', (tester) async {
    await open(tester, state: twoSongs());
    final titles = ['First', 'Second', 'Third'].map((t) => tester.getTopLeft(find.text(t)).dy).toList();
    expect(titles, orderedEquals([...titles]..sort()));
    expect(find.text('A'), findsOneWidget);
    expect(find.text('MIDI'), findsOneWidget);
    expect(find.text('MP3'), findsNWidgets(2));
  });

  testWidgets('says so when the queue is empty', (tester) async {
    await open(tester, state: stateOf());
    expect(shows('The queue is empty'), isTrue);
  });

  testWidgets('shows that it is connecting until the first state arrives', (tester) async {
    final rig = await open(tester);
    expect(shows('Connecting'), isTrue);
    expect(find.text('Coming up'), findsNothing);
    rig.setState(twoSongs());
    await tester.pump();
    expect(shows('Connecting'), isFalse);
    expect(find.text('Coming up'), findsOneWidget);
  });

  testWidgets('follows every new state from the server', (tester) async {
    final rig = await open(tester, state: twoSongs());
    rig.setState(stateOf(queue: [item('i9', song('9', 'Brand new', 'Z'))]));
    await tester.pump();
    expect(find.text('Brand new'), findsOneWidget);
    expect(find.text('First'), findsNothing);
  });

  testWidgets('tells the user when live updates are interrupted, and keeps the last state', (tester) async {
    final rig = await open(tester, state: twoSongs());
    expect(shows('Reconnecting'), isFalse);
    rig.setState(twoSongs(), connected: false);
    await tester.pump();
    expect(shows('Reconnecting'), isTrue);
    expect(find.text('First'), findsOneWidget);
    rig.setState(twoSongs());
    await tester.pump();
    expect(shows('Reconnecting'), isFalse);
  });

  testWidgets('shows the now playing card and the devices', (tester) async {
    await open(
      tester,
      state: stateOf(devices: [device('a', 'Kitchen phone')], now: nowPlaying(song('7', 'On air', 'Star'))),
    );
    expect(find.text('On air'), findsOneWidget);
    expect(find.text('Kitchen phone'), findsOneWidget);
    expect(find.text('Devices'), findsOneWidget);
  });

  group('remove and move', () {
    testWidgets('Remove sends RemoveFromQueue with the item id and offers Undo', (tester) async {
      final rig = await open(tester, state: twoSongs());
      await tester.tap(find.byTooltip('Remove Second from the queue'));
      await settle(tester);
      expect(rig.server.removes, ['i2']);
      expect(find.text('Removed Second'), findsOneWidget);
      expect(find.text('Undo'), findsOneWidget);
    });

    testWidgets('Undo adds the same song again', (tester) async {
      final rig = await open(tester, state: twoSongs());
      await tester.tap(find.byTooltip('Remove Second from the queue'));
      await settle(tester);
      await tester.pump(const Duration(milliseconds: 500)); // the snack bar slides in
      await tester.tap(find.text('Undo'));
      await settle(tester);
      expect(rig.server.adds, ['00002']);
    });

    testWidgets('Move to top sends MoveToTop, and the first row has none', (tester) async {
      final rig = await open(tester, state: twoSongs());
      expect(find.byTooltip('Move First to the top of the queue'), findsNothing);
      await tester.tap(find.byTooltip('Move Third to the top of the queue'));
      await settle(tester);
      expect(rig.server.moves, ['i3']);
    });

    testWidgets('a double tap on Remove or Move to top sends one command, not two', (tester) async {
      final rig = await open(tester, state: twoSongs());
      final gate = Completer<void>();
      rig.server.onMove = (_) => gate.future;
      await tester.tap(find.byTooltip('Move Third to the top of the queue'));
      await tester.pump();
      await tester.tap(find.byTooltip('Move Third to the top of the queue'));
      await tester.pump();
      expect(rig.server.moves, ['i3']);
      gate.complete();
      await settle(tester);
    });

    testWidgets('a button works again after its command has finished', (tester) async {
      final rig = await open(tester, state: twoSongs());
      await tester.tap(find.byTooltip('Move Third to the top of the queue'));
      await settle(tester);
      await tester.tap(find.byTooltip('Move Third to the top of the queue'));
      await settle(tester);
      expect(rig.server.moves, ['i3', 'i3']);
    });

    testWidgets('a failed removal is shown as an error', (tester) async {
      final rig = await open(tester, state: twoSongs());
      rig.server.onRemove = (_) => throw ConnectException(Code.unavailable, 'down');
      await tester.tap(find.byTooltip('Remove First from the queue'));
      await settle(tester);
      expect(shows('Could not reach the server'), isTrue);
      expect(find.text('Undo'), findsNothing);
    });

    testWidgets('every row button says which song it is about', (tester) async {
      await open(tester, state: twoSongs());
      for (final t in ['First', 'Second', 'Third']) {
        expect(find.byTooltip('Remove $t from the queue'), findsOneWidget, reason: t);
      }
    });
  });

  group('Play here', () {
    testWidgets('sends PLAY_HERE and pushes the player route', (tester) async {
      final rig = await open(
        tester,
        state: stateOf(player: 'tv', devices: [device('tv', 'TV')], now: nowPlaying(song('1', 'A', 'B'))),
        playerBuilder: (_) => const Scaffold(body: Text('PLAYER SCREEN')),
      );
      await tester.tap(find.text('Play here'));
      await tester.pumpAndSettle();
      expect(rig.server.controls, [ControlAction.CONTROL_ACTION_PLAY_HERE]);
      expect(find.text('PLAYER SCREEN'), findsOneWidget);
    });

    testWidgets('a refused Play here stays on the queue', (tester) async {
      final rig = await open(
        tester,
        state: stateOf(player: 'tv', devices: [device('tv', 'TV')], now: nowPlaying(song('1', 'A', 'B'))),
        playerBuilder: (_) => const Scaffold(body: Text('PLAYER SCREEN')),
      );
      rig.server.onControl = (_) => throw ConnectException(Code.permissionDenied, 'no');
      await tester.tap(find.text('Play here'));
      await tester.pumpAndSettle();
      expect(find.text('PLAYER SCREEN'), findsNothing);
      expect(find.text('Queue'), findsOneWidget);
    });

    testWidgets('without a player screen to open Play here only tells the server', (tester) async {
      final rig = await open(
        tester,
        state: stateOf(player: 'tv', devices: [device('tv', 'TV')], now: nowPlaying(song('1', 'A', 'B'))),
      );
      await tester.tap(find.text('Play here'));
      await tester.pumpAndSettle();
      expect(rig.server.controls, [ControlAction.CONTROL_ACTION_PLAY_HERE]);
    });
  });
}
