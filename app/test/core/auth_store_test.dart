import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

import 'fakes.dart';

AuthToken token({String t = 'tok-1', String device = 'dev-1', bool mustChange = false, bool withUser = true}) => AuthToken(
  token: t,
  deviceId: device,
  user: withUser ? User(id: 'u1', email: 'a@b.c', mustChangePassword: mustChange) : null,
);

void main() {
  test('starts signed out', () {
    final a = AuthStore(MemoryStore());
    expect(a.signedIn, isFalse);
    expect(a.token, isNull);
    expect(a.deviceId, isNull);
    expect(a.user, isNull);
    expect(a.passwordChangeRequired, isFalse);
  });

  test('signIn keeps and persists the token and device id, and notifies', () async {
    final store = MemoryStore();
    final a = AuthStore(store);
    var n = 0;
    a.addListener(() => n++);
    await a.signIn(token());
    expect(a.signedIn, isTrue);
    expect(a.token, 'tok-1');
    expect(a.deviceId, 'dev-1');
    expect(a.user!.email, 'a@b.c');
    expect(await store.read('kantahe.token'), 'tok-1');
    expect(await store.read('kantahe.deviceId'), 'dev-1');
    expect(n, greaterThan(0));
  });

  test('load reads the persisted token (the user is not persisted)', () async {
    final store = MemoryStore();
    await AuthStore(store).signIn(token());
    final again = AuthStore(store);
    await again.load();
    expect(again.token, 'tok-1');
    expect(again.deviceId, 'dev-1');
    expect(again.user, isNull);
  });

  test('a stored token without a device id is not a session', () async {
    final store = MemoryStore();
    await store.write('kantahe.token', 'orphan');
    final a = AuthStore(store);
    await a.load();
    expect(a.signedIn, isFalse);
  });

  test('signOut clears memory and storage', () async {
    final store = MemoryStore();
    final a = AuthStore(store);
    await a.signIn(token(mustChange: true));
    await a.signOut();
    expect(a.signedIn, isFalse);
    expect(a.deviceId, isNull);
    expect(a.user, isNull);
    expect(a.passwordChangeRequired, isFalse);
    expect(await store.read('kantahe.token'), isNull);
    expect(await store.read('kantahe.deviceId'), isNull);
  });

  test('signIn without a user leaves the user unset', () async {
    final a = AuthStore(MemoryStore());
    await a.signIn(token(withUser: false));
    expect(a.signedIn, isTrue);
    expect(a.user, isNull);
    expect(a.passwordChangeRequired, isFalse);
  });

  test('the password-change flag follows sign-in, the user and sign-out', () async {
    final a = AuthStore(MemoryStore());
    await a.signIn(token(mustChange: true));
    expect(a.passwordChangeRequired, isTrue);
    a.setUser(User(id: 'u1', mustChangePassword: false));
    expect(a.passwordChangeRequired, isFalse);
    a.setUser(null); // no user: the flag stays as it was
    expect(a.passwordChangeRequired, isFalse);
  });

  test('markMustChangePassword flags the user, and is remembered without one', () async {
    final a = AuthStore(MemoryStore());
    a.markMustChangePassword();
    expect(a.passwordChangeRequired, isTrue);
    expect(a.user, isNull);
    await a.signIn(token());
    a.markMustChangePassword();
    expect(a.user!.mustChangePassword, isTrue);
  });

  test('passwordChanged clears the requirement and the user flag', () async {
    final a = AuthStore(MemoryStore());
    await a.signIn(token(mustChange: true));
    a.passwordChanged();
    expect(a.passwordChangeRequired, isFalse);
    expect(a.user!.mustChangePassword, isFalse);
    expect(a.user!.email, 'a@b.c');
  });

  test('passwordChanged without a loaded user only clears the requirement', () {
    final a = AuthStore(MemoryStore());
    a.markMustChangePassword();
    a.passwordChanged();
    expect(a.passwordChangeRequired, isFalse);
    expect(a.user, isNull);
  });

  test('does not break when the keystore throws', () async {
    final a = AuthStore(ThrowingStore());
    await a.load();
    expect(a.signedIn, isFalse);
    await a.signIn(token());
    expect(a.token, 'tok-1'); // kept in memory for this run
    await a.signOut();
    expect(a.signedIn, isFalse);
  });
}
