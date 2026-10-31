import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter/scheduler.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/queue/now_playing_card.dart';
import 'package:kantahe/queue/queue_actions.dart';

import 'fakes.dart';

class Rig2 {
  Rig2(this.rig, this.actions, this.said);

  final QueueRig rig;
  final QueueActions actions;
  final List<String> said;
  int playHere = 0;
}

Future<Rig2> open(WidgetTester tester, State state, {String deviceId = 'me', bool connected = true}) async {
  final rig = QueueRig();
  await rig.signIn(deviceId);
  rig.setState(state, connected: connected);
  final said = <String>[];
  final actions = QueueActions(
    api: rig.api,
    notify: (m, {bool error = false, String? actionLabel, VoidCallback? onAction}) => said.add(error ? 'ERROR: $m' : m),
  );
  final r = Rig2(rig, actions, said);
  await rig.pump(
    tester,
    Scaffold(
      body: SingleChildScrollView(
        child: NowPlayingCard(actions: actions, onPlayHere: () => r.playHere++),
      ),
    ),
  );
  return r;
}

State playing({
  int positionMs = 41200,
  int durationMs = 0,
  String player = 'me',
  List<Device> devices = const [],
  SongSource source = SongSource.SONG_SOURCE_QUEUE,
}) => stateOf(
  status: PlayStatus.PLAY_STATUS_PLAYING,
  player: player,
  devices: devices,
  serverTimeMs: 1000,
  now: nowPlaying(
    song('00001', 'Yesterday', 'The Band', durationMs: durationMs),
    source: source,
    positionMs: positionMs,
    positionAtMs: 1000,
  ),
);

