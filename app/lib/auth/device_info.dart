import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:kantahe/auth/form.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

/// The type this phone app reports at sign-in (Android TV signs in with a code instead).
DeviceType currentDeviceType() => defaultTargetPlatform == TargetPlatform.iOS ? DeviceType.DEVICE_TYPE_IOS : DeviceType.DEVICE_TYPE_ANDROID;

/// A readable name for this phone, shown in the user's device list.
Future<String> currentDeviceName({bool tv = false}) async {
  final ios = defaultTargetPlatform == TargetPlatform.iOS;
  final fallback = ios ? 'iPhone' : (tv ? 'Android TV' : 'Android phone');
  try {
    final plugin = DeviceInfoPlugin();
    if (ios) return cleanDeviceName((await plugin.iosInfo).name, fallback);
    final info = await plugin.androidInfo;
    return cleanDeviceName('${info.manufacturer} ${info.model}', fallback);
  } catch (_) {
    return fallback; // the name is a convenience: never block signing in on it
  }
}
