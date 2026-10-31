import 'dart:async';

import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/player/embed_bridge.dart';
import 'package:kantahe/player/platform.dart';
import 'package:kantahe/player/web_embed.dart';
import 'package:kantahe/queue/queue_actions.dart';

/// The full-screen player: the web player page in a WebView (it plays and reports as this device), with
/// native Play/Pause/Skip and Close on top. The D-pad belongs to the native buttons, never to the page.
class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key, this.embedBuilder = webEmbedBuilder, this.screenAwake = const WakelockAwake(), this.osMicrophone = askOsMicrophone});

  final EmbedBuilder embedBuilder;
  final ScreenAwake screenAwake;

  /// Asks the operating system for the microphone; true when it was granted.
  final Future<bool> Function() osMicrophone;

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  late final AppServices _services = AppScope.of(context);
  late final EmbedBridge _bridge = EmbedBridge(auth: _services.auth, serverUrl: _services.serverUrl);
  late final QueueActions _actions = QueueActions(api: _services.api, notify: _notify);
  bool _bound = false;
  bool _awake = false;
  String _loadError = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bound) return;
    _bound = true;
    _services.state.addListener(_onState);
    _onState();
  }

  @override
  void dispose() {
    if (_bound) {
      _services.state.removeListener(_onState);
      // Closing the screen takes the page, and with it the sound, away: a song that played here is paused, so that the
      // user's other devices do not go on showing "playing" for silence (songs stop only on Pause).
      final s = _services.state.state;
      if (s != null && s.status == PlayStatus.PLAY_STATUS_PLAYING && s.playerDeviceId.isNotEmpty && s.playerDeviceId == _services.auth.deviceId) {
        unawaited(_actions.control(ControlAction.CONTROL_ACTION_PAUSE));
      }
    }
    if (_awake) widget.screenAwake.disable();
    super.dispose();
  }

  // The screen stays on while a song plays on this device.
  void _onState() {
    final s = _services.state.state;
    final shouldBeAwake = s != null && s.status == PlayStatus.PLAY_STATUS_PLAYING && s.playerDeviceId.isNotEmpty && s.playerDeviceId == _services.auth.deviceId;
    if (shouldBeAwake == _awake) return;
    _awake = shouldBeAwake;
    if (shouldBeAwake) {
      widget.screenAwake.enable();
    } else {
      widget.screenAwake.disable();
    }
  }

  void _notify(String message, {bool error = false, String? actionLabel, VoidCallback? onAction}) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? Theme.of(context).colorScheme.error : null));
  }

  /// The page may use the microphone only in Microphone score mode, and only after the user allowed it to the
  /// operating system; nothing else (camera and so on) is ever granted.
  Future<bool> _permission(Set<EmbedPermission> asked) async {
    if (asked.length != 1 || !asked.contains(EmbedPermission.microphone)) return false;
    if (_services.state.state?.settings.scoreMode != ScoreMode.SCORE_MODE_MICROPHONE) return false;
    return widget.osMicrophone();
  }

  Future<void> _retry() async {
    setState(() => _loadError = '');
    await _bridge.host?.reload();
  }

  @override
  Widget build(BuildContext context) {
    final server = _services.serverUrl.value;
    return Scaffold(
      backgroundColor: Colors.black,
      body: server == null
          ? const Center(
              child: Text('No server address is set.', style: TextStyle(color: Colors.white)),
            )
          : Stack(
              children: [
                // the page never takes focus: the D-pad belongs to the native buttons
                Positioned.fill(
                  child: ExcludeFocus(
                    child: widget.embedBuilder(
                      context,
                      EmbedConfig(
                        url: playerUrl(server),
                        onMessage: _bridge.onMessage,
                        onPermission: _permission,
                        onHost: (host) => _bridge.host = host,
                        onError: (description) => setState(() => _loadError = description),
                        allowNavigation: (to) => sameOrigin(to.toString(), server),
                      ),
                    ),
                  ),
                ),
                if (_loadError.isNotEmpty)
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Could not load the player. Check the connection and try again.',
                          style: TextStyle(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                        TextButton(onPressed: _retry, child: const Text('Try again')),
                      ],
                    ),
                  ),
                SafeArea(
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: OutlinedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Close')),
                    ),
                  ),
                ),
                SafeArea(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: ListenableBuilder(
                        listenable: _services.state,
                        builder: (context, _) {
                          final playing = _services.state.state?.status == PlayStatus.PLAY_STATUS_PLAYING;
                          return Wrap(
                            spacing: 12,
                            children: [
                              FilledButton(
                                autofocus: true,
                                onPressed: () => _actions.control(playing ? ControlAction.CONTROL_ACTION_PAUSE : ControlAction.CONTROL_ACTION_PLAY),
                                child: Text(playing ? 'Pause' : 'Play'),
                              ),
                              OutlinedButton(onPressed: () => _actions.control(ControlAction.CONTROL_ACTION_SKIP), child: const Text('Skip')),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
