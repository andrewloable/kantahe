import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/core/messages.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';
import 'package:kantahe/me/playlist_detail_screen.dart';

/// The user's playlists: create, rename, delete (after asking), open.
class PlaylistsScreen extends StatefulWidget {
  const PlaylistsScreen({super.key});

  @override
  State<PlaylistsScreen> createState() => _PlaylistsScreenState();
}

class _PlaylistsScreenState extends State<PlaylistsScreen> {
  late final AppServices _services = AppScope.of(context);
  final _draft = TextEditingController();
  List<PlaylistSummary> _playlists = [];
  bool _loaded = false;
  bool _busy = false;
  bool _started = false;
  String _nameError = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _load();
  }

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await _services.api.userLibrary.listPlaylists(ListPlaylistsRequest());
      if (mounted) setState(() => _playlists = res.playlists.toList());
    } catch (e) {
      if (mounted) showMessage(context, problem(e, const {}), error: true);
    } finally {
      if (mounted) setState(() => _loaded = true);
    }
  }

  /// Runs one change at a time; a second tap while it runs is ignored.
  Future<void> _once(Future<void> Function() change) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await change();
    } catch (e) {
      if (mounted) showMessage(context, problem(e, const {}), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() async {
    final name = _draft.text.trim();
    if (name.isEmpty) {
      setState(() => _nameError = 'Enter a name for the playlist.');
      return;
    }
    setState(() => _nameError = '');
    await _once(() async {
      final res = await _services.api.userLibrary.createPlaylist(CreatePlaylistRequest(name: name));
      if (!mounted) return;
      final p = res.playlist;
      setState(() {
        _playlists = [..._playlists, PlaylistSummary(id: p.id, name: p.name, songCount: p.songs.length)];
        _draft.clear();
      });
    });
  }

  Future<void> _rename(PlaylistSummary p) async {
    final controller = TextEditingController(text: p.name);
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Rename ${p.name}'),
        content: TextField(
          key: const Key('rename'),
          controller: controller,
          maxLength: 100,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'New name'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    // the controller is not disposed here: the dialog is still animating away and builds the field once more
    if (name == null || name.isEmpty || !mounted) return;
    await _once(() async {
      await _services.api.userLibrary.updatePlaylist(UpdatePlaylistRequest(id: p.id, name: name));
      if (mounted) setState(() => _playlists = [for (final x in _playlists) x.id == p.id ? PlaylistSummary(id: x.id, name: name, songCount: x.songCount) : x]);
    });
  }

  Future<void> _delete(PlaylistSummary p) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete "${p.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Yes, delete')),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    await _once(() async {
      await _services.api.userLibrary.deletePlaylist(DeletePlaylistRequest(id: p.id));
      if (mounted) setState(() => _playlists = _playlists.where((x) => x.id != p.id).toList());
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Playlists')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  key: const Key('new-playlist'),
                  controller: _draft,
                  maxLength: 100,
                  decoration: InputDecoration(labelText: 'New playlist', errorText: _nameError.isEmpty ? null : _nameError, border: const OutlineInputBorder()),
                  onSubmitted: (_) => _create(),
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: FilledButton(onPressed: _busy ? null : _create, child: const Text('Create')),
              ),
            ],
          ),
          if (_loaded && _playlists.isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('No playlists yet.')),
          for (final p in _playlists)
            ListTile(
              title: Text(p.name),
              subtitle: Text(p.songCount == 1 ? '1 song' : '${p.songCount} songs'),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => PlaylistDetailScreen(id: p.id, name: p.name),
                ),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(tooltip: 'Rename ${p.name}', icon: const Icon(Icons.edit_outlined), onPressed: () => _rename(p)),
                  IconButton(tooltip: 'Delete ${p.name}', icon: const Icon(Icons.delete_outline), onPressed: () => _delete(p)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
