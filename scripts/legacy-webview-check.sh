#!/usr/bin/env bash
# Runs the real player (the Flutter app's player screen with the web player page in the system WebView) on an Android
# emulator whose WebView is old, and fails when the page throws. This is the only check that runs the legacy web build
# (docs/PLAN.md, "Minimum engine") on a real Chromium 74: Playwright cannot, and the syntax scanner does not see a missing
# function or a CSS problem.
#
#   scripts/legacy-webview-check.sh [--build both|modern] [--api 29|35] [--without-polyfills] [--amateur] [--out DIR]
#
#   --build both    (default) the server carries the modern and the legacy build, as a release does; an engine below
#                   Chromium 85 is sent to the legacy one. Expected on --api 29: PASS.
#   --build modern  the server carries the modern build only. Expected on --api 29: FAIL (SyntaxError or the
#                   "browser is too old" message). This is the proof of the problem.
#   --api 29        Android 10 (google_apis image) with the WebView set to Chromium 74 (the AOSP prebuilt, which is
#                   fetched once and cached). --api 35: the stock WebView of the image, to prove that the legacy build
#                   did not break a modern engine (the server hands a modern engine the modern build in both modes).
#   --without-polyfills  strips the polyfill script from the legacy page before it is served: the check must then FAIL
#                   (a missing function in the console). It proves that the check can fail.
#   --amateur       checks amateur singer mode instead of the plain player run: the library gets one song with a vocals track and four lyric
#                   lines, the mode is switched on with the administrator's account, and app/integration_test/amateur_flow_test.dart expects the
#                   app's Vocals button to read "on" by itself in the first two lines and "off" after the third line starts.
#   --out DIR       where the screenshots, logcat and logs go (default: a new folder in the temp folder; printed).
#
# It creates the AVD kantahe_api<N> if it is missing (it touches no other AVD), builds the web app (both builds) into the
# server binary (the embedded files are put back on exit), starts the server on a temporary data folder with the synthetic
# library of kantahe-fixtures, runs app/integration_test/player_flow_test.dart on the emulator, and shuts everything down.
# Needs: the Android SDK (emulator, platform-tools, cmdline-tools, build-tools), the system image for the API, go, node/npm,
# python3, curl and flutter. The machine's arm64 images are used (Apple silicon); set ABI=x86_64 for an Intel machine.
set -euo pipefail

build=both
api=29
out=""
no_polyfills=""
amateur=""
while [ $# -gt 0 ]; do
  case "$1" in
    --build) build="$2"; shift 2 ;;
    --api) api="$2"; shift 2 ;;
    --without-polyfills) no_polyfills=1; shift ;;
    --amateur) amateur=1; shift ;;
    --out) out="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
case "$build" in both | modern) ;; *) echo "--build is both or modern" >&2; exit 2 ;; esac
case "$api" in 29 | 35) ;; *) echo "--api is 29 or 35" >&2; exit 2 ;; esac

repo="$(cd "$(dirname "$0")/.." && pwd)"
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
abi="${ABI:-arm64-v8a}"
avd="kantahe_api$api"
emu_port="${EMU_PORT:-5580}"
serial="emulator-$emu_port"
server_port="${SERVER_PORT:-18097}"
work="$(mktemp -d "${TMPDIR:-/tmp}/kantahe-legacy.XXXXXX")"
[ -n "$out" ] || out="$work/out"
mkdir -p "$out"
cache="${KANTAHE_CHECK_CACHE:-$HOME/.cache/kantahe-legacy-check}"
webdist="$repo/server/internal/webui/dist"
legacydist="$repo/server/internal/webui/dist-legacy"
adb="$sdk/platform-tools/adb"
server_pid=""
emu_pid=""
logcat_pid=""
shots_pid=""

step() { echo "== $*"; }
die() { echo "legacy-webview-check: $*" >&2; exit 1; }

for tool in go npm python3 curl flutter; do command -v "$tool" >/dev/null || die "$tool is not installed"; done
for f in "$adb" "$sdk/emulator/emulator" "$sdk/cmdline-tools/latest/bin/avdmanager"; do [ -x "$f" ] || die "$f is missing (Android SDK)"; done
grep -q 'Web app not built' "$webdist/index.html" || die "$webdist/index.html is not the placeholder page; put it back first"
[ -z "$(find "$legacydist" -mindepth 1 -not -name .gitkeep)" ] || die "$legacydist holds files; put it back to the .gitkeep only first"
cp "$webdist/index.html" "$work/placeholder.html"

