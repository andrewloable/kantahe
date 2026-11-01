#!/usr/bin/env bash
# Runs the checks of .github/workflows/ci.yml against EXACTLY the commit that will be tagged, before a tag is pushed.
#
#   scripts/ci-local.sh [--ref REF] [--only job,job] [--skip job,job] [--docker] [--strict] [--keep] [--list]
#
# CI runs only on a release tag, and your working tree is not what CI sees: a file that is untracked or uncommitted
# makes every local test pass and the tagged commit fail. So the jobs run in a separate git worktree of REF (default HEAD,
# a clean checkout: untracked and uncommitted files are not in it), with the same commands and flags as ci.yml. Your own
# working tree is never touched (no stash, reset or checkout); the worktree is removed on exit unless --keep.
#
# Jobs, in order: lint (actionlint and shellcheck, local only), buf, go, windows-compile (stands for the go-windows job, see
# below), web, scripts-and-docs, flutter, e2e,
# release-build, deploy-files, flutter-android, flutter-ios, and with --docker (or --only docker) the docker job, which
# builds both architectures and takes long. A job whose tool is missing is
# reported as "skipped: <tool> not installed", never silently; --strict makes a skip a failure.
# Needs bash 3.2 or newer (the one of macOS is enough). Nothing here pushes, tags or starts a GitHub workflow.
#
# The run: commands of ci.yml are written out below in the jobs, word for word; scripts/test_ci_local.py fails when a
# step of ci.yml has no counterpart here.
# SC2329: the job_* functions are called by name in the loop below. SC2016: the commands are kept literal, as in ci.yml.
# shellcheck disable=SC2329,SC2016
set -uo pipefail

# CI_LOCAL_ACTIONLINT replaces the command that runs actionlint: the test of this script points it at a stub, because the
# default downloads the pinned release (go run package@version asks the module proxy even when it is cached)
ACTIONLINT=${CI_LOCAL_ACTIONLINT:-"go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12"}
ALL_JOBS="lint buf go windows-compile web scripts-and-docs flutter e2e release-build deploy-files flutter-android flutter-ios docker"

repo="$(cd "$(dirname "$0")/.." && pwd)"
ref=HEAD
only=""
skip=""
strict=0
keep=0
with_docker=0

usage() {
  sed -n '2,/^# SC2329/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) ref="${2:?--ref needs a commit}"; shift 2 ;;
    --only) only="${2:?--only needs a list of jobs}"; shift 2 ;;
    --skip) skip="${2:?--skip needs a list of jobs}"; shift 2 ;;
    --docker) with_docker=1; shift ;;
    --strict) strict=1; shift ;;
    --keep) keep=1; shift ;;
    --list) echo "$ALL_JOBS" | tr ' ' '\n'; exit 0 ;;
    -h | --help) usage 0 ;;
    *) echo "ci-local: unknown argument: $1" >&2; usage 2 ;;
  esac
done

have() { command -v "$1" >/dev/null 2>&1; }
in_list() { case ",$2," in *",$1,"*) return 0 ;; esac; return 1; }

for name in $(echo "$only,$skip" | tr ',' ' '); do
  in_list "$name" "$(echo "$ALL_JOBS" | tr ' ' ',')" || { echo "ci-local: unknown job '$name' (see --list)" >&2; exit 2; }
done

cd "$repo" || exit 2
git rev-parse --verify --quiet "$ref^{commit}" >/dev/null || { echo "ci-local: '$ref' is not a commit of this repository" >&2; exit 2; }
sha="$(git rev-parse --short=12 "$ref^{commit}")"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/kantahe-ci.XXXXXX")"
wt="$tmp/checkout"
logs="$tmp/logs"
mkdir -p "$logs"
cleanup() {
  if [ "$keep" = 1 ]; then
    echo "ci-local: kept $wt (remove it with: git worktree remove --force $wt)"
  else
    git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1
    git -C "$repo" worktree prune >/dev/null 2>&1
    rm -rf "${tmp:?}"
  fi
}
trap cleanup EXIT
git worktree add --detach "$wt" "$ref" >/dev/null 2>&1 || { echo "ci-local: cannot create a worktree of $ref" >&2; exit 2; }

