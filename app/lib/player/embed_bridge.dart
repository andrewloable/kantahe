import 'dart:convert';

import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';

/// The address of the player page. The device token is never part of it: it goes in after the page has
/// said it is ready, through [buildSetTokenScript].
Uri playerUrl(String serverUrl) {
  final base = serverUrl.endsWith('/') ? serverUrl.substring(0, serverUrl.length - 1) : serverUrl;
  return Uri.parse('$base/embed/player');
}

/// JavaScript that hands the sign-in to the page: one call to window.kantahe.setToken. Every argument is
/// JSON-encoded, so a quote or a line break in a value cannot end the string or the call. U+2028 and U+2029
/// are escaped as well because older WebViews treat them as line ends.
String buildSetTokenScript(String token, String deviceId, String serverUrl) {
  String arg(String v) => jsonEncode(v).replaceAll(String.fromCharCode(0x2028), '\\u2028').replaceAll(String.fromCharCode(0x2029), '\\u2029');
  return 'window.kantahe.setToken(${arg(token)}, ${arg(deviceId)}, ${arg(serverUrl)});';
}

/// True when [url] is on the same origin (scheme, host and port) as [server]; the path and the query do not
/// matter (Uri.parse already lowercases the host).
bool sameOrigin(String? url, String server) {
  if (url == null) return false;
  final Uri a;
  final Uri b;
  try {
    a = Uri.parse(url);
    b = Uri.parse(server);
  } on FormatException {
    return false;
  }
  if (!a.hasScheme || a.host.isEmpty) return false;
  return a.scheme == b.scheme && a.host == b.host && a.port == b.port;
}

/// What the bridge needs from the WebView.
abstract interface class EmbedHost {
  Future<void> runJavaScript(String script);
  Future<void> reload();

  /// The address the page shows now (null when there is none yet).
  Future<String?> currentUrl();
}

/// The conversation with the player page (/embed/player): the page announces itself with the text
/// KantaheReady on a channel named Kantahe, and only then is it given the token. A page that starts again
/// announces itself again and is given the token again; a failed load never announces itself. The channel is
/// open to whatever page the WebView shows, so the token goes only to a page that is on the server's own origin.
class EmbedBridge {
  EmbedBridge({required this.auth, required this.serverUrl, this.host});

  final AuthStore auth;
  final ServerUrl serverUrl;
  EmbedHost? host;

  Future<void> onMessage(String message) async {
    if (message != 'KantaheReady') return;
    final host = this.host;
    final server = serverUrl.value;
    if (host == null || server == null) return;
    if (!sameOrigin(await host.currentUrl(), server)) return;
    // the session of this moment, read after the wait
    final token = auth.token;
    final deviceId = auth.deviceId;
    if (token == null || deviceId == null) return;
    await host.runJavaScript(buildSetTokenScript(token, deviceId, server));
  }
}
