#!/usr/bin/env bash
# Copies the logo exports of branding/export/ to where each client expects them. Idempotent: a second run changes nothing.
#
#   scripts/sync-branding.sh            copy the files, and put the splash logo into web/src/index.html
#   scripts/sync-branding.sh --check    change nothing; exit 1 when web/src/index.html does not hold exactly the splash logo that
#                                       branding/kantahe-splash-logo.svg gives (the drift test of the web app uses it)
#   scripts/sync-branding.sh --flutter  also regenerate the Flutter launcher icons and native splash from the copies
#
# The exports come from `python3 branding/build.py` (edit logo shapes there, never in generated files); this script
# does not run it, so it needs neither Chrome nor ImageMagick. KANTAHE_EXPORT_DIR points at another export folder.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
ex="${KANTAHE_EXPORT_DIR:-$repo/branding/export}"

# The splash logo is plain inline SVG in index.html, so that it paints before any script or image arrives. The block between the two
# markers is branding/kantahe-splash-logo.svg with every id prefixed by "splash-" (nothing else is changed), so that the ids cannot
# clash with another inline SVG. $1 is "write" or "check".
splash() {
  python3 - "$repo" "$1" <<'PY'
import pathlib, re, sys

repo, mode = pathlib.Path(sys.argv[1]), sys.argv[2]
svg = (repo / "branding" / "kantahe-splash-logo.svg").read_text().strip()
svg = re.sub(r'(?<![\w-])id="([^"]+)"', r'id="splash-\1"', svg)
svg = re.sub(r'url\(#([^)]+)\)', r'url(#splash-\1)', svg)
svg = re.sub(r'href="#([^"]+)"', r'href="#splash-\1"', svg)
page = repo / "web" / "src" / "index.html"
html = page.read_text()
begin, end = "<!-- brand-splash:begin -->", "<!-- brand-splash:end -->"
m = re.search(r'^([ \t]*)' + re.escape(begin) + r'.*?' + re.escape(end), html, re.S | re.M)
if not m:
    sys.exit("sync-branding: web/src/index.html has no brand-splash markers")
indent = m.group(1)
block = indent + begin + "\n" + "\n".join(indent + line if line else line for line in svg.splitlines()) + "\n" + indent + end
wanted = html[: m.start()] + block + html[m.end():]
if wanted == html:
    sys.exit(0)
if mode == "check":
    sys.exit("sync-branding: web/src/index.html does not hold the current splash logo: run scripts/sync-branding.sh")
page.write_text(wanted)
PY
}

if [ "${1:-}" = "--check" ]; then
  splash check
  echo "sync-branding: the splash in web/src/index.html is current"
  exit 0
fi
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
copy splash-logo.png app/assets/branding/splash-logo.png # the official splash logo: tile and wordmark (the Flutter splash shows it)
copy splash-logo-960.png app/assets/branding/splash-logo-native.png # the same at the size of the native splash before Android 12 (240 dp)
copy splash-android12-1152.png app/assets/branding/splash-android12.png # Android 12 shows the tile alone, in a circle
copy tv-banner-320x180.png app/android/app/src/main/res/drawable-xhdpi/tv_banner.png

# TV packages
copy icon-512.png tv/tizen/icon.png
copy icon-80.png tv/webos/icon-80.png
copy icon-130.png tv/webos/icon-130.png

splash write

if [ "${1:-}" = "--flutter" ]; then
  cd "$repo/app"
  dart run flutter_launcher_icons
  dart run flutter_native_splash:create
fi
echo "sync-branding: done"
