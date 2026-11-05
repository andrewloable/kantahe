import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/player/min_webview.dart';

// What the Android WebView calls itself: "Chrome/<version>" inside a long user agent (docs/PLAN.md, "Minimum engine").
const old =
    'Mozilla/5.0 (Linux; Android 9; TV Build/PPR1.180610.009; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/66.0.3359.158 Safari/537.36';
const chrome74 =
    'Mozilla/5.0 (Linux; Android 10; TV Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.186 Safari/537.36';
const current = 'Mozilla/5.0 (Linux; Android 14; TV Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/113.0.5672.136 Safari/537.36';

void main() {
  test('the minimum is Chromium 74: the oldest engine that runs the legacy player, which an engine older than 85 is given (docs/PLAN.md)', () {
    expect(kMinChromium, 74);
  });

  group('chromiumMajor', () {
    test('reads the major version of a WebView user agent', () {
      expect(chromiumMajor(old), 66);
      expect(chromiumMajor(chrome74), 74);
      expect(chromiumMajor(current), 113);
    });

    test('a user agent without a Chrome token, an empty one and null give null (not a Chromium WebView: nothing to block)', () {
      expect(
        chromiumMajor(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        ),
        isNull,
      );
      expect(chromiumMajor(''), isNull);
      expect(chromiumMajor(null), isNull);
      expect(chromiumMajor('Chrome/'), isNull);
    });
  });

  group('oldEngineMajor', () {
    test('returns the version of an engine below the minimum, and null at the minimum and above', () async {
      expect(await oldEngineMajor(() async => old), 66);
      expect(await oldEngineMajor(() async => 'x Chrome/73.0.3683.75 y'), 73);
      expect(await oldEngineMajor(() async => chrome74), isNull); // the legacy player runs here
      expect(await oldEngineMajor(() async => 'x Chrome/85.0.4183.83 y'), isNull);
      expect(await oldEngineMajor(() async => current), isNull);
    });

    test('an engine that cannot say, or fails to say, is not blocked: the page is loaded as before', () async {
      expect(await oldEngineMajor(() async => null), isNull);
      expect(await oldEngineMajor(() async => throw StateError('no user agent')), isNull);
    });
  });

  test('the message names the version found and the version needed', () {
    final text = engineTooOldMessage(66);
    expect(text, contains('Chromium 66'));
    expect(text, contains('Chromium $kMinChromium or newer'));
    expect(text, contains('Android System WebView'));
  });
}
