import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/messages.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';
import 'package:kantahe/library/format_badge.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/library/pager.dart';

/// yyyy-MM-dd HH:mm in the local time.
String formatWhen(DateTime t) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${t.year}-${two(t.month)}-${two(t.day)} ${two(t.hour)}:${two(t.minute)}';
}

/// What the user sang, newest first, with the score; Sing again queues a song once more.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late final AppServices _services = AppScope.of(context);
  late final LibraryActions _actions = LibraryActions(
    api: _services.api,
    auth: _services.auth,
    notify: (m, {bool error = false}) => showMessage(context, m, error: error),
  );
  late final Pager<HistoryEntry> _pager = Pager<HistoryEntry>((token, signal) async {
    final r = await _services.api.userLibrary.listHistory(ListHistoryRequest(pageToken: token), signal: signal);
    _actions.adopt(r.entries.where((e) => e.hasSong()).map((e) => e.song));
    return ListPage(r.entries, r.nextPageToken);
  });
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _pager.reset();
  }

  @override
  void dispose() {
    _pager.dispose();
    _actions.dispose();
    super.dispose();
  }

  String _result(HistoryEntry e) => e.skipped ? 'skipped' : (e.hasScore ? 'Score ${e.score_5}' : 'No score');

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Scaffold(
      appBar: AppBar(title: const Text('History')),
      body: ListenableBuilder(
        listenable: _pager,
        builder: (context, _) => ListView(
          children: [
            if (_pager.error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(_pager.error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ),
                    TextButton(onPressed: _pager.retry, child: const Text('Try again')),
                  ],
                ),
              ),
            for (final e in _pager.items)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(e.song.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                          Text(e.song.artist, style: TextStyle(color: muted)),
                          Text(formatWhen(DateTime.fromMillisecondsSinceEpoch(e.sungAtUnix.toInt() * 1000)), style: TextStyle(color: muted, fontSize: 13)),
                        ],
                      ),
                    ),
                    if (e.hasSong()) FormatBadge(e.song.format),
                    const SizedBox(width: 8),
                    Text(_result(e)),
                    if (e.hasSong()) IconButton(tooltip: 'Sing ${e.song.title} again', icon: const Icon(Icons.replay), onPressed: () => _actions.add(e.song)),
                  ],
                ),
              ),
            if (_pager.loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (!_pager.loading && _pager.loaded && _pager.items.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Nothing sung yet.')),
            if (_pager.hasMore)
              Center(
                child: TextButton(onPressed: _pager.loading ? null : _pager.more, child: const Text('Load more')),
              ),
          ],
        ),
      ),
    );
  }
}
