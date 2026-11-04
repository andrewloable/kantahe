import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/library/library_screen.dart';
import 'package:kantahe/me/me_screen.dart';
import 'package:kantahe/player/player_screen.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/queue/queue_screen.dart';
import 'package:kantahe/shell/app_footer.dart';
import 'package:kantahe/tv/focus.dart';

/// What the app shows once signed in: Library, Queue and Me behind a navigation bar (a rail at the side on a TV), with Player between Queue and
/// Me. The screens are kept while another one is shown (what was typed or scrolled stays). Player, and Play here on the queue, open the player
/// screen over them; Close returns to the screen that was shown. The app opens in the player (it is the screen that plays), once, as soon as
/// the server's state is known; Close leaves it for the library, and it is not opened again until the next start. Opening it sends no
/// command: nothing starts playing by itself.
class AppShell extends StatefulWidget {
  const AppShell({super.key, this.playerBuilder = _player});

  /// The player screen (tests give a stand-in: the real one needs a WebView).
  final WidgetBuilder playerBuilder;

  static Widget _player(BuildContext context) => const PlayerScreen();

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _screen = 0; // the screen shown behind the navigation: 0 Library, 1 Queue, 2 Me
  bool _playerOpen = false; // a player route pushed from here is on the stack
  StateStore? _watching;

  static const _destinations = [
    (icon: Icons.library_music_outlined, selected: Icons.library_music, label: 'Library'),
    (icon: Icons.queue_music_outlined, selected: Icons.queue_music, label: 'Queue'),
    (icon: Icons.play_circle_outline, selected: Icons.play_circle, label: 'Player'),
    (icon: Icons.person_outline, selected: Icons.person, label: 'Me'),
  ];

  /// The screen each destination shows; null: the destination opens the player over the screens instead of replacing one of them.
  static const _screenOf = [0, 1, null, 2];

  int get _selectedDestination => _screenOf.indexOf(_screen);

  void _select(int destination) {
    final screen = _screenOf[destination];
    if (screen == null) {
      _openPlayer();
    } else {
      setState(() => _screen = screen);
    }
  }

  /// Opens the player screen over the others, unless one pushed from here is open already.
  void _openPlayer() {
    if (_playerOpen) return;
    _playerOpen = true;
    Navigator.of(context).push(MaterialPageRoute<void>(builder: widget.playerBuilder)).whenComplete(() => _playerOpen = false);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final services = AppScope.of(context);
    if (_watching != null) return;
    _watching = services.state;
    _watching!.addListener(_openPlayerAtStart);
    _openPlayerAtStart();
  }

  @override
  void dispose() {
    _watching?.removeListener(_openPlayerAtStart);
    super.dispose();
  }

  void _openPlayerAtStart() {
    final store = _watching;
    if (store == null || store.state == null) return; // the server has not answered yet
    store.removeListener(_openPlayerAtStart);
    _watching = null; // once per start
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _openPlayer();
    });
  }

  /// DOWN on the last destination and UP on the first one stay where they are. Without this the default directional traversal leaves the rail
  /// for whatever lies lower or higher in the content (from Me into the middle of the Me list), skipping the entries in between.
  KeyEventResult _keepUpDownInRail(FocusNode rail, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final down = event.logicalKey == LogicalKeyboardKey.arrowDown;
    if (!down && event.logicalKey != LogicalKeyboardKey.arrowUp) return KeyEventResult.ignored;
    final items = rail.traversalDescendants.toList()..sort((a, b) => a.rect.top.compareTo(b.rect.top));
    if (items.isEmpty) return KeyEventResult.ignored;
    final atEdge = identical(FocusManager.instance.primaryFocus, down ? items.last : items.first);
    return atEdge ? KeyEventResult.handled : KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    final screens = IndexedStack(
      index: _screen,
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
              Focus(
                canRequestFocus: false,
                skipTraversal: true,
                onKeyEvent: _keepUpDownInRail,
                child: NavigationRail(
                  selectedIndex: _selectedDestination,
                  onDestinationSelected: _select,
                  labelType: NavigationRailLabelType.all,
                  destinations: [
                    for (final d in _destinations)
                      NavigationRailDestination(icon: _RailIcon(d.icon), selectedIcon: _RailIcon(d.selected), label: _RailLabel(d.label)),
                  ],
                ),
              ),
              const VerticalDivider(width: 1),
              Expanded(
                child: Column(
                  children: [
                    Expanded(child: screens),
                    const AppFooter(),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Scaffold(
      body: Column(
        children: [
          Expanded(child: screens),
          const AppFooter(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedDestination,
        onDestinationSelected: _select,
        destinations: [for (final d in _destinations) NavigationDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selected), label: d.label)],
      ),
    );
  }
}

/// The icon of a rail destination. The rail only tints a small pill behind the icon while the remote is on a
/// destination, which is too faint across a room: with the focus it becomes a solid block of the opposite tone of the
/// page, with a halo in the page's own tone (the same look as the buttons).
class _RailIcon extends StatelessWidget {
  const _RailIcon(this.icon);

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FocusAware(
      builder: (context, focused) => focused
          ? DecoratedBox(
              key: const Key('rail-focus'),
              decoration: BoxDecoration(
                color: scheme.inverseSurface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [BoxShadow(color: scheme.surface, spreadRadius: 2)],
              ),
              child: SizedBox(width: 56, height: 32, child: Icon(icon, color: scheme.onInverseSurface)),
            )
          : Icon(icon),
    );
  }
}

/// The label of a rail destination: bold while the remote is on it.
class _RailLabel extends StatelessWidget {
  const _RailLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => FocusAware(
    builder: (context, focused) => Text(label, style: focused ? const TextStyle(fontWeight: FontWeight.w800) : null),
  );
}
