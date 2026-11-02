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

/// JavaScript that tells the page what the Vocals buttons chose: one call to window.kantahe.setVocals(on, pct). The only values in it are a
/// boolean and a whole number (rounded down to a step of 10, between 0 and 100), so nothing that came from the page or the server can end up in it.
String buildSetVocalsScript(bool on, int pct) {
  final level = (pct.clamp(0, 100) ~/ 10) * 10;
  return 'window.kantahe && window.kantahe.setVocals && window.kantahe.setVocals($on, $level);';
}

/// What the page says about the guide vocals: `KantaheVocals:state:pct` with the state off, loading, on or failed (pct from 0 to 100).
class VocalsReport {
  const VocalsReport(this.state, this.pct);

  final String state;
  final int pct;
}

/// The report in [message], or null for anything else (also for a malformed one).
VocalsReport? parseVocalsMessage(String message) {
  const prefix = 'KantaheVocals:';
  if (!message.startsWith(prefix)) return null;
  final parts = message.substring(prefix.length).split(':');
  if (parts.length != 2 || !const {'off', 'loading', 'on', 'failed'}.contains(parts[0])) return null;
  final pct = int.tryParse(parts[1]);
  if (pct == null || pct < 0 || pct > 100) return null;
  return VocalsReport(parts[0], pct);
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

  /// Ends the page: shows an empty one, so that its script, synthesizer and video decoders stop and free their memory.
  Future<void> unload();

  /// Loads the player page again after [unload].
  Future<void> load();

  /// The address the page shows now (null when there is none yet).
  Future<String?> currentUrl();
}

/// The conversation with the player page (/embed/player): the page announces itself with the text
/// KantaheReady on a channel named Kantahe, and only then is it given the token. A page that starts again
/// announces itself again and is given the token again; a failed load never announces itself. The channel is
/// open to whatever page the WebView shows, so the token goes only to a page that is on the server's own origin.
class EmbedBridge {
  EmbedBridge({required this.auth, required this.serverUrl, this.host, this.onVocals});

  final AuthStore auth;
  final ServerUrl serverUrl;
  EmbedHost? host;

  /// Told what the page says about the guide vocals (only a page on the server's own origin is listened to).
  void Function(VocalsReport)? onVocals;

  /// What the user chose with the Vocals buttons; a page that starts again is given it after the token.
  ({bool on, int pct})? vocalsChoice;

  /// Passes the choice of the Vocals buttons to the page, and remembers it.
  Future<void> setVocals(bool on, int pct) async {
    vocalsChoice = (on: on, pct: pct);
    await host?.runJavaScript(buildSetVocalsScript(on, pct));
  }

  Future<void> onMessage(String message) async {
    final report = parseVocalsMessage(message);
    if (report == null && message != 'KantaheReady') return;
    final host = this.host;
    final server = serverUrl.value;
    if (host == null || server == null) return;
    if (!sameOrigin(await host.currentUrl(), server)) return;
    if (report != null) {
      onVocals?.call(report);
      return;
    }
    // the session of this moment, read after the wait
    final token = auth.token;
    final deviceId = auth.deviceId;
    if (token == null || deviceId == null) return;
    await host.runJavaScript(buildSetTokenScript(token, deviceId, server));
    final choice = vocalsChoice;
    if (choice != null) await host.runJavaScript(buildSetVocalsScript(choice.on, choice.pct));
  }
}
