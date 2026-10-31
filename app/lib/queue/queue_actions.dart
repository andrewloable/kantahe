import 'package:connectrpc/connect.dart';
import 'package:flutter/foundation.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/errors.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

/// Shows a message to the user (a snack bar); [error] marks a failure, [actionLabel] and [onAction] add a button.
typedef Notify = void Function(String message, {bool error, String? actionLabel, VoidCallback? onAction});

/// What the queue screens send to the server: play, pause, skip, play here, remove, move to top.
class QueueActions {
  QueueActions({required this.api, required this.notify});

  final Api api;
  final Notify notify;

  /// Items with a command on its way; a second command for the same item is ignored until it is done.
  final Set<String> _busy = {};

  /// Playback commands on their way: the same one sent again meanwhile (a double tap on Skip) is dropped.
  final Set<ControlAction> _controls = {};

  /// Sends a playback command; false when it failed (an error is shown) or was dropped as a repeat.
  Future<bool> control(ControlAction action) async {
    if (!_controls.add(action)) return false;
    try {
      await api.session.control(ControlRequest(action: action));
      return true;
    } catch (e) {
      notify(problem(e, const {}), error: true);
      return false;
    } finally {
      _controls.remove(action);
    }
  }

  Future<bool> _once(QueueItem item, Future<Object?> Function() command) async {
    if (!_busy.add(item.id)) return false;
    try {
      await command();
      return true;
    } catch (e) {
      notify(problem(e, const {}), error: true);
      return false;
    } finally {
      _busy.remove(item.id);
    }
  }

  /// Removes the item; Undo puts the song back at the end of the queue (its old place is not kept).
  Future<void> remove(QueueItem item) async {
    final removed = await _once(item, () => api.session.removeFromQueue(RemoveFromQueueRequest(itemId: item.id)));
    if (removed && item.hasSong()) {
      final song = item.song;
      var undone = false; // a second tap on Undo must not add the song twice
      notify(
        'Removed ${song.title}',
        actionLabel: 'Undo',
        onAction: () {
          if (undone) return;
          undone = true;
          _undo(song);
        },
      );
    }
  }

  Future<void> moveToTop(QueueItem item) => _once(item, () => api.session.moveToTop(MoveToTopRequest(itemId: item.id)));

  Future<void> _undo(Song song) async {
    try {
      await api.session.addToQueue(AddToQueueRequest(number: song.number));
      notify('Added ${song.title}');
    } catch (e) {
      notify(problem(e, {Code.notFound: 'That song is no longer in the library.'}), error: true);
    }
  }
}
