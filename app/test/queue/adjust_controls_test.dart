import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/queue/adjust_controls.dart';
import 'package:kantahe/queue/queue_actions.dart';

import 'fakes.dart';

// The volume and the guide vocals of the device that plays, adjusted from the queue screen of any device (kantahe-der). The player screen has none.

Device tv({int mp3 = 100, int midi = 100, bool on = false, int pct = 60, VocalsState state = VocalsState.VOCALS_STATE_OFF, bool newServer = true}) => device(
  'tv',
  'Living room TV',
  mp3VolumePct: mp3,
  midiVolumePct: midi,
  vocalsOn: newServer ? on : null,
  vocalsPct: newServer ? pct : null,
  vocalsState: newServer ? state : VocalsState.VOCALS_STATE_UNSPECIFIED,
);

State stateWith(Song s, {Device? player, String playerId = 'tv', bool noSong = false, int tempo = 100}) => stateOf(
  status: PlayStatus.PLAY_STATUS_PLAYING,
  player: playerId,
  devices: [device('me', 'Phone', isCaller: true), player ?? tv()],
  now: noSong ? null : nowPlaying(s, positionAtMs: 1000, tempoPct: tempo),
  serverTimeMs: 1000,
);

final vocalsSong = song('00001', 'Hello', 'Adele', hasVocals: true);
final plainSong = song('00002', 'Plain', 'Adele');
final midiSong = song('00003', 'Skyfall', 'Adele', format: Format.FORMAT_MIDI);

Future<QueueRig> open(WidgetTester tester, State state, {List<String>? said}) async {
  await tester.pumpWidget(const SizedBox()); // a fresh tree: the state of an earlier call in the same test is gone
  final rig = QueueRig();
  await rig.signIn('me');
  rig.setState(state);
  final actions = QueueActions(
    api: rig.api,
    notify: (m, {bool error = false, String? actionLabel, VoidCallback? onAction}) => said?.add(error ? 'ERROR: $m' : m),
  );
  await rig.pump(
    tester,
    Scaffold(
      body: SingleChildScrollView(child: AdjustControls(actions: actions)),
    ),
  );
  await settle(tester);
  return rig;
}

bool hasButton(String name) => find.widgetWithText(OutlinedButton, name).evaluate().isNotEmpty;
Future<void> press(WidgetTester tester, String name) async {
  await tester.tap(find.widgetWithText(OutlinedButton, name));
  await tester.pump();
}

