import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';
import 'package:kantahe/queue/queue_actions.dart';

import 'fakes.dart';

class Said {
  Said(this.message, this.error, this.actionLabel, this.onAction);

  final String message;
  final bool error;
  final String? actionLabel;
  final VoidCallback? onAction;
}

({QueueRig rig, QueueActions actions, List<Said> said}) make() {
  final rig = QueueRig();
  final said = <Said>[];
  final actions = QueueActions(
    api: rig.api,
    notify: (message, {bool error = false, String? actionLabel, VoidCallback? onAction}) => said.add(Said(message, error, actionLabel, onAction)),
  );
  return (rig: rig, actions: actions, said: said);
}

void main() {
  group('control', () {
    test('sends the action and says nothing on success', () async {
      final m = make();
      expect(await m.actions.control(ControlAction.CONTROL_ACTION_SKIP), isTrue);
      expect(m.rig.server.controls, [ControlAction.CONTROL_ACTION_SKIP]);
      expect(m.said, isEmpty);
    });

    test('regression: the same command sent twice while the first is on its way is sent once (a double tap on Skip skips one song)', () async {
      final m = make();
      final gate = Completer<void>();
      m.rig.server.onControl = (_) => gate.future;
      final first = m.actions.control(ControlAction.CONTROL_ACTION_SKIP);
      final second = m.actions.control(ControlAction.CONTROL_ACTION_SKIP);
      gate.complete();
      expect(await first, isTrue);
      expect(await second, isFalse); // not sent: nothing to follow up on
      expect(m.rig.server.controls, [ControlAction.CONTROL_ACTION_SKIP]);
      await m.actions.control(ControlAction.CONTROL_ACTION_SKIP); // once it has finished, it works again
      expect(m.rig.server.controls.length, 2);
    });

    test('different commands do not block each other', () async {
      final m = make();
      final gate = Completer<void>();
      m.rig.server.onControl = (_) => gate.future;
      final a = m.actions.control(ControlAction.CONTROL_ACTION_PAUSE);
      final b = m.actions.control(ControlAction.CONTROL_ACTION_SKIP);
      gate.complete();
      await Future.wait([a, b]);
      expect(m.rig.server.controls.toSet(), {ControlAction.CONTROL_ACTION_PAUSE, ControlAction.CONTROL_ACTION_SKIP});
    });

    test('a failed command frees its slot too', () async {
      final m = make();
      var fail = true;
      m.rig.server.onControl = (_) {
        if (fail) throw ConnectException(Code.unavailable, 'down');
      };
      await m.actions.control(ControlAction.CONTROL_ACTION_SKIP);
      fail = false;
      expect(await m.actions.control(ControlAction.CONTROL_ACTION_SKIP), isTrue);
    });

    test('a failed command is shown as an error and reported as false', () async {
      final m = make();
      m.rig.server.onControl = (_) => throw ConnectException(Code.unavailable, 'down');
      expect(await m.actions.control(ControlAction.CONTROL_ACTION_PLAY), isFalse);
      expect(m.said.single.error, isTrue);
      expect(m.said.single.message, contains('Could not reach the server'));
    });
  });

  group('remove', () {
    test('sends RemoveFromQueue with the item id and offers Undo', () async {
      final m = make();
      await m.actions.remove(item('i1', song('1', 'Yesterday', 'A')));
      expect(m.rig.server.removes, ['i1']);
      expect(m.said.single.message, 'Removed Yesterday');
      expect(m.said.single.actionLabel, 'Undo');
      expect(m.said.single.error, isFalse);
    });

    test('Undo adds the same song again and says so', () async {
      final m = make();
      await m.actions.remove(item('i1', song('00007', 'Yesterday', 'A')));
      m.said.single.onAction!();
      await Future<void>.delayed(Duration.zero);
      expect(m.rig.server.adds, ['00007']);
      expect(m.said.last.message, 'Added Yesterday');
    });

    test('regression: Undo used twice adds the song once', () async {
      final m = make();
      await m.actions.remove(item('i1', song('00007', 'Yesterday', 'A')));
      m.said.single.onAction!();
      m.said.single.onAction!();
      await Future<void>.delayed(Duration.zero);
      expect(m.rig.server.adds, ['00007']);
    });

    test('a failed Undo is shown as an error', () async {
      final m = make();
      m.rig.server.onAdd = (_) => throw ConnectException(Code.notFound, 'gone');
      await m.actions.remove(item('i1', song('1', 'Yesterday', 'A')));
      m.said.single.onAction!();
      await Future<void>.delayed(Duration.zero);
      expect(m.said.last.error, isTrue);
      expect(m.said.last.message, 'That song is no longer in the library.');
    });

    test('a failed removal is an error and offers no Undo', () async {
      final m = make();
      m.rig.server.onRemove = (_) => throw ConnectException(Code.unavailable, 'down');
      await m.actions.remove(item('i1', song('1', 'Yesterday', 'A')));
      expect(m.said.single.error, isTrue);
      expect(m.said.single.actionLabel, isNull);
    });

    test('an item without a song is removed without an Undo', () async {
      final m = make();
      await m.actions.remove(QueueItem(id: 'i9'));
      expect(m.rig.server.removes, ['i9']);
      expect(m.said, isEmpty);
    });
  });

  group('moveToTop', () {
    test('sends MoveToTop with the item id', () async {
      final m = make();
      await m.actions.moveToTop(item('i2', song('2', 'B', 'C')));
      expect(m.rig.server.moves, ['i2']);
    });

    test('a failure is shown as an error', () async {
      final m = make();
      m.rig.server.onMove = (_) => throw ConnectException(Code.notFound, 'gone');
      await m.actions.moveToTop(item('i2', song('2', 'B', 'C')));
      expect(m.said.single.error, isTrue);
    });
  });

  group('one command per item at a time', () {
    test('a second command for the same item is ignored until the first has finished', () async {
      final m = make();
      final gate = Completer<void>();
      m.rig.server.onRemove = (_) => gate.future;
      final i = item('i1', song('1', 'A', 'B'));
      final first = m.actions.remove(i);
      final second = m.actions.remove(i);
      final third = m.actions.moveToTop(i);
      gate.complete();
      await Future.wait([first, second, third]);
      expect(m.rig.server.removes, ['i1']);
      expect(m.rig.server.moves, isEmpty);
    });

    test('the same item can be commanded again once the command has finished', () async {
      final m = make();
      final i = item('i1', song('1', 'A', 'B'));
      await m.actions.moveToTop(i);
      await m.actions.moveToTop(i);
      expect(m.rig.server.moves, ['i1', 'i1']);
    });

    test('a failed command frees the item too', () async {
      final m = make();
      var fail = true;
      m.rig.server.onMove = (_) {
        if (fail) throw ConnectException(Code.unavailable, 'down');
      };
      final i = item('i1', song('1', 'A', 'B'));
      await m.actions.moveToTop(i);
      fail = false;
      await m.actions.moveToTop(i);
      expect(m.rig.server.moves.length, 2);
    });

    test('different items do not block each other', () async {
      final m = make();
      final gate = Completer<void>();
      m.rig.server.onMove = (_) => gate.future;
      final a = m.actions.moveToTop(item('a', song('1', 'A', 'B')));
      final b = m.actions.moveToTop(item('b', song('2', 'C', 'D')));
      gate.complete();
      await Future.wait([a, b]);
      expect(m.rig.server.moves.toSet(), {'a', 'b'});
    });
  });
}
