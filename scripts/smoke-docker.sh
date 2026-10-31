#!/usr/bin/env bash
# Runs a built image and checks it end to end.
#   scripts/smoke-docker.sh IMAGE VERSION [PLATFORM]       e.g. kantahe:test v0.0.0-test linux/arm64
set -euo pipefail
image=${1:?usage: scripts/smoke-docker.sh IMAGE VERSION [PLATFORM]}
version=${2:?usage: scripts/smoke-docker.sh IMAGE VERSION [PLATFORM]}
platform=${3:-}
port=${SMOKE_PORT:-18097}
# ${plat[@]+...} below: an empty array is an unbound variable in the bash 3.2 of macOS
plat=(); [ -n "$platform" ] && plat=(--platform "$platform")

name=kantahe-smoke-$$
vol=$name-data
tmp=$(mktemp -d)
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$vol" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

rpc() { curl -fsS -H 'Content-Type: application/json' -d "$2" "http://127.0.0.1:$port/kantahe.v1.AuthService/$1"; }
start() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d ${plat[@]+"${plat[@]}"} --name "$name" -p "127.0.0.1:$port:8080" -v "$vol:/data" "$image" >/dev/null
  for _ in $(seq 1 60); do
    curl -fs "http://127.0.0.1:$port/healthz" >/dev/null 2>&1 && return 0
    [ "$(docker inspect -f '{{.State.Running}}' "$name")" = true ] || break
    sleep 0.5
  done
  docker logs "$name" >&2
  echo "smoke: the container did not become healthy" >&2
  exit 1
}

[ "$(docker run --rm ${plat[@]+"${plat[@]}"} "$image" --version)" = "kantahe $version" ] ||
  { echo "smoke: wrong --version output" >&2; exit 1; }
user=$(docker inspect -f '{{.Config.User}}' "$image")
case $user in 65532 | 65532:* | nonroot | nonroot:*) ;; *) echo "smoke: the image runs as '$user', not as the unprivileged user" >&2; exit 1 ;; esac

docker volume create "$vol" >/dev/null
start
[ "$(curl -fs "http://127.0.0.1:$port/healthz")" = ok ] || { echo "smoke: healthz is not ok" >&2; exit 1; }
rpc GetServerInfo '{}' | grep -Eq '"setupRequired": ?true' || { echo "smoke: a new server must require setup" >&2; exit 1; }
curl -fs "http://127.0.0.1:$port/library" | grep -q '<app-root' || { echo "smoke: the web app is not served" >&2; exit 1; }
docker cp "$name:/data/soundfont/default.sf2" "$tmp/default.sf2"
[ "$(wc -c <"$tmp/default.sf2")" -gt 1000000 ] || { echo "smoke: the default SoundFont was not extracted" >&2; exit 1; }

rpc Setup '{"email":"admin@example.com","password":"correct horse battery staple","displayName":"Admin","deviceName":"smoke","deviceType":"DEVICE_TYPE_WEB"}' >/dev/null ||
  { echo "smoke: Setup failed" >&2; exit 1; }

# the data lives in the volume: a new container with the same volume is already set up
start
if rpc GetServerInfo '{}' | grep -Eq '"setupRequired": ?true'; then
  echo "smoke: the account did not survive a restart; is --data /data in CMD?" >&2
  exit 1
fi
echo "smoke ok ($image${platform:+, $platform})"
