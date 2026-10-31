import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/format_badge.dart';
import 'package:kantahe/library/library_actions.dart';

const _lookupDelay = Duration(milliseconds: 150);
const _maxDigits = 20;

enum _Status { idle, looking, found, missing, error }

/// Type the number of a song (as in a songbook): it is looked up 150 ms after the last key and can be queued.
class NumberPad extends StatefulWidget {
  const NumberPad({super.key, required this.actions});

  final LibraryActions actions;

  @override
  State<NumberPad> createState() => _NumberPadState();
}

class _NumberPadState extends State<NumberPad> {
  String _digits = '';
  _Status _status = _Status.idle;
  Song? _found;
  String _message = '';
  Timer? _timer;
  int _generation = 0;
  CancelableSignal? _lookingUp;

  @override
  void dispose() {
    _timer?.cancel();
    _lookingUp?.cancel();
    _generation++;
    super.dispose();
  }

  void _press(String d) {
    if (_digits.length < _maxDigits) _change(_digits + d);
  }

  void _backspace() => _change(_digits.isEmpty ? '' : _digits.substring(0, _digits.length - 1));

  void _clear() => _change('');

  Future<void> _add() async {
    final song = _found;
    if (song != null && await widget.actions.add(song)) {
      if (mounted) _clear();
    }
  }

  void _change(String digits) {
    _timer?.cancel();
    _lookingUp?.cancel();
    final mine = ++_generation;
    setState(() {
      _digits = digits;
      _found = null;
      _message = '';
      _status = digits.isEmpty ? _Status.idle : _Status.looking;
    });
    if (digits.isEmpty) return;
    _timer = Timer(_lookupDelay, () => _lookup(digits, mine));
  }

  Future<void> _lookup(String digits, int mine) async {
    final request = _lookingUp = CancelableSignal();
    try {
      final res = await widget.actions.api.catalog.getSong(GetSongRequest(number: digits), signal: request);
      if (mine != _generation || !mounted) return;
      widget.actions.adopt(res.hasSong() ? [res.song] : []);
      setState(() {
        _found = res.hasSong() ? res.song : null;
        _status = res.hasSong() ? _Status.found : _Status.missing;
      });
    } catch (e) {
      if (mine != _generation || !mounted) return;
      final message = problem(e, {Code.notFound: ''});
      setState(() {
        _status = message.isEmpty ? _Status.missing : _Status.error;
        _message = message;
      });
    }
  }

  Widget _key(String label, VoidCallback onPressed, {String? tooltip}) {
    final button = OutlinedButton(
      onPressed: onPressed,
      child: Text(label, style: const TextStyle(fontSize: 24)),
    );
    return tooltip == null ? button : Tooltip(message: tooltip, child: button);
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final found = _found;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                label: 'Song number',
                value: _digits,
                liveRegion: true,
                excludeSemantics: true,
                child: SizedBox(
                  height: 56,
                  child: Center(
                    child: Text(
                      _digits,
                      key: const Key('digits'),
                      style: const TextStyle(fontSize: 32, letterSpacing: 4, fontFeatures: [FontFeature.tabularFigures()]),
                    ),
                  ),
                ),
              ),
              Semantics(
                liveRegion: true,
                child: SizedBox(
                  height: 64,
                  child: Center(
                    child: switch (_status) {
                      _Status.looking => const Text('Looking…'),
                      _Status.missing => const Text('No song with this number'),
                      _Status.error => Text(_message, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      _Status.found when found != null => Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(found.number, style: TextStyle(color: muted)),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              found.title,
                              style: const TextStyle(fontWeight: FontWeight.w700),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Flexible(child: Text(found.artist, overflow: TextOverflow.ellipsis)),
                          const SizedBox(width: 8),
                          FormatBadge(found.format),
                        ],
                      ),
                      _ => const SizedBox.shrink(),
                    },
                  ),
                ),
              ),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 1.6,
                children: [
                  for (final d in ['1', '2', '3', '4', '5', '6', '7', '8', '9']) _key(d, () => _press(d)),
                  _key('C', _clear, tooltip: 'Clear'),
                  _key('0', () => _press('0')),
                  _key('⌫', _backspace, tooltip: 'Backspace'),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton(onPressed: found == null ? null : _add, child: const Text('Add to queue')),
            ],
          ),
        ),
      ),
    );
  }
}
