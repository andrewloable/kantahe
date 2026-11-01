import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/core/messages.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/tv/focus.dart';

const _types = <DeviceType, String>{
  DeviceType.DEVICE_TYPE_WEB: 'Web',
  DeviceType.DEVICE_TYPE_ANDROID: 'Android',
  DeviceType.DEVICE_TYPE_IOS: 'iOS',
  DeviceType.DEVICE_TYPE_ANDROID_TV: 'Android TV',
  DeviceType.DEVICE_TYPE_TIZEN: 'Tizen TV',
  DeviceType.DEVICE_TYPE_WEBOS: 'webOS TV',
};

typedef _ModeInfo = ({MidiMode value, String label, String explain});

const List<_ModeInfo> _modes = [
  (value: MidiMode.MIDI_MODE_AUTO, label: 'Auto', explain: 'Chooses by the memory of the device and steps down by itself if the sound stutters.'),
  (value: MidiMode.MIDI_MODE_FULL, label: 'Full', explain: 'The full sound: all voices, with reverb and chorus. Needs a device with plenty of memory.'),
  (value: MidiMode.MIDI_MODE_LOW_POWER, label: 'Low power', explain: 'Lighter on a weak device: 32 voices, no reverb or chorus, a lower sample rate.'),
  (
    value: MidiMode.MIDI_MODE_SERVER,
    label: 'Server',
    explain: 'The server makes the sound and the device only plays it like an MP3. Needs the server to be able to do that.',
  ),
];

String _modeLabel(MidiMode m) => _modes.where((x) => x.value == m).firstOrNull?.label ?? 'Auto';

typedef _BackgroundInfo = ({BackgroundMode value, String label, String explain});

const List<_BackgroundInfo> _backgrounds = [
  (value: BackgroundMode.BACKGROUND_MODE_AUTO, label: 'Auto', explain: 'On, unless this device is weak or uses a lighter sound mode.'),
  (
    value: BackgroundMode.BACKGROUND_MODE_ON,
    label: 'On',
    explain: 'Always show the moving pictures behind the lyrics on this device, even if it is weak. There is never any sound from them.',
  ),
  (value: BackgroundMode.BACKGROUND_MODE_OFF, label: 'Off', explain: 'A plain background behind the lyrics. Easier on a weak device.'),
];

/// The user's devices: type, online, the MIDI mode and the background video choice of each, and signing a device out.
class MyDevicesScreen extends StatefulWidget {
  const MyDevicesScreen({super.key});

  @override
  State<MyDevicesScreen> createState() => _MyDevicesScreenState();
}

class _MyDevicesScreenState extends State<MyDevicesScreen> {
  late final AppServices _services = AppScope.of(context);
  List<Device> _listed = [];
  bool _started = false;

  /// Modes chosen here and accepted by the server, for devices the live state does not show.
  final Map<String, MidiMode> _chosen = {};

