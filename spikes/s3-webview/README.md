# kantahe_s3

Spike S3: the player page inside a Flutter WebView. Report: [docs/spikes/s3-webview.md](../../docs/spikes/s3-webview.md).

* `assets/test.html`: the test page (WebAudio and `<audio>` at load, `window.kantahe.setToken`, microphone button).
  Serve it over plain HTTP, for example with `go run` of a small file server or any static server on port 8099.
* `lib/player_bridge.dart`: `playerUrl` and `buildSetTokenScript` (tested in `test/`).
* `lib/main.dart`: the WebView with native Play/Pause/Skip buttons. Dart defines: `PAGE_URL`, `SERVER_URL`, `AUTORUN`.

```sh
flutter analyze && flutter test
flutter run --dart-define=PAGE_URL=http://localhost:8099/test.html   # after: adb reverse tcp:8099 tcp:8099
```
