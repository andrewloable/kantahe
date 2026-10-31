# Spike S3: the player page in a Flutter WebView

Question: can the Flutter apps show `/embed/player` in a WebView with audio that starts without a tap, the device
token handed over through JavaScript (never the URL), microphone permission forwarded, and the D-pad driving native
controls on Android TV? And which WebView package and settings does that need?

Code: [spikes/s3-webview](../../spikes/s3-webview): `assets/test.html` (WebAudio and `<audio>` at load, `window.kantahe.setToken`,
a microphone button), `lib/player_bridge.dart` (`playerUrl`, `buildSetTokenScript`, with tests), `lib/main.dart`
(full-screen WebView with native Play/Pause/Skip buttons on top). The page side follows the existing
`web/src/app/player/embed-player.page.ts`: a JavaScript channel named `Kantahe`, the text `KantaheReady` from the page, then
`window.kantahe.setToken(...)` from the app.

## Decision

**`webview_flutter` 4.14.1** (with `webview_flutter_android` 4.14.1 and `webview_flutter_wkwebview` 3.27.2) does all of it.
`flutter_inappwebview` was not needed and not tried. Plus **`permission_handler` ^12.0.1** on Android only (see finding 4).

Settings that matter (all in `lib/main.dart` and the platform files):

| Platform | Setting | Why |
|---|---|---|
| Android | `AndroidWebViewController.setMediaPlaybackRequiresUserGesture(false)` | without it `<audio>.play()` is refused (`NotAllowedError`) |
| Android | manifest: `INTERNET`, `RECORD_AUDIO`, `android:usesCleartextTraffic="true"` (`MODIFY_AUDIO_SETTINGS` is also declared in the spike but was never tried without it, so it is not shown to be needed) | cleartext: the WebView refuses `http://` pages otherwise (`net::ERR_CLEARTEXT_NOT_PERMITTED`) |
| Android | in the permission callback: `Permission.microphone.request()` first, then `request.grant()` or `deny()` | the plugin never asks the system for `RECORD_AUDIO` itself |
| iOS | `WebKitWebViewControllerCreationParams(mediaTypesRequiringUserAction: {})` | without it `<audio>.play()` is refused and WebAudio stays `interrupted` |
| iOS | `allowsInlineMediaPlayback: true` | not needed for audio only (tried without); keep it for video in case a page ever plays one |
| iOS | `Info.plist`: `NSMicrophoneUsageDescription` | without it `navigator.mediaDevices` was **absent** from the page |
| iOS | `Info.plist`: `NSAppTransportSecurity` with `NSAllowsLocalNetworking` and `NSAllowsArbitraryLoadsInWebContent`, `NSLocalNetworkUsageDescription` | see finding 2 |
| both | `JavaScriptMode.unrestricted`, a JavaScript channel for reports from the page, the permission callback passed to the `WebViewController` constructor (`onPermissionRequest`) | |
| both | `addJavaScriptChannel('Kantahe', ...)`; on the message `KantaheReady` run `controller.runJavaScript(buildSetTokenScript(token, deviceId, serverUrl))` | arguments JSON-encoded; U+2028/U+2029 escaped; not at `onPageFinished` (finding 7) |

## What was run

Android phone emulator (Pixel 6 profile, Android 15 API 35), Android TV emulator (1080p TV image, API 36) and the iOS
simulator (iPhone 17 Pro, iOS 26.5), on one Apple Silicon Mac, with a debug build of the spike app and `test.html`
served from a static file server on the same Mac. Android pages: `http://10.0.2.2:8099` (the Mac as seen from the
emulator, a LAN-like address) and `http://localhost:8099` (via `adb reverse`). iOS: `http://127.0.0.1:8099`, the Mac's
LAN address, and `http://localtest.me:8099` (a named host that resolves to this Mac).

| | Android phone | Android TV | iOS simulator |
|---|---|---|---|
| WebAudio starts at load, no gesture | OK: `running`, clock moved 0.73-0.91 s | OK | OK (0.62 s) |
| `<audio>` starts at load | OK, `currentTime` 0.6 s | OK | OK |
| same, with the platform setting removed | **refused** (`NotAllowedError`); WebAudio still ran | not repeated | **refused**; WebAudio `interrupted` |
| Token through `runJavaScript` | received, 13 characters, not in the address | same | same |
| Page address | plain, no query | same | same |
| Microphone on `http://localhost` | system dialog ("While using the app"), then `granted, track live`; "Don't allow" gives `NotAllowedError` | same; the dialog works with the D-pad and focus returns to the native buttons | `granted, track live` (the simulator showed no system prompt, see "Not verified") |
| Microphone on `http://10.0.2.2` / LAN address / named host | no `navigator.mediaDevices` (`isSecureContext=false`) | same | same |
| D-pad | Right, Right, Center, Left, Center, Down, Left gave focus Pause, Skip, pressed Skip, focus Pause, pressed Pause, (Down: nothing), focus Play: **native buttons only** | | n/a |
| Plain `http://` page | needs `usesCleartextTraffic` (error `ERR_CLEARTEXT_NOT_PERMITTED` without) | same | IP addresses, `.local`, localhost load with no setting; a named host fails with `-1022` until `NSAllowsArbitraryLoadsInWebContent` is set, then loads |

