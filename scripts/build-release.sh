#!/usr/bin/env bash
# Builds the release binaries with the web app and the default SoundFont embedded.
#   scripts/build-release.sh VERSION      e.g. v0.1.0
# Writes dist/kantahe-VERSION-OS-ARCH[.exe] for linux, darwin and windows on amd64 and arm64, and
# dist/SHA256SUMS. Needs go, node/npm, curl. The embedded files are removed again on exit so the
# working tree stays clean (the placeholder page is put back).
set -euo pipefail

version=${1:?usage: scripts/build-release.sh VERSION}
[[ $version =~ ^[A-Za-z0-9._-]+$ ]] || { echo "build-release: bad version '$version'" >&2; exit 2; }

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
webdist=server/internal/webui/dist
fontdir=server/internal/assets/soundfont

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
lock() { sed -n "s/^$1=//p" scripts/soundfont.lock; }

placeholder=$(mktemp)
grep -q 'Web app not built' "$webdist/index.html" ||
  { echo "build-release: $webdist/index.html is not the placeholder page; put it back first" >&2; exit 1; }
cp "$webdist/index.html" "$placeholder"
clean() {
  find "$webdist" -mindepth 1 -not -name .gitkeep -delete
  find "$fontdir" -mindepth 1 -name '*.sf2' -delete
  cp "$placeholder" "$webdist/index.html"
  rm -f "$placeholder"
}
trap clean EXIT

echo "== SoundFont"
want=$(lock SHA256)
cache=${XDG_CACHE_HOME:-$HOME/.cache}/kantahe-build
mkdir -p "$cache"
font=$cache/GeneralUser-GS-$want.sf2
got=
[ -f "$font" ] && got=$(sha256 "$font" | cut -d' ' -f1)
if [ "$got" != "$want" ]; then
  curl -fsSL -o "$font.part" "$(lock URL)"
  got=$(sha256 "$font.part" | cut -d' ' -f1)
  if [ "$got" != "$want" ]; then
    rm -f "$font.part"
    echo "build-release: SoundFont checksum mismatch (got $got, want $want)" >&2
    exit 1
  fi
  mv "$font.part" "$font"
fi
cp "$font" "$fontdir/GeneralUser-GS.sf2"

echo "== web app"
(cd web && npm ci && npx ng build)
find "$webdist" -mindepth 1 -not -name .gitkeep -delete
cp -R web/dist/web/browser/. "$webdist/"
[ -f "$webdist/index.html" ] && ! grep -q 'Web app not built' "$webdist/index.html" ||
  { echo "build-release: the web build produced no index.html" >&2; exit 1; }

echo "== binaries"
mkdir -p dist
rm -f "dist/kantahe-$version-"* dist/SHA256SUMS
for os in linux darwin windows; do
  for arch in amd64 arm64; do
    ext=; [ "$os" = windows ] && ext=.exe
    out=../dist/kantahe-$version-$os-$arch$ext
    echo "$out"
    (cd server && CGO_ENABLED=0 GOOS=$os GOARCH=$arch go build -trimpath \
      -ldflags "-s -w -X main.version=$version" -o "$out" ./cmd/kantahe)
  done
done
(cd dist && sha256 "kantahe-$version-"* > SHA256SUMS)
ls -l dist
