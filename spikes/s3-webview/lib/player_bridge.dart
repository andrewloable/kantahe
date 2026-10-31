import 'dart:convert';

/// The address of the player page. The device token is never part of it: it
/// goes in after the page has loaded, through [buildSetTokenScript].
Uri playerUrl(String serverUrl) {
  final base = serverUrl.endsWith('/') ? serverUrl.substring(0, serverUrl.length - 1) : serverUrl;
  return Uri.parse('$base/embed/player');
}

/// JavaScript that hands the sign-in to the page: one call to
/// window.kantahe.setToken. Every argument is JSON-encoded, so a quote or a
/// line break in a value cannot end the string or the call. U+2028 and U+2029
/// are escaped as well because older WebViews treat them as line ends.
String buildSetTokenScript(String token, String deviceId, String serverUrl) {
  String arg(String v) => jsonEncode(v)
      .replaceAll(String.fromCharCode(0x2028), '\\u2028')
      .replaceAll(String.fromCharCode(0x2029), '\\u2029');
  return 'window.kantahe.setToken(${arg(token)}, ${arg(deviceId)}, ${arg(serverUrl)});';
}
