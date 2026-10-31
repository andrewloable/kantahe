import 'dart:async';

import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/alpha_browse.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/library/number_pad.dart';
import 'package:kantahe/library/pager.dart';
import 'package:kantahe/library/song_list.dart';

const _searchDelay = Duration(milliseconds: 250);

/// Find a song: search, type its number, or browse by letter. A tap queues it, the star favourites it.
class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this)..addListener(() => setState(() {}));
  LibraryActions? _actions;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_actions != null) return;
    final services = AppScope.of(context);
    _actions = LibraryActions(api: services.api, auth: services.auth, notify: _notify);
  }

  @override
  void dispose() {
    _tabs.dispose();
    _actions?.dispose();
    super.dispose();
  }

  void _notify(String message, {bool error = false}) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? Theme.of(context).colorScheme.error : null));
  }

  @override
  Widget build(BuildContext context) {
    final actions = _actions!;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Library'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Search'),
            Tab(text: 'Number'),
            Tab(text: 'Browse'),
          ],
        ),
      ),
      body: switch (_tabs.index) {
        0 => _SearchTab(actions: actions),
        1 => NumberPad(actions: actions),
        _ => AlphaBrowse(actions: actions),
      },
    );
  }
}

class _SearchTab extends StatefulWidget {
  const _SearchTab({required this.actions});

  final LibraryActions actions;

  @override
  State<_SearchTab> createState() => _SearchTabState();
}

class _SearchTabState extends State<_SearchTab> {
  final _query = TextEditingController();
  Format _format = Format.FORMAT_UNSPECIFIED;
  Timer? _timer;

  /// The query and format of the list on screen. A page token only fits the search it came from, so the
  /// text typed since (before the delay has passed) must not reach the next page's request.
  String _activeQuery = '';
  Format _activeFormat = Format.FORMAT_UNSPECIFIED;

  late final Pager<Song> _songs = Pager<Song>((token, signal) async {
    final r = await widget.actions.api.catalog.searchSongs(
      SearchSongsRequest(query: _activeQuery, format: _activeFormat, pageToken: token),
      signal: signal,
    );
    widget.actions.adopt(r.songs);
    return ListPage(r.songs, r.nextPageToken);
  }, key: (s) => s.number);

  @override
  void initState() {
    super.initState();
    _songs.reset();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _songs.dispose();
    _query.dispose();
    super.dispose();
  }

  void _onQuery(String _) {
    _timer?.cancel();
    _timer = Timer(_searchDelay, _searchNow);
  }

  /// Starts a new search with what is typed and chosen now.
  void _searchNow() {
    _timer?.cancel();
    _activeQuery = _query.text.trim();
    _activeFormat = _format;
    _songs.reset();
  }

  void _setFormat(Format f) {
    setState(() => _format = f);
    _searchNow();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: TextField(
            key: const Key('search'),
            controller: _query,
            onChanged: _onQuery,
            onSubmitted: (_) => _searchNow(),
            textInputAction: TextInputAction.search,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Search songs', prefixIcon: Icon(Icons.search), border: OutlineInputBorder()),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Wrap(
            spacing: 8,
            children: [
              for (final (label, f) in [('All', Format.FORMAT_UNSPECIFIED), ('MP3', Format.FORMAT_MP3), ('MIDI', Format.FORMAT_MIDI)])
                ChoiceChip(label: Text(label), selected: _format == f, onSelected: (_) => _setFormat(f)),
            ],
          ),
        ),
        Expanded(
          child: ListenableBuilder(
            listenable: _songs,
            builder: (context, _) => Column(
              children: [
                if (_songs.error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(_songs.error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                        ),
                        TextButton(onPressed: _songs.retry, child: const Text('Try again')),
                      ],
                    ),
                  ),
                Expanded(
                  child: SongList(
                    songs: _songs.items,
                    actions: widget.actions,
                    hasMore: _songs.hasMore,
                    loading: _songs.loading,
                    autoMore: _songs.error.isEmpty,
                    onMore: _songs.more,
                    onRefresh: _songs.reset,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