echo "== commit $sha ($ref) checked out clean in a separate worktree"
dirty="$(git status --porcelain | wc -l | tr -d ' ')"
if [ "$dirty" != 0 ]; then
  echo "WARNING: your working tree has $dirty uncommitted or untracked files: NOT part of this check (CI will not see them either):"
  git status --porcelain | head -10 | sed 's/^/           /'
  [ "$dirty" -le 10 ] || echo "           ... and $((dirty - 10)) more"
fi

# --- tool versions against CI's -------------------------------------------------------------------------------------
echo "== tools (a different version from CI is a warning, not a failure)"
node_major() { node --version 2>/dev/null | sed 's/^v//; s/\..*//'; }
go_want="$(sed -n 's/^go \([0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' "$wt/server/go.mod" | head -1)"
tool_version() {
  case "$1" in
    go) go version ;;
    flutter) flutter --version 2>/dev/null | head -1 ;;
    nginx) nginx -v 2>&1 ;;
    caddy) caddy version ;;
    *) "$1" --version 2>&1 | head -1 ;;
  esac
}
for t in go node npm flutter buf nginx caddy docker python3; do
  if have "$t"; then printf '   %-8s %s\n' "$t" "$(tool_version "$t")"; else printf '   %-8s not installed\n' "$t"; fi
done
have go && case "$(go version)" in *"go$go_want"*) ;; *) echo "WARNING: go.mod wants Go $go_want; CI uses that, this machine has $(go version | awk '{print $3}')" ;; esac
have node && [ "$(node_major)" != 24 ] && echo "WARNING: CI uses Node 24 (setup-node node-version: 24); this machine has $(node --version)"
have flutter && echo "   (CI uses the Flutter stable channel, not pinned; this machine: $(flutter --version 2>/dev/null | head -1))"

# --- running ----------------------------------------------------------------------------------------------------------
# run DIR COMMAND: the command exactly as in ci.yml, in DIR of the clean checkout
run() {
  local dir="$1"
  shift
  printf '   $ %s%s\n' "$*" "$([ "$dir" = . ] || echo "   (in $dir)")"
  ( cd "$wt/$dir" && eval "$*" )
}
# skip REASON: ends the job as skipped (the reason is shown in the summary)
skip_job() { echo "$1" > "$logs/current.skip"; return 77; }
need() {
  local t
  for t in "$@"; do have "$t" || { skip_job "$t not installed"; return 77; }; done
  return 0
}
# npm ci once per checkout: web, scripts-and-docs and e2e all start with it in CI (each on its own machine)
npm_ci() {
  [ -f "$logs/npm-ci.done" ] && { echo "   (npm ci already done in this checkout)"; return 0; }
  run web 'npm ci' && touch "$logs/npm-ci.done"
}

job_lint() {
  local rc=0
  [ -n "${CI_LOCAL_ACTIONLINT:-}" ] || need go || return $?
  run . "$ACTIONLINT" || rc=1
  # warnings and errors fail the run; the style notes (info) of the older scripts do not (CI does not run shellcheck on scripts)
  if have shellcheck; then run . 'shellcheck --severity=warning scripts/*.sh' || rc=1; else echo "   (shellcheck is not installed: not run)"; fi
  return "$rc"
}

job_buf() {
  need buf || return $?
  run . 'buf lint' || return 1
  run . 'buf generate' || return 1
  # git status (not git diff) so that newly generated, untracked files are caught too
  run . 'test -z "$(git status --porcelain -- server/gen web/src/gen app/lib/gen)"' || return 1
}

job_go() {
  need go || return $?
  run server 'go vet ./...' || return 1
  run server 'test -z "$(gofmt -l .)"' || return 1
  run server 'CGO_ENABLED=0 go build ./...' || return 1
  run server 'go test -race -shuffle=on ./...' || return 1
  run server 'TZ=Pacific/Kiritimati go test ./...' || return 1
}

