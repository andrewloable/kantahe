# Kantahe app

The Flutter app for Android, iOS and Android TV: native screens, and the web player in a
WebView. On an Android TV (the system reports the leanback feature) it signs in with a code and is driven with the
remote; the launcher banner comes from `branding/build.py` (`tv-banner-320x180.png`, copied to
`android/app/src/main/res/drawable-xhdpi/tv_banner.png`). See [docs/PLAN.md](../docs/PLAN.md) sections 8 and 11.

```sh
flutter pub get
flutter analyze && flutter test                      # widget and unit tests, no network
flutter build apk --debug                            # Android
flutter build ios --simulator --no-codesign --debug  # iOS simulator (macOS)
```

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
