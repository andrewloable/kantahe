import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/brand.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

/// The small last line of the app frame: the copyright and the version of the server the app is connected to. The version is asked once; a
/// server that does not answer (or no services above, in a test) leaves the copyright and the name alone. It is text only: no focus stop.
class AppFooter extends StatefulWidget {
  const AppFooter({super.key});

  @override
  State<AppFooter> createState() => _AppFooterState();
}

class _AppFooterState extends State<AppFooter> {
  String _version = '';
  bool _asked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_asked) return;
    final services = context.dependOnInheritedWidgetOfExactType<AppScope>()?.services;
    if (services == null) return;
    _asked = true;
    _load(services);
  }

  Future<void> _load(AppServices services) async {
    try {
      final info = await services.api.auth.getServerInfo(GetServerInfoRequest());
      if (mounted) setState(() => _version = info.version);
    } catch (_) {
      // nothing to tell the user: the footer keeps the copyright alone
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return ExcludeFocus(
      child: Semantics(
        container: true,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Center(
            child: Text('$kCopyright · Kantahe${_version.isEmpty ? '' : ' $_version'}', style: style, textAlign: TextAlign.center),
          ),
        ),
      ),
    );
  }
}
