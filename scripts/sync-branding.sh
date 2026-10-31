#!/usr/bin/env bash
# Copies the logo exports of branding/export/ to where each client expects them. Idempotent: a second run changes nothing.
#
#   scripts/sync-branding.sh            copy the files
#   scripts/sync-branding.sh --flutter  also regenerate the Flutter launcher icons and native splash from the copies
#
# The exports come from `python3 branding/build.py` (edit logo shapes there, never in generated files); this script
# does not run it, so it needs neither Chrome nor ImageMagick. KANTAHE_EXPORT_DIR points at another export folder.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
ex="${KANTAHE_EXPORT_DIR:-$repo/branding/export}"
if [ ! -f "$ex/icon-1024.png" ]; then
  echo "sync-branding: no logo exports in $ex: run python3 branding/build.py first" >&2
  exit 1
fi

copy() { # copy EXPORT_NAME DESTINATION (relative to the repository)
  local src="$ex/$1" dst="$repo/$2"
  [ -f "$src" ] || { echo "sync-branding: $src is missing: run python3 branding/build.py" >&2; exit 1; }
  mkdir -p "$(dirname "$dst")"
  cmp -s "$src" "$dst" || cp "$src" "$dst"
}

# web app: favicons, the home-screen icon, and the icons of manifest.webmanifest
for f in favicon.ico favicon.svg apple-touch-icon.png icon-192.png icon-512.png maskable-192.png maskable-512.png; do
  copy "$f" "web/public/$f"
done

# Flutter app: launcher icon (iOS wants a full square without alpha, Android an adaptive foreground) and the splash image
copy icon-1024.png app/assets/branding/icon.png
copy icon-ios-1024.png app/assets/branding/icon-ios.png
copy maskable-512.png app/assets/branding/icon-adaptive.png
copy icon-512.png app/assets/branding/splash.png
copy tv-banner-320x180.png app/android/app/src/main/res/drawable-xhdpi/tv_banner.png

# TV packages
copy icon-512.png tv/tizen/icon.png
copy icon-80.png tv/webos/icon-80.png
copy icon-130.png tv/webos/icon-130.png

if [ "${1:-}" = "--flutter" ]; then
  cd "$repo/app"
  dart run flutter_launcher_icons
  dart run flutter_native_splash:create
fi
echo "sync-branding: done"
