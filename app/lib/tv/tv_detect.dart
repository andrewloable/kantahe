import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

const _channel = MethodChannel('tech.loable.kantahe/platform');

/// True on an Android TV (the system has the leanback feature). Any other platform, or a platform that does
/// not answer, is not a TV.
Future<bool> detectTv() async {
  if (defaultTargetPlatform != TargetPlatform.android) return false;
  try {
    return await _channel.invokeMethod<bool>('isTv') ?? false;
  } catch (_) {
    return false; // no plugin or a platform error: behave like a phone
  }
}
