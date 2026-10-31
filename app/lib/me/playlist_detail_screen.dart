import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/core/messages.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';
import 'package:kantahe/library/format_badge.dart';

/// One playlist: its songs in order (move up or down, remove) and Add all to queue.
class PlaylistDetailScreen extends StatefulWidget {
  const PlaylistDetailScreen({super.key, required this.id, required this.name});

  final String id;

  /// The name known when the screen opened; the server's replaces it.
  final String name;

  @override
  State<PlaylistDetailScreen> createState() => _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends State<PlaylistDetailScreen> {
  late final AppServices _services = AppScope.of(context);
  late String _name = widget.name;
  List<Song> _songs = [];
  bool _loaded = false;
  bool _missing = false;
  bool _saving = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _load();
  }

  Future<void> _load() async {
    try {
      final p = (await _services.api.userLibrary.getPlaylist(GetPlaylistRequest(id: widget.id))).playlist;
      if (!mounted) return;
      setState(() {
        _name = p.name;
        _songs = p.songs.toList();
        _loaded = true;
      });
    } catch (e) {
      if (!mounted) return;
      if (e is ConnectException && e.code == Code.notFound) {
        setState(() => _missing = true);
      } else {
        showMessage(context, problem(e, const {}), error: true);
      }
    }
  }

  /// Saves a change of the list, one at a time. The server replaces the whole list, so the list this screen
  /// shows must still be the server's: if it changed elsewhere (another device added a song) the change is not
  /// made, the screen shows the new content and the user repeats it.
  Future<void> _change(List<Song> Function(List<Song> current) apply) async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final fresh = (await _services.api.userLibrary.getPlaylist(GetPlaylistRequest(id: widget.id))).playlist;
      final current = _songs;
      final same =
          fresh.songs.length == current.length && [for (var i = 0; i < current.length; i++) fresh.songs[i].number == current[i].number].every((x) => x);
      if (!same) {
        if (!mounted) return;
        setState(() {
          _name = fresh.name;
          _songs = fresh.songs.toList();
        });
        showMessage(context, 'This playlist was changed on another device. Look at it again and repeat the change.', error: true);
        return;
      }
      final next = apply(current);
      final res = await _services.api.userLibrary.updatePlaylist(
        UpdatePlaylistRequest(id: widget.id, replaceNumbers: true, numbers: next.map((s) => s.number)),
      );
      if (mounted) setState(() => _songs = res.hasPlaylist() ? res.playlist.songs.toList() : next);
    } catch (e) {
      if (mounted) showMessage(context, problem(e, {Code.notFound: 'That playlist no longer exists.'}), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _move(int index, int by) => _change((current) {
    final next = [...current];
    final t = next[index];
    next[index] = next[index + by];
    next[index + by] = t;
    return next;
  });

  Future<void> _removeAt(int index) => _change(
    (current) => [
      for (var i = 0; i < current.length; i++)
        if (i != index) current[i],
    ],
  );

  Future<void> _addAll() async {
    try {
      final res = await _services.api.session.addPlaylistToQueue(AddPlaylistToQueueRequest(playlistId: widget.id));
      if (mounted) showMessage(context, 'Added ${res.added} ${res.added == 1 ? 'song' : 'songs'} to the queue');
    } catch (e) {
      if (mounted) showMessage(context, problem(e, const {}), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Scaffold(
      appBar: AppBar(title: Text(_name)),
      body: _missing
          ? const Padding(padding: EdgeInsets.all(16), child: Text('This playlist no longer exists.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton(onPressed: _songs.isEmpty || _saving ? null : _addAll, child: const Text('Add all to queue')),
                ),
                if (_loaded && _songs.isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('This playlist is empty. Add songs from the library.')),
                for (final (i, s) in _songs.indexed)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(s.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(s.artist, style: TextStyle(color: muted)),
                            ],
                          ),
                        ),
                        FormatBadge(s.format),
                        if (i > 0)
                          IconButton(tooltip: 'Move ${s.title} up', icon: const Icon(Icons.arrow_upward), onPressed: _saving ? null : () => _move(i, -1)),
                        if (i < _songs.length - 1)
                          IconButton(tooltip: 'Move ${s.title} down', icon: const Icon(Icons.arrow_downward), onPressed: _saving ? null : () => _move(i, 1)),
                        IconButton(
                          tooltip: 'Remove ${s.title} from the playlist',
                          icon: const Icon(Icons.delete_outline),
                          onPressed: _saving ? null : () => _removeAt(i),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
