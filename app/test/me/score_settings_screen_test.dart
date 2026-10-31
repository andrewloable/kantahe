import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/me/score_settings_screen.dart';

import 'fakes.dart';

Future<MeRig> open(
  WidgetTester tester, {
  ScoreMode mode = ScoreMode.SCORE_MODE_RANDOM,
  ScoreLevel level = ScoreLevel.SCORE_LEVEL_MIDDLE,
  bool mic = false,
}) async {
  final r = MeRig();
  r.setState(
    stateOf(
      settings: UserSettings(scoreMode: mode, scoreLevel: level),
      devices: [device('me', 'Phone').deepCopy()..micAvailable = mic],
    ),
  );
  await r.pump(tester, const ScoreSettingsScreen());
  return r;
}

ScoreMode? mode(WidgetTester tester) => tester.widget<RadioGroup<ScoreMode>>(find.byType(RadioGroup<ScoreMode>)).groupValue;
ScoreLevel? level(WidgetTester tester) => tester.widget<RadioGroup<ScoreLevel>>(find.byType(RadioGroup<ScoreLevel>)).groupValue;

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
}
