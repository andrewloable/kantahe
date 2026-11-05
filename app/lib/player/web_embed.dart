import 'dart:async';

import 'package:flutter/material.dart';
import 'package:kantahe/player/embed_bridge.dart';
import 'package:kantahe/player/min_webview.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

/// What the page asks the app for.
enum EmbedPermission { microphone, camera, other }

/// Everything the player screen needs from the embedded page, whatever shows it.
class EmbedConfig {
  const EmbedConfig({
    required this.url,
    required this.onMessage,
    required this.onPermission,
    required this.onHost,
    required this.onError,
    required this.allowNavigation,
    this.onEngineTooOld,
  });

  final Uri url;

  /// Text the page sent on the channel named Kantahe.
  final void Function(String message) onMessage;

  /// The page asks for [asked]; true grants it.
  final Future<bool> Function(Set<EmbedPermission> asked) onPermission;

  /// The embedded view exists and can be driven.
  final void Function(EmbedHost host) onHost;

  /// The page could not be loaded.
  final void Function(String description) onError;

  /// Whether the page may go to this address. Anything else is refused, so the page stays on the server.
  final bool Function(Uri to) allowNavigation;

  /// The WebView of this device is older than the player page can run on (the major version of its Chromium); the page is not loaded.
  final void Function(int major)? onEngineTooOld;
}

typedef EmbedBuilder = Widget Function(BuildContext context, EmbedConfig config);

/// The real thing: webview_flutter with the settings proven in spike S3.
Widget webEmbedBuilder(BuildContext context, EmbedConfig config) => WebEmbed(config: config);

class WebEmbed extends StatefulWidget {
  const WebEmbed({super.key, required this.config});

  final EmbedConfig config;

  @override
  State<WebEmbed> createState() => _WebEmbedState();
}

class _Host implements EmbedHost {
  _Host(this._controller, this._url);

  final WebViewController _controller;
  final Uri _url;

  @override
  Future<void> runJavaScript(String script) => _controller.runJavaScript(script);

  @override
  Future<void> reload() => _controller.reload();

  @override
  Future<void> unload() => _controller.loadRequest(Uri.parse('about:blank'));

  @override
  Future<void> load() => _controller.loadRequest(_url);

  @override
  Future<String?> currentUrl() => _controller.currentUrl();
}

EmbedPermission _kind(WebViewPermissionResourceType t) => switch (t) {
  WebViewPermissionResourceType.microphone => EmbedPermission.microphone,
  WebViewPermissionResourceType.camera => EmbedPermission.camera,
  _ => EmbedPermission.other,
};

class _WebEmbedState extends State<WebEmbed> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    // iOS: audio starts without a tap and plays inline instead of full screen.
    final PlatformWebViewControllerCreationParams params = WebViewPlatform.instance is WebKitWebViewPlatform
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true, mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{})
        : const PlatformWebViewControllerCreationParams();
    _controller =
        WebViewController.fromPlatformCreationParams(
            params,
            onPermissionRequest: (request) async {
              final granted = await widget.config.onPermission(request.types.map(_kind).toSet());
              return granted ? request.grant() : request.deny();
            },
          )
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(Colors.black)
          // The page talks to the app through a channel named Kantahe (what /embed/player uses).
          ..addJavaScriptChannel('Kantahe', onMessageReceived: (m) => widget.config.onMessage(m.message))
          ..setNavigationDelegate(
            NavigationDelegate(
              onNavigationRequest: (request) {
                final to = Uri.tryParse(request.url);
                return to != null && widget.config.allowNavigation(to) ? NavigationDecision.navigate : NavigationDecision.prevent;
              },
              onWebResourceError: (e) {
                if (e.isForMainFrame ?? true) widget.config.onError(e.description);
              },
            ),
          );
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false); // no remote debugging of the page, also in debug builds of the app
      // Android: playback without a user gesture.
      platform.setMediaPlaybackRequiresUserGesture(false);
    }
    widget.config.onHost(_Host(_controller, widget.config.url));
    unawaited(_load());
  }

  /// Loads the player page, unless the WebView is too old to run it (the page would only show the splash and fail): then the screen is
  /// told, and shows the reason instead.
  Future<void> _load() async {
    final tooOld = widget.config.onEngineTooOld;
    if (tooOld != null) {
      final major = await oldEngineMajor(_controller.getUserAgent);
      if (!mounted) return;
      if (major != null) {
        tooOld(major);
        return;
      }
    }
    unawaited(_controller.loadRequest(widget.config.url));
  }

  @override
  void dispose() {
    // Android keeps the page of a WebView that left the screen alive until the garbage collector comes, and that page still plays: two
    // players of one device then take the audio focus from each other and the one on screen freezes. Ending the page ends its sound.
    unawaited(_controller.loadRequest(Uri.parse('about:blank')));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => WebViewWidget(controller: _controller);
}
