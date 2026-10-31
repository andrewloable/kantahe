#!/usr/bin/env bash
# Starts a release binary and checks that it serves the embedded web app next to the API.
#   scripts/smoke-release.sh dist/kantahe-VERSION-OS-ARCH VERSION
set -euo pipefail
bin=${1:?usage: scripts/smoke-release.sh BINARY VERSION}
version=${2:?usage: scripts/smoke-release.sh BINARY VERSION}
port=${SMOKE_PORT:-18099}

[ "$("$bin" --version)" = "kantahe $version" ] || { echo "smoke: wrong --version output" >&2; exit 1; }

data=$(mktemp -d)
"$bin" --listen "127.0.0.1:$port" --data "$data" 2>"$data/log" &
pid=$!
trap 'kill $pid 2>/dev/null || true; wait $pid 2>/dev/null || true; rm -rf "$data"' EXIT

for _ in $(seq 1 50); do
  curl -fs "http://127.0.0.1:$port/healthz" >/dev/null 2>&1 && break
  kill -0 $pid 2>/dev/null || { cat "$data/log" >&2; echo "smoke: the server exited" >&2; exit 1; }
  sleep 0.2
done
base=http://127.0.0.1:$port

page=$(curl -fs "$base/library")
grep -q '<app-root' <<<"$page" || { echo "smoke: /library is not the web app" >&2; exit 1; }
curl -fs -o /dev/null -w '%{http_code} %{content_type}\n' "$base/" | grep -q '^200 text/html' ||
  { echo "smoke: / is not an HTML page" >&2; exit 1; }
# every hashed file the page names (main, chunks, styles) is cached for good
hashed=$(grep -oE '(main|chunk|styles)-[A-Za-z0-9_-]+\.(js|css)' <<<"$page" | sort -u)
[ -n "$hashed" ] || { echo "smoke: the page names no hashed files" >&2; exit 1; }
for f in $hashed; do
  curl -fsI "$base/$f" | tr -d '\r' | grep -qi '^cache-control: public, max-age=31536000, immutable$' ||
    { echo "smoke: $f is not immutable" >&2; exit 1; }
done
# a stale script name must be a 404, not the page
[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/main-NOSUCHFILE.js")" = 404 ] ||
  { echo "smoke: a missing script was not a 404" >&2; exit 1; }
# the API answers as before (server info is public)
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' \
  "$base/kantahe.v1.AuthService/GetServerInfo")
[ "$code" = 200 ] || { echo "smoke: API answered $code" >&2; exit 1; }
# the embedded SoundFont was written once to the data directory
[ -s "$data/soundfont/default.sf2" ] || { echo "smoke: the default SoundFont was not extracted" >&2; exit 1; }
echo "smoke ok"