restore() {
  find "$webdist" -mindepth 1 -not -name .gitkeep -delete
  cp "$work/placeholder.html" "$webdist/index.html"
  find "$legacydist" -mindepth 1 -not -name .gitkeep -delete
}
# shellcheck disable=SC2329 # called by the EXIT trap
cleanup() {
  for p in "$shots_pid" "$logcat_pid" "$server_pid"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
  if [ -n "$emu_pid" ]; then
    "$adb" -s "$serial" emu kill >/dev/null 2>&1 || true
    sleep 2
    kill "$emu_pid" 2>/dev/null || true
  fi
  restore || true
  # the binaries, the library and the data go; the results stay when they were put inside the work folder
  rm -rf "$work/kantahe" "$work/fixtures" "$work/library" "$work/data" "$work/test.sf2" "$work/placeholder.html"
  rmdir "$work" 2>/dev/null || true
}
trap cleanup EXIT

# --- 1. the AVD and the emulator --------------------------------------------------------------------------------------
step "emulator $avd (API $api)"
if ! "$sdk/emulator/emulator" -list-avds | grep -qx "$avd"; then
  echo "creating the AVD $avd"
  echo no | "$sdk/cmdline-tools/latest/bin/avdmanager" create avd -n "$avd" -k "system-images;android-$api;google_apis;$abi" -d tv_1080p >/dev/null
