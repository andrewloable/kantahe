import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/tv/focus.dart';

/// Light, dark, or Auto (what the system says). Applies at once and is kept on this device.
class AppearanceScreen extends StatelessWidget {
  const AppearanceScreen({super.key});

  static const _choices = [(ThemeMode.system, 'Auto (system)'), (ThemeMode.light, 'Light'), (ThemeMode.dark, 'Dark')];

  @override
  Widget build(BuildContext context) {
    final theme = AppScope.of(context).theme;
    return Scaffold(
      appBar: AppBar(title: const Text('Appearance')),
      body: ListenableBuilder(
        listenable: theme,
        builder: (context, _) => ListView(
          children: [
            for (final (mode, label) in _choices)
              FocusRing(
                radius: 0,
                child: ListTile(
                  title: Text(label),
                  selected: theme.mode == mode,
                  trailing: theme.mode == mode ? const Icon(Icons.check) : null,
                  onTap: () => theme.set(mode),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
