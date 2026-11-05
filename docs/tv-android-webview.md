# Android TV: when the WebView is too old

The Android and Android TV app show the player inside the system **WebView**. On a TV box with an old WebView the player does not
start. This page explains how to see that, the normal fix, and what to do when the normal fix is not offered. It was worked out on a
real box (an Avidus T99 Max, an Android 10 based engineering build that calls itself 14.0, WebView 74) and it ended with the player
working on WebView 113.

> **The last method changes the system software of the TV.** It only works on a box whose firmware is signed with the public
> Android test keys (`test-keys`, an engineering or developer build). A retail TV refuses it, and you should not try to get round
> that. Do it only on your own device, and keep the rollback command at hand.

## 1. How to tell

Symptom: the app opens, the player screen stays empty or frozen, and nothing plays.

With the TV on the network and adb debugging on (the TV's *Developer options*), connect and look at the WebView and at its log:

```sh
TV=<tv-address>:5555            # the TV's address; adb over the network uses port 5555
adb connect $TV
adb -s $TV shell dumpsys webviewupdate | grep -E "Current WebView|Valid package"
adb -s $TV logcat -d | grep -E "chromium" | grep -E "SyntaxError|Uncaught"
```

A line like `Current WebView package (name, version): (com.android.webview, 74.0.3729.186)` is the version, and
`Uncaught SyntaxError: Unexpected token .` for `main-*.js` is the proof: the engine cannot read the web app's JavaScript.

**What each Android release ships** (the stock WebView, from Google's open-source tree; a box without Google Play keeps it unless the
maker updates it): Android 8.1 = Chromium 61, 9 = 66, 10 = 74, 11 = 83, 12 = 91, 13 = 101, 14 = 113, 15 = 124, 16 = 133. So an
Android 9 box or older needs an update to run the player at all; an Android 10 or 11 box (also a box that says "14.0" on an Android 10
platform) runs the player with the older build that the server gives it (an update gives it the normal build instead); a box with Google Play updates Android System WebView by itself. The player and the app tell you when the engine is below the minimum (the table with TV browsers
is in docs/PLAN.md, "Minimum engine").

**What the player needs: Chromium 74 or newer** (the server gives a WebView below 85 a second, older build of the player page by itself:
section 7). The normal web build needs Chromium 85: optional chaining (`?.`) and `??` need 80, logical assignment (`||=`) needs 85.
The app is built for modern browsers (ES2022). Angular's own build can be aimed at an old browser (a `.browserslistrc` with
`chrome 74`; it warns that the browser is outside its support), but that converts only part of the syntax: 35 optional chains,
7 `??` and 42 logical assignments were still left in the 1.2.0 build, which Chromium 74 cannot read. Section 7 has the
extra step that converts the rest. Below Chromium 74 (Android 9 and older) the player says that the browser is too old; update the
WebView (sections 2 to 4) or use another device.

## 2. The normal fix

Update **Android System WebView** (`com.google.android.webview`) from the Google Play Store on the TV. On a retail TV this is all.
On some boxes the store does not offer it, which is the case this page is about.

## 3. Why a downloaded Google WebView is refused

You can install Google's `com.google.android.webview` APK by hand (take one whose minimum Android version is not higher than the TV's:
`adb shell getprop ro.build.version.sdk`). It installs, and still the TV keeps the old WebView:
`adb shell cmd webviewupdate set-webview-implementation com.google.android.webview` answers *Failed to switch*.

The reason is an allowlist inside the firmware. Read it:

```sh
WORK=<an empty working folder>
adb -s $TV pull /system/framework/framework-res.apk $WORK/
aapt2 dump xmltree --file res/xml/config_webview_packages.xml $WORK/framework-res.apk
```

On the box this page comes from, the answer was one entry, `packageName="com.android.webview"`. Only that package can be the WebView.
Removing it does not help: the TV would have no WebView at all and every app that shows web content would break. (`aapt2` and
`apksigner` come with the Android SDK build tools, `<sdk>/build-tools/<version>/`.)

So the way to a newer WebView is a newer **`com.android.webview`**, installed as an update of the system app. Android only accepts an
update of a system app that is signed with the same certificate as the one on the TV.

