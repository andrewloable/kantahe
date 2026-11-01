#!/usr/bin/env bash
# Publishes the files of a folder as the GitHub release for a tag. Safe to run again after a failure, and users never see a
# release with files missing: the release is a draft until every file is on it.
#   scripts/publish-release.sh TAG DIST PRERELEASE NOTES PREVIOUS
#     DIST        the folder with the files (dist/)
#     PRERELEASE  true or false (scripts/release-checks.py decides it from the tag)
#     NOTES       generate (GitHub writes the notes from the commits since PREVIOUS) or template (docs/release-notes-template.md)
#     PREVIOUS    the tag the generated notes start from; empty with the template
# 1. A release for TAG exists (draft or published)? Then it is used as it is; else it is created as a draft.
# 2. Every file of DIST is uploaded, replacing a file of the same name.
# 3. The release must now have every file of DIST; only then the draft is published.
# Needs the gh CLI with GH_TOKEN (contents: write). It is the only place of the release workflow that calls gh release.
set -euo pipefail

tag=${1:?usage: scripts/publish-release.sh TAG DIST PRERELEASE NOTES PREVIOUS}
dist=${2:?usage: scripts/publish-release.sh TAG DIST PRERELEASE NOTES PREVIOUS}
prerelease=${3:?usage: scripts/publish-release.sh TAG DIST PRERELEASE NOTES PREVIOUS}
notes=${4:?usage: scripts/publish-release.sh TAG DIST PRERELEASE NOTES PREVIOUS}
previous=${5:-}

root=$(cd "$(dirname "$0")/.." && pwd)
fail() { echo "publish-release: $*" >&2; exit 1; }

case $prerelease in true | false) ;; *) fail "PRERELEASE must be true or false, not '$prerelease'" ;; esac
case $notes in
  generate) [ -n "$previous" ] || fail "generated notes need the tag they start from" ;;
  template) ;;
  *) fail "NOTES must be generate or template, not '$notes'" ;;
esac

files=()
for f in "$dist"/*; do
  [ -f "$f" ] && files+=("$f")
done
[ "${#files[@]}" -gt 0 ] || fail "no files in $dist"

if gh release view "$tag" >/dev/null 2>&1; then
  echo "== the release $tag exists: uploading to it again"
else
  echo "== creating $tag as a draft"
  args=(--draft --verify-tag --title "$tag")
  [ "$prerelease" = true ] && args+=(--prerelease)
  if [ "$notes" = generate ]; then
    args+=(--generate-notes --notes-start-tag "$previous")
  else
    args+=(--notes-file "$root/docs/release-notes-template.md")
  fi
  gh release create "$tag" "${args[@]}"
fi

echo "== uploading ${#files[@]} files"
gh release upload "$tag" "${files[@]}" --clobber

# every file must be there before anyone can see the release
on_release=$(gh release view "$tag" --json assets --jq '.assets[].name')
for f in "${files[@]}"; do
  grep -qxF -- "$(basename "$f")" <<<"$on_release" || fail "$(basename "$f") is not on the release $tag after the upload"
done

echo "== publishing $tag"
gh release edit "$tag" --draft=false
