# Kantahe app

The Flutter app for Android, iOS and Android TV: native screens, and the web player in a
WebView. On an Android TV (the system reports the leanback feature) it signs in with a code and is driven with the
remote; the launcher banner comes from `branding/build.py` (`tv-banner-320x180.png`, copied to
`android/app/src/main/res/drawable-xhdpi/tv_banner.png`). See [docs/PLAN.md](../docs/PLAN.md) sections 8 and 11.

The launch splash is the official logo from the brand pipeline: `scripts/sync-branding.sh` copies `splash-logo.png` (the Flutter splash,
`lib/bootstrap.dart`), `splash-logo-960.png` (as `splash-logo-native.png`, the native splash before Android 12, 240 dp) and
`splash-android12-1152.png` into `assets/branding/`, and `scripts/sync-branding.sh --flutter` regenerates the native files from them
(`dart run flutter_native_splash:create`; it keeps the hand edit of `NormalTheme` in the four `styles.xml`, which sets the window colour behind the
app to `#0a0e22`). `test/brand_test.dart` fails when the colour, a copy or a native file drifts.

```sh
flutter pub get
flutter analyze && flutter test                      # widget and unit tests, no network
flutter build apk --debug                            # Android
flutter build ios --simulator --no-codesign --debug  # iOS simulator (macOS)
```

## Finding the server

On start the app looks for servers on the network (`lib/core/server_discovery.dart`, the `bonsoir` package, service
`_kantahe._tcp`): one is connected to by itself, several are listed, and the address field appears only when none is
found (`lib/auth/server_screen.dart`, rules in [docs/PLAN.md](../docs/PLAN.md) section 8). iOS needs
`NSBonjourServices` and the local-network text in `ios/Runner/Info.plist`; Android gets its multicast permission from
the plugin. The search is turned off in the integration runs (`--dart-define=KANTAHE_NO_DISCOVERY=true`, set by the script).

## Integration tests

`integration_test/` holds tests that run the app against a real server. `scripts/flutter-integration.sh` starts
one with the synthetic song library and runs `flow_test.dart`:

```sh
scripts/flutter-integration.sh emulator-5554                          # Android emulator
scripts/flutter-integration.sh <simulator id> --host 127.0.0.1        # iOS simulator
scripts/flutter-integration.sh <tv emulator or box> --test tv_flow_test.dart   # Android TV: code sign-in and the remote
```

## Release signing (Android)

A release build is signed with the key named in `android/key.properties` (`storeFile`, `storePassword`,
`keyAlias`, `keyPassword`). That file and the keystore are never committed (`android/.gitignore`). Without
it `flutter build apk --release` still works but signs with the debug key: fine for trying, not for publishing.
iOS signing is set up in Xcode with your own team.
