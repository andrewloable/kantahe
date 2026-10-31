import 'package:connectrpc/connect.dart';
import 'package:flutter/foundation.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.pb.dart';

/// What a tap on a song does: queue it, or star it. The star state is shared by every list.
class LibraryActions extends ChangeNotifier {
  LibraryActions({required this.api, required this.auth, required this.notify}) {
    // stars belong to the user: another one signing in starts with none
    _signedInAs = auth.token;
    auth.addListener(_onAuth);
  }

  final Api api;
  final AuthStore auth;

  /// Shows a message to the user (a snack bar); [error] marks a failure.
  final void Function(String message, {bool error}) notify;

  /// The newest known star of each song, by number: what the user set here, or what the server last said.
  final Map<String, bool> _stars = {};

  /// Numbers whose star is being saved; a list read before the save finished must not undo it.
  final Set<String> _saving = {};
  String? _signedInAs;

  void _onAuth() {
    if (auth.token == _signedInAs) return;
    _signedInAs = auth.token;
    _stars.clear();
    _saving.clear();
    notifyListeners();
  }

  @override
  void dispose() {
    auth.removeListener(_onAuth);
    super.dispose();
  }

  bool isFavourite(Song song) => _stars[song.number] ?? song.favourite;

  /// Takes the stars of songs that were just read from the server (they may have changed elsewhere).
  void adopt(Iterable<Song> songs) {
    for (final s in songs) {
      if (!_saving.contains(s.number)) _stars[s.number] = s.favourite;
    }
    notifyListeners();
  }

  Future<bool> add(Song song) async {
    if (song.failed) {
      notify("That song can't be played.", error: true);
      return false;
    }
    try {
      await api.session.addToQueue(AddToQueueRequest(number: song.number));
      notify('Added ${song.title}');
      return true;
    } catch (e) {
      notify(problem(e, {Code.notFound: 'That song is no longer in the library.'}), error: true);
      return false;
    }
  }

  Future<void> toggleFavourite(Song song) async {
    final before = isFavourite(song);
    _saving.add(song.number);
    _setStar(song.number, !before); // shown at once; undone below if the server refuses
    try {
      await api.userLibrary.setFavourite(SetFavouriteRequest(number: song.number, favourite: !before));
    } catch (e) {
      _setStar(song.number, before);
      notify(problem(e, {Code.notFound: 'That song is no longer in the library.'}), error: true);
    } finally {
      _saving.remove(song.number);
    }
  }

  void _setStar(String number, bool value) {
    _stars[number] = value;
    notifyListeners();
  }
}
