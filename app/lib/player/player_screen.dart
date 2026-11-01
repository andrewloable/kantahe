import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/player/embed_bridge.dart';
import 'package:kantahe/player/platform.dart';
import 'package:kantahe/player/web_embed.dart';
import 'package:kantahe/queue/queue_actions.dart';
import 'package:kantahe/tv/focus.dart';

/// The full-screen player: the web player page in a WebView (it plays and reports as this device), with
/// native Play/Pause/Skip and Close on top. The D-pad belongs to the native buttons, never to the page.
/// While a song plays here and nobody presses anything for [_hideAfter], the buttons fade out; any key or touch
/// brings them back (and is used up doing so: a hidden Pause is never pressed by the key that wakes it).
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
  static const _hideAfter = Duration(seconds: 4);
  final FocusNode _wakeNode = FocusNode(debugLabel: 'player: receives the key that wakes the buttons');
  final FocusNode _pauseNode = FocusNode(debugLabel: 'player: Play/Pause');
  Timer? _hideTimer;
  bool _idle = false;
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
    _hideTimer?.cancel();
    _wakeNode.dispose();
    _pauseNode.dispose();
    if (_awake) widget.screenAwake.disable();
    super.dispose();
  }

  bool get _playingHere {
    final s = _services.state.state;
    return s != null && s.status == PlayStatus.PLAY_STATUS_PLAYING && s.playerDeviceId.isNotEmpty && s.playerDeviceId == _services.auth.deviceId;
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    if (_playingHere && _loadError.isEmpty) _hideTimer = Timer(_hideAfter, _hide);
  }

  void _hide() {
    if (!mounted || !_playingHere || _loadError.isNotEmpty) return;
    setState(() => _idle = true);
    _wakeNode.requestFocus(); // the keys that follow come here, not to a button nobody can see
  }

  /// Shows the buttons (if hidden), puts the D-pad on Play/Pause, and starts the countdown again.
  void _wake() {
    if (!mounted) return;
    if (_idle) {
      setState(() => _idle = false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_idle) _pauseNode.requestFocus();
      });
    }
    _scheduleHide();
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final wasIdle = _idle;
    _wake();
    return wasIdle ? KeyEventResult.handled : KeyEventResult.ignored;
  }

  // The screen stays on while a song plays on this device.
  void _onState() {
    final shouldBeAwake = _playingHere;
    if (!shouldBeAwake) {
      // paused, or not the player: the buttons are needed, so they stay (or come back)
      _hideTimer?.cancel();
      if (_idle) _wake();
    } else if (_hideTimer?.isActive != true && !_idle) {
      _scheduleHide();
    }
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
    return Focus(
      focusNode: _wakeNode,
      onKeyEvent: _onKey,
      // a touch anywhere shows the buttons; while they are hidden it reaches no button (IgnorePointer below)
      child: Listener(behavior: HitTestBehavior.translucent, onPointerDown: (_) => _wake(), child: _scaffold(context, server)),
    );
  }

  Widget _scaffold(BuildContext context, String? server) {
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
                        onError: (description) {
                          setState(() => _loadError = description);
                          _wake(); // "Try again" must be in view
                        },
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
                Positioned.fill(
                  child: ExcludeFocus(
                    excluding: _idle,
                    child: IgnorePointer(
                      ignoring: _idle,
                      child: AnimatedOpacity(
                        key: const Key('player-controls'),
                        opacity: _idle ? 0 : 1,
                        duration: const Duration(milliseconds: 300),
                        child: Stack(
                          children: [
                            SafeArea(
                              child: Align(
                                alignment: Alignment.topLeft,
                                child: Padding(
                                  padding: const EdgeInsets.all(8),
                                  child: FocusGrow(
                                    child: OutlinedButton(onPressed: () => Navigator.of(context).maybePop(), child: const Text('Close')),
                                  ),
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
                                      final playerId = _services.state.state?.playerDeviceId ?? '';
                                      final isHere = playerId.isNotEmpty && playerId == _services.auth.deviceId;
                                      return Wrap(
                                        spacing: 12,
                                        children: [
                                          // all the buttons are one quiet kind: only the one with the focus stands out (tvTheme)
                                          FocusGrow(
                                            child: OutlinedButton(
                                              autofocus: true,
                                              focusNode: _pauseNode,
                                              onPressed: () =>
                                                  _actions.control(playing ? ControlAction.CONTROL_ACTION_PAUSE : ControlAction.CONTROL_ACTION_PLAY),
                                              child: Text(playing ? 'Pause' : 'Play'),
                                            ),
                                          ),
                                          FocusGrow(
                                            child: OutlinedButton(
                                              onPressed: () => _actions.control(ControlAction.CONTROL_ACTION_SKIP),
                                              child: const Text('Skip'),
                                            ),
                                          ),
                                          // the page's own buttons cannot take the D-pad, so taking over from another device is a native button
                                          if (!isHere)
                                            FocusGrow(
                                              child: OutlinedButton(
                                                onPressed: () => _actions.control(ControlAction.CONTROL_ACTION_PLAY_HERE),
                                                child: const Text('Play here'),
                                              ),
                                            ),
                                        ],
                                      );
                                    },
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
