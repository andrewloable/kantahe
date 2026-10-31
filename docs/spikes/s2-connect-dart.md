# Spike S2: connect-dart unary and server streaming over plain HTTP

Question: can the Flutter apps call the server with the generated Dart client over plain `http://` on a LAN,
keep `SessionService.WatchState` open for hours, and which platform settings does that need?

Code: [spikes/s2-connect-dart](../../spikes/s2-connect-dart): `server/` (Go test server with
`GetServerInfo` and a `WatchState` that ticks, with tests), `app/` (Flutter app: a URL field, a unary button, a
stream switch with message and reconnect counters, a `Watcher` that reconnects, an autorun mode for the test
runs, unit, widget and integration tests).

## Result in one line

**Works on Android, iOS and Android TV with the Connect protocol, binary protobuf, and dart:io's HTTP/1.1
client, over plain HTTP.** The one platform setting that matters is the INTERNET permission in the Android
main manifest.

## What was run

Android phone emulator (Pixel-like, Android 15, API 35), Android TV emulator (1080p TV image, API 36) and iOS
simulator (iPhone 17 Pro, iOS 26.5), all on one Apple M4 Pro Mac, against the Go test server on the same Mac
(`10.0.2.2` from the Android emulators, `127.0.0.1` from the simulator). The same autorun build ran on all three
at once for 11 minutes (`--dart-define=AUTORUN_SECONDS=660`), logging every 30 s. The server was killed
and restarted about a minute in, and paused silently (SIGSTOP) for 35 s about three minutes in.

| | Android phone | Android TV | iOS simulator |
|---|---|---|---|
| Unary `GetServerInfo` | OK (`version=spike setup_required=true`) | OK | OK |
| Stream open for 11 minutes | OK, 615 messages | OK, 615 messages | OK, 615 messages |
| After the server was killed and restarted | reconnected, 4 reconnects counted, stream resumed | same | same |
| Server paused silently for 35 s | no messages for 35 s, **no error, no reconnect**; resumed by itself | same | same |
| Transport | `Transport` of `package:connectrpc/protocol/connect.dart` + `createHttpClient(HttpClient())` of `.../io.dart`, `ProtoCodec` | same | same |
| Settings needed in debug builds | none | none | none |
| Settings needed in release builds | `INTERNET` permission in the main manifest | same | none seen in the simulator |

## Findings

1. **Cleartext policies do not apply to the Dart client.** dart:io opens plain sockets, so neither Android's
   cleartext policy (`usesCleartextTraffic`, network security config) nor iOS App Transport Security stopped
   `http://` in the runs above (debug builds with no settings). **They do apply to a WebView**, which Phase 4
   uses for the player page (`/embed/player`): Android's WebView honours `usesCleartextTraffic`, and iOS's
   `WKWebView` applies ATS (an IP address or `.local` name is covered by `NSAllowsLocalNetworking`; a named host
   such as `http://karaoke.example.lan` would need `NSAllowsArbitraryLoadsInWebContent`). Both stay declared and
   spike S3 has to confirm them with a real page. The spike app declares `android:usesCleartextTraffic="true"`
   and `NSAllowsLocalNetworking` (not `NSAllowsArbitraryLoads`).
2. **Android release builds need `<uses-permission android:name="android.permission.INTERNET"/>` in
   `android/app/src/main/AndroidManifest.xml`.** `flutter create` only puts it in the debug manifest. Without it
   the release build failed with `SocketException: Connection failed (OS Error: Operation not permitted, errno = 1)`
   (screenshot checked); with it the same build connected.
3. **No idle detection.** dart:io has no read timeout: a server that stops answering without closing the
   connection (cable pulled, Wi-Fi gone, NAT table dropped) leaves the stream open and silent. The real
   `WatchState` sends a snapshot only when something changes, so on a quiet server the client cannot tell silence
   from a dead link. See the recommendation.
4. **HTTP/2 was not tried**: the server speaks plain HTTP/1.1 only by decision D10 (no h2c), and the package's
   HTTP/2 transport needs h2c or TLS. HTTP/1.1 streaming works, so nothing is lost.
5. **Not verified here (needs a person with the hardware):** a physical iPhone (iOS asks for the Local Network
   permission on the first connection to a LAN address; `NSLocalNetworkUsageDescription` is set so that the prompt
   has text, but the prompt was not seen on the simulator), a physical Android phone and TV box (real Wi-Fi,
   sleep/doze behaviour while the stream is open for hours), and runs longer than 11 minutes.

## Recommended Phase 4 client setup

* Packages as in `app/pubspec.yaml`: `connectrpc ^2.0.1`, `protobuf ^6.1.0`; Dart SDK and Flutter as installed
  (Flutter 3.47.5 stable at the time of the spike).
* One `dart:io` `HttpClient` per server address, with `connectionTimeout` set (10 s) so an unreachable address
  fails quickly; build the transport with
  `protocol.Transport(baseUrl: url, codec: const ProtoCodec(), httpClient: createHttpClient(client))` and pass it
  to the generated clients (binary protobuf, Connect protocol, as the spike did).
* Android: `INTERNET` permission in the main manifest, `usesCleartextTraffic="true"`. iOS:
  `NSLocalNetworkUsageDescription` and `NSAppTransportSecurity` with `NSAllowsLocalNetworking` in `Info.plist`.
* Reconnect with the spike's `Watcher` rules: wait 1, 2, 4, then 5 seconds between attempts, and start again at one
  second after a message arrived. It worked on all three targets.
* **Add a liveness check** (finding 3): treat the stream as dead when nothing arrived for about 60 seconds and
  reconnect. The server must then send something at least every 20-30 seconds, for example the unchanged
  snapshot; this is a small change in `SessionService.WatchState` and in the web client's store, which today
  relies on errors and a polling fallback. Filed as kantahe-6y6.15.
* Cancel the stream (`AbortSignal`) when the screen leaves or the app goes to the background on iOS, where the
  OS closes the connection anyway, and reconnect on resume.
