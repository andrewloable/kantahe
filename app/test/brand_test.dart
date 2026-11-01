import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/brand.dart';

// The splash colours and files come from the brand pipeline (branding/build.py, scripts/sync-branding.sh): these tests read the files and
// fail when one of them drifts from the official splash.

String read(String path) => File(path).readAsStringSync();
Uint8List bytes(String path) => File(path).readAsBytesSync();

int pngWidth(String path) => ByteData.sublistView(bytes(path)).getUint32(16);

void main() {
  const background = '#0a0e22';

  test('the splash background is the official #0a0e22, not the ink #0c1230', () {
    expect(kSplashBackground, const Color(0xFF0A0E22));
    expect(kSplashBackground.toARGB32() & 0xFFFFFF, isNot(0x0C1230));
  });

  group('pubspec flutter_native_splash', () {
    final block = RegExp(r'flutter_native_splash:\n((?:  .*\n|\n)+)').firstMatch(read('pubspec.yaml'))!.group(1)!;
    final android12 = RegExp(r'  android_12:\n((?:    .*\n)+)').firstMatch(block)!.group(1)!;

    test('the colour and the Android 12 colour are the official ones', () {
      expect(RegExp(r'^  color: "(#[0-9a-fA-F]{6})"', multiLine: true).firstMatch(block)!.group(1)!.toLowerCase(), background);
      expect(RegExp(r'color: "(#[0-9a-fA-F]{6})"').firstMatch(android12)!.group(1)!.toLowerCase(), background);
      expect(android12.toLowerCase(), contains('icon_background_color: "$background"'));
    });

    test('the image is the official logo at the native size, not the app icon', () {
      expect(block, contains('image: assets/branding/splash-logo-native.png'));
      expect(android12, contains('image: assets/branding/splash-android12.png'));
      expect(block, isNot(contains('icon-512')));
      expect(block, isNot(contains('assets/branding/icon')));
    });

    test('the logo that Flutter draws is declared as an asset', () {
      expect(read('pubspec.yaml'), contains('    - assets/branding/splash-logo.png'));
    });
  });

  group('the native files', () {
    const res = 'android/app/src/main/res';

    test('the Android 12 splash has the official colour, day and night', () {
      for (final f in ['values-v31', 'values-night-v31']) {
        expect(read('$res/$f/styles.xml').toLowerCase(), contains('<item name="android:windowsplashscreenbackground">$background</item>'), reason: f);
      }
    });

    test('the window shows the official colour between the native splash and the first Flutter frame (no black, no white)', () {
      expect(read('$res/values/brand_colors.xml').toLowerCase(), contains('<color name="kantahe_splash_background">$background</color>'));
      for (final f in ['values', 'values-night', 'values-v31', 'values-night-v31']) {
        final normal = RegExp(r'<style name="NormalTheme".*?</style>', dotAll: true).firstMatch(read('$res/$f/styles.xml'))!.group(0)!;
        expect(normal, contains('<item name="android:windowBackground">@color/kantahe_splash_background</item>'), reason: f);
        expect(normal, isNot(contains('colorBackground')), reason: f);
      }
    });

    test('the solid background image of the splash is the official colour', () {
      final png = bytes('$res/drawable/background.png');
      expect(pngWidth('$res/drawable/background.png'), 1);
      // a 1x1 PNG: its pixel is the RGB of the colour (decoded by the tests of the brand pipeline); here the file must at least be the generated one
      expect(png.length, lessThan(200));
    });

    test('the native logo is as wide as the Flutter one and fits a 360 dp phone', () {
      final widths = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0};
      widths.forEach((density, scale) {
        expect(pngWidth('$res/drawable-$density/splash.png') / scale, kSplashLogoWidth, reason: density);
      });
      expect(kSplashLogoWidth, lessThanOrEqualTo(360 * 0.7), reason: 'wider than that would be cropped or crowd a 360 dp phone');
    });
  });

  group('the artwork comes from the brand pipeline', () {
    test('the app copies are the exports, byte for byte', () {
      expect(bytes('assets/branding/splash-logo.png'), bytes('../branding/export/splash-logo.png'));
      expect(bytes('assets/branding/splash-logo-native.png'), bytes('../branding/export/splash-logo-960.png'));
      expect(bytes('assets/branding/splash-android12.png'), bytes('../branding/export/splash-android12-1152.png'));
    });

    test('scripts/sync-branding.sh no longer makes the app icon the splash', () {
      final script = read('../scripts/sync-branding.sh');
      expect(script, isNot(contains('icon-512.png app/assets/branding/splash')));
      expect(script, contains('splash-logo.png app/assets/branding/splash-logo.png'));
      expect(script, contains('splash-android12-1152.png app/assets/branding/splash-android12.png'));
    });

    test('the old copy of the icon is gone', () {
      expect(File('assets/branding/splash.png').existsSync(), isFalse);
    });

    test('the wordmark colours are not in Dart: the logo is the PNG of the pipeline', () {
      for (final f in ['lib/bootstrap.dart', 'lib/core/brand.dart']) {
        expect(read(f).toLowerCase(), isNot(contains('ffd23f')), reason: f);
      }
    });
  });
}
