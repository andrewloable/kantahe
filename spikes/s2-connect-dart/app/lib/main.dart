// ignore_for_file: avoid_print
import 'dart:async';

import 'package:flutter/material.dart';

import 'api.dart';
import 'watcher.dart';

/// Build-time settings: flutter build --dart-define=SPIKE_URL=http://10.0.2.2:8099 --dart-define=AUTORUN_SECONDS=660
const _url = String.fromEnvironment('SPIKE_URL', defaultValue: 'http://127.0.0.1:8099');
const _autorunSeconds = int.fromEnvironment('AUTORUN_SECONDS');

void main() {
  runApp(SpikeApp(apiFor: ConnectApi.new, defaultUrl: _url, autorunSeconds: _autorunSeconds));
}

class SpikeApp extends StatelessWidget {
  const SpikeApp({super.key, required this.apiFor, required this.defaultUrl, this.autorunSeconds = 0});

  final SpikeApi Function(String url) apiFor;
  final String defaultUrl;

  /// When above zero the app runs the whole test by itself and logs it with the prefix SPIKE.
  final int autorunSeconds;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Spike S2',
        home: SpikePage(apiFor: apiFor, defaultUrl: defaultUrl, autorunSeconds: autorunSeconds),
      );
}

class SpikePage extends StatefulWidget {
  const SpikePage({super.key, required this.apiFor, required this.defaultUrl, required this.autorunSeconds});

  final SpikeApi Function(String url) apiFor;
  final String defaultUrl;
  final int autorunSeconds;

  @override
  State<SpikePage> createState() => _SpikePageState();
}

class _SpikePageState extends State<SpikePage> {
  late final TextEditingController _url = TextEditingController(text: widget.defaultUrl);
  String _unary = '';
  bool _streaming = false;
  Watcher? _watcher;
  SpikeApi? _api;
  Timer? _log;

  @override
  void initState() {
    super.initState();
    if (widget.autorunSeconds > 0) WidgetsBinding.instance.addPostFrameCallback((_) => _autorun());
  }

  @override
  void dispose() {
    _log?.cancel();
    _watcher?.dispose();
    _api?.close();
    _url.dispose();
    super.dispose();
  }

  Future<void> _doUnary() async {
    final api = widget.apiFor(_url.text.trim());
    try {
      final text = await api.serverInfo();
      if (mounted) setState(() => _unary = text);
      print('SPIKE unary ok: $text');
    } catch (e) {
      if (mounted) setState(() => _unary = 'error: $e');
      print('SPIKE unary FAILED: $e');
    } finally {
      api.close();
    }
  }

  void _setStreaming(bool on) {
    _watcher?.stop();
    _api?.close();
    if (on) {
      final api = _api = widget.apiFor(_url.text.trim());
      _watcher = Watcher(api.watch)
        ..addListener(() {
          if (mounted) setState(() {});
        })
        ..start();
    } else {
      _watcher = null;
      _api = null;
    }
    setState(() => _streaming = on);
  }

  Future<void> _autorun() async {
    print('SPIKE start url=${_url.text} for ${widget.autorunSeconds} s');
    await _doUnary();
    _setStreaming(true);
    final started = DateTime.now();
    _log = Timer.periodic(const Duration(seconds: 30), (t) {
      final v = _watcher?.value;
      final elapsed = DateTime.now().difference(started).inSeconds;
      print('SPIKE t=${elapsed}s messages=${v?.messages} last_server_time_ms=${v?.lastTimeMs} reconnects=${v?.reconnects} last_error=${v?.lastError}');
      if (elapsed >= widget.autorunSeconds) {
        print('SPIKE DONE messages=${v?.messages} reconnects=${v?.reconnects}');
        t.cancel();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final v = _watcher?.value ?? const WatchValue();
    return Scaffold(
      appBar: AppBar(title: const Text('Spike S2: connect-dart')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: [
            TextField(key: const Key('url'), controller: _url, decoration: const InputDecoration(labelText: 'Server URL')),
            const SizedBox(height: 16),
            FilledButton(key: const Key('unary'), onPressed: _doUnary, child: const Text('Unary: GetServerInfo')),
            Text(_unary, key: const Key('unaryResult')),
            const SizedBox(height: 16),
            SwitchListTile(key: const Key('stream'), title: const Text('Stream: WatchState'), value: _streaming, onChanged: _setStreaming),
            Text('last server_time_ms: ${v.lastTimeMs}'),
            Text('messages: ${v.messages}'),
            Text('reconnects: ${v.reconnects}'),
            if (v.lastError != null) Text('last error: ${v.lastError}'),
          ],
        ),
      ),
    );
  }
}
