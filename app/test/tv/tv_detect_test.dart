import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/tv/tv_detect.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('tech.loable.kantahe/platform');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  int calls = 0;

  setUp(() {
    calls = 0;
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
  });

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    messenger.setMockMethodCallHandler(channel, null);
  });

  void answer(Object? Function(MethodCall call) f) => messenger.setMockMethodCallHandler(channel, (call) async {
    calls++;
    return f(call);
  });

  test('asks the platform and says yes for a TV', () async {
    answer((call) => call.method == 'isTv' ? true : null);
    expect(await detectTv(), isTrue);
    expect(calls, 1);
  });

  test('says no for a phone', () async {
    answer((call) => false);
    expect(await detectTv(), isFalse);
  });

  test('an answer that is not a bool means no', () async {
    answer((call) => null);
    expect(await detectTv(), isFalse);
  });

  test('a platform error means no', () async {
    answer((call) => throw PlatformException(code: 'x'));
    expect(await detectTv(), isFalse);
  });

  test('no plugin on this platform means no', () async {
    // nothing registered for the channel
    expect(await detectTv(), isFalse);
  });

  test('only Android can be an Android TV: elsewhere the platform is not even asked', () async {
    answer((call) => true);
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    expect(await detectTv(), isFalse);
    expect(calls, 0);
  });
}
