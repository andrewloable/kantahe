import 'package:flutter/material.dart';
import 'package:kantahe/auth/auth_page.dart';
import 'package:kantahe/core/app_scope.dart';

/// First screen: the address of the server. A server that has no account yet is set up in a web browser.
class ServerScreen extends StatefulWidget {
  const ServerScreen({super.key});

  @override
  State<ServerScreen> createState() => _ServerScreenState();
}

class _ServerScreenState extends State<ServerScreen> {
  final _url = TextEditingController(text: 'http://');
  bool _busy = false;
  String _failure = '';
  bool _needsSetup = false;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
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

  @override
  Widget build(BuildContext context) {
    return AuthPage(
      title: 'Connect to your server',
      children: [
        const Text('Enter the address of your Kantahe server, for example http://192.168.1.20:8080.'),
        const SizedBox(height: 16),
        TextField(
          key: const Key('server-url'),
          controller: _url,
          keyboardType: TextInputType.url,
          autocorrect: false,
          enableSuggestions: false,
          textInputAction: TextInputAction.go,
          onSubmitted: (_) => _connect(),
          decoration: const InputDecoration(labelText: 'Server address', border: OutlineInputBorder()),
        ),
        if (_failure.isNotEmpty) MessageLine(_failure),
        if (_needsSetup)
          const MessageLine(
            'Server needs setup in a web browser first. Open its address in a browser, create the first account there, then come back.',
            error: false,
          ),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : _connect, child: const Text('Connect')),
      ],
    );
  }
}
