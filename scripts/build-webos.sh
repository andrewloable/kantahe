#!/usr/bin/env bash
# Builds the LG TV (webOS) package of the web app.
#
#   scripts/build-webos.sh               build, then package with the webOS CLI -> dist/com.loabletech.kantahe_VERSION_all.ipk
#   scripts/build-webos.sh --stage-only  build and assemble build/webos/ without the CLI (what gets packaged)
#
# KANTAHE_BUILD_DIR moves the build folder (default: build/ at the repository root), KANTAHE_DIST_DIR the folder
# the package is written to (default: dist/). Nothing here needs, reads or stores a device key.
set -euo pipefail

usage() { echo "usage: scripts/build-webos.sh [--stage-only]" >&2; exit 2; }

stage_only=0
for arg in "$@"; do
  case "$arg" in
    --stage-only) stage_only=1 ;;
    *) usage ;;
  esac
done

# look for the webOS CLI first: nothing is built for a machine that cannot package it
if [ "$stage_only" = 0 ] && ! command -v ares-package >/dev/null 2>&1; then
  echo "build-webos: the webOS TV CLI (ares-package) is not on PATH. Install it with" >&2
  echo "'npm install -g @webos-tools/cli' (see docs/tv-lg.md). --stage-only builds without it." >&2
  exit 1
fi

repo="$(cd "$(dirname "$0")/.." && pwd)"
build="${KANTAHE_BUILD_DIR:-$repo/build}"
dist="${KANTAHE_DIST_DIR:-$repo/dist}"
stage="$build/webos"

echo "== building the webOS configuration of the web app"
cd "$repo/web"
[ -d node_modules ] || npm ci
npx ng build --configuration webos

echo "== assembling $stage"
rm -rf "${stage:?}"
mkdir -p "$stage"
cp -R "$repo/web/dist/webos/." "$stage/"
cp "$repo/tv/webos/appinfo.json" "$repo/tv/webos/icon-80.png" "$repo/tv/webos/icon-130.png" "$stage/"
python3 "$repo/scripts/check-webos-appinfo.py" "$stage/appinfo.json"

if [ "$stage_only" = 1 ]; then
  echo "staged in $stage (not packaged)"
  exit 0
fi

echo "== packaging"
mkdir -p "$dist"
ares-package "$stage" -o "$dist"
ls -l "$dist"/*.ipk
