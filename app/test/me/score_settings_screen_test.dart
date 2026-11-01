import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/me/score_settings_screen.dart';

import 'fakes.dart';
import '../tv/ring_helper.dart';

Future<MeRig> open(
  WidgetTester tester, {
  ScoreMode mode = ScoreMode.SCORE_MODE_RANDOM,
  ScoreLevel level = ScoreLevel.SCORE_LEVEL_MIDDLE,
  bool mic = false,
  bool tv = false,
}) async {
  final r = MeRig(isTv: tv);
  r.setState(
    stateOf(
      settings: UserSettings(scoreMode: mode, scoreLevel: level),
      devices: [device('me', 'Phone').deepCopy()..micAvailable = mic],
    ),
  );
  await r.pump(tester, const ScoreSettingsScreen());
  return r;
}

/// Whether the option with this label shows the selected mark.
bool picked(WidgetTester tester, String label) => find
    .descendant(
      of: find.ancestor(of: find.text(label), matching: find.byType(ListTile)).first,
      matching: find.byIcon(Icons.radio_button_checked),
    )
    .evaluate()
    .isNotEmpty;

ScoreMode? mode(WidgetTester tester) => {
  'Off': ScoreMode.SCORE_MODE_OFF,
  'Random': ScoreMode.SCORE_MODE_RANDOM,
  'Microphone': ScoreMode.SCORE_MODE_MICROPHONE,
}.entries.where((e) => picked(tester, e.key)).map((e) => e.value).firstOrNull;

ScoreLevel? level(WidgetTester tester) => {
  'Low': ScoreLevel.SCORE_LEVEL_LOW,
  'Middle': ScoreLevel.SCORE_LEVEL_MIDDLE,
  'High': ScoreLevel.SCORE_LEVEL_HIGH,
}.entries.where((e) => picked(tester, e.key)).map((e) => e.value).firstOrNull;

const _options = ['Off', 'Random', 'Microphone', 'Low', 'Middle', 'High'];

/// The option that has the remote's focus, by its label (null when none has it).
String? focused(WidgetTester tester) {
  for (final label in _options) {
    if (Focus.of(tester.element(find.text(label))).hasFocus) return label;
  }
  return null;
}

Future<void> focusOption(WidgetTester tester, String label) async {
  focusNodeInside(tester, find.ancestor(of: find.text(label), matching: find.byType(ListTile))).requestFocus();
  await tester.pump();
}

