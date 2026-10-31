import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/player/embed_bridge.dart';
import 'package:kantahe/player/web_embed.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';

import 'fake_webview_platform.dart';

class Seen {
  final messages = <String>[];
  final errors = <String>[];
  final asked = <Set<EmbedPermission>>[];
  EmbedHost? host;
  bool answer = true;

  EmbedConfig config() => EmbedConfig(
    url: Uri.parse('http://srv:1/embed/player'),
    onMessage: messages.add,
    onPermission: (kinds) async {
      asked.add(kinds);
      return answer;
    },
    onHost: (h) => host = h,
    onError: errors.add,
    allowNavigation: (uri) => uri.host == 'srv',
  );
}

Future<({Seen seen, FakeWebViewPlatform platform})> open(WidgetTester tester) async {
  final platform = FakeWebViewPlatform();
  WebViewPlatform.instance = platform;
  final seen = Seen();
  await tester.pumpWidget(MaterialApp(home: Builder(builder: (context) => webEmbedBuilder(context, seen.config()))));
  await tester.pump();
  return (seen: seen, platform: platform);
}

void main() {
  testWidgets('loads the player page with JavaScript on, on a black background', (tester) async {
    final o = await open(tester);
    expect(find.byKey(const Key('fake-webview')), findsOneWidget);
    expect(o.platform.controller!.loaded, [Uri.parse('http://srv:1/embed/player')]);
    expect(o.platform.controller!.mode, JavaScriptMode.unrestricted);
    expect(o.platform.controller!.background, Colors.black);
  });

  testWidgets('what the page posts on the channel named Kantahe reaches the app', (tester) async {
    final o = await open(tester);
    final channel = o.platform.controller!.channels['Kantahe']!;
    channel.onMessageReceived(const JavaScriptMessage(message: 'KantaheReady'));
    expect(o.seen.messages, ['KantaheReady']);
  });

  testWidgets('the host knows which address the page shows', (tester) async {
    final o = await open(tester);
    expect(await o.seen.host!.currentUrl(), 'http://srv:1/embed/player');
  });

  testWidgets('the host runs scripts and reloads the page', (tester) async {
    final o = await open(tester);
    await o.seen.host!.runJavaScript('window.kantahe.setToken("a","b","c");');
    await o.seen.host!.reload();
    expect(o.platform.controller!.scripts, ['window.kantahe.setToken("a","b","c");']);
    expect(o.platform.controller!.reloads, 1);
  });

  group('permission requests', () {
    testWidgets('the microphone is passed on as a microphone request, and granted when the app says yes', (tester) async {
      final o = await open(tester);
      final request = FakeRequest({WebViewPermissionResourceType.microphone});
      o.platform.controller!.onPermission!(request);
      await tester.pump();
      expect(o.seen.asked, [
        {EmbedPermission.microphone},
      ]);
      expect(request.granted, isTrue);
    });

    testWidgets('and denied when the app says no', (tester) async {
      final o = await open(tester);
      o.seen.answer = false;
      final request = FakeRequest({WebViewPermissionResourceType.microphone});
      o.platform.controller!.onPermission!(request);
      await tester.pump();
      expect(request.granted, isFalse);
    });

    testWidgets('a camera, or a camera with a microphone, is passed on as such', (tester) async {
      final o = await open(tester);
      o.platform.controller!.onPermission!(FakeRequest({WebViewPermissionResourceType.camera}));
      o.platform.controller!.onPermission!(FakeRequest({WebViewPermissionResourceType.camera, WebViewPermissionResourceType.microphone}));
      await tester.pump();
      expect(o.seen.asked, [
        {EmbedPermission.camera},
        {EmbedPermission.camera, EmbedPermission.microphone},
      ]);
    });

    testWidgets('a resource of another kind is "other"', (tester) async {
      final o = await open(tester);
      o.platform.controller!.onPermission!(FakeRequest({const WebViewPermissionResourceType('midi')}));
      await tester.pump();
      expect(o.seen.asked, [
        {EmbedPermission.other},
      ]);
    });
  });

  group('navigation', () {
    testWidgets('regression: the page cannot leave the server: other addresses are refused', (tester) async {
      final o = await open(tester);
      final ask = o.platform.delegate!.onNavigation!;
      expect(await ask(const NavigationRequest(url: 'http://srv:1/embed/player', isMainFrame: true)), NavigationDecision.navigate);
      expect(await ask(const NavigationRequest(url: 'https://evil.example/', isMainFrame: true)), NavigationDecision.prevent);
      expect(await ask(const NavigationRequest(url: 'intent://x#Intent;end', isMainFrame: true)), NavigationDecision.prevent);
    });

    testWidgets('a navigation that is not parseable is refused', (tester) async {
      final o = await open(tester);
      expect(await o.platform.delegate!.onNavigation!(const NavigationRequest(url: 'http://[bad', isMainFrame: true)), NavigationDecision.prevent);
    });
  });

  group('load errors', () {
    testWidgets('a failure of the page itself is reported', (tester) async {
      final o = await open(tester);
      o.platform.delegate!.onError!(const WebResourceError(errorCode: -6, description: 'net::ERR_CONNECTION_REFUSED', isForMainFrame: true));
      expect(o.seen.errors, ['net::ERR_CONNECTION_REFUSED']);
    });

    testWidgets('a failure of something inside the page (an image, a frame) is not', (tester) async {
      final o = await open(tester);
      o.platform.delegate!.onError!(const WebResourceError(errorCode: -2, description: 'broken image', isForMainFrame: false));
      expect(o.seen.errors, isEmpty);
    });
  });
}
