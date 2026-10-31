import 'package:flutter/material.dart';
import 'package:kantahe/core/storage.dart';

const _key = 'kantahe.theme';

/// Light, dark, or Auto (the system's choice), kept on this device in shared preferences (the web app has the same three).
class ThemeSetting extends ChangeNotifier {
  ThemeSetting(this._store);

  final KeyValueStore _store;
  ThemeMode _mode = ThemeMode.system;

  ThemeMode get mode => _mode;

  static ThemeMode? _parse(String? s) => switch (s) {
    'light' => ThemeMode.light,
    'dark' => ThemeMode.dark,
    'auto' => ThemeMode.system,
    _ => null,
  };

  static String _name(ThemeMode m) => switch (m) {
    ThemeMode.light => 'light',
    ThemeMode.dark => 'dark',
    ThemeMode.system => 'auto',
  };

  Future<void> load() async {
    String? stored;
    try {
      stored = await _store.read(_key);
    } catch (_) {
      return; // unreadable storage: Auto
    }
    final mode = _parse(stored) ?? ThemeMode.system; // a value nobody wrote means Auto
    if (mode != _mode) {
      _mode = mode;
      notifyListeners();
    }
  }

  Future<void> set(ThemeMode mode) async {
    if (mode == _mode) return;
    _mode = mode;
    notifyListeners();
    try {
      await _store.write(_key, _name(mode));
    } catch (_) {
      // the choice holds for this run; it is just not remembered
    }
  }
}
