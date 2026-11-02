import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/player/platform.dart';
import 'package:kantahe/player/player_screen.dart';
import 'package:kantahe/player/web_embed.dart';
import 'package:kantahe/tv/focus.dart';

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

Future<Rig> open(WidgetTester tester, {State? state, String? server = 'http://srv:1', Widget base = const Text('base screen'), bool tv = false}) async {
  if (tv) {
    // a TV screen: the buttons share one row
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }
  final q = QueueRig(isTv: tv);
  // the address first: a new address ends the session
  if (server != null) await q.services.serverUrl.set(server);
  await q.signIn('me');
  q.setState(state ?? playingHere());
  final r = Rig(q);
  await q.pump(tester, Scaffold(body: base));
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

    testWidgets('Play here is offered while this device is not the player (the page cannot take the D-pad), and sends PLAY_HERE', (tester) async {
      final r = await open(tester, state: playingHere(player: 'tv'));
      expect(find.text('Play here'), findsOneWidget);
      await tester.tap(find.text('Play here'));
      await settle(tester);
      expect(r.q.server.controls, [ControlAction.CONTROL_ACTION_PLAY_HERE]);
    });

    testWidgets('Play here is offered while no device is the player', (tester) async {
      await open(tester, state: playingHere(player: ''));
      expect(find.text('Play here'), findsOneWidget);
    });

    testWidgets('no Play here while this device is the player', (tester) async {
      await open(tester);
      expect(find.text('Play here'), findsNothing);
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
      expect(tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Pause')).autofocus, isTrue);
    });

    testWidgets('REGRESSION: Close, Pause, Skip and Play here are one kind of button, none filled (a filled Pause always looked chosen)', (tester) async {
      await open(
        tester,
        state: playingHere(player: 'tv', status: PlayStatus.PLAY_STATUS_PAUSED),
      );
      expect(find.byType(FilledButton), findsNothing);
      for (final label in ['Close', 'Play', 'Skip', 'Play here']) {
        expect(find.widgetWithText(OutlinedButton, label), findsOneWidget, reason: label);
      }
    });

    testWidgets('the remote moves the growth: Pause is larger at first, then Skip when the arrow goes right', (tester) async {
      await open(tester);
      double scale(String label) => tester
          .widget<AnimatedScale>(
            find.descendant(
              of: find.ancestor(of: find.text(label), matching: find.byType(FocusGrow)).first,
              matching: find.byType(AnimatedScale),
            ),
          )
          .scale;
      await tester.pump();
      expect(scale('Pause'), greaterThan(1));
      expect(scale('Skip'), 1);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(scale('Pause'), 1);
      expect(scale('Skip'), greaterThan(1));
    });

    testWidgets('every control has a text label', (tester) async {
      await open(tester);
      for (final b in tester.widgetList<ButtonStyleButton>(find.byType(ButtonStyleButton))) {
        expect(b.child, isA<Text>());
      }
    });
  });

  group('auto-hide', () {
    double controlsOpacity(WidgetTester tester) => tester.widget<AnimatedOpacity>(find.byKey(const Key('player-controls'))).opacity;
    bool focusExcluded(WidgetTester tester) =>
        tester.widget<ExcludeFocus>(find.ancestor(of: find.byKey(const Key('player-controls')), matching: find.byType(ExcludeFocus)).first).excluding;
    Future<void> idleFor(WidgetTester tester, int seconds) async {
      await tester.pump(Duration(seconds: seconds));
      await tester.pump(const Duration(milliseconds: 400)); // the fade
    }

    testWidgets('the buttons fade away after 4 seconds without input while a song plays here', (tester) async {
      await open(tester);
      expect(controlsOpacity(tester), 1);
      await tester.pump(const Duration(seconds: 3));
      expect(controlsOpacity(tester), 1);
      await idleFor(tester, 2);
      expect(controlsOpacity(tester), 0);
      expect(focusExcluded(tester), isTrue);
    });

    testWidgets('a key press brings them back and does nothing else: a hidden Pause is not pressed by the same key', (tester) async {
      final r = await open(tester);
      await idleFor(tester, 5);
      expect(controlsOpacity(tester), 0);
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pump(const Duration(milliseconds: 400));
      expect(controlsOpacity(tester), 1);
      expect(r.q.server.controls, isEmpty);
      // and the D-pad is ready on Pause: the next Select pauses
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await settle(tester);
      expect(r.q.server.controls, [ControlAction.CONTROL_ACTION_PAUSE]);
    });

    testWidgets('any arrow key brings them back', (tester) async {
      await open(tester);
      await idleFor(tester, 5);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump(const Duration(milliseconds: 400));
      expect(controlsOpacity(tester), 1);
      expect(focusExcluded(tester), isFalse);
    });

    testWidgets('a key press while they are shown starts the 4 seconds again', (tester) async {
      await open(tester);
      await tester.pump(const Duration(seconds: 3));
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump(const Duration(seconds: 3));
      expect(controlsOpacity(tester), 1); // 6 s after the start, 3 s after the key
      await idleFor(tester, 2);
      expect(controlsOpacity(tester), 0);
    });

    testWidgets('a touch brings them back, and the touch does not press the button under it', (tester) async {
      final r = await open(tester);
      final pause = tester.getCenter(find.text('Pause'));
      await idleFor(tester, 5);
      expect(controlsOpacity(tester), 0);
      await tester.tapAt(pause); // exactly where the hidden Pause is
      await tester.pump(const Duration(milliseconds: 400));
      expect(controlsOpacity(tester), 1);
      await settle(tester);
      expect(r.q.server.controls, isEmpty);
    });

    testWidgets('while paused they stay', (tester) async {
      await open(tester, state: playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      await idleFor(tester, 30);
      expect(controlsOpacity(tester), 1);
    });

    testWidgets('while another device is the player they stay', (tester) async {
      await open(tester, state: playingHere(player: 'tv'));
      await idleFor(tester, 30);
      expect(controlsOpacity(tester), 1);
    });

    testWidgets('pausing from elsewhere while they are hidden shows them', (tester) async {
      final r = await open(tester);
      await idleFor(tester, 5);
      expect(controlsOpacity(tester), 0);
      r.q.setState(playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      await tester.pump(const Duration(milliseconds: 400));
      expect(controlsOpacity(tester), 1);
      await idleFor(tester, 30);
      expect(controlsOpacity(tester), 1);
    });

    testWidgets('playing again hides them again after 4 seconds', (tester) async {
      final r = await open(tester, state: playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      r.q.setState(playingHere());
      await tester.pump();
      await idleFor(tester, 5);
      expect(controlsOpacity(tester), 0);
    });

    testWidgets('a page that does not load keeps its Try again in view', (tester) async {
      final r = await open(tester);
      r.config!.onError('net::ERR');
      await tester.pump();
      await idleFor(tester, 30);
      expect(find.text('Try again'), findsOneWidget);
      expect(controlsOpacity(tester), 1);
    });
  });

  group('remote focus', () {
    String focusLabel() => FocusManager.instance.primaryFocus?.debugLabel ?? '';
    // the invisible node around the whole screen: no key can leave it, so the directional focus must never land on it
    const wake = 'receives the key that wakes';
    bool buttonHasFocus(String label) => find
        .descendant(
          of: find.widgetWithText(OutlinedButton, label),
          matching: find.byElementPredicate((e) => identical(e, FocusManager.instance.primaryFocus?.context)),
        )
        .evaluate()
        .isNotEmpty;

    testWidgets('REGRESSION: Up from Pause never lands on the wake node of the whole screen (no key can leave it)', (tester) async {
      await open(tester);
      await tester.pump();
      expect(focusLabel(), 'player: Play/Pause');
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
      await tester.pump();
      expect(focusLabel(), isNot(contains(wake)));
    });

    testWidgets('REGRESSION: the remote reaches Close from Pause, and Select on it closes the player', (tester) async {
      await open(tester);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
      await tester.pump();
      if (!buttonHasFocus('Close')) {
        await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
        await tester.pump();
      }
      expect(buttonHasFocus('Close'), isTrue, reason: 'the focus is on "${focusLabel()}"');
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pumpAndSettle();
      expect(find.byType(PlayerScreen), findsNothing);
      expect(find.text('base screen'), findsOneWidget);
    });

    testWidgets('REGRESSION: no arrow key moves the focus out of the player to the screen behind it (a hidden text field popped up the keyboard)', (
      tester,
    ) async {
      await open(
        tester,
        base: const Column(
          children: [
            TextField(),
            ElevatedButton(onPressed: null, child: Text('behind')),
          ],
        ),
      );
      await tester.pump();
      final keys = [
        LogicalKeyboardKey.arrowUp,
        LogicalKeyboardKey.arrowUp,
        LogicalKeyboardKey.arrowDown,
        LogicalKeyboardKey.arrowDown,
        LogicalKeyboardKey.arrowDown,
        LogicalKeyboardKey.arrowLeft,
        LogicalKeyboardKey.arrowLeft,
        LogicalKeyboardKey.arrowRight,
        LogicalKeyboardKey.arrowRight,
        LogicalKeyboardKey.arrowRight,
        LogicalKeyboardKey.arrowUp,
      ];
      for (final key in keys) {
        await tester.sendKeyEvent(key);
        await tester.pump();
        final context = FocusManager.instance.primaryFocus?.context;
        final inPlayer = find.ancestor(of: find.byElementPredicate((e) => identical(e, context)), matching: find.byType(PlayerScreen)).evaluate().isNotEmpty;
        expect(inPlayer, isTrue, reason: 'after ${key.keyLabel} the focus is on "${focusLabel()}", outside the player');
      }
    });

    testWidgets('REGRESSION (a9v.9): when the screen behind the player takes the focus, it goes back to the player', (tester) async {
      final behind = FocusNode(debugLabel: 'behind the player');
      addTearDown(behind.dispose);
      await open(
        tester,
        base: Focus(focusNode: behind, child: const Text('behind')),
      );
      await tester.pump();
      expect(focusLabel(), 'player: Play/Pause');
      behind.requestFocus(); // as the library's own autofocus does when it lands after the player was pushed
      await tester.pump();
      await tester.pump();
      expect(focusLabel(), 'player: Play/Pause');
    });

    testWidgets('while another screen is on top of the player, the player leaves the focus to it', (tester) async {
      await open(tester);
      final top = FocusNode(debugLabel: 'on top of the player');
      addTearDown(top.dispose);
      tester
          .state<NavigatorState>(find.byType(Navigator))
          .push(
            MaterialPageRoute<void>(
              builder: (_) => Scaffold(
                body: Focus(focusNode: top, autofocus: true, child: const Text('top')),
              ),
            ),
          );
      await tester.pumpAndSettle();
      expect(focusLabel(), 'on top of the player');
      top.requestFocus();
      await tester.pump();
      await tester.pump();
      expect(focusLabel(), 'on top of the player');
    });

    testWidgets('review: the arrows reach Close, Pause, Skip and Play here, and Select presses the one that has the focus', (tester) async {
      final r = await open(tester, state: playingHere(player: 'tv')); // another device plays: Close, Pause, Skip, Play here
      await tester.pump();
      expect(buttonHasFocus('Pause'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(buttonHasFocus('Skip'), isTrue, reason: 'the focus is on "${focusLabel()}"');
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(buttonHasFocus('Play here'), isTrue, reason: 'the focus is on "${focusLabel()}"');
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.pump();
      expect(buttonHasFocus('Pause'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.pump();
      expect(buttonHasFocus('Close'), isTrue, reason: 'the focus is on "${focusLabel()}"');
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(buttonHasFocus('Play here'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await settle(tester);
      expect(r.q.server.controls, [ControlAction.CONTROL_ACTION_PLAY_HERE]);
    });

    testWidgets('opened while paused the buttons are shown and a button has the focus, not the wake node', (tester) async {
      await open(tester, state: playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      await tester.pump();
      expect(find.widgetWithText(OutlinedButton, 'Play'), findsOneWidget);
      expect(focusLabel(), isNot(contains(wake)));
      expect(focusLabel(), isNotEmpty);
    });
  });

  group('foreground only', () {
    Future<void> goToBackground(WidgetTester tester) async {
      for (final s in [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]) {
        tester.binding.handleAppLifecycleStateChanged(s);
        await tester.pump();
      }
      await settle(tester);
    }

    Future<void> comeBack(WidgetTester tester) async {
      for (final s in [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]) {
        tester.binding.handleAppLifecycleStateChanged(s);
        await tester.pump();
      }
      await settle(tester);
    }

    testWidgets('REGRESSION: going to the background pauses the song that plays here and unloads the page', (tester) async {
      final r = await open(tester);
      await goToBackground(tester);
      expect(r.q.server.controls, [ControlAction.CONTROL_ACTION_PAUSE]);
      expect(r.host.unloads, 1);
    });

    testWidgets('coming back loads the page again and does not press Play', (tester) async {
      final r = await open(tester);
      await goToBackground(tester);
      await comeBack(tester);
      expect(r.host.loads, 1);
      expect(r.host.unloads, 1);
      expect(r.q.server.controls, [ControlAction.CONTROL_ACTION_PAUSE]);
    });

    testWidgets('the screen is allowed to sleep while the app is in the background', (tester) async {
      final r = await open(tester);
      expect(r.awake.log.last, isTrue);
      await goToBackground(tester);
      expect(r.awake.log.last, isFalse);
    });

    testWidgets('a state that arrives while the app is in the background does not take the wake lock again', (tester) async {
      final r = await open(tester);
      await goToBackground(tester);
      expect(r.awake.log.last, isFalse);
      r.q.setState(playingHere()); // the last known state still says "playing here"
      await settle(tester);
      expect(r.awake.log.last, isFalse);
      await comeBack(tester);
      r.q.setState(playingHere(status: PlayStatus.PLAY_STATUS_PAUSED));
      await settle(tester);
      expect(r.awake.log.last, isFalse);
    });

    testWidgets('nothing is sent while the song is paused or another device plays, but the page is still unloaded', (tester) async {
      for (final state in [playingHere(status: PlayStatus.PLAY_STATUS_PAUSED), playingHere(player: 'tv')]) {
        final r = await open(tester, state: state);
        await goToBackground(tester);
        expect(r.q.server.controls, isEmpty);
        expect(r.host.unloads, 1);
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('inactive alone (a system sheet) does nothing', (tester) async {
      final r = await open(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await settle(tester);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await settle(tester);
      expect(r.host.unloads, 0);
      expect(r.host.loads, 0);
      expect(r.q.server.controls, isEmpty);
    });

    testWidgets('hidden and then paused unload the page once', (tester) async {
      final r = await open(tester);
      await goToBackground(tester);
      expect(r.host.unloads, 1);
      expect(r.q.server.controls, hasLength(1));
    });

    testWidgets('review: two trips to the background unload and load twice, and pause only a song that plays', (tester) async {
      final r = await open(tester);
      await goToBackground(tester);
      await comeBack(tester);
      await goToBackground(tester);
      await comeBack(tester);
      expect(r.host.unloads, 2);
      expect(r.host.loads, 2);
      // the second trip found the stale state "playing here" again, as in the app until the stream answers
      expect(r.q.server.controls.every((c) => c == ControlAction.CONTROL_ACTION_PAUSE), isTrue);
    });

    testWidgets('review: after the player is closed, trips to the background do nothing to the page that is gone', (tester) async {
      final r = await open(tester);
      tester.state<NavigatorState>(find.byType(Navigator)).pop();
      await tester.pumpAndSettle();
      expect(find.byType(PlayerScreen), findsNothing);
      await goToBackground(tester);
      await comeBack(tester);
      expect(tester.takeException(), isNull);
      expect(r.host.unloads, 0);
      expect(r.host.loads, 0);
    });

    testWidgets('review: the token goes only to a page that is loaded: not to about:blank, again after coming back', (tester) async {
      final r = await open(tester);
      await goToBackground(tester);
      r.config!.onMessage('KantaheReady');
      await settle(tester);
      expect(r.host.scripts, isEmpty, reason: 'the page is about:blank');
      await comeBack(tester);
      r.config!.onMessage('KantaheReady');
      await settle(tester);
      expect(r.host.scripts, hasLength(1));
      expect(r.host.scripts.single, contains('setToken'));
    });

    testWidgets('review: the wake lock is taken again only when the state says playing here after coming back', (tester) async {
      final r = await open(tester);
      await goToBackground(tester);
      await comeBack(tester);
      expect(r.awake.log.last, isFalse, reason: 'the song was paused by the trip');
      r.q.setState(playingHere());
      await settle(tester);
      expect(r.awake.log.last, isTrue);
    });

    testWidgets('about:blank is the only extra address the page may go to', (tester) async {
      final r = await open(tester);
      final allow = r.config!.allowNavigation;
      expect(allow(Uri.parse('about:blank')), isTrue);
      expect(allow(Uri.parse('http://srv:1/embed/player')), isTrue);
      expect(allow(Uri.parse('http://evil.example/')), isFalse);
      expect(allow(Uri.parse('about:srcdoc')), isFalse);
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

  group('connect a phone', () {
    const address = 'http://192.0.2.10:8080';
    double controlsOpacity(WidgetTester tester) => tester.widget<AnimatedOpacity>(find.byKey(const Key('player-controls'))).opacity;
    String focusLabel() => FocusManager.instance.primaryFocus?.debugLabel ?? '';
    Future<void> gone(WidgetTester tester, int seconds) async {
      await tester.pump(Duration(seconds: seconds));
      await tester.pump(const Duration(milliseconds: 400));
    }

    Future<Rig> openCard(WidgetTester tester) async {
      final r = await open(tester, server: address, tv: true);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight); // Pause -> Skip
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight); // Skip -> Volume down
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight); // Volume down -> Volume up
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight); // Volume up -> Connect a phone
      await tester.pump();
      expect(focusLabel(), 'player: Connect a phone');
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pump(const Duration(milliseconds: 400));
      return r;
    }

    testWidgets('REGRESSION: on a TV the player has a Connect a phone button the remote can reach', (tester) async {
      await open(tester, server: address, tv: true);
      expect(find.text('Connect a phone'), findsOneWidget);
    });

    testWidgets('it is not there on a phone or tablet', (tester) async {
      await open(tester, server: address);
      expect(find.text('Connect a phone'), findsNothing);
    });

    testWidgets('OK shows the QR of the server address and the address, and nothing else is in the QR', (tester) async {
      await openCard(tester);
      // the QR's key is built from the very string the QR encodes
      expect(find.byKey(const ValueKey('qr:$address')), findsOneWidget);
      expect(find.byType(QrImageView), findsOneWidget);
      expect(find.text(address), findsOneWidget);
    });

    testWidgets('the card hides by itself after 10 seconds, not before, and the focus is back on the button', (tester) async {
      await openCard(tester);
      await tester.pump(const Duration(seconds: 9));
      expect(find.byType(QrImageView), findsOneWidget);
      await gone(tester, 2);
      expect(find.byType(QrImageView), findsNothing);
      expect(focusLabel(), 'player: Connect a phone');
    });

    testWidgets('Back closes the card and not the player; the next Back leaves the player', (tester) async {
      await openCard(tester);
      await tester.binding.handlePopRoute();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byType(QrImageView), findsNothing);
      expect(find.byType(PlayerScreen), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(PlayerScreen), findsNothing);
    });

    testWidgets('the controls stay while the card is open and fade again after it, as before', (tester) async {
      await openCard(tester);
      await tester.pump(const Duration(seconds: 2));
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft); // any key starts the 4 seconds of the buttons again, which must not hide them now
      await tester.pump(const Duration(seconds: 6));
      expect(controlsOpacity(tester), 1);
      await gone(tester, 3); // the card is gone
      expect(find.byType(QrImageView), findsNothing);
      expect(controlsOpacity(tester), 1);
      await gone(tester, 5);
      expect(controlsOpacity(tester), 0);
    });

    testWidgets('a second press on the button starts the 10 seconds again', (tester) async {
      await openCard(tester);
      await tester.pump(const Duration(seconds: 7));
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pump();
      await tester.pump(const Duration(seconds: 7)); // 14 seconds after the first press
      expect(find.byType(QrImageView), findsOneWidget);
      await gone(tester, 4);
      expect(find.byType(QrImageView), findsNothing);
    });
  });

  group('volume', () {
    const me = 'me';
    double controlsOpacity(WidgetTester tester) => tester.widget<AnimatedOpacity>(find.byKey(const Key('player-controls'))).opacity;
    State withVolumes({int? mp3, int? midi, Format format = Format.FORMAT_MP3, bool song = true}) => stateOf(
      status: PlayStatus.PLAY_STATUS_PLAYING,
      player: me,
      devices: [
        device(me, 'This device', isCaller: true, mp3VolumePct: mp3, midiVolumePct: midi),
        device('tv', 'TV'),
      ],
      now: song ? nowPlaying(Song(number: '1', title: 'A', artist: 'B', format: format)) : null,
    );
    Future<Rig> openWith(WidgetTester tester, State s) {
      // a wide screen: the buttons share one row, as on a TV
      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      return open(tester, state: s);
    }

    testWidgets('a MIDI song: Volume up shows 105 at once and sends one request with midiPct 105 and no mp3Pct after 300 ms', (tester) async {
      final r = await openWith(tester, withVolumes(mp3: 100, midi: 100, format: Format.FORMAT_MIDI));
      expect(find.text('MIDI volume 100%'), findsOneWidget);
      await tester.tap(find.text('Volume up'));
      await tester.pump();
      expect(find.text('MIDI volume 105%'), findsOneWidget);
      expect(r.q.server.volumes, isEmpty);
      await tester.pump(const Duration(milliseconds: 310));
      expect(r.q.server.volumes, hasLength(1));
      expect(r.q.server.volumes.single.deviceId, me);
      expect(r.q.server.volumes.single.midiPct, 105);
      expect(r.q.server.volumes.single.hasMp3Pct(), isFalse);
    });

    testWidgets('an MP3 song: three presses of Volume down within the pause send ONE request with mp3Pct 35', (tester) async {
      final r = await openWith(tester, withVolumes(mp3: 50, midi: 100));
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text('Volume down'));
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(r.q.server.volumes, isEmpty);
      await tester.pump(const Duration(milliseconds: 310));
      expect(r.q.server.volumes, hasLength(1));
      expect(r.q.server.volumes.single.mp3Pct, 35);
      expect(r.q.server.volumes.single.hasMidiPct(), isFalse);
    });

    testWidgets('it stops at 200 and at 0 and sends nothing', (tester) async {
      final r = await openWith(tester, withVolumes(mp3: 200, midi: 0));
      await tester.tap(find.text('Volume up'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('MP3 volume 200%'), findsOneWidget);
      r.q.setState(withVolumes(mp3: 200, midi: 0, format: Format.FORMAT_MIDI));
      await tester.pump();
      await tester.tap(find.text('Volume down'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('MIDI volume 0%'), findsOneWidget);
      expect(r.q.server.volumes, isEmpty);
    });

    testWidgets('while another device is the player there are no volume buttons here', (tester) async {
      await open(tester, state: playingHere(player: 'tv'));
      expect(find.text('Volume up'), findsNothing);
    });

    testWidgets('a server that sends no volumes (older) starts at 100', (tester) async {
      await openWith(tester, withVolumes());
      expect(find.text('MP3 volume 100%'), findsOneWidget);
    });

    testWidgets('REGRESSION: a refused request puts the old value back and shows the error', (tester) async {
      final r = await openWith(tester, withVolumes(mp3: 100, midi: 100));
      r.q.server.onVolume = (_) => throw ConnectException(Code.permissionDenied, 'not yours');
      await tester.tap(find.text('Volume up'));
      await tester.pump();
      expect(find.text('MP3 volume 105%'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 310));
      await tester.pump();
      await tester.pump();
      expect(find.text('MP3 volume 100%'), findsOneWidget);
      expect(find.byType(SnackBar), findsOneWidget);
    });

    testWidgets('with no song current there are no volume buttons', (tester) async {
      await openWith(tester, withVolumes(song: false));
      expect(find.text('Volume up'), findsNothing);
      expect(find.text('Volume down'), findsNothing);
    });

    testWidgets('a value the server later shows differently is not hidden by the earlier step', (tester) async {
      final r = await openWith(tester, withVolumes(mp3: 100, midi: 100));
      await tester.tap(find.text('Volume up'));
      await tester.pump(const Duration(milliseconds: 310));
      r.q.setState(withVolumes(mp3: 105, midi: 100));
      await tester.pump();
      r.q.setState(withVolumes(mp3: 60, midi: 100));
      await tester.pump();
      expect(find.text('MP3 volume 60%'), findsOneWidget);
    });

    testWidgets('the D-pad reaches Volume down and Volume up after Skip, and OK changes the level', (tester) async {
      final r = await openWith(tester, withVolumes(mp3: 100, midi: 100));
      await tester.pump();
      bool onButton(String label) => find
          .descendant(
            of: find.widgetWithText(OutlinedButton, label),
            matching: find.byElementPredicate((e) => identical(e, FocusManager.instance.primaryFocus?.context)),
          )
          .evaluate()
          .isNotEmpty;
      expect(onButton('Pause'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(onButton('Skip'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(onButton('Volume down'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(onButton('Volume up'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pump();
      expect(find.text('MP3 volume 105%'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 310));
      expect(r.q.server.volumes.single.mp3Pct, 105);
    });

    testWidgets('pressing a volume button starts the 4 seconds of the controls again', (tester) async {
      await openWith(tester, withVolumes(mp3: 100, midi: 100));
      await tester.pump(const Duration(seconds: 3));
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump(const Duration(seconds: 3)); // 6 seconds after the start, 3 after the key
      expect(controlsOpacity(tester), 1);
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 400));
      expect(controlsOpacity(tester), 0);
    });
  });
}
