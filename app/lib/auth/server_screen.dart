import 'package:flutter/material.dart';
import 'package:kantahe/auth/auth_page.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/server_discovery.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/tv/dpad_escape.dart';
import 'package:kantahe/tv/focus.dart';

/// How long the network is searched (docs/PLAN.md section 8, "Finding the server").
const _searchWindow = Duration(seconds: 3);

const _setupText = 'Server needs setup in a web browser first. Open its address in a browser, create the first account there, then come back.';

/// A server that answered: where it is, what it calls itself and its version.
class _Found {
  const _Found(this.url, this.name, this.version, this.setupRequired);

  final String url;
  final String name;
  final String version;
  final bool setupRequired;

  String get title => name.isEmpty ? url : name;
}

enum _Phase { searching, connecting, list, manual }

/// First screen: the server. It looks for Kantahe servers on the network; one is connected to by itself, several are
/// listed to choose from, and only when none is found does it ask for the address. A server that has no account yet is
/// set up in a web browser.
class ServerScreen extends StatefulWidget {
  const ServerScreen({super.key});

  @override
  State<ServerScreen> createState() => _ServerScreenState();
}

class _ServerScreenState extends State<ServerScreen> {
  final _url = TextEditingController(text: 'http://');
  _Phase _phase = _Phase.searching;
  List<_Found> _found = const [];
  String _connectingTo = '';
  bool _busy = false;
  bool _searching = false;
  bool _started = false;
  String _failure = '';
  bool _needsSetup = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _search();
  }

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  /// The first address of this server that answers, or null.
  Future<_Found?> _firstAnswer(ServerUrl serverUrl, ServerCandidate server) async {
    final checks = await Future.wait(server.urls.map(serverUrl.validate));
    for (final c in checks) {
      if (c.ok) return _Found(c.url!, c.name ?? '', c.version ?? '', c.setupRequired);
    }
    return null;
  }

  Future<void> _search() async {
    if (_searching) return;
    _searching = true;
    final services = AppScope.of(context);
    setState(() {
      _phase = _Phase.searching;
      _failure = '';
      _needsSetup = false;
    });
    final found = <String, _Found>{}; // one entry per address
    try {
      final servers = await services.findServers(_searchWindow);
      final answers = await Future.wait(servers.map((s) => _firstAnswer(services.serverUrl, s)));
      for (final a in answers) {
        if (a != null) found.putIfAbsent(a.url, () => a);
      }
    } catch (_) {
      // a search that fails finds nothing: the address can still be typed
    } finally {
      _searching = false;
    }
    if (!mounted) return;
    final servers = found.values.toList();
    if (servers.length == 1 && !servers.first.setupRequired && services.serverUrl.autoConnect) {
      setState(() {
        _phase = _Phase.connecting;
        _connectingTo = servers.first.title;
      });
      await services.serverUrl.set(servers.first.url); // the app moves on to sign-in by itself
      return;
    }
    setState(() {
      _found = servers;
      _phase = servers.isEmpty ? _Phase.manual : _Phase.list;
    });
  }

  Future<void> _choose(_Found server) async {
    if (server.setupRequired) {
      setState(() => _needsSetup = true);
      return;
    }
    await AppScope.of(context).serverUrl.set(server.url);
  }

  Future<void> _connect() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failure = '';
      _needsSetup = false;
    });
    final serverUrl = AppScope.of(context).serverUrl;
    try {
      final check = await serverUrl.validate(_url.text);
      if (!mounted) return;
      if (!check.ok) {
        setState(() => _failure = check.error!);
      } else if (check.setupRequired) {
        setState(() {
          _needsSetup = true;
          _failure = '';
        });
      } else {
        await serverUrl.set(check.url!); // the app moves on to sign-in by itself
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _searchAgain() => OutlinedButton(key: const Key('search-again'), onPressed: _search, child: const Text('Search again'));

  @override
  Widget build(BuildContext context) {
    switch (_phase) {
      case _Phase.searching:
        return AuthPage(
          title: 'Connect to your server',
          children: [
            const Center(child: CircularProgressIndicator()),
            const SizedBox(height: 16),
            Semantics(liveRegion: true, child: const Text('Looking for Kantahe servers on this network...', textAlign: TextAlign.center)),
          ],
        );
      case _Phase.connecting:
        return AuthPage(
          title: 'Connect to your server',
          children: [Semantics(liveRegion: true, child: Text('Connecting to $_connectingTo...', textAlign: TextAlign.center))],
        );
      case _Phase.list:
        final tv = AppScope.isTvOf(context);
        return AuthPage(
          title: 'Choose your server',
          children: [
            for (var i = 0; i < _found.length; i++) _row(_found[i], autofocus: tv && i == 0),
            if (_needsSetup) const MessageLine(_setupText, error: false),
            const SizedBox(height: 16),
            _searchAgain(),
          ],
        );
      case _Phase.manual:
        return AuthPage(
          title: 'Connect to your server',
          children: [
            const Text('No Kantahe server was found on this network. Enter its address, for example http://192.168.1.20:8080.'),
            const SizedBox(height: 16),
            DpadEscape(
              controller: _url,
              builder: (focus) => TextField(
                focusNode: focus,
                key: const Key('server-url'),
                controller: _url,
                keyboardType: TextInputType.url,
                autocorrect: false,
                enableSuggestions: false,
                textInputAction: TextInputAction.go,
                onSubmitted: (_) => _connect(),
                decoration: const InputDecoration(labelText: 'Server address', border: OutlineInputBorder()),
              ),
            ),
            if (_failure.isNotEmpty) MessageLine(_failure),
            if (_needsSetup) const MessageLine(_setupText, error: false),
            const SizedBox(height: 16),
            FilledButton(onPressed: _busy ? null : _connect, child: const Text('Connect')),
            const SizedBox(height: 8),
            _searchAgain(),
          ],
        );
    }
  }

  Widget _row(_Found server, {required bool autofocus}) {
    final muted = Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.8);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Semantics(
        label: 'Connect to ${server.title}, ${server.url}',
        button: true,
        excludeSemantics: true,
        child: FocusRing(
          radius: 12,
          child: Card(
            margin: EdgeInsets.zero,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: Key('found-server-${server.url}'),
              autofocus: autofocus,
              onTap: () => _choose(server),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(server.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18)),
                    Text(server.version.isEmpty ? server.url : '${server.url} · version ${server.version}', style: TextStyle(color: muted)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
