import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/format_badge.dart';
import 'package:kantahe/library/library_actions.dart';
import 'package:kantahe/tv/focus.dart';

/// How near the end of the list (in logical pixels) the next page is asked for.
const _nearEnd = 400.0;

/// Songs, one row each: number, title, artist, format badge; a tap queues the song, the star favourites it.
/// Asks for the next page when the end comes near, also when the first page does not fill the screen.
class SongList extends StatefulWidget {
  const SongList({
    super.key,
    required this.songs,
    required this.actions,
    this.hasMore = false,
    this.loading = false,
    this.autoMore = true,
    this.onMore,
    this.onRefresh,
    this.emptyText = 'No songs found.',
  });

  final List<Song> songs;
  final LibraryActions actions;
  final bool hasMore;
  final bool loading;

  /// Ask for the next page by itself when the end is near. Off after a failure, so that a dead link is not
  /// asked again and again: the Load more button (or Try again) is then the way on.
  final bool autoMore;

  /// The end of the list is near (or Load more was pressed).
  final VoidCallback? onMore;

  /// Pull to refresh; without it the list does not offer it.
  final Future<void> Function()? onRefresh;
  final String emptyText;

  @override
  State<SongList> createState() => _SongListState();
}

class _SongListState extends State<SongList> {
  final _controller = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_maybeMore);
    _checkAfterFrame();
  }

  @override
  void didUpdateWidget(SongList old) {
    super.didUpdateWidget(old);
    _checkAfterFrame(); // a page arrived: an end that is still near must ask again
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _checkAfterFrame() => WidgetsBinding.instance.addPostFrameCallback((_) => _maybeMore());

  void _maybeMore() {
    if (!mounted || widget.onMore == null || !widget.hasMore || widget.loading || !widget.autoMore || !_controller.hasClients) return;
    if (_controller.position.extentAfter < _nearEnd) widget.onMore!();
  }

  @override
  Widget build(BuildContext context) {
    final list = ListenableBuilder(
      listenable: widget.actions,
      builder: (context, _) {
        final songs = widget.songs;
        final hasFooter = widget.loading || songs.isEmpty || widget.hasMore;
        return ListView.builder(
          controller: _controller,
          physics: const AlwaysScrollableScrollPhysics(), // pull to refresh also works on a short list
          itemCount: songs.length + (hasFooter ? 1 : 0),
          itemBuilder: (context, i) {
            if (i < songs.length) return _Row(song: songs[i], actions: widget.actions, autofocus: i == 0 && AppScope.isTvOf(context));
            if (widget.loading) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (songs.isEmpty) return Padding(padding: const EdgeInsets.all(16), child: Text(widget.emptyText));
            return Padding(
              padding: const EdgeInsets.all(8),
              child: Center(
                child: TextButton(onPressed: widget.onMore, child: const Text('Load more')),
              ),
            );
          },
        );
      },
    );
    final refresh = widget.onRefresh;
    return refresh == null ? list : RefreshIndicator(onRefresh: refresh, child: list);
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.song, required this.actions, this.autofocus = false});

  final Song song;
  final LibraryActions actions;

  /// The remote starts on the first song.
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final starred = actions.isFavourite(song);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              label: 'Add ${song.title} by ${song.artist} to the queue${formatLabel(song.format).isEmpty ? '' : ', ${formatLabel(song.format)}'}',
              button: true,
              enabled: !song.failed,
              excludeSemantics: true,
              child: FocusRing(
                radius: 0,
                child: InkWell(
                  autofocus: autofocus,
                  onTap: song.failed ? null : () => actions.add(song),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 64,
                          child: Text(
                            song.number,
                            style: TextStyle(color: muted, fontFeatures: const [FontFeature.tabularFigures()]),
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(song.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(song.artist, style: TextStyle(color: muted, fontSize: 13)),
                              if (song.failed) Text("This song can't be played.", style: TextStyle(color: muted, fontSize: 13)),
                            ],
                          ),
                        ),
                        FormatBadge(song.format),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          MergeSemantics(
            child: Semantics(
              toggled: starred,
              child: FocusRing(
                radius: 24,
                child: IconButton(
                  tooltip: 'Favourite: ${song.title}',
                  isSelected: starred,
                  icon: Icon(starred ? Icons.star : Icons.star_border),
                  onPressed: () => actions.toggleFavourite(song),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