void main() {
  testWidgets('shows_volume_for_the_song_kind: MP3 song, MIDI song', (tester) async {
    await open(tester, stateWith(plainSong, player: tv(mp3: 60, midi: 120)));
    expect(find.text('MP3 volume 60%'), findsOneWidget);
    await open(tester, stateWith(midiSong, player: tv(mp3: 60, midi: 120)));
    expect(find.text('MIDI volume 120%'), findsOneWidget);
  });

  testWidgets('volume_up_calls_setVolume_for_the_player_device: the last value after a pause, for the TV and not this phone', (tester) async {
    final rig = await open(tester, stateWith(plainSong));
    await press(tester, 'Volume up');
    await press(tester, 'Volume up');
    await press(tester, 'Volume down');
    expect(find.text('MP3 volume 105%'), findsOneWidget); // shown at once
    expect(rig.server.volumes, isEmpty);
    await settle(tester, 400);
    expect(rig.server.volumes.map((r) => (r.deviceId, r.hasMp3Pct() ? r.mp3Pct : null, r.hasMidiPct() ? r.midiPct : null)), [('tv', 105, null)]);
  });

  testWidgets('a MIDI song sends midi_pct and the level stops at 200', (tester) async {
    final rig = await open(tester, stateWith(midiSong, player: tv(midi: 195)));
    for (var i = 0; i < 4; i++) {
      await press(tester, 'Volume up');
    }
    await settle(tester, 400);
    expect(find.text('MIDI volume 200%'), findsOneWidget);
    expect(rig.server.volumes.map((r) => (r.deviceId, r.hasMidiPct() ? r.midiPct : null)), [('tv', 200)]);
  });

  testWidgets('when this device plays the buttons act on this device', (tester) async {
    final rig = await open(tester, stateWith(plainSong, playerId: 'me', player: tv()));
    await press(tester, 'Volume down');
    await settle(tester, 400);
    expect(rig.server.volumes.map((r) => (r.deviceId, r.mp3Pct)), [('me', 95)]);
  });

  testWidgets('nothing_without_a_player: no device plays, or no song is current', (tester) async {
    await open(tester, stateWith(plainSong, playerId: ''));
    expect(find.byType(OutlinedButton), findsNothing);
    await open(tester, stateWith(plainSong, noSong: true));
    expect(find.byType(OutlinedButton), findsNothing);
  });

  testWidgets('vocals_controls_only_for_vocals_songs: a plain MP3 song, a MIDI song, and a server that does not keep the choice', (tester) async {
    await open(tester, stateWith(plainSong));
    expect(shows('Vocals'), isFalse);
    await open(tester, stateWith(song('00003', 'Skyfall', 'Adele', format: Format.FORMAT_MIDI, hasVocals: true)));
    expect(shows('Vocals'), isFalse);
    await open(tester, stateWith(vocalsSong, player: tv(newServer: false)));
    expect(hasButton('Volume up'), isTrue);
    expect(shows('Vocals'), isFalse);
  });

  testWidgets('vocals_button_shows_reported_state: off, loading…, on, and the level only while not off; the guide shows on although the choice is off', (
    tester,
  ) async {
    await open(tester, stateWith(vocalsSong));
    expect(hasButton('Vocals: off'), isTrue);
    expect(hasButton('Vocals quieter'), isFalse);
    await open(tester, stateWith(vocalsSong, player: tv(on: true, state: VocalsState.VOCALS_STATE_LOADING)));
    expect(hasButton('Vocals: loading…'), isTrue);
    await open(tester, stateWith(vocalsSong, player: tv(on: true, pct: 40, state: VocalsState.VOCALS_STATE_ON)));
    expect(hasButton('Vocals: on'), isTrue);
    expect(find.text('Vocals volume 40%'), findsOneWidget);
    await open(tester, stateWith(vocalsSong, player: tv(on: false, state: VocalsState.VOCALS_STATE_ON)));
    expect(hasButton('Vocals: on'), isTrue);
    // a player that has not reported yet is shown by the choice
    await open(tester, stateWith(vocalsSong, player: tv(on: true, state: VocalsState.VOCALS_STATE_UNSPECIFIED)));
    expect(hasButton('Vocals: on'), isTrue);
  });

  testWidgets('vocals_toggle_calls_setVocals_for_the_player_device: on when it reads off, off when it reads on', (tester) async {
    final rig = await open(tester, stateWith(vocalsSong));
    await press(tester, 'Vocals: off');
    rig.setState(stateWith(vocalsSong, player: tv(on: false, state: VocalsState.VOCALS_STATE_ON))); // the guide plays by itself
    await settle(tester);
    await press(tester, 'Vocals: on');
    await settle(tester);
    expect(rig.server.vocals.map((r) => (r.deviceId, r.hasOn() ? r.on : null, r.hasPct() ? r.pct : null)), [('tv', true, null), ('tv', false, null)]);
  });

  testWidgets('the vocals level moves by 10 from 0 to 100, sent after a pause', (tester) async {
    final rig = await open(tester, stateWith(vocalsSong, player: tv(on: true, pct: 60, state: VocalsState.VOCALS_STATE_ON)));
    await press(tester, 'Vocals quieter');
    await press(tester, 'Vocals quieter');
    expect(find.text('Vocals volume 40%'), findsOneWidget);
    expect(rig.server.vocals, isEmpty);
    await settle(tester, 400);
    expect(rig.server.vocals.map((r) => (r.deviceId, r.hasOn() ? r.on : null, r.pct)), [('tv', null, 40)]);
    for (var i = 0; i < 12; i++) {
      await press(tester, 'Vocals louder');
    }
    await settle(tester, 400);
    expect(find.text('Vocals volume 100%'), findsOneWidget);
  });

  testWidgets('a refused change shows an error and the old level comes back', (tester) async {
    final said = <String>[];
    final rig = await open(tester, stateWith(plainSong), said: said);
    rig.server.onVolume = (_) => throw ConnectException(Code.internal, 'no');
    await press(tester, 'Volume up');
    await settle(tester, 400);
    expect(said.any((m) => m.startsWith('ERROR')), isTrue);
    expect(find.text('MP3 volume 100%'), findsOneWidget);
  });

  testWidgets('the state is the truth after a change: another device moving the level shows here', (tester) async {
    final rig = await open(tester, stateWith(plainSong));
    await press(tester, 'Volume up');
    await settle(tester, 400);
    rig.setState(stateWith(plainSong, player: tv(mp3: 105)));
    await settle(tester);
    rig.setState(stateWith(plainSong, player: tv(mp3: 80)));
    await settle(tester);
    expect(find.text('MP3 volume 80%'), findsOneWidget);
  });

  group('tempo', () {
    bool enabled(WidgetTester t, String name) => t.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, name)).onPressed != null;

    testWidgets('shows the tempo and Slower and Faster; Normal speed only while the tempo is not 100', (tester) async {
      final rig = await open(tester, stateWith(plainSong));
      expect(find.text('Tempo 100%'), findsOneWidget);
      expect(hasButton('Slower'), isTrue);
      expect(hasButton('Faster'), isTrue);
      expect(hasButton('Normal speed'), isFalse);
      rig.setState(stateWith(plainSong, tempo: 85));
      await settle(tester);
      expect(find.text('Tempo 85%'), findsOneWidget);
      expect(hasButton('Normal speed'), isTrue);
    });

    testWidgets('slower_sends_SetTempo_95 and faster_sends_105, once after a pause with the last value', (tester) async {
      final rig = await open(tester, stateWith(plainSong));
      await press(tester, 'Slower');
      expect(find.text('Tempo 95%'), findsOneWidget);
      expect(rig.server.tempos, isEmpty);
      await settle(tester, 400);
      expect(rig.server.tempos, [95]);
      await press(tester, 'Faster');
      await press(tester, 'Faster');
      await settle(tester, 400);
      expect(rig.server.tempos, [95, 105]);
    });

    testWidgets('faster_disabled_at_125 and slower_disabled_at_75', (tester) async {
      await open(tester, stateWith(plainSong, tempo: 125));
      expect(enabled(tester, 'Faster'), isFalse);
      expect(enabled(tester, 'Slower'), isTrue);
      await open(tester, stateWith(plainSong, tempo: 75));
      expect(enabled(tester, 'Slower'), isFalse);
      expect(enabled(tester, 'Faster'), isTrue);
    });

    testWidgets('Normal speed sends 100', (tester) async {
      final rig = await open(tester, stateWith(plainSong, tempo: 80));
      await press(tester, 'Normal speed');
      await settle(tester, 400);
      expect(rig.server.tempos, [100]);
    });

    testWidgets('an older server (no tempo in the state) has no tempo controls', (tester) async {
      await open(tester, stateWith(plainSong, tempo: 0));
      expect(shows('Tempo'), isFalse);
      expect(hasButton('Slower'), isFalse);
      expect(hasButton('Volume up'), isTrue);
    });

    testWidgets('a refused change shows an error and the old tempo comes back', (tester) async {
      final said = <String>[];
      final rig = await open(tester, stateWith(plainSong), said: said);
      rig.server.onTempo = (_) => throw ConnectException(Code.internal, 'no');
      await press(tester, 'Faster');
      await settle(tester, 400);
      expect(said.any((m) => m.startsWith('ERROR')), isTrue);
      expect(find.text('Tempo 100%'), findsOneWidget);
    });
  });
}
