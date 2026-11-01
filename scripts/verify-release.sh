#!/usr/bin/env bash
# Checks a PUBLISHED release: what users download from the GitHub release page and pull from ghcr.io, not the files of a local build.
#
#   scripts/verify-release.sh TAG [--strict] [--no-docker]
#   scripts/verify-release.sh TAG --from-dir DIR [--image IMAGE] [--latest-image IMAGE] [--platforms "linux/amd64 ..."] [--strict]
#
# 1. The release is not a draft, is marked pre-release exactly when TAG has a "-", and has exactly the 7 files of the build:
#    kantahe-TAG-{linux,darwin,windows}-{amd64,arm64}[.exe] and SHA256SUMS (a missing or an unexpected file fails).
# 2. SHA256SUMS lists exactly the six binaries, and the documented command (docs/install.md) passes on the download.
# 3. The binary of this machine passes scripts/smoke-release.sh; on Linux/amd64 the linux-arm64 binary runs under qemu-user when that exists.
# 4. The image ghcr.io/andrewloable/kantahe:TAG, for linux/amd64 and linux/arm64, passes scripts/smoke-docker.sh.
# 5. :latest has the digest of :TAG for a version without "-", and has NOT moved to it for a pre-release.
#
# Reads only: gh release view/download and docker pull; it never changes a release or an image. A check that cannot run here (no Docker,
# no qemu, a platform without a binary) is reported as "skipped"; --strict makes a skip a failure (the verify job of release.yml uses it).
# Test mode: --from-dir takes the downloaded files from DIR instead of GitHub, --image names a local image instead of the ghcr one and
# --latest-image the image that stands for :latest (without it step 5 is skipped).
# VERIFY_SMOKE_BINARY and VERIFY_SMOKE_IMAGE name other programs for scripts/smoke-release.sh and scripts/smoke-docker.sh, VERIFY_MACHINE
# (for example linux-amd64) the machine type, and VERIFY_BINFMT_QEMU the kernel's qemu-aarch64 handler file (the tests set all of them).
# Needs bash 3.2 or newer (the one of macOS is enough), gh (unless --from-dir), curl, and docker for steps 4 and 5.
set -uo pipefail
export LC_ALL=C # one sort order for sort and comm

usage() { sed -n '2,/^# Needs bash/p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

tag=""
from_dir=""
image=""
latest_image=""
platforms="linux/amd64 linux/arm64"
strict=0
docker_wanted=1
while [ $# -gt 0 ]; do
  case "$1" in
    --from-dir) from_dir="${2:?--from-dir needs a folder}"; shift 2 ;;
    --image) image="${2:?--image needs an image}"; shift 2 ;;
    --latest-image) latest_image="${2:?--latest-image needs an image}"; shift 2 ;;
    --platforms) platforms="${2:?--platforms needs a list}"; shift 2 ;;
    --strict) strict=1; shift ;;
    --no-docker) docker_wanted=0; shift ;;
    -h | --help) usage 0 ;;
    -*) echo "verify-release: unknown option: $1" >&2; usage 2 ;;
    *) [ -z "$tag" ] || { echo "verify-release: one tag only" >&2; exit 2; }; tag="$1"; shift ;;
  esac
done
[ -n "$tag" ] || usage 2
[[ $tag =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo "verify-release: '$tag' is not a version tag" >&2; exit 2; }

repo=$(cd "$(dirname "$0")/.." && pwd)
repo_image=ghcr.io/andrewloable/kantahe
smoke_binary_script="${VERIFY_SMOKE_BINARY:-$repo/scripts/smoke-release.sh}"
smoke_image_script="${VERIFY_SMOKE_IMAGE:-$repo/scripts/smoke-docker.sh}"
[ -n "$image" ] || image="$repo_image:$tag"
if [ -z "$from_dir" ]; then latest_image="$repo_image:latest"; fi
prerelease=false
case $tag in *-*) prerelease=true ;; esac

