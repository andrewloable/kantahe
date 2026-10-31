import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/library/library_actions.dart';

import 'fakes.dart';

class Rig {
  Rig(this.services, this.fake) {
    actions = LibraryActions(
      api: services.api,
      auth: services.auth,
      notify: (message, {bool error = false}) => messages.add(error ? 'ERROR: $message' : message),
    );
  }

  final AppServices services;
  final FakeLibrary fake;
  late final LibraryActions actions;
  final messages = <String>[];
}

Future<Rig> rig() async {
  final fake = FakeLibrary();
  return Rig(await fake.services(), fake);
}

void main() {
  group('add', () {
    test('queues the song by number and says so', () async {
      final r = await rig();
      expect(await r.actions.add(song('00007', 'Yesterday', 'The Band')), isTrue);
      expect(r.fake.adds.map((a) => a.number), ['00007']);
      expect(r.messages, ['Added Yesterday']);
    });

    test('shows a failure as an error', () async {
      final r = await rig();
      r.fake.onAdd = (_) => throw ConnectException(Code.unavailable, 'down');
      expect(await r.actions.add(song('1', 'A', 'B')), isFalse);
      expect(r.messages, ['ERROR: Could not reach the server. Check the connection and try again.']);
    });

    test('says when the song is gone', () async {
      final r = await rig();
      r.fake.onAdd = (_) => throw ConnectException(Code.notFound, 'no such song');
      await r.actions.add(song('1', 'A', 'B'));
      expect(r.messages, ['ERROR: That song is no longer in the library.']);
    });

    test('does not queue a song that cannot be played', () async {
      final r = await rig();
      expect(await r.actions.add(song('1', 'A', 'B', failed: true)), isFalse);
      expect(r.fake.adds, isEmpty);
      expect(r.messages, ["ERROR: That song can't be played."]);
    });
  });

  group('toggleFavourite', () {
    test('flips the star at once and tells the server', () async {
      final r = await rig();
      final s = song('1', 'A', 'B');
      final gate = Completer<void>();
      r.fake.onFav = (_) => gate.future;
      var notified = 0;
      r.actions.addListener(() => notified++);
      final done = r.actions.toggleFavourite(s);
      expect(r.actions.isFavourite(s), isTrue); // before the server answered
      expect(notified, greaterThan(0));
      gate.complete();
      await done;
      expect(r.fake.favs.single.number, '1');
      expect(r.fake.favs.single.favourite, isTrue);
      expect(r.actions.isFavourite(s), isTrue);
    });

    test('turns a favourite off', () async {
      final r = await rig();
      final s = song('1', 'A', 'B', favourite: true);
      await r.actions.toggleFavourite(s);
      expect(r.fake.favs.single.favourite, isFalse);
      expect(r.actions.isFavourite(s), isFalse);
    });

    test('puts the star back and shows an error when the server refuses', () async {
      final r = await rig();
      r.fake.onFav = (_) => throw ConnectException(Code.notFound, 'gone');
      final s = song('1', 'A', 'B');
      await r.actions.toggleFavourite(s);
      expect(r.actions.isFavourite(s), isFalse);
      expect(r.messages, ['ERROR: That song is no longer in the library.']);
    });

    test('every row of the same song follows (the state is shared by number)', () async {
      final r = await rig();
      await r.actions.toggleFavourite(song('1', 'A', 'B'));
      expect(r.actions.isFavourite(song('1', 'A', 'B')), isTrue);
      expect(r.actions.isFavourite(song('2', 'C', 'D')), isFalse);
    });
  });

  group('adopt', () {
    test('a fresh list from the server replaces a star this page remembered', () async {
      final r = await rig();
      await r.actions.toggleFavourite(song('1', 'A', 'B')); // now starred here
      r.actions.adopt([song('1', 'A', 'B', favourite: false)]); // the server says it is not (changed elsewhere)
      expect(r.actions.isFavourite(song('1', 'A', 'B')), isFalse);
    });

    test('every list shows the newest known star, including rows loaded earlier', () async {
      final r = await rig();
      final old = song('1', 'A', 'B');
      r.actions.adopt([song('1', 'A', 'B', favourite: true)]);
      expect(r.actions.isFavourite(old), isTrue);
    });

    test('does not undo a star that is still being saved', () async {
      final r = await rig();
      final gate = Completer<void>();
      r.fake.onFav = (_) => gate.future;
      final s = song('1', 'A', 'B');
      final saving = r.actions.toggleFavourite(s);
      r.actions.adopt([song('1', 'A', 'B', favourite: false)]); // a list read before the save finished
      expect(r.actions.isFavourite(s), isTrue);
      gate.complete();
      await saving;
    });
  });

  test('another user who signs in on the same app does not see the stars of the one before', () async {
    final r = await rig();
    await r.actions.toggleFavourite(song('1', 'A', 'B'));
    expect(r.actions.isFavourite(song('1', 'A', 'B')), isTrue);
    await r.services.auth.signOut();
    await r.services.auth.signIn(
      AuthToken(
        token: 'other',
        deviceId: 'd2',
        user: User(id: 'u2'),
      ),
    );
    expect(r.actions.isFavourite(song('1', 'A', 'B')), isFalse);
  });

  test('dispose stops listening to the sign-in', () async {
    final r = await rig();
    r.actions.dispose();
    await r.services.auth.signOut(); // must not throw
  });
}
