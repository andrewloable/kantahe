#!/usr/bin/env bash
# Runs the phone app's integration test (app/integration_test/flow_test.dart) against a real Kantahe server.
#
#   scripts/flutter-integration.sh <flutter-device-id> [--host HOST] [--bind ADDR] [--test FILE]
#
# <flutter-device-id> is an Android emulator (emulator-5554) or an iOS simulator id (flutter devices).
# HOST is how the device reaches this machine: 10.0.2.2 for an Android emulator (the default), 127.0.0.1 for an
# iOS simulator. --bind is the address the server listens on (default 127.0.0.1, which both an emulator and a
# simulator reach); a real phone needs the LAN address of this machine here and in --host, which opens the
# throwaway server (test passwords) to your network for the length of the run. --test picks another file of
# app/integration_test (default flow_test.dart). The app is started with KANTAHE_NO_DISCOVERY and the server with
# --discovery=false: a device on the same network would otherwise find your real server and skip the address form.
#
# It builds the web app into the server binary (the embedded files are removed again on exit), starts the
# server on a temporary data folder with the synthetic library of kantahe-fixtures, creates a user with curl,
# runs the test, and stops everything. Needs go, node/npm, python3, curl and flutter.
set -euo pipefail

device="${1:?usage: scripts/flutter-integration.sh <flutter-device-id> [--host HOST] [--bind ADDR] [--test FILE]}"
shift
host=10.0.2.2
bind=127.0.0.1
test_file=flow_test.dart
while [ $# -gt 0 ]; do
  case "$1" in
    --host) host="$2"; shift 2 ;;
    --bind) bind="$2"; shift 2 ;;
    --test) test_file="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/kantahe-flutter.XXXXXX")"
port=18090
webdist="$repo/server/internal/webui/dist"
server_pid=""

grep -q 'Web app not built' "$webdist/index.html" ||
  { echo "flutter-integration: $webdist/index.html is not the placeholder page; put it back first" >&2; exit 1; }
cp "$webdist/index.html" "$work/placeholder.html"

restore() { find "$webdist" -mindepth 1 -not -name .gitkeep -delete; cp "$work/placeholder.html" "$webdist/index.html"; }
cleanup() {
  [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null || true
  restore || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "== building the web app and the server"
(cd "$repo/web" && npm run build >/dev/null)
find "$webdist" -mindepth 1 -not -name .gitkeep -delete
cp -R "$repo/web/dist/web/browser/." "$webdist/"
(cd "$repo/server" && CGO_ENABLED=0 go build -o "$work/kantahe" ./cmd/kantahe && CGO_ENABLED=0 go build -o "$work/fixtures" ./cmd/kantahe-fixtures)
restore

"$work/fixtures" -out "$work/library" -mp3 3 -midi 4 -sf2 "$work/test.sf2" >/dev/null
"$work/kantahe" --listen "$bind:$port" --data "$work/data" --library "$work/library" --soundfont "$work/test.sf2" --score-seconds 3 --discovery=false >"$work/server.log" 2>&1 </dev/null &
server_pid=$!
base="http://$bind:$port"
for _ in $(seq 1 60); do
  curl -s --noproxy '*' -m 2 -o /dev/null "$base/healthz" && break
  sleep 0.3
done
curl -s --noproxy '*' -m 2 -o /dev/null "$base/healthz" || { echo "the server did not start:"; tail -5 "$work/server.log"; exit 1; }

echo "== creating a user"
json='content-type: application/json'
token_of() { python3 -c 'import sys,json; print(json.load(sys.stdin)["auth"]["token"])'; }
admin_pw="admin-$RANDOM-$RANDOM"
user_pw="user-$RANDOM-$RANDOM"
admin_token=$(curl -s --noproxy '*' -H "$json" -d "{\"email\":\"admin@example.test\",\"password\":\"$admin_pw\",\"displayName\":\"Admin\",\"deviceName\":\"setup\",\"deviceType\":\"DEVICE_TYPE_WEB\"}" "$base/kantahe.v1.AuthService/Setup" | token_of)
curl -s --noproxy '*' -o /dev/null -H "$json" -H "Authorization: Bearer $admin_token" -d "{\"email\":\"user@example.test\",\"displayName\":\"User\",\"temporaryPassword\":\"$user_pw\"}" "$base/kantahe.v1.AdminService/CreateUser"
# a new user must change the temporary password first: do it once so that the app can sign in at once
user_token=$(curl -s --noproxy '*' -H "$json" -d "{\"email\":\"user@example.test\",\"password\":\"$user_pw\",\"deviceName\":\"prepare\",\"deviceType\":\"DEVICE_TYPE_WEB\"}" "$base/kantahe.v1.AuthService/Login" | token_of)
curl -s --noproxy '*' -o /dev/null -H "$json" -H "Authorization: Bearer $user_token" -d "{\"currentPassword\":\"$user_pw\",\"newPassword\":\"$user_pw-ok\"}" "$base/kantahe.v1.AuthService/ChangePassword"

echo "== running $test_file on $device (server at http://$host:$port)"
cd "$repo/app"
flutter test "integration_test/$test_file" -d "$device" \
  --dart-define="SERVER_URL=http://$host:$port" \
  --dart-define="USER_EMAIL=user@example.test" \
  --dart-define="USER_PASSWORD=$user_pw-ok" \
  --dart-define="KANTAHE_NO_DISCOVERY=true"
