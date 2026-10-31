import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/player/platform.dart';
import 'package:kantahe/player/player_screen.dart';
import 'package:kantahe/player/web_embed.dart';

import '../queue/fakes.dart';
import 'embed_bridge_test.dart' show FakeHost, argsOf;

class FakeAwake implements ScreenAwake {
  final log = <bool>[];

  @override
  Future<void> enable() async => log.add(true);

  @override
  Future<void> disable() async => log.add(false);
}

class Rig {
  Rig(this.q);

  final QueueRig q;
  final host = FakeHost();
  final awake = FakeAwake();
  EmbedConfig? config;
  int builds = 0;
  int osAsked = 0;
  bool osAnswer = true;

  Widget embed(BuildContext context, EmbedConfig c) {
    config = c;
    builds++;
    c.onHost(host);
    return const ColoredBox(key: Key('embed'), color: Colors.black);
  }
}

State playingHere({ScoreMode? mode, String player = 'me', PlayStatus status = PlayStatus.PLAY_STATUS_PLAYING}) => stateOf(
  status: status,
  player: player,
  settings: mode == null ? null : UserSettings(scoreMode: mode),
  now: nowPlaying(song('1', 'A', 'B')),
);

Future<Rig> open(WidgetTester tester, {State? state, String? server = 'http://srv:1'}) async {
  final q = QueueRig();
  // the address first: a new address ends the session
  if (server != null) await q.services.serverUrl.set(server);
  await q.signIn('me');
  q.setState(state ?? playingHere());
  final r = Rig(q);
  await q.pump(tester, const Scaffold(body: Text('base screen')));
  // pushed on top of another screen, as in the app (so that Close has somewhere to go back to)
  tester
      .state<NavigatorState>(find.byType(Navigator))
      .push(
        MaterialPageRoute<void>(
          builder: (_) => PlayerScreen(
            embedBuilder: r.embed,
            screenAwake: r.awake,
            osMicrophone: () async {
              r.osAsked++;
              return r.osAnswer;
            },
          ),
        ),
      );
  await tester.pumpAndSettle();
  return r;
}

