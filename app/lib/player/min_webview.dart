/// The oldest Chromium that can run the player page (docs/PLAN.md, "Minimum engine"): 74, the WebView of Android 10. The modern web build
/// needs Chromium 85 or newer (optional chaining and ?? need 80, logical assignment needs 85), so the server gives the player page of an
/// older engine the legacy build (web/scripts/build-legacy.mjs), converted for Chromium 74 and newer. Below 74 nothing can run it: ES modules
/// need 61, dynamic import() 63, BigInt 67 and the converted code relies on more. The number is the one of the legacy page
/// (LEGACY_MIN_CHROMIUM in web/scripts/build-legacy.mjs; a test of the web app keeps them equal).
const kMinChromium = 74;

/// The major version of Chromium in a WebView user agent ("... Chrome/74.0.3729.186 ..."), or null when there is none: not a Chromium
/// WebView, or no user agent at all. Nothing is blocked on null.
int? chromiumMajor(String? userAgent) {
  if (userAgent == null) return null;
  final m = RegExp(r'Chrome/(\d+)').firstMatch(userAgent);
  return m == null ? null : int.parse(m.group(1)!);
}

/// The major version of a WebView that is below [kMinChromium], or null when it is new enough, cannot say, or fails to say.
Future<int?> oldEngineMajor(Future<String?> Function() userAgent) async {
  try {
    final major = chromiumMajor(await userAgent());
    return major != null && major < kMinChromium ? major : null;
  } catch (_) {
    return null;
  }
}

/// What the player shows instead of a page that could only fail to start.
String engineTooOldMessage(int major) =>
    "This screen's browser is too old (Chromium $major). Kantahe needs Chromium $kMinChromium or newer. "
    'Update Android System WebView (see the user guide, Android TV: when the WebView is too old), or use a newer device.';
