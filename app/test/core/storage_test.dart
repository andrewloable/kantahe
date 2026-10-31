import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/storage.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

Future<void> roundTrip(KeyValueStore s) async {
  expect(await s.read('k'), isNull);
  await s.write('k', 'v');
  expect(await s.read('k'), 'v');
  await s.write('k', 'w');
  expect(await s.read('k'), 'w');
  await s.delete('k');
  expect(await s.read('k'), isNull);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('MemoryStore keeps, replaces and deletes values', () => roundTrip(MemoryStore()));

  test('SecureStore goes through the platform keystore', () async {
    FlutterSecureStorage.setMockInitialValues({});
    await roundTrip(SecureStore());
  });

  test('PrefsStore goes through shared preferences', () async {
    SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty();
    await roundTrip(PrefsStore());
  });
}
