import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/messages.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/library/pager.dart';
import 'package:kantahe/library/song_list.dart';

/// The songs the user starred.
class FavouritesScreen extends StatefulWidget {
  const FavouritesScreen({super.key});

  @override
  State<FavouritesScreen> createState() => _FavouritesScreenState();
}

class _FavouritesScreenState extends State<FavouritesScreen> {
  late final AppServices _services = AppScope.of(context);
  late final LibraryActions _actions = LibraryActions(
    api: _services.api,
    auth: _services.auth,
    notify: (m, {bool error = false}) => showMessage(context, m, error: error),
  );
  late final Pager<Song> _pager = Pager<Song>((token, signal) async {
    final r = await _services.api.userLibrary.listFavourites(ListFavouritesRequest(pageToken: token), signal: signal);
    _actions.adopt(r.songs);
    return ListPage(r.songs, r.nextPageToken);
  }, key: (s) => s.number);
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

  /// A song that is un-starred here leaves the list.
  List<Song> get _shown => _pager.items.where(_actions.isFavourite).toList();

  /// Songs were un-starred here, so the positions the server counts from have moved.
  bool get _moved => _pager.items.any((s) => !_actions.isFavourite(s));

  /// The next page. After un-starring, the server's next page (counted by position) would skip a song, so the
  /// list is read again from the start, at least as far as it was, plus a page.
  Future<void> _more() async {
    if (!_pager.hasMore || _pager.loading) return;
    if (!_moved) return _pager.more();
    final keep = _shown.length;
    await _pager.reset();
    while (mounted && _pager.items.length <= keep && _pager.hasMore) {
      await _pager.more();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Favourites')),
      body: ListenableBuilder(
        listenable: Listenable.merge([_pager, _actions]),
        builder: (context, _) => Column(
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
            Expanded(
              child: SongList(
                songs: _shown,
                actions: _actions,
                hasMore: _pager.hasMore,
                loading: _pager.loading,
                autoMore: _pager.error.isEmpty,
                onMore: _more,
                onRefresh: _pager.reset,
                emptyText: 'You have no favourites yet.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
