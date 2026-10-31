import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/core/theme_setting.dart';

class FailingStore extends MemoryStore {
  @override
  Future<void> write(String key, String value) async => throw Exception('disk full');

  @override
  Future<String?> read(String key) async => throw Exception('unreadable');
}

void main() {
  test('is Auto (follows the system) until a choice is made', () async {
    final s = ThemeSetting(MemoryStore());
    await s.load();
    expect(s.mode, ThemeMode.system);
  });

  test('a choice is kept and read again after a restart: Light, Dark and Auto', () async {
    final store = MemoryStore();
    final running = ThemeSetting(store);
    await running.load();
    for (final mode in [ThemeMode.light, ThemeMode.dark, ThemeMode.system]) {
      await running.set(mode);
      final restarted = ThemeSetting(store);
      await restarted.load();
      expect(restarted.mode, mode);
    }
  });

  test('listeners hear a change, and only a change', () async {
    final s = ThemeSetting(MemoryStore());
    var heard = 0;
    s.addListener(() => heard++);
    await s.set(ThemeMode.dark);
    await s.set(ThemeMode.dark);
    await s.set(ThemeMode.light);
    expect(heard, 2);
  });

  test('regression: a value nobody wrote (damaged storage) means Auto, not a crash', () async {
    final store = MemoryStore();
    await store.write('kantahe.theme', 'purple');
    final s = ThemeSetting(store);
    await s.load();
    expect(s.mode, ThemeMode.system);
  });

  test('unreadable or unwritable storage keeps the choice for this run and does not throw', () async {
    final s = ThemeSetting(FailingStore());
    await s.load();
    expect(s.mode, ThemeMode.system);
    await s.set(ThemeMode.dark);
    expect(s.mode, ThemeMode.dark);
  });
}
