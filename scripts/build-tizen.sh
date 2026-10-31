#!/usr/bin/env bash
# Builds the Samsung TV (Tizen) package of the web app.
#
#   scripts/build-tizen.sh PROFILE        build, then sign and package with the Tizen CLI -> build/tizen/Kantahe.wgt
#   scripts/build-tizen.sh --stage-only   build and assemble build/tizen/ without the CLI (what gets packaged)
#
# PROFILE is the name of the author and distributor certificate profile you made in Tizen Studio's Certificate
# Manager (see docs/tv-samsung.md). Certificates are never part of the repository. KANTAHE_BUILD_DIR moves the
# build folder (default: build/ at the repository root).
set -euo pipefail

usage() { echo "usage: scripts/build-tizen.sh PROFILE | --stage-only" >&2; exit 2; }

profile=""
stage_only=0
for arg in "$@"; do
  case "$arg" in
    --stage-only) stage_only=1 ;;
    -*) usage ;;
    *) [ -z "$profile" ] || usage; profile="$arg" ;;
  esac
done
[ "$stage_only" = 1 ] || [ -n "$profile" ] || usage

# look for the Tizen CLI first: nothing is built for a machine that cannot package it
if [ "$stage_only" = 0 ] && ! command -v tizen >/dev/null 2>&1; then
  echo "build-tizen: the Tizen CLI (tizen) is not on PATH. Install Tizen Studio (or its CLI package) and add" >&2
  echo "<tizen-studio>/tools/ide/bin to PATH; see docs/tv-samsung.md. --stage-only builds without it." >&2
  exit 1
fi

repo="$(cd "$(dirname "$0")/.." && pwd)"
build="${KANTAHE_BUILD_DIR:-$repo/build}"
stage="$build/tizen"

echo "== building the Tizen configuration of the web app"
cd "$repo/web"
[ -d node_modules ] || npm ci
npx ng build --configuration tizen

echo "== assembling $stage"
rm -rf "${stage:?}"
mkdir -p "$stage"
cp -R "$repo/web/dist/tizen/." "$stage/"
cp "$repo/tv/tizen/config.xml" "$repo/tv/tizen/icon.png" "$stage/"

if [ "$stage_only" = 1 ]; then
  echo "staged in $stage (not packaged)"
  exit 0
fi

echo "== signing and packaging with profile $profile"
tizen package -t wgt -s "$profile" -- "$stage"
ls -l "$stage"/*.wgt