Future<void> press(WidgetTester tester, LogicalKeyboardKey key) async {
  await tester.sendKeyEvent(key);
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('two groups with their legends, showing the current settings', (tester) async {
    await open(tester);
    expect(find.text('Score'), findsWidgets);
    expect(find.text('Level'), findsOneWidget);
    expect(mode(tester), ScoreMode.SCORE_MODE_RANDOM);
    expect(level(tester), ScoreLevel.SCORE_LEVEL_MIDDLE);
    expect(mode(tester), isNot(ScoreMode.SCORE_MODE_OFF));
  });

  testWidgets('choosing a mode sends only the mode', (tester) async {
    final r = await open(tester);
    await tester.tap(find.text('Off'));
    await settle(tester);
    expect(r.server.settings.single.scoreMode, ScoreMode.SCORE_MODE_OFF);
    expect(r.server.settings.single.hasScoreLevel() && r.server.settings.single.scoreLevel != ScoreLevel.SCORE_LEVEL_UNSPECIFIED, isFalse);
  });

  testWidgets('choosing a level sends only the level', (tester) async {
    final r = await open(tester);
    await tester.ensureVisible(find.text('High'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('High'));
    await settle(tester);
    expect(r.server.settings.single.scoreLevel, ScoreLevel.SCORE_LEVEL_HIGH);
    expect(r.server.settings.single.scoreMode, ScoreMode.SCORE_MODE_UNSPECIFIED);
  });

  testWidgets('the choice shows at once, and the state takes over afterwards', (tester) async {
    final r = await open(tester);
    final gate = Completer<void>();
    r.server.onSettings = (_) => gate.future;
    await tester.tap(find.text('Off'));
    await tester.pump();
    expect(mode(tester), ScoreMode.SCORE_MODE_OFF); // before the server has answered
    gate.complete();
    await settle(tester);
    expect(mode(tester), ScoreMode.SCORE_MODE_RANDOM); // the state, which has not changed, takes over
    r.setState(
      stateOf(
        settings: UserSettings(scoreMode: ScoreMode.SCORE_MODE_OFF, scoreLevel: ScoreLevel.SCORE_LEVEL_MIDDLE),
      ),
    );
    await tester.pump();
    expect(mode(tester), ScoreMode.SCORE_MODE_OFF);
  });

  testWidgets('a refusal is shown and the choice goes back', (tester) async {
    final r = await open(tester);
    r.server.onSettings = (_) => throw ConnectException(Code.unavailable, 'down');
    await tester.tap(find.text('Off'));
    await settle(tester);
    expect(shows('Could not change the score setting. Try again.'), isTrue);
    expect(mode(tester), ScoreMode.SCORE_MODE_RANDOM);
  });

  testWidgets('says what each mode does, and warns when no device could listen', (tester) async {
    await open(tester);
    expect(shows('No score after a song.'), isTrue);
    expect(shows('A score for every song, for fun.'), isTrue);
    expect(shows('The score follows how loud you sing'), isTrue);
    expect(shows('Scores from 60 to 100.'), isTrue);
    expect(shows('Needs a device with a microphone'), isTrue);
  });

  testWidgets('does not warn when a device can listen', (tester) async {
    await open(tester, mic: true);
    expect(shows('Needs a device with a microphone'), isFalse);
  });

  testWidgets('without settings in the state it shows the defaults (Random, Middle)', (tester) async {
    final r = MeRig();
    r.setState(stateOf());
    await r.pump(tester, const ScoreSettingsScreen());
    expect(mode(tester), ScoreMode.SCORE_MODE_RANDOM);
    expect(level(tester), ScoreLevel.SCORE_LEVEL_MIDDLE);
  });

  testWidgets('the remote\'s focus on a mode and on a level shows the ring, and the setting does not change', (tester) async {
    await open(tester);
    await expectNoRingWhenNotFocused(tester, find.widgetWithText(ListTile, 'Random'));
    await expectRingOnFocus(tester, find.widgetWithText(ListTile, 'Random'));
    await expectRingOnFocus(tester, find.widgetWithText(ListTile, 'Middle'));
    expect(mode(tester), ScoreMode.SCORE_MODE_RANDOM);
    expect(level(tester), ScoreLevel.SCORE_LEVEL_MIDDLE);
  });

  group('on a TV the arrow keys only move the focus', () {
    testWidgets('REGRESSION: DOWN through the options changes no setting and sends nothing', (tester) async {
      final r = await open(tester, tv: true);
      await focusOption(tester, 'Off');
      for (final next in ['Random', 'Microphone', 'Low', 'Middle']) {
        await press(tester, LogicalKeyboardKey.arrowDown);
        expect(focused(tester), next);
      }
      expect(r.server.settings, isEmpty);
    });

    testWidgets('REGRESSION: every option is reached with DOWN, from Off to High, and DOWN on High stays; UP goes back', (tester) async {
      await open(tester, tv: true);
      await focusOption(tester, 'Off');
      final seen = <String?>['Off'];
      for (var i = 0; i < 6; i++) {
        await press(tester, LogicalKeyboardKey.arrowDown);
        seen.add(focused(tester));
      }
      expect(seen, ['Off', 'Random', 'Microphone', 'Low', 'Middle', 'High', 'High']);
      await press(tester, LogicalKeyboardKey.arrowUp);
      expect(focused(tester), 'Middle');
      await press(tester, LogicalKeyboardKey.arrowUp);
      await press(tester, LogicalKeyboardKey.arrowUp);
      expect(focused(tester), 'Microphone');
    });

    testWidgets('OK on a focused option chooses it and sends only that setting', (tester) async {
      final r = await open(tester, tv: true);
      await focusOption(tester, 'Microphone');
      await press(tester, LogicalKeyboardKey.select);
      await settle(tester);
      expect(r.server.settings.single.scoreMode, ScoreMode.SCORE_MODE_MICROPHONE);
      expect(r.server.settings.single.hasScoreLevel() && r.server.settings.single.scoreLevel != ScoreLevel.SCORE_LEVEL_UNSPECIFIED, isFalse);
    });
  });
}