# The go-windows job of ci.yml runs on Windows, which this machine cannot: windows-compile does what can be done for Windows from
# here (vet, build and compile every test binary, the Windows-only files included), and the smoke script that the Windows job runs
# is tested here against stubs. scripts/test_ci_local.py maps each step of go-windows to a command below.
job_windows_compile() {
  need go || return $?
  run server 'GOOS=windows GOARCH=amd64 go vet ./...' || return 1
  run server 'GOOS=windows GOARCH=arm64 go vet ./...' || return 1
  run server 'CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build ./...' || return 1
  run server 'dir=$(mktemp -d); GOOS=windows GOARCH=amd64 go test -c -o "$dir/" ./...; rc=$?; rm -rf "$dir"; exit $rc' || return 1
  run server 'dir=$(mktemp -d); GOOS=windows GOARCH=amd64 go build -o "$dir/kantahe.exe" ./cmd/kantahe; rc=$?; rm -rf "$dir"; exit $rc' || return 1
}

job_web() {
  need node npm || return $?
  npm_ci || return 1
  run web 'npx ng lint' || return 1
  run web 'npx ng test --watch=false' || return 1
  run web 'TZ=Pacific/Kiritimati npx ng test --watch=false' || return 1
  run web 'npx ng build' || return 1
  run web 'npx ng build --configuration tizen' || return 1
  run web 'npx ng build --configuration webos' || return 1
}

job_scripts_and_docs() {
  need node npm python3 xmllint || return $?
  npm_ci || return 1
  # ci-only: sudo apt-get install -y libxml2-utils   (xmllint is on this machine already)
  run . 'xmllint --noout tv/tizen/config.xml' || return 1
  run . 'python3 -m unittest discover -s tv/tizen' || return 1
  run . 'python3 -m unittest discover -s tv/webos' || return 1
  run . "python3 -m unittest discover -s scripts -p 'test_check_links.py'" || return 1
  run . "python3 -m unittest discover -s scripts -p 'test_ci_local.py'" || return 1
  run . "python3 -m unittest discover -s scripts -p 'test_check_proxy_configs.py'" || return 1
  run . "python3 -m unittest discover -s scripts -p 'test_build_release.py'" || return 1
  run . "python3 -m unittest discover -s scripts -p 'test_release_checks.py'" || return 1
  run . "python3 -m unittest discover -s scripts -p 'test_smoke_windows.py'" || return 1
  run . "python3 -m unittest discover -s scripts -p 'test_verify_release.py'" || return 1
  run . 'scripts/sync-branding.sh --check' || return 1
  run . 'python3 scripts/check-links.py' || return 1
}

job_e2e() {
  need go node npm || return $?
  npm_ci || return 1
  # --with-deps installs system libraries with apt: only on Linux; elsewhere the browser alone
  if [ "$(uname -s)" = Linux ]; then run web 'npx playwright install --with-deps chromium' || return 1; else run web 'npx playwright install chromium' || return 1; fi
  run web 'npm run e2e' || return 1
  run web 'npm run e2e:responsive:checks' || return 1
  run web 'npm run e2e:layout' || return 1
}

job_release_build() {
  need go node npm || return $?
  run . 'scripts/build-release.sh v0.0.0-test' || return 1
  # ci: test "$(find dist -type f | wc -l)" = 7   (BSD wc pads its number with spaces, so here it is trimmed)
  run . 'test "$(find dist -type f | wc -l | tr -d " ")" = 7' || return 1
  if have sha256sum; then run . '(cd dist && sha256sum -c SHA256SUMS)' || return 1; else run . '(cd dist && shasum -a 256 -c SHA256SUMS)' || return 1; fi
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) run . 'scripts/smoke-release.sh dist/kantahe-v0.0.0-test-linux-amd64 v0.0.0-test' || return 1 ;;
    Darwin-arm64) run . 'scripts/smoke-release.sh dist/kantahe-v0.0.0-test-darwin-arm64 v0.0.0-test' || return 1 ;;
    Darwin-x86_64) run . 'scripts/smoke-release.sh dist/kantahe-v0.0.0-test-darwin-amd64 v0.0.0-test' || return 1 ;;
    *) echo "   (no binary of this platform to start: the smoke test is not run)" ;;
  esac
  # the embedded files must not show up in the working tree
  run . 'test -z "$(git status --porcelain -- server/internal/webui server/internal/assets)"' || return 1
}