  /// The same for the background video choice, with what the server resolved from it.
  final Map<String, ({BackgroundMode mode, bool effective})> _chosenBackground = {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _services.api.auth.listMyDevices(ListMyDevicesRequest());
      if (mounted) setState(() => _listed = res.devices.toList());
    } catch (e) {
      if (mounted) showMessage(context, problem(e, const {}), error: true);
    }
  }

  Device? _live(Device d) => _services.state.state?.devices.where((x) => x.id == d.id).firstOrNull;

  bool _online(Device d) => _live(d)?.online ?? d.online;
  MidiMode _mode(Device d) => _chosen[d.id] ?? _live(d)?.midiMode ?? d.midiMode;
  String _explain(Device d) => _modes.where((m) => m.value == _mode(d)).firstOrNull?.explain ?? '';
  String _effective(Device d) => _modeLabel(_live(d)?.effectiveMidiMode ?? d.effectiveMidiMode);

  /// What the user chose; a server that does not know the field says "unspecified", which is Auto.
  BackgroundMode _background(Device d) {
    final mode = _chosenBackground[d.id]?.mode ?? _live(d)?.backgroundMode ?? d.backgroundMode;
    return mode == BackgroundMode.BACKGROUND_MODE_UNSPECIFIED ? BackgroundMode.BACKGROUND_MODE_AUTO : mode;
  }

  String _explainBackground(Device d) => _backgrounds.where((b) => b.value == _background(d)).firstOrNull?.explain ?? '';

  String _effectiveBackground(Device d) {
    final live = _live(d);
    final on = live != null ? live.effectiveBackground : (_chosenBackground[d.id]?.effective ?? d.effectiveBackground);
    return on ? 'On' : 'Off';
  }

  Future<void> _setBackground(Device d, BackgroundMode mode) async {
    try {
      final res = await _services.api.session.setBackgroundMode(SetBackgroundModeRequest(deviceId: d.id, mode: mode));
      if (mounted) {
        setState(
          () => _chosenBackground[d.id] = (
            mode: res.hasDevice() ? res.device.backgroundMode : mode,
            effective: res.hasDevice() && res.device.effectiveBackground,
          ),
        );
      }
    } catch (e) {
      if (mounted) showMessage(context, problem(e, const {}), error: true);
    }
  }

  Future<void> _setMode(Device d, MidiMode mode) async {
    try {
      final res = await _services.api.session.setMidiMode(SetMidiModeRequest(deviceId: d.id, mode: mode));
      if (mounted) setState(() => _chosen[d.id] = res.hasDevice() ? res.device.midiMode : mode);
    } catch (e) {
      if (mounted) showMessage(context, problem(e, const {}), error: true);
    }
  }

  Future<void> _revoke(Device d) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Sign out "${d.name}"?'),
        content: d.isCaller ? const Text('This is the device you are using; you will have to sign in again.') : null,
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Yes, sign out')),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    try {
      await _services.api.auth.revokeDevice(RevokeDeviceRequest(deviceId: d.id));
    } catch (e) {
      if (mounted) showMessage(context, problem(e, const {}), error: true);
      return;
    }
    if (d.id == _services.auth.deviceId) {
      await _services.auth.signOut(); // the app goes back to sign-in by itself
    } else {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Scaffold(
      appBar: AppBar(title: const Text('My devices')),
      body: ListenableBuilder(
        listenable: _services.state,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            for (final d in _listed)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(d.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                          if (d.isCaller) const Text('(this device)'),
                          Text(_types[d.type] ?? 'Unknown', style: TextStyle(color: muted)),
                          Text(_online(d) ? 'online' : 'offline', style: TextStyle(color: muted)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text('MIDI mode', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      FocusRing(
                        radius: 8,
                        child: DropdownButton<MidiMode>(
                          key: Key('mode-${d.id}'),
                          value: _modes.any((m) => m.value == _mode(d)) ? _mode(d) : MidiMode.MIDI_MODE_AUTO,
                          isExpanded: true,
                          hint: Text('MIDI mode of ${d.name}'),
                          items: [for (final m in _modes) DropdownMenuItem(value: m.value, child: Text(m.label))],
                          onChanged: (m) {
                            if (m != null) _setMode(d, m);
                          },
                        ),
                      ),
                      Text(_explain(d), style: TextStyle(color: muted, fontSize: 13)),
                      Text('Now using: ${_effective(d)}'),
                      const SizedBox(height: 8),
                      const Text('Background video', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      FocusRing(
                        radius: 8,
                        child: DropdownButton<BackgroundMode>(
                          key: Key('background-${d.id}'),
                          value: _backgrounds.any((b) => b.value == _background(d)) ? _background(d) : BackgroundMode.BACKGROUND_MODE_AUTO,
                          isExpanded: true,
                          hint: Text('Background video of ${d.name}'),
                          items: [for (final b in _backgrounds) DropdownMenuItem(value: b.value, child: Text(b.label))],
                          onChanged: (b) {
                            if (b != null) _setBackground(d, b);
                          },
                        ),
                      ),
                      Text(_explainBackground(d), style: TextStyle(color: muted, fontSize: 13)),
                      Text('Now using: ${_effectiveBackground(d)}'),
                      Align(
                        alignment: Alignment.centerRight,
                        child: IconButton(tooltip: 'Sign out ${d.name}', icon: const Icon(Icons.logout), onPressed: () => _revoke(d)),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