## 4. The method (builds signed with the public test keys)

**a. Look at the certificate of the TV's own WebView.**

```sh
adb -s $TV shell pm path com.android.webview           # for example /product/app/webview/webview.apk
adb -s $TV pull <that path> $WORK/device-webview.apk   # keep this file: it is the way back
apksigner verify --print-certs $WORK/device-webview.apk
```

If the certificate is `CN=Android, O=Android, EMAILADDRESS=android@android.com` with the SHA-256
`a40da80a59d170caa950cf15c18c454d47a39b26989d8b640ecd745ba71bf5dc`, the box is signed with the **public Android test key**: anyone can
sign for it, and the method below works. **Any other certificate: stop here.** A retail device keeps its key to itself, and the
only fix is a firmware from the maker.

**b. Download the official prebuilt WebView.** Google's open-source Android tree carries prebuilt WebView packages named
`com.android.webview`, one per Android release (the repository is `platform/external/chromium-webview`). The `android14-release`
branch has Chromium 113.0.5672.136. Take the folder that matches the TV's processor:

```sh
adb -s $TV shell getprop ro.product.cpu.abilist        # armeabi-v7a -> arm, arm64-v8a -> arm64 (a 32-bit TV with a 64-bit kernel is arm)
curl -s "https://android.googlesource.com/platform/external/chromium-webview/+/refs/heads/android14-release/prebuilt/arm/webview.apk?format=TEXT" \
  | base64 -D > $WORK/aosp-webview.apk                 # on Linux: base64 -d
aapt2 dump badging $WORK/aosp-webview.apk | grep -E "^package|minSdk|native-code"
```

Check that the package is `com.android.webview`, that the version code is **higher** than the TV's
(`dumpsys webviewupdate` shows it), that `minSdkVersion` is not higher than the TV's SDK, and that `native-code` fits.

**c. Get the public test key** from the same source tree, `platform/build`, folder `target/product/security/`: the files `testkey.pk8`
and `testkey.x509.pem`, downloaded the same way as above. Prove it is the key of the TV before using it:

```sh
openssl x509 -in $WORK/testkey.x509.pem -noout -fingerprint -sha256     # must equal the SHA-256 of step a
```

**d. Sign and check.**

```sh
apksigner sign --key $WORK/testkey.pk8 --cert $WORK/testkey.x509.pem --out $WORK/webview-signed.apk $WORK/aosp-webview.apk
apksigner verify --print-certs $WORK/webview-signed.apk                 # the same certificate as the TV's
```

(`apksigner` signs with schemes v2 and v3 only when the minimum SDK is 24 or more; the TV reads those.)

**e. Install it as an update, and check.**

```sh
adb -s $TV install -r $WORK/webview-signed.apk
adb -s $TV shell dumpsys webviewupdate | grep -E "Current WebView|Valid package"
```

The WebView line now shows the new version. Start the app again (`adb -s $TV shell am force-stop party.kantahe`, then open it); the
player plays and the log has no `SyntaxError`. An update of a system app normally survives a restart (not tried on the box this page
comes from).

**f. Roll back** if anything on the TV misbehaves:

```sh
adb -s $TV uninstall com.android.webview     # removes the update; the built-in version comes back (the usual behaviour for a system app; not run on the box this page comes from)
```

## 5. What did not work

* Installing Google's own `com.google.android.webview` and choosing it: not on the allowlist, so refused (section 3).
* Removing the TV's built-in WebView: leaves the TV without any (section 3).
* Using the Chrome app that came on the box as the WebView: switching failed, and its version (79) is too old anyway.
* Aiming Angular's own build at Chromium 74 (`.browserslistrc`): it converted only part of the syntax (section 1); an extra esbuild pass converts the rest (section 7).
* A Google WebView built for a newer Android than the TV's: `INSTALL_FAILED_OLDER_SDK`. The TV's real level is `ro.build.version.sdk`,
  whatever number the *About* screen shows.

## 6. Limits

