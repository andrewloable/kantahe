import 'dart:convert';

/// The server counts bytes: 8 to 256.
bool passwordLengthOk(String password) {
  final n = utf8.encode(password).length;
  return n >= 8 && n <= 256;
}

/// A device name the server accepts (at most 100 characters), with [fallback] when there is nothing to show.
String cleanDeviceName(String? raw, String fallback) {
  final name = (raw ?? '').trim().replaceAll(RegExp(r'\s+'), ' ');
  if (name.isEmpty) return fallback;
  // cut by characters (runes), not UTF-16 units: a unit-wise cut can split an emoji in two
  return name.runes.length > 100 ? String.fromCharCodes(name.runes.take(100)) : name;
}
