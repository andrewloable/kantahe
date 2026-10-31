import 'package:flutter/material.dart';
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';

/// A WebView platform that does nothing but record what the app asks of it.
class FakeWebViewPlatform extends WebViewPlatform {
  FakeWebController? controller;
  FakeDelegate? delegate;

  @override
  PlatformWebViewController createPlatformWebViewController(PlatformWebViewControllerCreationParams params) => controller = FakeWebController(params);

  @override
  PlatformNavigationDelegate createPlatformNavigationDelegate(PlatformNavigationDelegateCreationParams params) => delegate = FakeDelegate(params);

  @override
  PlatformWebViewWidget createPlatformWebViewWidget(PlatformWebViewWidgetCreationParams params) => FakeWidget(params);
}

class FakeWebController extends PlatformWebViewController {
  FakeWebController(super.params) : super.implementation();

  final loaded = <Uri>[];
  final scripts = <String>[];
  final channels = <String, JavaScriptChannelParams>{};
  int reloads = 0;
  JavaScriptMode? mode;
  Color? background;
  void Function(PlatformWebViewPermissionRequest request)? onPermission;

  @override
  Future<void> loadRequest(LoadRequestParams params) async => loaded.add(params.uri);

  @override
  Future<void> runJavaScript(String javaScript) async => scripts.add(javaScript);

  @override
  Future<void> reload() async => reloads++;

  @override
  Future<String?> currentUrl() async => loaded.isEmpty ? null : loaded.last.toString();

  @override
  Future<void> setJavaScriptMode(JavaScriptMode javaScriptMode) async => mode = javaScriptMode;

  @override
  Future<void> setBackgroundColor(Color color) async => background = color;

  @override
  Future<void> addJavaScriptChannel(JavaScriptChannelParams javaScriptChannelParams) async => channels[javaScriptChannelParams.name] = javaScriptChannelParams;

  @override
  Future<void> setPlatformNavigationDelegate(PlatformNavigationDelegate handler) async {}

  @override
  Future<void> setOnPlatformPermissionRequest(void Function(PlatformWebViewPermissionRequest request) onPermissionRequest) async =>
      onPermission = onPermissionRequest;
}

class FakeDelegate extends PlatformNavigationDelegate {
  FakeDelegate(super.params) : super.implementation();

  WebResourceErrorCallback? onError;
  NavigationRequestCallback? onNavigation;

  @override
  Future<void> setOnNavigationRequest(NavigationRequestCallback onNavigationRequest) async => onNavigation = onNavigationRequest;

  @override
  Future<void> setOnWebResourceError(WebResourceErrorCallback onWebResourceError) async => onError = onWebResourceError;
}

class FakeWidget extends PlatformWebViewWidget {
  FakeWidget(super.params) : super.implementation();

  @override
  Widget build(BuildContext context) => const SizedBox(key: Key('fake-webview'));
}

// ignore: must_be_immutable (a test double that records what the app answered)
class FakeRequest extends PlatformWebViewPermissionRequest {
  FakeRequest(Set<WebViewPermissionResourceType> types) : super(types: types);

  bool? granted;

  @override
  Future<void> grant() async => granted = true;

  @override
  Future<void> deny() async => granted = false;
}
