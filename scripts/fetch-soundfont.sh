#!/usr/bin/env bash
# Puts the default SoundFont (GeneralUser GS, pinned in scripts/soundfont.lock) where a server build embeds it, so that every binary
# carries it and MIDI songs can be played with no --soundfont. Called by scripts/build-release.sh and by `go generate ./internal/assets`.
#   scripts/fetch-soundfont.sh [DEST_DIR]     default: server/internal/assets/soundfont (git-ignored)
# The download is cached under ${XDG_CACHE_HOME:-$HOME/.cache}/kantahe-build and checked against the SHA-256 of the lock file; a file already
# in DEST_DIR with that checksum is left alone. Needs curl. KANTAHE_SOUNDFONT_LOCK names another lock file (the tests use it).
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
dest=${1:-$root/server/internal/assets/soundfont}
lockfile=${KANTAHE_SOUNDFONT_LOCK:-$root/scripts/soundfont.lock}

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
lock() { sed -n "s/^$1=//p" "$lockfile"; }

want=$(lock SHA256)
[ -n "$want" ] || { echo "fetch-soundfont: no SHA256 in $lockfile" >&2; exit 2; }
target=$dest/GeneralUser-GS.sf2
if [ -f "$target" ] && [ "$(sha256 "$target" | cut -d' ' -f1)" = "$want" ]; then
  echo "SoundFont already in place: $target"
  exit 0
fi

cache=${XDG_CACHE_HOME:-$HOME/.cache}/kantahe-build
mkdir -p "$cache" "$dest"
font=$cache/GeneralUser-GS-$want.sf2
got=
[ -f "$font" ] && got=$(sha256 "$font" | cut -d' ' -f1)
if [ "$got" != "$want" ]; then
  # one network blip must not fail a build: retry 3 times (BUILD_RELEASE_RETRY_DELAY seconds apart, 5 by default; the tests set 1; 0 would mean
  # curl's own backoff), also on connection errors, and never wait more than 5 minutes for the file. The checksum below is checked as ever
  curl -fsSL --retry 3 --retry-delay "${BUILD_RELEASE_RETRY_DELAY:-5}" --retry-all-errors --max-time 300 -o "$font.part" "$(lock URL)"
  got=$(sha256 "$font.part" | cut -d' ' -f1)
  if [ "$got" != "$want" ]; then
    rm -f "$font.part"
    echo "fetch-soundfont: SoundFont checksum mismatch (got $got, want $want)" >&2
    exit 1
  fi
  mv "$font.part" "$font"
fi
cp "$font" "$target"
echo "SoundFont put in place: $target"