fi
"$sdk/emulator/emulator" -avd "$avd" -no-window -no-audio -no-snapshot -no-boot-anim -port "$emu_port" >"$out/emulator.log" 2>&1 </dev/null &
emu_pid=$!
booted=""
for _ in $(seq 1 100); do
  [ "$("$adb" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && { booted=1; break; }
  sleep 3
done
[ -n "$booted" ] || die "the emulator did not boot (see $out/emulator.log)"

# --- 2. the WebView ---------------------------------------------------------------------------------------------------
webview_info() { "$adb" -s "$serial" shell dumpsys webviewupdate | tr -d '\r' | grep 'Current WebView package' || true; }
if [ "$api" = 29 ]; then
  step "WebView 74"
  if ! webview_info | grep -q 'com.android.webview, 74\.'; then
    apk="$cache/aosp-android10-arm64-webview.apk"
    if [ ! -s "$apk" ]; then
      mkdir -p "$cache"
      curl -fsS "https://android.googlesource.com/platform/external/chromium-webview/+/refs/heads/android10-release/prebuilt/arm64/webview.apk?format=TEXT" |
        python3 -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' >"$apk.part"
      mv "$apk.part" "$apk"
    fi
    "$adb" -s "$serial" install -r "$apk" >/dev/null
    "$adb" -s "$serial" shell cmd webviewupdate set-webview-implementation com.android.webview >/dev/null
  fi
  webview_info | grep -q 'com.android.webview, 74\.' || die "the emulator's WebView is not 74: $(webview_info)"
fi
webview_info | tee "$out/webview.txt"

# --- 3. the web app and the server -----------------------------------------------------------------------------------
step "building the web app ($build) and the server"
(cd "$repo/web" && npm run build >/dev/null)
cp -R "$repo/web/dist/web/browser/." "$webdist/"
if [ "$build" = both ]; then
  (cd "$repo/web" && npm run build:legacy >/dev/null)
  cp -R "$repo/web/dist/web-legacy/browser/." "$legacydist/"
  if [ -n "$no_polyfills" ]; then
    grep -q '<script src="legacy-polyfills.js"></script>' "$legacydist/index.html" || die "the legacy page has no polyfill script to strip"
    sed -i.bak 's|<script src="legacy-polyfills.js"></script>||' "$legacydist/index.html" && rm "$legacydist/index.html.bak"
  fi
fi
(cd "$repo/server" && CGO_ENABLED=0 go build -o "$work/kantahe" ./cmd/kantahe && CGO_ENABLED=0 go build -o "$work/fixtures" ./cmd/kantahe-fixtures)
restore

guide_number=90
guide_args=()
[ -z "$amateur" ] || guide_args=(-guide "$guide_number")
"$work/fixtures" -out "$work/library" -mp3 3 -midi 4 -sf2 "$work/test.sf2" ${guide_args[@]+"${guide_args[@]}"} >/dev/null
"$work/kantahe" --listen "127.0.0.1:$server_port" --data "$work/data" --library "$work/library" --soundfont "$work/test.sf2" --score-seconds 3 --discovery=false >"$out/server.log" 2>&1 </dev/null &
server_pid=$!
base="http://127.0.0.1:$server_port"
for _ in $(seq 1 60); do curl -s --noproxy '*' -m 2 -o /dev/null "$base/healthz" && break; sleep 0.3; done
curl -s --noproxy '*' -m 2 -o /dev/null "$base/healthz" || die "the server did not start: $(tail -5 "$out/server.log")"

# what the server hands each engine: an old Chromium is sent to the legacy build, a current one is not
ua_old='Mozilla/5.0 (Linux; Android 10; TV; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.186 Safari/537.36'
ua_new='Mozilla/5.0 (Linux; Android 14; TV; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/113.0.5672.136 Safari/537.36'
redirect_of() { curl -s --noproxy '*' -o /dev/null -A "$1" -w '%{redirect_url}' "$base/embed/player"; }
if [ "$build" = both ]; then
  [ "$(redirect_of "$ua_old")" = "$base/legacy/embed/player" ] || die "Chromium 74 was not sent to /legacy/embed/player (got: $(redirect_of "$ua_old"))"
  [ -z "$(redirect_of "$ua_new")" ] || die "Chromium 113 was redirected to $(redirect_of "$ua_new")"
fi

step "creating a throw-away user"
json='content-type: application/json'
token_of() { python3 -c 'import sys,json; print(json.load(sys.stdin)["auth"]["token"])'; }
admin_pw="admin-$RANDOM-$RANDOM"
user_pw="user-$RANDOM-$RANDOM"
admin_token=$(curl -s --noproxy '*' -H "$json" -d "{\"email\":\"admin@example.test\",\"password\":\"$admin_pw\",\"displayName\":\"Admin\",\"deviceName\":\"setup\",\"deviceType\":\"DEVICE_TYPE_WEB\"}" "$base/kantahe.v1.AuthService/Setup" | token_of)
curl -s --noproxy '*' -o /dev/null -H "$json" -H "Authorization: Bearer $admin_token" -d "{\"email\":\"user@example.test\",\"displayName\":\"User\",\"temporaryPassword\":\"$user_pw\"}" "$base/kantahe.v1.AdminService/CreateUser"
user_token=$(curl -s --noproxy '*' -H "$json" -d "{\"email\":\"user@example.test\",\"password\":\"$user_pw\",\"deviceName\":\"prepare\",\"deviceType\":\"DEVICE_TYPE_WEB\"}" "$base/kantahe.v1.AuthService/Login" | token_of)
curl -s --noproxy '*' -o /dev/null -H "$json" -H "Authorization: Bearer $user_token" -d "{\"currentPassword\":\"$user_pw\",\"newPassword\":\"$user_pw-ok\"}" "$base/kantahe.v1.AuthService/ChangePassword"

# --- 4. the run -------------------------------------------------------------------------------------------------------
test_file=player_flow_test.dart
test_defines=()
if [ -n "$amateur" ]; then
  curl -s --noproxy '*' -o /dev/null -H "$json" -H "Authorization: Bearer $admin_token" -d '{"amateurMode":true}' "$base/kantahe.v1.AdminService/UpdateServerSettings"
  curl -s --noproxy '*' -H "$json" -H "Authorization: Bearer $admin_token" -d '{}' "$base/kantahe.v1.AdminService/GetServerSettings" | grep -Eq '"amateurMode": ?true' || die "amateur singer mode was not switched on"
  test_file=amateur_flow_test.dart
  test_defines=(--dart-define="GUIDE_NUMBER=$(printf %05d "$guide_number")")
fi
step "running the player on the emulator (build $build, server at http://10.0.2.2:$server_port)"
"$adb" -s "$serial" logcat -c
"$adb" -s "$serial" logcat -v time >"$out/logcat.txt" 2>&1 &
logcat_pid=$!
disown "$logcat_pid" # so that the shell does not print "Terminated" when it is stopped
( # a screenshot every 3 seconds for at most 5 minutes: the idle player, a song playing, the lyrics, the score
  for i in $(seq 1 100); do
    sleep 3
    "$adb" -s "$serial" exec-out screencap -p >"$out/shot-$(printf %02d "$i").png" 2>/dev/null || true
  done
) &
shots_pid=$!
disown "$shots_pid"

test_ok=1
(cd "$repo/app" && flutter test "integration_test/$test_file" -d "$serial" \
  --dart-define="SERVER_URL=http://10.0.2.2:$server_port" \
  --dart-define="USER_EMAIL=user@example.test" \
  --dart-define="USER_PASSWORD=$user_pw-ok" \
  --dart-define="KANTAHE_NO_DISCOVERY=true" ${test_defines[@]+"${test_defines[@]}"}) >"$out/flutter-test.log" 2>&1 || test_ok=""
kill "$shots_pid" 2>/dev/null || true
shots_pid=""
kill "$logcat_pid" 2>/dev/null || true
logcat_pid=""

# --- 5. the verdict ---------------------------------------------------------------------------------------------------
# What the page printed to the console. A WebView writes it to logcat under the tag "chromium".
errors="$(grep -E 'chromium' "$out/logcat.txt" | grep -E 'CONSOLE' | grep -E 'Uncaught|SyntaxError|ReferenceError|TypeError|is not a function|is not defined' || true)"
tail -15 "$out/flutter-test.log"
echo
echo "screenshots, logcat and logs: $out"
if [ -n "$errors" ]; then
  echo "console errors of the page:"
  echo "$errors" | head -20
fi
if [ -n "$test_ok" ] && [ -z "$errors" ]; then
  echo "PASS: ${amateur:+amateur singer mode: the guide vocals followed the window; }the player played its songs on $(sed 's/^ *//' "$out/webview.txt")"
  exit 0
fi
echo "FAIL: build $build on API $api (test passed: ${test_ok:-no}; console errors: $(echo -n "$errors" | grep -c . || true))"
exit 1
