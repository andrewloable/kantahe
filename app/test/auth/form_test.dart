import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/device_info.dart';
import 'package:kantahe/auth/form.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

void main() {
  group('passwordLengthOk counts bytes, 8 to 256', () {
    test('limits', () {
      expect(passwordLengthOk('1234567'), isFalse);
      expect(passwordLengthOk('12345678'), isTrue);
      expect(passwordLengthOk('a' * 256), isTrue);
      expect(passwordLengthOk('a' * 257), isFalse);
    });

    test('a multi-byte character counts for every byte', () {
      expect(passwordLengthOk('éééé'), isTrue); // 4 characters, 8 bytes
      expect(passwordLengthOk('ééé'), isFalse); // 6 bytes
      expect(passwordLengthOk('é' * 129), isFalse); // 258 bytes
    });
  });

  group('cleanDeviceName', () {
    test('trims, collapses spaces and keeps at most 100 characters', () {
      expect(cleanDeviceName('  Pixel   8  Pro ', 'x'), 'Pixel 8 Pro');
      expect(cleanDeviceName('a' * 150, 'x').length, 100);
    });

    test('regression: cutting at 100 characters never splits a character made of two code units', () {
      final cut = cleanDeviceName('\u{1F4F1}' * 120, 'x'); // 120 phone emoji
      expect(cut.runes.length, 100);
      expect(() => utf8.encode(cut), returnsNormally);
      expect(cut.runes.every((r) => r == 0x1F4F1), isTrue);
    });

    test('falls back when there is nothing to show', () {
      expect(cleanDeviceName(null, 'Android phone'), 'Android phone');
      expect(cleanDeviceName('   ', 'Android phone'), 'Android phone');
    });
  });

  // kantahe-0je: Android reports manufacturer "BYD AUTO" and model "BYD AUTO" on a BYD head unit
  group('androidDeviceName', () {
    test('REGRESSION: a model that already names the maker is not prefixed with it again', () {
      expect(androidDeviceName('BYD AUTO', 'BYD AUTO'), 'BYD AUTO');
      expect(androidDeviceName('Xiaomi', 'Xiaomi MIBOX4'), 'Xiaomi MIBOX4');
      expect(androidDeviceName('xiaomi', 'Xiaomi MIBOX4'), 'Xiaomi MIBOX4'); // the case may differ
    });

    test('otherwise the maker and the model', () {
      expect(androidDeviceName('Sony', 'BRAVIA 4K VH21'), 'Sony BRAVIA 4K VH21');
      expect(androidDeviceName('samsung', 'SM-S918B'), 'samsung SM-S918B');
      expect(androidDeviceName('LG', 'LGM-V300'), 'LG LGM-V300'); // review: a model that only begins with the same letters keeps the maker
    });

    test('an empty maker or model leaves the other', () {
      expect(androidDeviceName('', 'Pixel 8'), 'Pixel 8');
      expect(androidDeviceName('Google', '  '), 'Google');
      expect(androidDeviceName(' Google ', ' Pixel 8 '), 'Google Pixel 8');
    });
  });

  group('device type and name of this phone', () {
    tearDown(() => debugDefaultTargetPlatformOverride = null);

    test('iOS reports IOS, everything else ANDROID', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      expect(currentDeviceType(), DeviceType.DEVICE_TYPE_IOS);
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(currentDeviceType(), DeviceType.DEVICE_TYPE_ANDROID);
    });

    test('the name falls back to a generic one when the plugin cannot answer', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      expect(await currentDeviceName(), 'iPhone');
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(await currentDeviceName(), 'Android phone');
    });
  });
}