* Only on builds signed with the public test keys; a retail TV needs its maker's firmware or another device.
* A factory reset brings the old WebView back; repeat step e (the files are the same).
* It is a change to the system software of one TV. Do it on your own devices only, and not on a TV you do not control.
* The newer the WebView, the more it relies on the Android it runs on. Chromium 113 on an Android 10 base worked; a much newer
  prebuilt may not, in which case roll back and take an older branch (`android12-release`, `android13-release`).
* When the maker offers a firmware with a current WebView, use that instead.

## 7. The web build for old WebViews

Since the release after 1.2.0 the release and the Docker image carry a second build of the web app for engines from Chromium 74 to 84,
and the server gives it to them by itself (the user agent of the WebView says its Chromium version). Nothing has to be done on the TV.
How it is made (`npm run build:legacy` in `web/`, after `ng build`):

* esbuild with `--target=chrome74` over every `.js` file of the finished build turns the syntax that Chromium 74 cannot read (569 optional
  chains, 265 `??`, 96 `||=`, `&&=` and `??=` in the 1.2.0 build) into older syntax. `npm run check:legacy` scans the result and fails on
  anything newer than 74.
* `web/legacy/polyfills.js` adds the functions that Chromium 74 lacks and the code calls: `Object.hasOwn`, `Array.prototype.at`,
  `String.prototype.at` and `String.prototype.replaceAll`.
* `web/legacy/legacy.css` replaces the CSS that Chromium 74 cannot read in the player page (flex `gap`, `inset`, `min()` and `clamp()`),
  under the class `legacy` of the `html` element.
* The page gets `<base href="/legacy/">`, and the server serves the files under `/legacy/`: the two builds have the same file names with
  different content.
* The server (`server/internal/webui/webui.go`) answers `/embed/player` from a user agent `Chrome/NN`, NN below 85, with a 302 to
  `/legacy/embed/player` (and `Vary: User-Agent`). Every other engine gets the normal build.

Checked on a real WebView 74 (section 8): the normal build stops with `Uncaught SyntaxError: Unexpected token .` and the page's "browser
is too old" message; the legacy build plays an MP3 and a MIDI song with lyrics, progress and score screen and writes no console error.
The legacy page is for the player page only (`/embed/player`): the rest of the web app is not promised below Chromium 85, and the
Samsung and LG packages are the normal build. The update of section 4 stays the way to give a TV a current engine (it also helps the
songs that need the synthesizer).

## 8. Checking the player on an old WebView, automatically

`scripts/legacy-webview-check.sh` runs the real player (the app's player screen with the web player page in the system WebView)
on an Android emulator and fails when the page throws. It is the only check that runs the web app on a real Chromium 74: Playwright
cannot, and the syntax scanner does not see a missing function.

```sh
scripts/legacy-webview-check.sh                          # Android 10, WebView 74, both builds in the server: expected PASS
scripts/legacy-webview-check.sh --api 35                 # a current WebView: expected PASS (the modern build is served)
scripts/legacy-webview-check.sh --build modern           # the modern build only, as before the legacy build: expected FAIL
scripts/legacy-webview-check.sh --without-polyfills      # the legacy page without its polyfills: expected FAIL
```

It creates the AVD `kantahe_api29` (or `kantahe_api35`) when it is missing and touches no other AVD, starts it without a window,
puts Google's WebView 74 (the prebuilt `com.android.webview` of the Android 10 branch, downloaded once into
`~/.cache/kantahe-legacy-check`) on API 29, builds the web app and the server, starts the server on a temporary data folder with the
synthetic songs of `kantahe-fixtures` and a throw-away account, runs `app/integration_test/player_flow_test.dart` (an MP3 and a MIDI
song are played through the page), and shuts everything down. The verdict is the test result plus the page's console, which the WebView
writes to logcat: any `Uncaught`, `SyntaxError`, `ReferenceError`, `TypeError`, `is not a function` or `is not defined` fails the run.
The screenshots (every 3 seconds), the logcat and the logs go to the folder named with `--out` (printed at the end). With both builds
it also checks that the server sends Chromium 74 to `/legacy/embed/player` and does not redirect Chromium 113. Needs the Android SDK
with the system image of the API, go, node, python3, curl and flutter; set `ABI=x86_64` on an Intel machine.
