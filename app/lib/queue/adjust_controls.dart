import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/queue/queue_actions.dart';

/// What the singer adjusts about the song that is on, from any device and never on the player screen (so that nothing moves there while
/// someone sings): the volume of the device that plays and its guide vocals. It acts on the player device, also when that is this one.
class AdjustControls extends StatefulWidget {
  const AdjustControls({super.key, required this.actions});

  final QueueActions actions;

  @override
  State<AdjustControls> createState() => _AdjustControlsState();
}

class _AdjustControlsState extends State<AdjustControls> {
  static const _volumeStep = 5;
  static const _volumeMax = 200;
  static const _vocalsStep = 10;
  static const _vocalsMax = 100;
  static const _tempoStep = 5;
  static const _tempoMin = 75;
  static const _tempoMax = 125;
  static const _pause = Duration(milliseconds: 300);

  late final _store = AppScope.of(context).state;
  bool _bound = false;

  /// What was just chosen with the buttons ("device:what" -> percent), shown at once; dropped when the state shows it or the server refuses it.
  final Map<String, int> _moved = {};
  final Map<String, Timer> _timers = {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bound) return;
    _bound = true;
    _store.addListener(_onState);
  }

  @override
  void dispose() {
    if (_bound) _store.removeListener(_onState);
    for (final t in _timers.values) {
      t.cancel();
    }
    super.dispose();
  }

  /// The device that plays, while a song is current.
  Device? get _target {
    final s = _store.state;
    if (s == null || !s.hasNow() || s.playerDeviceId.isEmpty) return null;
    return s.devices.where((d) => d.id == s.playerDeviceId).firstOrNull;
  }

  Song? get _song {
    final s = _store.state;
    return s != null && s.hasNow() && s.now.hasSong() ? s.now.song : null;
  }

  bool get _isMp3 => _song?.format != Format.FORMAT_MIDI;

  int? _live(Device d, String what) => switch (what) {
    'mp3' => d.hasMp3VolumePct() ? d.mp3VolumePct : null,
    'midi' => d.hasMidiVolumePct() ? d.midiVolumePct : null,
    _ => d.hasVocalsPct() ? d.vocalsPct : null,
  };

  String get _volumeWhat => _isMp3 ? 'mp3' : 'midi';

  int _pct(Device d, String what, int fallback) => _moved['${d.id}:$what'] ?? _live(d, what) ?? fallback;

  // The state shows what the buttons chose: from now on the state is the truth (another device may change it).
  void _onState() {
    final tempo = _store.state?.now.tempoPct;
    if (_moved['tempo'] != null && _moved['tempo'] == tempo) _moved.remove('tempo');
    final d = _target;
    if (d != null) {
      for (final what in ['mp3', 'midi', 'vocals']) {
        final key = '${d.id}:$what';
        if (_moved[key] != null && _moved[key] == _live(d, what)) _moved.remove(key);
      }
    }
  }

  /// A server that keeps the vocals choice sends vocals_on; only a song with a vocals track, and only an MP3 song, has the controls.
  bool _vocalsShown(Device d) => d.hasVocalsOn() && _isMp3 && (_song?.hasVocals ?? false);

  /// What the player really plays (the guide plays although the choice is off); a player that has not reported yet is shown by the choice.
  String _vocalsMode(Device d) => switch (d.vocalsState) {
    VocalsState.VOCALS_STATE_ON => 'on',
    VocalsState.VOCALS_STATE_LOADING => 'loading',
    VocalsState.VOCALS_STATE_OFF => 'off',
    _ => d.vocalsOn ? 'on' : 'off',
  };

  void _step(Device d, String what, int by, int max, Future<bool> Function(int pct) send, int fallback) {
    final now = _pct(d, what, fallback);
    final pct = (now + by).clamp(0, max);
    if (pct == now) return;
    final key = '${d.id}:$what';
    final before = _moved[key];
    setState(() => _moved[key] = pct);
    _timers[key]?.cancel();
    _timers[key] = Timer(_pause, () async {
      _timers.remove(key);
      final ok = await send(pct);
      if (ok || !mounted) return;
      // refused: the level that the state shows comes back
      if (_moved[key] == pct) {
        setState(() {
          if (before == null) {
            _moved.remove(key);
          } else {
            _moved[key] = before;
          }
        });
      }
    });
  }

  void _changeVolume(Device d, int direction) {
    final mp3 = _isMp3;
    _step(d, _volumeWhat, direction * _volumeStep, _volumeMax, (pct) => widget.actions.setVolume(d.id, mp3: mp3 ? pct : null, midi: mp3 ? null : pct), 100);
  }

  /// The speed of the song in percent (the server's, or what was just chosen); a server that sends none (an older one) has no tempo.
  bool get _tempoShown => (_store.state?.now.tempoPct ?? 0) > 0;
  int get _tempoPct => _moved['tempo'] ?? (_store.state?.now.tempoPct ?? 100);

  void _changeTempo(int direction) {
    final now = _tempoPct;
    final pct = (now + direction * _tempoStep).clamp(_tempoMin, _tempoMax);
    if (pct != now) _setTempo(pct);
  }

  /// Shown at once, sent after a short pause (a held button is one change).
  void _setTempo(int pct) {
    final before = _moved['tempo'];
    setState(() => _moved['tempo'] = pct);
    _timers['tempo']?.cancel();
    _timers['tempo'] = Timer(_pause, () async {
      _timers.remove('tempo');
      final ok = await widget.actions.setTempo(pct);
      if (ok || !mounted || _moved['tempo'] != pct) return;
      setState(() {
        if (before == null) {
          _moved.remove('tempo');
        } else {
          _moved['tempo'] = before;
        }
      });
    });
  }

  void _changeVocals(Device d, int direction) => _step(d, 'vocals', direction * _vocalsStep, _vocalsMax, (pct) => widget.actions.setVocals(d.id, pct: pct), 60);

  void _toggleVocals(Device d) {
    // while the voice plays (also the guide that plays by itself) a press switches it off; while it is off, on
    unawaited(widget.actions.setVocals(d.id, on: _vocalsMode(d) == 'off'));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _store,
      builder: (context, _) {
        final d = _target;
        if (d == null) return const SizedBox.shrink();
        final mode = _vocalsMode(d);
        return Semantics(
          container: true,
          label: 'Adjust ${d.name}',
          child: Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              Wrap(
                spacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  OutlinedButton(onPressed: () => _changeVolume(d, -1), child: const Text('Volume down')),
                  Semantics(liveRegion: true, child: Text('${_isMp3 ? 'MP3' : 'MIDI'} volume ${_pct(d, _volumeWhat, 100)}%')),
                  OutlinedButton(onPressed: () => _changeVolume(d, 1), child: const Text('Volume up')),
                ],
              ),
              if (_tempoShown)
                Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    OutlinedButton(onPressed: _tempoPct <= _tempoMin ? null : () => _changeTempo(-1), child: const Text('Slower')),
                    Semantics(liveRegion: true, child: Text('Tempo $_tempoPct%')),
                    OutlinedButton(onPressed: _tempoPct >= _tempoMax ? null : () => _changeTempo(1), child: const Text('Faster')),
                    if (_tempoPct != 100) OutlinedButton(onPressed: () => _setTempo(100), child: const Text('Normal speed')),
                  ],
                ),
              if (_vocalsShown(d))
                Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    OutlinedButton(
                      onPressed: () => _toggleVocals(d),
                      child: Text(
                        mode == 'on'
                            ? 'Vocals: on'
                            : mode == 'loading'
                            ? 'Vocals: loading…'
                            : 'Vocals: off',
                      ),
                    ),
                    if (mode != 'off') ...[
                      OutlinedButton(onPressed: () => _changeVocals(d, -1), child: const Text('Vocals quieter')),
                      Semantics(liveRegion: true, child: Text('Vocals volume ${_pct(d, 'vocals', 60)}%')),
                      OutlinedButton(onPressed: () => _changeVocals(d, 1), child: const Text('Vocals louder')),
                    ],
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}