void main() {
  testWidgets('shows the song, its badge and where it came from', (tester) async {
    await open(tester, playing());
    expect(find.text('Yesterday'), findsOneWidget);
    expect(find.text('The Band'), findsOneWidget);
    expect(find.text('MP3'), findsOneWidget);
    expect(shows('From the queue'), isTrue);
  });

  testWidgets('says when a song was picked at random', (tester) async {
    await open(tester, playing(source: SongSource.SONG_SOURCE_RANDOM));
    expect(shows('Picked at random'), isTrue);
  });

  testWidgets('a position of 41.2 s plus 2 s shows 0:43, moving with the clock', (tester) async {
    final r = await open(tester, playing());
    expect(shows('0:41'), isTrue);
    r.rig.clockMs = 2000;
    await tester.pump(const Duration(seconds: 2));
    expect(shows('0:43'), isTrue);
  });

  testWidgets('shows the length of the song when it is known, with a progress bar', (tester) async {
    await open(tester, playing(durationMs: 180000));
    expect(shows('0:41 / 3:00'), isTrue);
    final bar = tester.widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator));
    expect(bar.value, closeTo(41.2 / 180, 0.001));
    expect(bar.semanticsLabel, 'Song progress');
  });

  testWidgets('without a known length there is no progress bar', (tester) async {
    await open(tester, playing());
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  testWidgets('never shows a position past the end of the song while waiting for the next state', (tester) async {
    final r = await open(tester, playing(positionMs: 58000, durationMs: 60000));
    r.rig.clockMs = 100000;
    await tester.pump(const Duration(seconds: 100));
    expect(shows('1:00 / 1:00'), isTrue);
  });

  testWidgets('a paused song does not move', (tester) async {
    final r = await open(
      tester,
      stateOf(
        status: PlayStatus.PLAY_STATUS_PAUSED,
        player: 'me',
        serverTimeMs: 1000,
        now: nowPlaying(song('1', 'A', 'B'), positionMs: 41200, positionAtMs: 1000),
      ),
    );
    r.rig.clockMs = 5000;
    await tester.pump(const Duration(seconds: 5));
    expect(shows('0:41'), isTrue);
  });

  testWidgets('only animates while the song plays', (tester) async {
    final r = await open(tester, playing());
    expect(SchedulerBinding.instance.transientCallbackCount, greaterThan(0));
    r.rig.setState(stateOf(status: PlayStatus.PLAY_STATUS_PAUSED, player: 'me', now: nowPlaying(song('1', 'A', 'B'))));
    await tester.pump();
    expect(SchedulerBinding.instance.transientCallbackCount, 0);
    r.rig.setState(playing());
    await tester.pump();
    expect(SchedulerBinding.instance.transientCallbackCount, greaterThan(0));
  });

  testWidgets('stops animating when it is removed from the screen', (tester) async {
    await open(tester, playing());
    await tester.pumpWidget(const SizedBox());
    expect(SchedulerBinding.instance.transientCallbackCount, 0);
  });

  testWidgets('stops animating while its route is covered', (tester) async {
    final r = await open(tester, playing());
    expect(SchedulerBinding.instance.transientCallbackCount, greaterThan(0));
    r.rig.setState(playing()); // still playing
    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.push(MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Text('on top'))));
    await tester.pumpAndSettle();
    expect(SchedulerBinding.instance.transientCallbackCount, 0, reason: 'a ticker must not run behind another page');
  });

  group('controls', () {
    testWidgets('Pause while playing, Play while paused', (tester) async {
      final r = await open(tester, playing());
      expect(find.text('Play'), findsNothing);
      await tester.tap(find.text('Pause'));
      await settle(tester);
      expect(r.rig.server.controls, [ControlAction.CONTROL_ACTION_PAUSE]);
      r.rig.setState(stateOf(status: PlayStatus.PLAY_STATUS_PAUSED, player: 'me', now: nowPlaying(song('1', 'A', 'B'))));
      await tester.pump();
      expect(find.text('Pause'), findsNothing);
      await tester.tap(find.text('Play'));
      await settle(tester);
      expect(r.rig.server.controls.last, ControlAction.CONTROL_ACTION_PLAY);
    });

    testWidgets('Skip', (tester) async {
      final r = await open(tester, playing());
      await tester.tap(find.text('Skip'));
      await settle(tester);
      expect(r.rig.server.controls, [ControlAction.CONTROL_ACTION_SKIP]);
    });

    testWidgets('shows a failed command', (tester) async {
      final r = await open(tester, playing());
      r.rig.server.onControl = (_) => throw ConnectException(Code.unavailable, 'down');
      await tester.tap(find.text('Skip'));
      await settle(tester);
      expect(r.said.single, startsWith('ERROR: Could not reach the server'));
    });

    testWidgets('every control has a text label', (tester) async {
      await open(tester, playing(player: 'other'));
      for (final b in tester.widgetList<ButtonStyleButton>(find.byType(ButtonStyleButton))) {
        expect(b.child, isA<Text>());
      }
    });
  });

  group('where it plays', () {
    testWidgets('on another device: says which one and offers Play here', (tester) async {
      await open(tester, playing(player: 'tv', devices: [device('tv', 'Living room TV'), device('me', 'Phone', isCaller: true)]));
      expect(shows('Playing on Living room TV'), isTrue);
      expect(find.text('Play here'), findsOneWidget);
    });

    testWidgets('Play here sends PLAY_HERE (not PLAY) and then opens the player', (tester) async {
      final r = await open(tester, playing(player: 'tv', devices: [device('tv', 'TV')]));
      await tester.tap(find.text('Play here'));
      await settle(tester);
      expect(r.rig.server.controls, [ControlAction.CONTROL_ACTION_PLAY_HERE]);
      expect(r.playHere, 1);
    });

    testWidgets('regression: a double tap on Play here sends one command and opens the player once', (tester) async {
      final r = await open(tester, playing(player: 'tv', devices: [device('tv', 'TV')]));
      final gate = Completer<void>();
      r.rig.server.onControl = (_) => gate.future;
      await tester.tap(find.text('Play here'));
      await tester.pump();
      await tester.tap(find.text('Play here'));
      await tester.pump();
      gate.complete();
      await settle(tester);
      expect(r.rig.server.controls, [ControlAction.CONTROL_ACTION_PLAY_HERE]);
      expect(r.playHere, 1);
    });

    testWidgets('a refused Play here does not open the player', (tester) async {
      final r = await open(tester, playing(player: 'tv', devices: [device('tv', 'TV')]));
      r.rig.server.onControl = (_) => throw ConnectException(Code.permissionDenied, 'no');
      await tester.tap(find.text('Play here'));
      await settle(tester);
      expect(r.playHere, 0);
      expect(r.said.single, startsWith('ERROR:'));
    });

    testWidgets('a player that is offline is not described as playing', (tester) async {
      await open(tester, playing(player: 'tv', devices: [device('tv', 'Living room TV', online: false)]));
      expect(shows('Living room TV is offline'), isTrue);
      expect(shows('Playing on'), isFalse);
      expect(find.text('Play here'), findsOneWidget);
    });

    testWidgets('on this device: says so and no Play here button', (tester) async {
      await open(tester, playing(player: 'me', devices: [device('me', 'Phone', isCaller: true)]));
      expect(shows('Playing on this device'), isTrue);
      expect(find.text('Play here'), findsNothing);
    });

    testWidgets('paused on this device', (tester) async {
      await open(tester, stateOf(status: PlayStatus.PLAY_STATUS_PAUSED, player: 'me', now: nowPlaying(song('1', 'A', 'B'))));
      expect(shows('Paused on this device'), isTrue);
    });

    testWidgets('no device is playing: says so and still offers Play here', (tester) async {
      await open(tester, stateOf(now: nowPlaying(song('1', 'A', 'B'))));
      expect(shows('No device is playing'), isTrue);
      expect(find.text('Play here'), findsOneWidget);
    });

    testWidgets('a player that is not in the device list is "another device"', (tester) async {
      await open(tester, playing(player: 'ghost'));
      expect(shows('Playing on another device'), isTrue);
    });
  });

  testWidgets('shows the Up next line', (tester) async {
    await open(
      tester,
      stateOf(
        now: nowPlaying(song('1', 'A', 'B')),
        upNext: UpNext(song: song('2', 'Next one', 'Singer')),
      ),
    );
    expect(shows('Up next: Next one — Singer'), isTrue);
  });

  testWidgets('nothing playing yet', (tester) async {
    await open(tester, stateOf());
    expect(shows('Nothing is playing. Add songs from the library.'), isTrue);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });

  testWidgets('the card is a labelled region', (tester) async {
    await open(tester, playing());
    expect(find.bySemanticsLabel('Now playing'), findsOneWidget);
  });
}
