import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/messages.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/tv/focus.dart';

const _modes = [
  (value: ScoreMode.SCORE_MODE_OFF, label: 'Off', hint: 'No score after a song.'),
  (value: ScoreMode.SCORE_MODE_RANDOM, label: 'Random', hint: 'A score for every song, for fun.'),
  (value: ScoreMode.SCORE_MODE_MICROPHONE, label: 'Microphone', hint: 'The score follows how loud you sing; the device that plays needs a microphone.'),
];

const _levels = [
  (value: ScoreLevel.SCORE_LEVEL_LOW, label: 'Low', hint: 'Scores from 50 to 100.'),
  (value: ScoreLevel.SCORE_LEVEL_MIDDLE, label: 'Middle', hint: 'Scores from 60 to 100.'),
  (value: ScoreLevel.SCORE_LEVEL_HIGH, label: 'High', hint: 'Scores from 80 to 100.'),
];

/// How songs are scored: Off, Random or Microphone, and how generous the scores are.
class ScoreSettingsScreen extends StatefulWidget {
  const ScoreSettingsScreen({super.key});

  @override
  State<ScoreSettingsScreen> createState() => _ScoreSettingsScreenState();
}

class _ScoreSettingsScreenState extends State<ScoreSettingsScreen> {
  late final AppServices _services = AppScope.of(context);
  ScoreMode? _pendingMode;
  ScoreLevel? _pendingLevel;

  ScoreMode get _mode {
    final m = _services.state.state?.settings.scoreMode;
    return _pendingMode ?? (m == null || m == ScoreMode.SCORE_MODE_UNSPECIFIED ? ScoreMode.SCORE_MODE_RANDOM : m);
  }

  ScoreLevel get _level {
    final l = _services.state.state?.settings.scoreLevel;
    return _pendingLevel ?? (l == null || l == ScoreLevel.SCORE_LEVEL_UNSPECIFIED ? ScoreLevel.SCORE_LEVEL_MIDDLE : l);
  }

  bool get _canListen => (_services.state.state?.devices ?? const []).any((d) => d.micAvailable);

  /// The choice shows at once; if the server refuses, it goes back.
  Future<void> _choose({ScoreMode? mode, ScoreLevel? level}) async {
    setState(() {
      _pendingMode = mode ?? _pendingMode;
      _pendingLevel = level ?? _pendingLevel;
    });
    try {
      await _services.api.session.updateUserSettings(UpdateUserSettingsRequest(scoreMode: mode, scoreLevel: level));
    } catch (_) {
      if (mounted) showMessage(context, 'Could not change the score setting. Try again.', error: true);
    } finally {
      // what the server says now (through the state) takes over from the choice made here
      if (mounted) {
        setState(() {
          if (mode != null) _pendingMode = null;
          if (level != null) _pendingLevel = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Score')),
      body: ListenableBuilder(
        listenable: _services.state,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Score', style: Theme.of(context).textTheme.titleMedium),
            RadioGroup<ScoreMode>(
              groupValue: _mode,
              onChanged: (m) => _choose(mode: m),
              child: Column(
                children: [
                  for (final m in _modes)
                    FocusRing(
                      radius: 0,
                      child: RadioListTile<ScoreMode>(value: m.value, title: Text(m.label), subtitle: Text(m.hint)),
                    ),
                ],
              ),
            ),
            if (!_canListen)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Needs a device with a microphone, on a secure page (HTTPS). None of your devices has said it can listen yet.'),
              ),
            const SizedBox(height: 16),
            Text('Level', style: Theme.of(context).textTheme.titleMedium),
            RadioGroup<ScoreLevel>(
              groupValue: _level,
              onChanged: (l) => _choose(level: l),
              child: Column(
                children: [
                  for (final l in _levels)
                    FocusRing(
                      radius: 0,
                      child: RadioListTile<ScoreLevel>(value: l.value, title: Text(l.label), subtitle: Text(l.hint)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