void main() {
  testWidgets('loads the player page of the server, with no token in the address', (tester) async {
    final r = await open(tester);
    expect(r.config!.url.toString(), 'http://srv:1/embed/player');
    expect(r.config!.url.hasQuery, isFalse);
  });

  testWidgets('hands the token over only after the page says it is ready', (tester) async {
    final r = await open(tester);
    expect(r.host.scripts, isEmpty);
    r.config!.onMessage('KantaheReady');
    await tester.pump();
    expect(argsOf(r.host.scripts.single), ['t', 'me', 'http://srv:1']);
  });

  testWidgets('regression: the page may only navigate within the server address', (tester) async {
    final r = await open(tester);
    expect(r.config!.allowNavigation(Uri.parse('http://srv:1/embed/player')), isTrue);
    expect(r.config!.allowNavigation(Uri.parse('http://srv:1/assets/app.js')), isTrue);
    expect(r.config!.allowNavigation(Uri.parse('https://evil.example/')), isFalse);
    expect(r.config!.allowNavigation(Uri.parse('http://srv:2/')), isFalse);
  });

  testWidgets('without a server address it says so and loads nothing', (tester) async {
    final r = await open(tester, server: null);
    expect(shows('server'), isTrue);
    expect(r.builds, 0);
  });

  group('native controls', () {
    testWidgets('Pause while playing, Play while paused, Skip', (tester) async {
      final r = await open(tester);
      expect(find.text('Play'), findsNothing);
      await tester.tap(find.text('Pause'));
      await settle(tester);
      expect(r.q.server.controls, [ControlAction.CONTROL_ACTION_PAUSE]);
      r.q.setState(playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      await tester.pump();
      expect(find.text('Pause'), findsNothing);
      await tester.tap(find.text('Play'));
      await settle(tester);
      expect(r.q.server.controls.last, ControlAction.CONTROL_ACTION_PLAY);
      await tester.tap(find.text('Skip'));
      await settle(tester);
      expect(r.q.server.controls.last, ControlAction.CONTROL_ACTION_SKIP);
    });

    testWidgets('a failed command is shown', (tester) async {
      final r = await open(tester);
      r.q.server.onControl = (_) => throw ConnectException(Code.unavailable, 'down');
      await tester.tap(find.text('Skip'));
      await settle(tester);
      expect(shows('Could not reach the server'), isTrue);
    });

    testWidgets('regression: Close pauses what was playing here: the page and its sound are gone, other devices must not show "playing"', (tester) async {
      final r = await open(tester);
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(find.byType(PlayerScreen), findsNothing);
      expect(find.text('base screen'), findsOneWidget);
      expect(r.q.server.controls, [ControlAction.CONTROL_ACTION_PAUSE]);
    });

    testWidgets('Close sends nothing while paused', (tester) async {
      final r = await open(tester, state: playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(r.q.server.controls, isEmpty);
    });

    testWidgets('Close sends nothing when another device is the player', (tester) async {
      final r = await open(tester, state: playingHere(player: 'tv'));
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(r.q.server.controls, isEmpty);
    });

    testWidgets('the page never takes focus: the D-pad belongs to the native buttons', (tester) async {
      await open(tester);
      expect(find.ancestor(of: find.byKey(const Key('embed')), matching: find.byType(ExcludeFocus)), findsOneWidget);
      expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Pause')).autofocus, isTrue);
    });

    testWidgets('every control has a text label', (tester) async {
      await open(tester);
      for (final b in tester.widgetList<ButtonStyleButton>(find.byType(ButtonStyleButton))) {
        expect(b.child, isA<Text>());
      }
    });
  });

  group('microphone', () {
    testWidgets('in Microphone score mode the OS permission is asked, and the page gets what the user answered', (tester) async {
      final r = await open(tester, state: playingHere(mode: ScoreMode.SCORE_MODE_MICROPHONE));
      expect(await r.config!.onPermission({EmbedPermission.microphone}), isTrue);
      expect(r.osAsked, 1);
      r.osAnswer = false;
      expect(await r.config!.onPermission({EmbedPermission.microphone}), isFalse);
      expect(r.osAsked, 2);
    });

    testWidgets('in any other score mode the page is refused and the OS is not asked', (tester) async {
      for (final mode in [ScoreMode.SCORE_MODE_OFF, ScoreMode.SCORE_MODE_RANDOM, ScoreMode.SCORE_MODE_UNSPECIFIED]) {
        final r = await open(tester, state: playingHere(mode: mode));
        expect(await r.config!.onPermission({EmbedPermission.microphone}), isFalse, reason: '$mode');
        expect(r.osAsked, 0, reason: '$mode');
      }
    });

    testWidgets('without settings in the state the page is refused', (tester) async {
      final r = await open(tester);
      expect(await r.config!.onPermission({EmbedPermission.microphone}), isFalse);
      expect(r.osAsked, 0);
    });

    testWidgets('a camera, or anything else, is never granted', (tester) async {
      final r = await open(tester, state: playingHere(mode: ScoreMode.SCORE_MODE_MICROPHONE));
      expect(await r.config!.onPermission({EmbedPermission.camera}), isFalse);
      expect(await r.config!.onPermission({EmbedPermission.other}), isFalse);
      expect(await r.config!.onPermission({EmbedPermission.microphone, EmbedPermission.camera}), isFalse);
      expect(r.osAsked, 0);
    });
  });

  group('page errors', () {
    testWidgets('a page that does not load shows why, and Try again loads it again', (tester) async {
      final r = await open(tester);
      r.config!.onError('net::ERR_CONNECTION_REFUSED');
      await tester.pump();
      expect(shows('Could not load the player'), isTrue);
      await tester.tap(find.text('Try again'));
      await tester.pump();
      expect(r.host.reloads, 1);
      expect(shows('Could not load the player'), isFalse);
    });
  });

  group('screen awake', () {
    testWidgets('kept awake while a song plays on this device', (tester) async {
      final r = await open(tester);
      expect(r.awake.log, [true]);
    });

    testWidgets('released when paused, taken again when playing, released on leaving', (tester) async {
      final r = await open(tester);
      r.q.setState(playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      await tester.pump();
      expect(r.awake.log, [true, false]);
      r.q.setState(playingHere());
      await tester.pump();
      expect(r.awake.log, [true, false, true]);
      await tester.pumpWidget(const SizedBox());
      expect(r.awake.log.last, false);
    });

    testWidgets('not taken while another device is the player', (tester) async {
      final r = await open(tester, state: playingHere(player: 'tv'));
      expect(r.awake.log.where((on) => on), isEmpty);
    });

    testWidgets('unchanged states do not ask the platform again', (tester) async {
      final r = await open(tester);
      r.q.setState(playingHere());
      await tester.pump();
      r.q.setState(playingHere());
      await tester.pump();
      expect(r.awake.log, [true]);
    });
  });
}