fails=0
skips=0
pass() { echo "ok:       $*"; }
fail() { echo "FAILED:   $*" >&2; fails=$((fails + 1)); }
skip() { echo "skipped:  $*"; skips=$((skips + 1)); }
have() { command -v "$1" >/dev/null 2>&1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
dl="$tmp/download"

# the seven files a release must have
expected="$tmp/expected"
: >"$expected"
for os in linux darwin windows; do
  for arch in amd64 arm64; do
    ext=""
    [ "$os" = windows ] && ext=".exe"
    echo "kantahe-$tag-$os-$arch$ext" >>"$expected"
  done
done
echo SHA256SUMS >>"$expected"
sort -o "$expected" "$expected"

# --- 1. the release and its files
echo "== the release $tag"
if [ -n "$from_dir" ]; then
  [ -d "$from_dir" ] || { echo "verify-release: $from_dir is not a folder" >&2; exit 2; }
  cp -R "$from_dir" "$dl"
  (cd "$dl" && find . -maxdepth 1 -type f | sed 's|^\./||' | sort) >"$tmp/actual"
else
  have gh || { echo "verify-release: gh is needed to read the release" >&2; exit 2; }
  info=$(gh release view "$tag" --json isDraft,isPrerelease --jq '"\(.isDraft) \(.isPrerelease)"') ||
    { echo "verify-release: the release $tag cannot be read" >&2; exit 1; }
  read -r is_draft is_pre <<<"$info"
  if [ "$is_draft" = false ]; then pass "the release is published, not a draft"; else fail "the release is still a draft"; fi
  if [ "$is_pre" = "$prerelease" ]; then pass "pre-release flag is $is_pre, as for $tag"; else fail "the release is marked pre-release=$is_pre, but $tag needs $prerelease"; fi
  gh release view "$tag" --json assets --jq '.assets[].name' | sort >"$tmp/actual"
  mkdir -p "$dl"
  gh release download "$tag" -D "$dl" >/dev/null || fail "the files cannot be downloaded"
fi
missing=$(comm -23 "$expected" "$tmp/actual")
extra=$(comm -13 "$expected" "$tmp/actual")
if [ -z "$missing" ] && [ -z "$extra" ]; then
  pass "exactly the 7 expected files are on the release"
else
  for f in $missing; do fail "the file $f is missing from the release"; done
  for f in $extra; do fail "the release has an unexpected file: $f"; done
fi

# --- 2. checksums
echo "== checksums"
if [ ! -f "$dl/SHA256SUMS" ]; then
  fail "SHA256SUMS is not there to check anything"
else
  listed=$(awk '{print $2}' "$dl/SHA256SUMS" | sed 's/^\*//' | sort)
  want=$(grep -v '^SHA256SUMS$' "$expected")
  if [ "$listed" = "$want" ]; then
    pass "SHA256SUMS lists exactly the six binaries"
  else
    fail "SHA256SUMS does not list exactly the six binaries (listed: $(echo "$listed" | tr '\n' ' '))"
  fi
  # the command of docs/install.md, as written there
  if grep -qF 'sha256sum -c --ignore-missing SHA256SUMS' "$repo/docs/install.md"; then
    pass "docs/install.md still shows the checksum command used here"
  else
    fail "docs/install.md no longer shows 'sha256sum -c --ignore-missing SHA256SUMS': update this script and the document together"
  fi
  if have sha256sum; then
    if (cd "$dl" && sha256sum -c --ignore-missing SHA256SUMS) >"$tmp/sum.log" 2>&1; then
      pass "sha256sum -c --ignore-missing SHA256SUMS"
    else
      cat "$tmp/sum.log" >&2
      fail "a downloaded file does not match SHA256SUMS"
    fi
  elif have shasum; then
    if (cd "$dl" && shasum -a 256 -c SHA256SUMS) >"$tmp/sum.log" 2>&1; then
      pass "shasum -a 256 -c SHA256SUMS (this machine has no sha256sum)"
    else
      cat "$tmp/sum.log" >&2
      fail "a downloaded file does not match SHA256SUMS"
    fi
  else
    skip "no sha256sum or shasum on this machine"
  fi
fi

# the image that docs/install.md and deploy/compose.yaml tell users to pull is the one checked below
if grep -qF "image: $repo_image:latest" "$repo/deploy/compose.yaml" 2>/dev/null; then
  pass "deploy/compose.yaml pulls $repo_image:latest, the image checked below"
else
  fail "deploy/compose.yaml does not use $repo_image:latest: update this script and the file together"
fi

# --- 3. the binary of this machine
echo "== the binary"
case "${VERIFY_MACHINE:-$(uname -s)-$(uname -m)}" in
  linux-amd64 | Linux-x86_64) mine=linux-amd64 ;;
  linux-arm64 | Linux-aarch64 | Linux-arm64) mine=linux-arm64 ;;
  darwin-arm64 | Darwin-arm64) mine=darwin-arm64 ;;
  darwin-amd64 | Darwin-x86_64) mine=darwin-amd64 ;;
  *) mine="" ;;