## Findings

1. **Autoplay needs the platform setting on both systems** (table above); the negative runs prove the setting is what
   allows playback. Android WebAudio ran either way in the test; iOS WebAudio only with the setting.
2. **Cleartext for the player page**: Android needs `usesCleartextTraffic`. iOS ATS does not apply to IP addresses and
   `.local` names (a LAN IP loaded with no ATS key at all), but a named host such as `http://karaoke.lan` is refused
   (`-1022`); `NSAllowsArbitraryLoadsInWebContent` fixes it for WebView content only, and the native Dart client is not
   affected (S2). `NSAllowsArbitraryLoads` is not needed.
3. **Microphone needs a secure context, and a LAN address is not one.** On `http://<lan address>` or a named host
   the page has no `navigator.mediaDevices` at all, in every WebView tried; only `localhost`/`127.0.0.1`, or HTTPS, work.
   So for a server on plain HTTP (the default, D10), **the Microphone score mode cannot work inside the WebView page**;
   it works when the server is behind HTTPS (reverse proxy). PLAN.md says Flutter apps offer the mode; that needs a
   decision, see the recommendation. Nothing in the WebView can be set to change this: the plugin has no switch for it.
4. **Android runtime permission**: `webview_flutter_android` forwards the page's request to `onPermissionRequest` but
   does not ask Android for `RECORD_AUDIO`; granting the request alone ends in `NotReadableError`. The app must request
   it (`permission_handler`) first. `permission_handler` 13 needs `compileSdk` 37, which Flutter 3.47.5 with
   Android Gradle plugin 9.1.0 does not support (build error `checkDebugAarMetadata`); version 12.0.3 builds. iOS needs no
   such call: granting the request makes WebKit ask the system.
5. **iOS without `NSMicrophoneUsageDescription`** the page had no `navigator.mediaDevices` even on 127.0.0.1; with it the
   microphone worked. Observed once each; treat the key as required.
6. **The D-pad never reached the WebView**: the native buttons got all focus moves, with and without `ExcludeFocus`
   around the WebView in this test (the page had a focusable button). `ExcludeFocus` stays as a cheap guard; the
   claim "the WebView never takes focus" is verified only on the TV emulator's remote keys.
7. **`onPageFinished` also fires for a failed load.** The first version of the spike injected the token there and it ran
   inside Chromium's error page (`chrome-error://chromewebdata`, console error `Cannot read properties of undefined`).
   The page also may not have created `window.kantahe` yet (the real page is an Angular route that creates it when it
   starts). Hand over the token only on the message `KantaheReady`. Checked: a refused connection
   (`ERR_CONNECTION_REFUSED`) sends no ready message and runs no script; on a good page the ready message arrived before
   `onPageFinished` in the Android and iOS runs. Reloads need the token again: the message comes again with each page start.

## Recommended Phase 4 setup

* Dependencies: `webview_flutter ^4.14.1` (resolves the Android and WKWebView packages above), `permission_handler ^12.0.1`
  (recheck when Flutter's default `compileSdk` reaches 37). Call the platform-specific `Permission.microphone.request()` only on
  Android.
* Copy the settings table into the app; `playerUrl(serverUrl)` and `buildSetTokenScript` are ready to reuse, with tests.
* The embedded page (`/embed/player`, already in the web app) defines `window.kantahe.setToken(token, deviceId, serverUrl)`
  and posts `KantaheReady` to a channel named `Kantahe` (or calls the handler `ready` of flutter_inappwebview). Register
  a `webview_flutter` channel named `Kantahe` and answer the ready message as the spike does.
* **Decision needed for Microphone score mode on plain HTTP** (finding 3): either (a) offer it only when the server
  address is HTTPS or localhost, as in the web app, or (b) read the microphone natively in Flutter (for example the
  `record` package) and feed loudness readings to the page through `runJavaScript`. (a) costs nothing and matches
  the web; (b) needs a small hook in the web player. Recommend (a) for the first release, (b) only if owners ask.

## Not verified here (needs a person with the hardware)

* A physical iPhone: the system microphone and Local Network prompts (the simulator showed no prompt, so the prompt
  text was not seen), and WebKit's behaviour with real audio routing.
* A physical Android phone and an Android TV box: real audio output (the emulators accepted playback but nobody listened),
  the microphone with a real input, TV remotes, and release builds (only debug builds were run; `INTERNET` is already
  in the main manifest, R8 was not exercised).
* Playback of a full song through the real `/embed/player` page against the real server: the spike used `test.html`; the
  real page was not loaded in the WebView (it needs a signed-in device and a song).
* Videos or full-screen behaviour (`allowsInlineMediaPlayback` is only inferred to be irrelevant for audio).
