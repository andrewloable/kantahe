import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/player/connect_card.dart';
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

class _PlayerScreenState extends State<PlayerScreen> with WidgetsBindingObserver {
  late final AppServices _services = AppScope.of(context);
  late final EmbedBridge _bridge = EmbedBridge(auth: _services.auth, serverUrl: _services.serverUrl);
  late final QueueActions _actions = QueueActions(api: _services.api, notify: _notify);
  static const _hideAfter = Duration(seconds: 4);
  static const _connectCardTime = Duration(seconds: 10);
  static const _volumeStep = 5;
  static const _volumeMax = 200;
  static const _volumePause = Duration(milliseconds: 300);
  // It wraps the whole screen, so the arrow keys must never move the focus onto it (from there none reaches a button): it takes the
  // focus only by code, in _hide.
  final FocusNode _wakeNode = FocusNode(debugLabel: 'player: receives the key that wakes the buttons', skipTraversal: true);
  final FocusNode _pauseNode = FocusNode(debugLabel: 'player: Play/Pause');
  final FocusNode _connectNode = FocusNode(debugLabel: 'player: Connect a phone');
  Timer? _hideTimer;
  Timer? _connectTimer;
  bool _connectOpen = false; // the card with the QR of the server address
  // Volumes chosen with the buttons (key: true for the MP3 volume): shown and sent after a short pause; dropped when the state shows them.
  final Map<bool, int> _movedVolume = {};
  final Map<bool, Timer> _volumeTimers = {};
  bool _idle = false;
  bool _suspended = false; // the app is in the background: the song is paused and the page ended
  bool _bound = false;
  ModalRoute<void>? _route;
  bool _awake = false;
  String _loadError = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bound) return;
    _bound = true;
    _route = ModalRoute.of(context) as ModalRoute<void>?;
    FocusManager.instance.addListener(_keepFocus);
    WidgetsBinding.instance.addObserver(this);
    _services.state.addListener(_onState);
    _onState();
  }

  // The screen behind the player (the library, when the TV opens the player by itself) can take the focus after the player was pushed, and
  // then the remote drives a screen nobody can see: while the player is the current route, the focus is brought back to it.
  void _keepFocus() {
    if (!mounted || _wakeNode.hasFocus || !(_route?.isCurrent ?? true)) return;
    (_idle ? _wakeNode : _pauseNode).requestFocus();
  }

  @override
  void dispose() {
    if (_bound) {
      FocusManager.instance.removeListener(_keepFocus);
      WidgetsBinding.instance.removeObserver(this);
      _services.state.removeListener(_onState);
      // Closing the screen takes the page, and with it the sound, away: a song that played here is paused, so that the
      // user's other devices do not go on showing "playing" for silence (songs stop only on Pause).
      final s = _services.state.state;
      if (s != null && s.status == PlayStatus.PLAY_STATUS_PLAYING && s.playerDeviceId.isNotEmpty && s.playerDeviceId == _services.auth.deviceId) {
        unawaited(_actions.control(ControlAction.CONTROL_ACTION_PAUSE));
      }
    }
    _hideTimer?.cancel();
    _connectTimer?.cancel();
    // a step chosen just before leaving is still sent
    for (final entry in _volumeTimers.entries.toList()) {
      entry.value.cancel();
      unawaited(_sendVolume(entry.key, _movedVolume[entry.key]!));
    }
    _wakeNode.dispose();
    _pauseNode.dispose();
    _connectNode.dispose();
    if (_awake) widget.screenAwake.disable();
    super.dispose();
  }

  bool get _playingHere {
    final s = _services.state.state;
    return s != null && s.status == PlayStatus.PLAY_STATUS_PLAYING && s.playerDeviceId.isNotEmpty && s.playerDeviceId == _services.auth.deviceId;
  }

  /// The kind of volume the buttons change: true for the MP3 volume, false for the MIDI volume (also when the server rendered the song);
  /// null when no song is current.
  bool? get _volumeIsMp3 {
    final s = _services.state.state;
    if (s == null || !s.hasNow() || !s.now.hasSong()) return null;
    return s.now.song.format != Format.FORMAT_MIDI;
  }

  /// This device's volume of the kind in percent: what was just chosen, else the state, else 100 (an older server sends none).
  int _volumePct(bool mp3) => _movedVolume[mp3] ?? _liveVolume(mp3) ?? 100;

  int? _liveVolume(bool mp3) {
    final mine = _services.state.state?.devices.where((d) => d.id == _services.auth.deviceId).firstOrNull;
    if (mine == null) return null;
    if (mp3) return mine.hasMp3VolumePct() ? mine.mp3VolumePct : null;
    return mine.hasMidiVolumePct() ? mine.midiVolumePct : null;
  }

  void _changeVolume(int direction) {
    final mp3 = _volumeIsMp3;
    if (mp3 == null) return;
    final now = _volumePct(mp3);
    final pct = (now + direction * _volumeStep).clamp(0, _volumeMax);
    if (pct == now) return;
    setState(() => _movedVolume[mp3] = pct);
    _volumeTimers[mp3]?.cancel();
    _volumeTimers[mp3] = Timer(_volumePause, () => _sendVolume(mp3, pct));
  }

  Future<void> _sendVolume(bool mp3, int pct) async {
    _volumeTimers.remove(mp3);
    final id = _services.auth.deviceId;
    if (id == null) return;
    try {
      await _services.api.session.setVolume(mp3 ? SetVolumeRequest(deviceId: id, mp3Pct: pct) : SetVolumeRequest(deviceId: id, midiPct: pct));
    } catch (e) {
      if (!mounted) return;
      if (_movedVolume[mp3] == pct) setState(() => _movedVolume.remove(mp3));
      _notify(problem(e, const {}), error: true);
    }
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    // the buttons stay while the card is open: the focus is on one of them
    if (_playingHere && _loadError.isEmpty && !_connectOpen) _hideTimer = Timer(_hideAfter, _hide);
  }

  /// Shows the card (or starts its 10 seconds again when it is open): it closes by itself.
  void _showConnect() {
    _connectTimer?.cancel();
    _hideTimer?.cancel();
    _connectTimer = Timer(_connectCardTime, _closeConnect);
    if (!_connectOpen) setState(() => _connectOpen = true);
  }

  void _closeConnect() {
    _connectTimer?.cancel();
    if (!mounted || !_connectOpen) return;
    setState(() => _connectOpen = false);
    _scheduleHide(); // the focus never left the button that opened the card
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

  // The player runs only while it is on screen: when the app goes to the background (Home, another app) the song is paused and the page ended,
  // so that its synthesizer, timers and video decoders stop and free their memory; coming back loads the page again and the song waits for
  // Play. "inactive" is a short interruption (a system sheet): nothing changes.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        _suspend();
      case AppLifecycleState.resumed:
        _resume();
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        break;
    }
  }

  void _suspend() {
    if (_suspended) return;
    _suspended = true;
    _hideTimer?.cancel();
    if (_playingHere) unawaited(_actions.control(ControlAction.CONTROL_ACTION_PAUSE));
    if (_awake) {
      _awake = false;
      widget.screenAwake.disable();
    }
    unawaited(_bridge.host?.unload());
  }

  void _resume() {
    if (!_suspended) return;
    _suspended = false;
    if (_loadError.isNotEmpty) setState(() => _loadError = '');
    unawaited(_bridge.host?.load()); // the page announces itself and is given the token again
  }

  // The screen stays on while a song plays on this device.
  void _onState() {
    // the state shows what the buttons chose: from now on the state is the truth (another device may change it)
    for (final mp3 in [true, false]) {
      if (_movedVolume[mp3] != null && _movedVolume[mp3] == _liveVolume(mp3)) _movedVolume.remove(mp3);
    }
    if (_suspended) return; // the state is stale while the app is in the background
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
    return PopScope(
      canPop: !_connectOpen, // Back closes the card first, then the player
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _closeConnect();
      },
      child: Focus(
        focusNode: _wakeNode,
        onKeyEvent: _onKey,
        // a touch anywhere shows the buttons; while they are hidden it reaches no button (IgnorePointer below)
        child: Listener(behavior: HitTestBehavior.translucent, onPointerDown: (_) => _wake(), child: _scaffold(context, server)),
      ),
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
                        allowNavigation: (to) => to.toString() == 'about:blank' || sameOrigin(to.toString(), server),
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
                                        runSpacing: 8,
                                        crossAxisAlignment: WrapCrossAlignment.center,
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
                                          // this device's volume: only while this device is the player (the song that plays elsewhere is not affected)
                                          if (isHere && _volumeIsMp3 != null) ...[
                                            FocusGrow(
                                              child: OutlinedButton(onPressed: () => _changeVolume(-1), child: const Text('Volume down')),
                                            ),
                                            Semantics(
                                              liveRegion: true,
                                              child: Text(
                                                '${_volumeIsMp3! ? 'MP3' : 'MIDI'} volume ${_volumePct(_volumeIsMp3!)}%',
                                                style: const TextStyle(color: Colors.white, fontSize: 18),
                                              ),
                                            ),
                                            FocusGrow(
                                              child: OutlinedButton(onPressed: () => _changeVolume(1), child: const Text('Volume up')),
                                            ),
                                          ],
                                          // the page's own buttons cannot take the D-pad, so taking over from another device is a native button
                                          if (!isHere)
                                            FocusGrow(
                                              child: OutlinedButton(
                                                onPressed: () => _actions.control(ControlAction.CONTROL_ACTION_PLAY_HERE),
                                                child: const Text('Play here'),
                                              ),
                                            ),
                                          // for the people in the room: the server's address as a QR, to queue songs from a phone or tablet
                                          if (AppScope.isTvOf(context))
                                            FocusGrow(
                                              child: OutlinedButton(focusNode: _connectNode, onPressed: _showConnect, child: const Text('Connect a phone')),
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
                // above the controls and above the lyrics; it takes no focus: the focus stays on the button that opened it
                if (_connectOpen)
                  Center(
                    child: ExcludeFocus(child: ConnectCard(address: server)),
                  ),
              ],
            ),
    );
  }
}
