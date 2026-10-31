import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

/// Keeps the screen on while a song plays.
abstract interface class ScreenAwake {
  Future<void> enable();
  Future<void> disable();
}

class WakelockAwake implements ScreenAwake {
  const WakelockAwake();

  @override
  Future<void> enable() => WakelockPlus.enable();

  @override
  Future<void> disable() => WakelockPlus.disable();
}

/// Asks the operating system for the microphone. Android needs the app to ask (the WebView plugin does not);
/// on iOS granting the page's request makes WebKit ask by itself (spike S3).
Future<bool> askOsMicrophone() async {
  if (defaultTargetPlatform != TargetPlatform.android) return true;
  return (await Permission.microphone.request()).isGranted;
}