job_deploy_files() {
  # the proxy check uses a local caddy and nginx, else their Docker images
  if ! { have caddy && have nginx; } && ! docker info >/dev/null 2>&1; then
    skip_job "needs caddy and nginx, or a running Docker daemon (CI has Docker)"
    return 77
  fi
  run . 'scripts/check-proxy-configs.sh' || return 1
  # ci-only: sudo useradd --system --no-create-home --shell /usr/sbin/nologin kantahe
  # ci-only: sudo install -m 755 /bin/true /usr/local/bin/kantahe
  # ci-only: sudo install -d /srv/karaoke
  # ci-only: systemd-analyze verify deploy/systemd/kantahe.service   (it wants the program, the user and the folder to exist)
  if have systemd-analyze; then
    echo "   (systemd-analyze verify needs the user, the program and the folder of the unit: CI creates them with sudo; not repeated here)"
  else
    echo "   (systemd-analyze is not installed: the unit is not verified here; CI verifies it)"
  fi
}

job_docker() {
  need docker || return $?
  docker info >/dev/null 2>&1 || { skip_job "the docker daemon is not running"; return 77; }
  local platform
  for platform in linux/amd64 linux/arm64; do
    run . "docker buildx build --platform $platform --build-arg VERSION=v0.0.0-test -t kantahe:test --load ." || return 1
    run . "scripts/smoke-docker.sh kantahe:test v0.0.0-test $platform" || return 1
  done
}

job_flutter() {
  need flutter || return $?
  run app 'flutter pub get' || return 1
  run app 'flutter analyze' || return 1
  run app 'flutter test' || return 1
  run app 'TZ=Pacific/Kiritimati flutter test' || return 1
}

job_flutter_android() {
  need flutter java || return $?
  run app 'flutter pub get' || return 1
  run app 'flutter build apk --debug' || return 1
}

job_flutter_ios() {
  need flutter xcodebuild || return $?
  run app 'flutter pub get' || return 1
  run app 'flutter build ios --simulator --no-codesign --debug' || return 1
}

names=()
results=()
seconds=()
notes=()
failed=0
skipped=0
for job in $ALL_JOBS; do
  if [ -n "$only" ] && ! in_list "$job" "$only"; then continue; fi
  if [ -n "$skip" ] && in_list "$job" "$skip"; then continue; fi
  if [ "$job" = docker ] && [ "$with_docker" = 0 ] && ! in_list docker "$only"; then continue; fi
  echo
  echo "== job $job"
  rm -f "$logs/current.skip"
  start="$(date +%s)"
  "job_$(echo "$job" | tr '-' '_')" 2>&1 | tee "$logs/$job.log"
  rc="${PIPESTATUS[0]}"
  secs="$(($(date +%s) - start))"
  note=""
  if [ "$rc" = 77 ]; then
    result=skipped
    note="$(cat "$logs/current.skip" 2>/dev/null)"
    skipped=$((skipped + 1))
    echo "   skipped: $note"
  elif [ "$rc" = 0 ]; then
    result=passed
  else
    result=FAILED
    failed=$((failed + 1))
  fi
  names+=("$job")
  results+=("$result")
  seconds+=("$secs")
  notes+=("$note")
done

echo
echo "== summary for commit $sha"
printf '   %-18s %-9s %7s  %s\n' job result seconds note
i=0
while [ "$i" -lt "${#names[@]}" ]; do
  r="${results[$i]}"
  n="${notes[$i]}"
  [ "$r" = skipped ] && n="skipped: $n"
  printf '   %-18s %-9s %7s  %s\n' "${names[$i]}" "$r" "${seconds[$i]}" "$n"
  i=$((i + 1))
done

if [ "$with_docker" = 0 ] && ! in_list docker "$only" && ! in_list docker "$skip"; then
  echo "   docker             not run (takes long: add --docker)"
fi

if [ "$failed" -gt 0 ]; then
  echo "ci-local: $failed job(s) FAILED: do not tag this commit"
  exit 1
fi
if [ "$strict" = 1 ] && [ "$skipped" -gt 0 ]; then
  echo "ci-local: $skipped job(s) skipped and --strict is on"
  exit 1
fi
[ "$skipped" -gt 0 ] && echo "ci-local: no failure, but $skipped job(s) were skipped (see above): they still run in CI"
echo "ci-local: ok for commit $sha"
exit 0
