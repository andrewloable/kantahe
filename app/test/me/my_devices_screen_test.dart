import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/me/my_devices_screen.dart';

import 'fakes.dart';
import '../tv/ring_helper.dart';

Device dev(
  String id,
  String name, {
  DeviceType type = DeviceType.DEVICE_TYPE_ANDROID,
  bool online = true,
  bool isCaller = false,
  MidiMode mode = MidiMode.MIDI_MODE_AUTO,
  MidiMode effective = MidiMode.MIDI_MODE_FULL,
  BackgroundMode background = BackgroundMode.BACKGROUND_MODE_AUTO,
  bool effectiveBackground = true,
  int? mp3Volume,
  int? midiVolume,
}) => Device(
  id: id,
  name: name,
  type: type,
  online: online,
  isCaller: isCaller,
  midiMode: mode,
  effectiveMidiMode: effective,
  backgroundMode: background,
  effectiveBackground: effectiveBackground,
  mp3VolumePct: mp3Volume,
  midiVolumePct: midiVolume,
);

Future<MeRig> open(WidgetTester tester, List<Device> devices, {String me = 'me'}) async {
  final r = MeRig(deviceId: me);
  r.server.devices = devices;
  await r.pump(tester, const MyDevicesScreen());
  await settle(tester);
  return r;
}

