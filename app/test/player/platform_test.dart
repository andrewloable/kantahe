import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/player/platform.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('party.kantahe/platform');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  final calls = <String>[];

  setUp(calls.clear);
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  void answer(Object? Function(MethodCall call) f) => messenger.setMockMethodCallHandler(channel, (call) async {
    calls.add(call.method);
    return f(call);
  });

  group('AndroidBackgroundPlayback (kantahe-go8.2)', () {
    test('REGRESSION: start and stop ask the platform for the playback service, in that order', () async {
      answer((_) => null);
      const playback = AndroidBackgroundPlayback();
      await playback.start();
      await playback.stop();
      expect(calls, ['playbackStart', 'playbackStop']);
    });

    test('a platform error never reaches the caller: the music matters more than its notification', () async {
      answer((_) => throw PlatformException(code: 'ForegroundServiceStartNotAllowedException'));
      const playback = AndroidBackgroundPlayback();
      await expectLater(playback.start(), completes);
      await expectLater(playback.stop(), completes);
      expect(calls, ['playbackStart', 'playbackStop']);
    });

    test('no plugin on this platform: nothing happens and nothing is thrown', () async {
      const playback = AndroidBackgroundPlayback();
      await expectLater(playback.start(), completes);
      await expectLater(playback.stop(), completes);
    });
  });

  test('NoBackgroundPlayback never asks the platform', () async {
    answer((_) => null);
    const playback = NoBackgroundPlayback();
    await playback.start();
    await playback.stop();
    expect(calls, isEmpty);
  });
}
