import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/library/format_badge.dart';
import 'package:kantahe/queue/devices_list.dart';
import 'package:kantahe/queue/now_playing_card.dart';
import 'package:kantahe/queue/queue_actions.dart';

/// The user's queue: what plays now, what comes up (remove, move to top), and the devices. Everything shown
/// comes from the state stream.
class QueueScreen extends StatefulWidget {
  const QueueScreen({super.key, this.playerBuilder});

  /// The player screen; Play here opens it once the server accepted the command.
  final WidgetBuilder? playerBuilder;

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  QueueActions? _actions;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _actions ??= QueueActions(api: AppScope.of(context).api, notify: _notify);
  }

  void _notify(String message, {bool error = false, String? actionLabel, VoidCallback? onAction}) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Theme.of(context).colorScheme.error : null,
        action: actionLabel == null ? null : SnackBarAction(label: actionLabel, onPressed: onAction ?? () {}),
      ),
    );
  }

  void _openPlayer() {
    final builder = widget.playerBuilder;
    if (builder != null && mounted) Navigator.of(context).push(MaterialPageRoute<void>(builder: builder));
  }

  @override
  Widget build(BuildContext context) {
    final store = AppScope.of(context).state;
    final actions = _actions!;
    return Scaffold(
      appBar: AppBar(title: const Text('Queue')),
      body: ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          final state = store.state;
          if (state == null) return const Padding(padding: EdgeInsets.all(16), child: Text('Connecting…'));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (!store.connected)
                Semantics(
                  liveRegion: true,
                  child: const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('Reconnecting… Showing the last known state.')),
                ),
              NowPlayingCard(actions: actions, onPlayHere: _openPlayer),
              const SizedBox(height: 16),
              Text('Coming up', style: Theme.of(context).textTheme.titleMedium),
              if (state.queue.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text('The queue is empty. Add songs from the library, or let the next one be picked at random.'),
                )
              else
                for (final (i, q) in state.queue.indexed) _QueueRow(item: q, first: i == 0, actions: actions),
              const SizedBox(height: 16),
              const DevicesList(),
            ],
          );
        },
      ),
    );
  }
}

class _QueueRow extends StatelessWidget {
  const _QueueRow({required this.item, required this.first, required this.actions});

  final QueueItem item;
  final bool first;
  final QueueActions actions;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final title = item.song.title;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(item.song.artist, style: TextStyle(color: muted)),
                ],
              ),
            ),
          ),
          if (item.hasSong()) FormatBadge(item.song.format),
          if (!first)
            IconButton(tooltip: 'Move $title to the top of the queue', icon: const Icon(Icons.vertical_align_top), onPressed: () => actions.moveToTop(item)),
          IconButton(tooltip: 'Remove $title from the queue', icon: const Icon(Icons.delete_outline), onPressed: () => actions.remove(item)),
        ],
      ),
    );
  }
}
