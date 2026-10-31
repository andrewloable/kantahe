import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' as pb show State;
import 'package:kantahe/library/format_badge.dart';
import 'package:kantahe/queue/queue_actions.dart';

/// m:ss of a time in milliseconds.
String clock(int ms) {
  final s = ms < 0 ? 0 : ms ~/ 1000;
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

/// The song that plays now: title, progress that follows the server clock, where it plays, Play/Pause/Skip.
class NowPlayingCard extends StatefulWidget {
  const NowPlayingCard({super.key, required this.actions, this.onPlayHere});

  final QueueActions actions;

  /// Called after Play here was accepted by the server, and by Open player when this device is the player already (the app opens the player screen).
  final VoidCallback? onPlayHere;

  @override
  State<NowPlayingCard> createState() => _NowPlayingCardState();
}

class _NowPlayingCardState extends State<NowPlayingCard> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker((_) => _position.value = _shown());
  final ValueNotifier<int> _position = ValueNotifier(0);
  late final _store = AppScope.of(context).state;
  bool _bound = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bound) return;
    _bound = true;
    _store.addListener(_onState);
    _onState();
  }

  @override
  void dispose() {
    if (_bound) _store.removeListener(_onState);
    _ticker.dispose();
    _position.dispose();
    super.dispose();
  }

  int _duration() => _store.state?.now.song.durationMs.toInt() ?? 0;

  /// The position now; it runs on with the server clock until the next state arrives, so it stops at the end.
  int _shown() {
    final ms = _store.positionMs();
    final length = _duration();
    return length > 0 && ms > length ? length : ms;
  }

  // The position is redrawn on every frame, but only while it moves (a song is playing); a ticker is muted by
  // Flutter while the screen is covered by another page.
  void _onState() {
    _position.value = _shown();
    final s = _store.state;
    final moving = s != null && s.hasNow() && s.status == PlayStatus.PLAY_STATUS_PLAYING;
    if (moving && !_ticker.isActive) {
      _ticker.start();
    } else if (!moving && _ticker.isActive) {
      _ticker.stop();
    }
  }

  Future<void> _playHere() async {
    if (await widget.actions.control(ControlAction.CONTROL_ACTION_PLAY_HERE)) widget.onPlayHere?.call();
  }

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return ListenableBuilder(
      listenable: _store,
      builder: (context, _) {
        final state = _store.state;
        final now = state != null && state.hasNow() ? state.now : null;
        final playing = state?.status == PlayStatus.PLAY_STATUS_PLAYING;
        final playerId = state?.playerDeviceId ?? '';
        final isHere = playerId.isNotEmpty && playerId == services.auth.deviceId;
        final length = now?.song.durationMs.toInt() ?? 0;
        return Semantics(
          label: 'Now playing',
          container: true,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (now == null)
                    const Text('Nothing is playing. Add songs from the library.')
                  else ...[
                    Text(now.song.title, style: Theme.of(context).textTheme.titleLarge),
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(now.song.artist, style: TextStyle(color: muted)),
                        if (now.hasSong()) FormatBadge(now.song.format),
                        Text(now.source == SongSource.SONG_SOURCE_RANDOM ? 'Picked at random' : 'From the queue', style: TextStyle(color: muted)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ValueListenableBuilder<int>(
                      valueListenable: _position,
                      builder: (context, position, _) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(length > 0 ? '${clock(position)} / ${clock(length)}' : clock(position)),
                          if (length > 0) LinearProgressIndicator(value: (position / length).clamp(0.0, 1.0), semanticsLabel: 'Song progress'),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Semantics(liveRegion: true, child: Text(_where(state, playing, isHere))),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      if (playing)
                        FilledButton(onPressed: () => widget.actions.control(ControlAction.CONTROL_ACTION_PAUSE), child: const Text('Pause'))
                      else
                        FilledButton(onPressed: () => widget.actions.control(ControlAction.CONTROL_ACTION_PLAY), child: const Text('Play')),
                      OutlinedButton(onPressed: () => widget.actions.control(ControlAction.CONTROL_ACTION_SKIP), child: const Text('Skip')),
                      if (!isHere)
                        OutlinedButton(onPressed: _playHere, child: const Text('Play here'))
                      else if (widget.onPlayHere != null)
                        // the server may list this device as the player already (the app was restarted): the way into the player screen must stay
                        OutlinedButton(onPressed: widget.onPlayHere, child: const Text('Open player')),
                    ],
                  ),
                  if (state != null && state.hasUpNext()) ...[
                    const SizedBox(height: 8),
                    Text('Up next: ${state.upNext.song.title} — ${state.upNext.song.artist}', style: TextStyle(color: muted)),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  String _where(pb.State? state, bool playing, bool isHere) {
    final id = state?.playerDeviceId ?? '';
    if (id.isEmpty) return 'No device is playing';
    if (isHere) return playing ? 'Playing on this device' : 'Paused on this device';
    final Device? device = state!.devices.where((d) => d.id == id).firstOrNull;
    final name = device?.name ?? 'another device';
    // Play here takes over when the player has gone away (the server decides the same way)
    if (device != null && !device.online) return '$name is offline';
    return playing ? 'Playing on $name' : 'Paused on $name';
  }
}