esac
smoke_binary() { # file label
  chmod +x "$1" 2>/dev/null
  if SMOKE_PORT="${SMOKE_PORT:-18099}" "$smoke_binary_script" "$1" "$tag" >"$tmp/smoke.log" 2>&1; then
    pass "$2 starts and serves the web app and the API"
  else
    cat "$tmp/smoke.log" >&2
    fail "$2 does not pass the smoke test"
  fi
}
if [ -z "$mine" ]; then
  skip "no binary of this release runs on $(uname -s)-$(uname -m)"
elif [ ! -f "$dl/kantahe-$tag-$mine" ]; then
  fail "kantahe-$tag-$mine is not there to run"
else
  smoke_binary "$dl/kantahe-$tag-$mine" "kantahe-$tag-$mine"
fi
if [ "$mine" = linux-amd64 ]; then
  arm64="$dl/kantahe-$tag-linux-arm64"
  qemu=""
  for q in qemu-aarch64 qemu-aarch64-static; do have "$q" && qemu=$q && break; done
  if [ ! -f "$arm64" ]; then
    : # reported above as a missing file
  elif [ -n "$qemu" ]; then
    chmod +x "$arm64" 2>/dev/null
    printf '#!/bin/sh\nexec %s %s "$@"\n' "$(command -v "$qemu")" "$arm64" >"$tmp/arm64"
    chmod +x "$tmp/arm64"
    SMOKE_PORT=18098 smoke_binary "$tmp/arm64" "kantahe-$tag-linux-arm64 (under $qemu)"
  elif [ -e "${VERIFY_BINFMT_QEMU:-/proc/sys/fs/binfmt_misc/qemu-aarch64}" ]; then
    # docker/setup-qemu-action registers qemu with the kernel: an arm64 binary runs as it is
    SMOKE_PORT=18098 smoke_binary "$arm64" "kantahe-$tag-linux-arm64 (through the kernel's qemu handler)"
  else
    skip "linux-arm64: no qemu-user here to run it"
  fi
fi

# --- 4 and 5. the image
echo "== the image $image"
if [ "$docker_wanted" = 0 ]; then
  skip "the image checks were switched off (--no-docker)"
elif ! have docker || ! docker info >/dev/null 2>&1; then
  skip "Docker is not available (no docker, or its daemon is not running): the image is not checked"
else
  for p in $platforms; do
    if docker pull --platform "$p" "$image" >"$tmp/pull.log" 2>&1; then
      pass "docker pull --platform $p $image"
      if SMOKE_PORT=18097 "$smoke_image_script" "$image" "$tag" "$p" >"$tmp/dsmoke.log" 2>&1; then
        pass "the image passes the smoke test on $p"
      else
        cat "$tmp/dsmoke.log" >&2
        fail "the image does not pass the smoke test on $p"
      fi
    else
      cat "$tmp/pull.log" >&2
      fail "the image $image cannot be pulled for $p"
    fi
  done
  digest() { docker buildx imagetools inspect "$1" --format '{{.Manifest.Digest}}' 2>/dev/null; }
  if [ -z "$latest_image" ]; then
    skip "no image stands for :latest, its digest is not compared"
  else
    d_tag=$(digest "$image")
    d_latest=$(digest "$latest_image")
    if [ -z "$d_tag" ]; then
      fail "the digest of $image cannot be read"
    elif [ "$prerelease" = true ]; then
      if [ "$d_latest" = "$d_tag" ]; then
        fail ":latest moved to the pre-release $tag ($d_tag)"
      else
        if [ -z "$d_latest" ]; then pass ":latest did not move to the pre-release (there is no :latest yet)"; else pass ":latest did not move to the pre-release (it is $d_latest)"; fi
      fi
    else
      if [ "$d_latest" = "$d_tag" ]; then
        pass ":latest is $tag ($d_tag)"
      else
        fail ":latest is ${d_latest:-missing}, not $tag ($d_tag)"
      fi
    fi
  fi
fi

# --- summary
echo
if [ "$strict" = 1 ] && [ "$skips" -gt 0 ]; then
  echo "FAILED:   $skips check(s) were skipped and --strict is on" >&2
  fails=$((fails + skips))
fi
if [ "$fails" -gt 0 ]; then
  echo "verify-release: $tag FAILED ($fails problem(s), $skips skipped)" >&2
  exit 1
fi
echo "verify-release: $tag ok ($skips skipped)"
