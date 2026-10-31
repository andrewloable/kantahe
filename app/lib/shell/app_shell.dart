import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/library/library_screen.dart';
import 'package:kantahe/me/me_screen.dart';
import 'package:kantahe/player/player_screen.dart';
import 'package:kantahe/queue/queue_screen.dart';

/// What the app shows once signed in: Library, Queue and Me behind a navigation bar. The screens are kept
/// while another one is shown (what was typed or scrolled stays). Play here on the queue opens the player.
class AppShell extends StatefulWidget {
  const AppShell({super.key, this.playerBuilder = _player});

  /// The player screen (tests give a stand-in: the real one needs a WebView).
  final WidgetBuilder playerBuilder;

  static Widget _player(BuildContext context) => const PlayerScreen();

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  static const _destinations = [
    (icon: Icons.library_music_outlined, selected: Icons.library_music, label: 'Library'),
    (icon: Icons.queue_music_outlined, selected: Icons.queue_music, label: 'Queue'),
    (icon: Icons.person_outline, selected: Icons.person, label: 'Me'),
  ];

  @override
  Widget build(BuildContext context) {
    final screens = IndexedStack(
      index: _index,
      children: [
        const LibraryScreen(),
        QueueScreen(playerBuilder: widget.playerBuilder),
        const MeScreen(),
      ],
    );
    if (AppScope.isTvOf(context)) {
      // a TV has the width: the destinations go to the side, where left on the remote reaches them
      return Scaffold(
        body: SafeArea(
          child: Row(
            children: [
              NavigationRail(
                selectedIndex: _index,
                onDestinationSelected: (i) => setState(() => _index = i),
                labelType: NavigationRailLabelType.all,
                destinations: [
                  for (final d in _destinations) NavigationRailDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selected), label: Text(d.label)),
                ],
              ),
              const VerticalDivider(width: 1),
              Expanded(child: screens),
            ],
          ),
        ),
      );
    }
    return Scaffold(
      body: screens,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [for (final d in _destinations) NavigationDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selected), label: d.label)],
      ),
    );
  }
}
