import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

/// The free space on the device's storage in bytes, or null where it cannot be read (or on a platform that does not say). Android reports the
/// free bytes of its data partition, iOS the free disk size.
Future<int?> readFreeDiskBytes() async {
  try {
    final plugin = DeviceInfoPlugin();
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => (await plugin.androidInfo).freeDiskSize,
      TargetPlatform.iOS => (await plugin.iosInfo).freeDiskSize,
      _ => null,
    };
  } catch (_) {
    return null; // the free space is a help for the song cache: never a reason for the player to fail
  }
}