Future<void> choose(WidgetTester tester, String device, String label) async {
  await tester.ensureVisible(find.byKey(Key('mode-$device')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(Key('mode-$device')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

Future<void> chooseBackground(WidgetTester tester, String device, String label) async {
  await tester.ensureVisible(find.byKey(Key('background-$device')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(Key('background-$device')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

Future<void> chooseVolume(WidgetTester tester, String key, String label) async {
  await tester.ensureVisible(find.byKey(Key(key)));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(Key(key)));
  await tester.pumpAndSettle();
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

String? volumeShown(WidgetTester tester, String key) => tester.widget<DropdownButton<int>>(find.byKey(Key(key))).value?.toString();

void main() {
  group('volume', () {
    testWidgets('REGRESSION: each device has an MP3 and a MIDI volume dropdown, with the stored percent (100 when the server sends none)', (tester) async {
      await open(tester, [dev('me', 'Phone', isCaller: true, mp3Volume: 50, midiVolume: 150), dev('tv', 'TV')]);
      expect(shows('MP3 songs volume'), isTrue);
      expect(shows('MIDI songs volume'), isTrue);
      expect(volumeShown(tester, 'mp3-volume-me'), '50');
      expect(volumeShown(tester, 'midi-volume-me'), '150');
      expect(volumeShown(tester, 'mp3-volume-tv'), '100');
      expect(volumeShown(tester, 'midi-volume-tv'), '100');
    });

    testWidgets('choosing 75 percent for MP3 sends SetVolume for that device with only that field', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true), dev('tv', 'TV', mp3Volume: 100, midiVolume: 100)]);
      r.server.onVolume = (req) => dev(req.deviceId, 'TV', mp3Volume: req.mp3Pct, midiVolume: 100);
      await chooseVolume(tester, 'mp3-volume-tv', '75 %');
      expect(r.server.volumes, hasLength(1));
      expect(r.server.volumes.single.deviceId, 'tv');
      expect(r.server.volumes.single.mp3Pct, 75);
      expect(r.server.volumes.single.hasMidiPct(), isFalse);
      expect(volumeShown(tester, 'mp3-volume-tv'), '75');
    });

    testWidgets('the MIDI dropdown sends only the MIDI field', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true)]);
      r.server.onVolume = (req) => dev('me', 'Phone', mp3Volume: 100, midiVolume: req.midiPct);
      await chooseVolume(tester, 'midi-volume-me', '150 %');
      expect(r.server.volumes.single.midiPct, 150);
      expect(r.server.volumes.single.hasMp3Pct(), isFalse);
    });

    testWidgets('a value set elsewhere (120 percent from the web page) is listed and shown, not an error', (tester) async {
      await open(tester, [dev('me', 'Phone', isCaller: true, mp3Volume: 120, midiVolume: 100)]);
      expect(volumeShown(tester, 'mp3-volume-me'), '120');
    });

    testWidgets('a refused change is shown and the value goes back', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true, mp3Volume: 100, midiVolume: 100)]);
      r.server.onVolume = (_) => throw ConnectException(Code.unavailable, 'down');
      await chooseVolume(tester, 'mp3-volume-me', '25 %');
      expect(shows('Could not reach the server'), isTrue);
      expect(volumeShown(tester, 'mp3-volume-me'), '100');
    });

    testWidgets("the remote's focus on a volume dropdown shows the ring", (tester) async {
      await open(tester, [dev('me', 'Phone', isCaller: true)]);
      for (final key in ['mp3-volume-me', 'midi-volume-me']) {
        final dropdown = find.byKey(Key(key));
        await expectNoRingWhenNotFocused(tester, dropdown);
        await expectRingOnFocus(tester, dropdown);
      }
    });
  });

  testWidgets('lists the devices with their type; this one is marked', (tester) async {
    await open(tester, [dev('me', 'Phone', isCaller: true), dev('tv', 'Living room TV', type: DeviceType.DEVICE_TYPE_ANDROID_TV)]);
    expect(find.text('Phone'), findsOneWidget);
    expect(find.text('(this device)'), findsOneWidget);
    expect(find.text('Android TV'), findsOneWidget);
    expect(find.text('Android'), findsOneWidget);
  });

  testWidgets('online comes from the live state; the listed flag is the fallback for a device the state does not know', (tester) async {
    final r = MeRig();
    r.server.devices = [dev('a', 'Known', online: true), dev('b', 'Unknown', online: false)];
    r.setState(stateOf(devices: [device('a', 'Known', online: false)]));
    await r.pump(tester, const MyDevicesScreen());
    await settle(tester);
    expect(find.text('offline'), findsNWidgets(2)); // Known (live: offline) and Unknown (listed: offline)
    expect(find.text('online'), findsNothing);
  });

  testWidgets('the MIDI mode: Auto, Full, Low power, Server, with a one-line explanation and the mode in use', (tester) async {
    await open(tester, [dev('me', 'Phone', isCaller: true, mode: MidiMode.MIDI_MODE_LOW_POWER, effective: MidiMode.MIDI_MODE_LOW_POWER)]);
    expect(shows('Lighter on a weak device'), isTrue);
    expect(shows('Now using: Low power'), isTrue);
    await tester.tap(find.byKey(const Key('mode-me')));
    await tester.pumpAndSettle();
    for (final l in ['Auto', 'Full', 'Low power', 'Server']) {
      expect(find.text(l), findsWidgets, reason: l);
    }
  });

  testWidgets('changing the mode sends SetMidiMode for that device and shows the effective mode from the state', (tester) async {
    final r = await open(tester, [dev('me', 'Phone', isCaller: true)]);
    r.server.onMode = (req) => dev('me', 'Phone', mode: req.mode);
    await choose(tester, 'me', 'Server');
    expect(r.server.modes.single.deviceId, 'me');
    expect(r.server.modes.single.mode, MidiMode.MIDI_MODE_SERVER);
    expect(shows('The server makes the sound'), isTrue);
    r.setState(stateOf(devices: [device('me', 'Phone').deepCopy()..effectiveMidiMode = MidiMode.MIDI_MODE_SERVER]));
    await tester.pump();
    expect(shows('Now using: Server'), isTrue);
  });

  testWidgets("changing the mode of another device sends that device's id", (tester) async {
    final r = await open(tester, [dev('me', 'Phone', isCaller: true), dev('tv', 'TV')]);
    await choose(tester, 'tv', 'Full');
    expect(r.server.modes.single.deviceId, 'tv');
  });

  testWidgets('a refused change is shown and the choice goes back', (tester) async {
    final r = await open(tester, [dev('me', 'Phone', isCaller: true)]);
    r.server.onMode = (_) => throw ConnectException(Code.unavailable, 'down');
    await choose(tester, 'me', 'Server');
    expect(shows('Could not reach the server'), isTrue);
    expect(shows('Chooses by the memory of the device'), isTrue); // Auto again
  });

  group('background video', () {
    testWidgets('Auto, On, Off with an explanation and what the server resolved', (tester) async {
      await open(tester, [dev('me', 'Phone', isCaller: true, background: BackgroundMode.BACKGROUND_MODE_OFF, effectiveBackground: false)]);
      expect(shows('A plain background behind the lyrics'), isTrue);
      expect(shows('Now using: Off'), isTrue);
      await tester.tap(find.byKey(const Key('background-me')));
      await tester.pumpAndSettle();
      for (final l in ['Auto', 'On', 'Off']) {
        expect(find.text(l), findsWidgets, reason: l);
      }
    });

    testWidgets('an unset mode from an older server counts as Auto', (tester) async {
      await open(tester, [dev('me', 'Phone', isCaller: true, background: BackgroundMode.BACKGROUND_MODE_UNSPECIFIED)]);
      expect(shows('On, unless this device is weak'), isTrue);
    });

    testWidgets('changing it sends SetBackgroundMode for that device and not the MIDI call', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true), dev('tv', 'TV')]);
      r.server.onBackground = (req) => dev(req.deviceId, 'TV', background: req.mode, effectiveBackground: true);
      await chooseBackground(tester, 'tv', 'Off');
      expect(r.server.backgrounds.single.deviceId, 'tv');
      expect(r.server.backgrounds.single.mode, BackgroundMode.BACKGROUND_MODE_OFF);
      expect(r.server.modes, isEmpty);
      expect(shows('A plain background behind the lyrics'), isTrue);
    });

    testWidgets('"Now using" follows the live state', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true)]);
      r.setState(stateOf(devices: [device('me', 'Phone').deepCopy()..effectiveBackground = false]));
      await tester.pump();
      expect(shows('Now using: Off'), isTrue);
    });

    testWidgets('a refused change is shown and the choice goes back', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true)]);
      r.server.onBackground = (_) => throw ConnectException(Code.unavailable, 'down');
      await chooseBackground(tester, 'me', 'Off');
      expect(shows('Could not reach the server'), isTrue);
      expect(shows('On, unless this device is weak'), isTrue); // Auto again
    });

    testWidgets("the remote's focus on the background video of a device shows the ring", (tester) async {
      await open(tester, [dev('me', 'Phone', isCaller: true)]);
      final dropdown = find.byKey(const Key('background-me'));
      await expectNoRingWhenNotFocused(tester, dropdown);
      await expectRingOnFocus(tester, dropdown);
    });
  });

  group('sign out', () {
    testWidgets('signing out another device asks first, then signs it out and refreshes the list', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true), dev('tv', 'Living room TV')]);
      await tester.ensureVisible(find.byTooltip('Sign out Living room TV')); // the second card is below the window now
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Sign out Living room TV'));
      await tester.pumpAndSettle();
      expect(shows('Sign out "Living room TV"?'), isTrue);
      expect(r.server.revoked, isEmpty);
      r.server.devices = [dev('me', 'Phone', isCaller: true)];
      await tester.tap(find.text('Yes, sign out'));
      await tester.pumpAndSettle();
      expect(r.server.revoked, ['tv']);
      expect(r.server.deviceListings, 2);
      expect(find.text('Living room TV'), findsNothing);
      expect(r.auth.signedIn, isTrue);
    });

    testWidgets('signing out this device signs this app out', (tester) async {
      final r = await open(tester, [dev('me', 'Phone', isCaller: true)]);
      await tester.tap(find.byTooltip('Sign out Phone'));
      await tester.pumpAndSettle();
      expect(shows('This is the device you are using; you will have to sign in again.'), isTrue);
      await tester.tap(find.text('Yes, sign out'));
      await tester.pumpAndSettle();
      expect(r.server.revoked, ['me']);
      expect(r.auth.signedIn, isFalse);
    });

    testWidgets('cancelling the question does nothing', (tester) async {
      final r = await open(tester, [dev('tv', 'TV')]);
      await tester.tap(find.byTooltip('Sign out TV'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(r.server.revoked, isEmpty);
    });

    testWidgets('a refused sign-out is shown and the device stays', (tester) async {
      final r = await open(tester, [dev('tv', 'TV')]);
      r.server.onRevoke = (_) => throw ConnectException(Code.unavailable, 'down');
      await tester.tap(find.byTooltip('Sign out TV'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yes, sign out'));
      await tester.pumpAndSettle();
      expect(shows('Could not reach the server'), isTrue);
      expect(find.text('TV'), findsOneWidget);
    });
  });

  testWidgets('the remote\'s focus on the MIDI mode of a device shows the ring', (tester) async {
    await open(tester, [dev('me', 'Phone', isCaller: true)]);
    final dropdown = find.byKey(const Key('mode-me'));
    await expectNoRingWhenNotFocused(tester, dropdown);
    await expectRingOnFocus(tester, dropdown);
  });
}
