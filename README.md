# Kantahe

A self-hosted karaoke server. You install it on any computer or Docker host, add your own `.kar` and `.karmp3`
songs, create accounts for the people at home, and everyone sings from a browser, a phone or a TV: each person has their
own queue, and any of their devices can be the screen while the others are remote controls.

Kantahe is open source (MIT). It ships **no songs**: you bring your own.

The domain of the project is **kantahe.party**.

## What it does

* **Songs**: `.kar` (a MIDI file with lyrics) and `.karmp3` (an MP3 with timed lyrics) files, uploaded in the browser or
  read from folders on the server. Every file is its own entry with a number you can type on a number pad, and an MP3
  or MIDI badge. Search, browse by letter, favourites, history and playlists.
* **Accounts**: email and password. The first start creates the admin; the admin creates the other users, decides who
  may upload, and resets forgotten passwords. TVs sign in with a short code approved from a phone.
* **Per-user queue**: one queue and one now-playing song per person. "Play here" moves the singing to the device in
  your hand; your other devices become remotes. Songs wait their turn, and when the queue runs dry a random song plays.
* **Lyrics and score**: words light up as they are sung, with count-in dots before a line. After a song a score screen
  and fanfare, for fun (random) or following how loudly you sing (microphone).
* **Background videos**: the admin uploads H.264 MP4 clips that loop, with no sound, behind the lyrics on the screen that plays;
  each device can switch them off.
* **MIDI that works on weak devices**: the browser synthesizes MIDI songs itself; a TV or an old phone can use a lighter
  mode or let the server render the audio.
* **One program**: the server is a single static binary with the web app inside, for Linux, macOS and Windows
  (amd64 and arm64), and a multi-arch Docker image. Data is a SQLite database and plain files.

## Quick start (Docker)

```sh
# edit the path of your karaoke folder in deploy/compose.yaml, then
docker compose -f deploy/compose.yaml up -d
```

Open <http://localhost:8080> and create the first (admin) account. More ways to run it, and what to back up, are in the
[installation guide](docs/install.md). For use outside your home network, put a reverse proxy with HTTPS in front
([reverse proxy guide](docs/reverse-proxy.md)).

## Guides

* [Installation](docs/install.md): Docker, Linux, macOS, Windows, backups, upgrades.
* [User guide](docs/user-guide.md): signing in, finding and queueing songs, the player, score, favourites, playlists, TVs.
* [Admin guide](docs/admin-guide.md): users, uploads and watched folders, settings, deleting songs, backups.
* [Reverse proxy](docs/reverse-proxy.md): HTTPS with Caddy or nginx.
* TV apps: [Samsung](docs/tv-samsung.md), [LG](docs/tv-lg.md); [Android TV with an old WebView](docs/tv-android-webview.md).
* [Plan and decisions](docs/PLAN.md): how it works and why.
* [Releasing](docs/releasing.md): the checklist before a tag, with `scripts/ci-local.sh`.

## Apps

| Where | What |
|---|---|
| Any browser | The web app, served by the server itself. |
| Android, iOS, Android TV | A Flutter app in `app/` (native screens, with the web player inside). |
| Samsung and LG TVs | The web app packaged for each TV (`tv/`), installed in developer mode. |

## Android TV with an old WebView

The Android and Android TV app shows the player in the system WebView, so an old TV box may not start it. The app and the player say
"this screen's browser is too old" with the Chromium version when that happens. The player needs **Chromium 74 or newer**, and there
are two ways to get there:

1. **Do nothing (Chromium 74 to 84).** The server sends these engines to a second, older build of the player by itself. Android 10 and
   11 boxes are in this range. Below 74 (Android 9 and older) nothing can be offered: update the WebView or use another device.
2. **Update the WebView (Chromium 85 or newer).** The server then gives the normal player, which is the best tested one. On a TV with
   Google Play, update *Android System WebView* in the store. On a box where the store does not offer it, the steps below work only on
   firmware signed with the public Android test keys (an engineering build). **They change the TV's system software: use them on your
   own device only, and keep the rollback command.** A retail TV needs its maker's firmware or another device.

Steps (the full guide, with the reasons and what did not work, is [docs/tv-android-webview.md](docs/tv-android-webview.md)). Needs adb,
and `aapt2` and `apksigner` from the Android SDK build tools:

```sh
TV=<tv-address>:5555 ; WORK=<an empty working folder>
adb connect $TV
adb -s $TV shell dumpsys webviewupdate | grep -E "Current WebView|Valid package"        # the version now
adb -s $TV shell pm path com.android.webview                                             # for example /product/app/webview/webview.apk
adb -s $TV pull <that path> $WORK/device-webview.apk                                     # keep it: it is the way back
apksigner verify --print-certs $WORK/device-webview.apk                                  # must be CN=Android, SHA-256 a40da80a...f5dc (the public test key)
adb -s $TV shell getprop ro.product.cpu.abilist                                          # armeabi-v7a -> arm, arm64-v8a -> arm64
# the prebuilt WebView of Google's open-source tree (Chromium 113, branch android14-release); use "arm64" or "arm" below; Linux: base64 -d
curl -s "https://android.googlesource.com/platform/external/chromium-webview/+/refs/heads/android14-release/prebuilt/arm/webview.apk?format=TEXT" | base64 -D > $WORK/aosp-webview.apk
# the public test key, from the same tree: files testkey.pk8 and testkey.x509.pem in platform/build, folder target/product/security/
openssl x509 -in $WORK/testkey.x509.pem -noout -fingerprint -sha256                      # must equal the SHA-256 of the TV's WebView
apksigner sign --key $WORK/testkey.pk8 --cert $WORK/testkey.x509.pem --out $WORK/webview-signed.apk $WORK/aosp-webview.apk
adb -s $TV install -r $WORK/webview-signed.apk                                           # an update of the system app
adb -s $TV shell dumpsys webviewupdate | grep -E "Current WebView|Valid package"        # now 113
adb -s $TV shell am force-stop party.kantahe                                             # then open the app again
adb -s $TV uninstall com.android.webview                                                 # rollback: the built-in version comes back
```

Check before installing that the package is `com.android.webview`, that its version code is higher than the TV's, and that its
minimum Android version is not higher than the TV's (`adb shell getprop ro.build.version.sdk`). If the certificate of the TV's WebView is
anything but the public test key, stop: nobody but the maker can sign for it.

## Status

The server, the web app and the Android and iOS apps are built and tested, including against a real server in an
emulator. The TV packages (Android TV, Samsung, LG) have run on emulators and in a desktop browser, not yet on real TVs,
and which TV models play MIDI songs without dropouts is still to be measured ([spike S1](docs/spikes/s1-web-player.md)).

## Building from source

The layout and commands are in [CLAUDE.md](CLAUDE.md). In short: `cd server && go test ./...`, `cd web && npx ng test`,
`cd app && flutter test`, and `scripts/build-release.sh` builds the release binaries.

## Licence

MIT, see [LICENSE](LICENSE). The software Kantahe is built from, and the SoundFont it embeds in releases, are listed with
their licences in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (`scripts/licenses.sh` checks and regenerates it).
