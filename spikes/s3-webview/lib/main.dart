import 'dart:convert';

import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'player_bridge.dart';

// The page to load and the sign-in to hand it. The spike serves assets/test.html with a plain HTTP server.
const pageUrl = String.fromEnvironment('PAGE_URL', defaultValue: 'http://10.0.2.2:8099/test.html');
const serverUrl = String.fromEnvironment('SERVER_URL', defaultValue: 'http://10.0.2.2:8080');
const autorun = bool.fromEnvironment('AUTORUN');

// Everything the run needs to see goes through here, one line each, tagged for grep.
void say(String line) => debugPrint('S3 $line');

void main() => runApp(const MaterialApp(home: PlayerScreen()));

class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  late final WebViewController controller;

  @override
  void initState() {
    super.initState();
    // iOS: audio and video start without a tap and play inline instead of full screen.
    final PlatformWebViewControllerCreationParams params = WebViewPlatform.instance is WebKitWebViewPlatform
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true, mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{})
        : const PlatformWebViewControllerCreationParams();
    // The page asks for the microphone; the app decides. The spike grants and logs.
    controller = WebViewController.fromPlatformCreationParams(params, onPermissionRequest: (request) async {
      say('permission request ${request.types.map((t) => t.name).join(',')}');
      // Android: the plugin does not ask the system for RECORD_AUDIO; iOS asks by itself when the request is granted.
      if (Platform.isAndroid && !(await Permission.microphone.request()).isGranted) {
        say('system microphone permission refused');
        return request.deny();
      }
      return request.grant();
    })
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      // The page talks to the app through a channel named Kantahe (what /embed/player uses). The text
      // KantaheReady says window.kantahe exists; the token goes in then, not at onPageFinished, because the
      // page may still be starting and a failed load also "finishes".
      ..addJavaScriptChannel('Kantahe', onMessageReceived: (m) {
        if (m.message == 'KantaheReady') {
          say('page ready');
          controller.runJavaScript(buildSetTokenScript('tok"en-123456', 'dev-1', serverUrl));
          if (autorun) {
            Future<void>.delayed(const Duration(seconds: 2), () => controller.runJavaScript('window.kantahe.requestMic();'));
          }
          return;
        }
        final r = jsonDecode(m.message) as Map<String, dynamic>;
        say('report ${r['key']}=${r['value']}');
      })
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (url) => say('page finished $url'),
        onWebResourceError: (e) => say('web error ${e.errorCode} ${e.description}'),
      ));
    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      // Android: playback without a user gesture.
      platform.setMediaPlaybackRequiresUserGesture(false);
    }
    controller.loadRequest(Uri.parse(pageUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(children: [
        // The page never takes focus: the D-pad belongs to the native buttons.
        Positioned.fill(child: ExcludeFocus(child: WebViewWidget(controller: controller))),
        Positioned(
          left: 0,
          right: 0,
          bottom: 16,
          child: FocusScope(
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (final (i, name) in ['Play', 'Pause', 'Skip'].indexed)
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Focus(
                    onFocusChange: (f) {
                      if (f) say('focus $name');
                    },
                    child: FilledButton(
                      autofocus: i == 0,
                      onPressed: () => say('pressed $name'),
                      child: Text(name),
                    ),
                  ),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}
