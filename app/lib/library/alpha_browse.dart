import 'package:flutter/material.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/library/pager.dart';
import 'package:kantahe/library/song_list.dart';

final _letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];

enum _Mode { titles, artists }

/// Browse by first letter: song titles, or artists (tap one to see their songs).
class AlphaBrowse extends StatefulWidget {
  const AlphaBrowse({super.key, required this.actions});

  final LibraryActions actions;

  @override
  State<AlphaBrowse> createState() => _AlphaBrowseState();
}

class _AlphaBrowseState extends State<AlphaBrowse> {
  String _letter = 'A';
  _Mode _mode = _Mode.titles;

  /// The artist whose songs are shown.
  String? _artist;

  late final Pager<Song> _titles = Pager<Song>((token, signal) async {
    final r = await widget.actions.api.catalog.searchSongs(
      SearchSongsRequest(sort: SongSort.SONG_SORT_TITLE, letter: _letter, pageToken: token),
      signal: signal,
    );
    widget.actions.adopt(r.songs);
    return ListPage(r.songs, r.nextPageToken);
  }, key: (s) => s.number);

  late final Pager<Artist> _artists = Pager<Artist>((token, signal) async {
    final r = await widget.actions.api.catalog.listArtists(
      ListArtistsRequest(letter: _letter, pageToken: token),
      signal: signal,
    );
    return ListPage(r.artists, r.nextPageToken);
  }, key: (a) => a.name);

  late final Pager<Song> _artistSongs = Pager<Song>((token, signal) async {
    final r = await widget.actions.api.catalog.searchSongs(
      SearchSongsRequest(query: _artist ?? '', sort: SongSort.SONG_SORT_TITLE, pageToken: token),
      signal: signal,
    );
    widget.actions.adopt(r.songs);
    return ListPage(r.songs, r.nextPageToken);
  }, key: (s) => s.number);

  @override
  void initState() {
    super.initState();
    _titles.reset();
  }

  @override
  void dispose() {
    _titles.dispose();
    _artists.dispose();
    _artistSongs.dispose();
    super.dispose();
  }

  void _setLetter(String l) {
    setState(() {
      _letter = l;
      _artist = null;
    });
    (_mode == _Mode.titles ? _titles : _artists).reset();
  }

  void _setMode(_Mode m) {
    if (m == _mode) return;
    setState(() {
      _mode = m;
      _artist = null;
    });
    (m == _Mode.titles ? _titles : _artists).reset();
  }

  void _choose(Artist a) {
    setState(() => _artist = a.name);
    _artistSongs.reset();
  }

  Widget _error(Pager<Object?> p) => p.error.isEmpty
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              Expanded(
                child: Text(p.error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ),
              TextButton(onPressed: p.retry, child: const Text('Try again')),
            ],
          ),
        );

  Widget _songs(Pager<Song> p) => ListenableBuilder(
    listenable: p,
    builder: (context, _) => Column(
      children: [
        _error(p),
        Expanded(
          child: SongList(
            songs: p.items,
            actions: widget.actions,
            hasMore: p.hasMore,
            loading: p.loading,
            autoMore: p.error.isEmpty,
            onMore: p.more,
            onRefresh: p.reset,
          ),
        ),
      ],
    ),
  );

  Widget _artistList() => ListenableBuilder(
    listenable: _artists,
    builder: (context, _) {
      final p = _artists;
      return Column(
        children: [
          _error(p),
          Expanded(
            child: ListView(
              children: [
                for (final a in p.items)
                  ListTile(
                    title: Text(a.name),
                    trailing: Text(
                      a.songCount == 1 ? '1 song' : '${a.songCount} songs',
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    ),
                    onTap: () => _choose(a),
                  ),
                if (p.loading)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (!p.loading && p.loaded && p.items.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No artists under this letter.')),
                if (p.hasMore)
                  Center(
                    child: TextButton(onPressed: p.loading ? null : p.more, child: const Text('Load more')),
                  ),
              ],
            ),
          ),
        ],
      );
    },
  );

  @override
  Widget build(BuildContext context) {
    final artist = _artist;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: SegmentedButton<_Mode>(
            segments: const [
              ButtonSegment(value: _Mode.titles, label: Text('Titles')),
              ButtonSegment(value: _Mode.artists, label: Text('Artists')),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => _setMode(s.first),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              for (final l in _letters)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: ChoiceChip(label: Text(l), selected: _letter == l, onSelected: (_) => _setLetter(l)),
                ),
            ],
          ),
        ),
        Expanded(
          child: switch (_mode) {
            _Mode.titles => _songs(_titles),
            _Mode.artists when artist != null => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(onPressed: () => setState(() => _artist = null), child: const Text('← Back to artists')),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(artist, style: Theme.of(context).textTheme.titleLarge),
                ),
                Expanded(child: _songs(_artistSongs)),
              ],
            ),
            _Mode.artists => _artistList(),
          },
        ),
      ],
    );
  }
}
