import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
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

/// Keeps the app running while a song plays on this device, also when another app covers it (a car's camera view, Home on a TV): on
/// Android a foreground service with a "Playing on this device" notification (PlaybackService.kt). Started while the app is on screen,
/// because Android 12 and later refuse to start one from the background.
abstract interface class BackgroundPlayback {
  Future<void> start();
  Future<void> stop();
}

const _platform = MethodChannel('party.kantahe/platform');

class AndroidBackgroundPlayback implements BackgroundPlayback {
  const AndroidBackgroundPlayback();

  @override
  Future<void> start() => _call('playbackStart');

  @override
  Future<void> stop() => _call('playbackStop');

  // A refused or missing service only costs the notification and the priority: the song itself plays on.
  Future<void> _call(String method) async {
    try {
      await _platform.invokeMethod<void>(method);
    } catch (_) {}
  }
}

/// Where there is no service to keep the app running (iOS, tests).
class NoBackgroundPlayback implements BackgroundPlayback {
  const NoBackgroundPlayback();

  @override
  Future<void> start() async {}

  @override
  Future<void> stop() async {}
}

/// Asks the operating system for the microphone. Android needs the app to ask (the WebView plugin does not);
/// on iOS granting the page's request makes WebKit ask by itself (spike S3).
Future<bool> askOsMicrophone() async {
  if (defaultTargetPlatform != TargetPlatform.android) return true;
  return (await Permission.microphone.request()).isGranted;
}
