# Releasing Kantahe

A release is a tag `vX.Y.Z`. Pushing the tag runs `.github/workflows/release.yml`, which first checks the tag, then calls
`ci.yml` (every check below), then builds the binaries, attaches them to a GitHub release and pushes the Docker image. GitHub
Actions run **only** on a tag (and by hand), so a mistake that CI would find is found only after the tag exists. This checklist
finds it before.

1. **Commit everything that belongs to the release.** CI sees only the commit, not your working tree. A file that is
   untracked or uncommitted makes every local test pass and the tagged commit fail (this happened: a test used a helper that
   existed only in the working tree).
2. **Run the same checks on that commit:** `scripts/ci-local.sh`. It checks out the commit in a separate git worktree
   (your working tree is not touched), runs the jobs of `ci.yml` with the same commands, and prints one line per job
   (passed, FAILED or skipped, and how long). A skipped job names the missing tool; `--strict` turns a skip into a failure.
   It warns when your working tree has uncommitted files, because those are not part of the check. `--only go,web` runs
   some jobs, `--docker` adds the Docker job (both architectures, slow), `--ref <commit>` checks another commit, and
   `--keep` leaves the worktree for you to look at. Fix every FAILED job before going on.
3. **Run `ci.yml` by hand on GitHub** (the Actions tab, *Run workflow*, branch of the release commit) and wait for green. This
   is the real machine: Linux, the pinned tools, Docker, systemd.
4. **Rehearse the release by hand:** Actions tab, *release*, *Run workflow*, branch of the release commit, version name
   `v0.0.0-dry` (any name that looks like `vX.Y.Z` or `vX.Y.Z-suffix`). It does everything a tag does except the publishing:
   the same checks, the six binaries and `SHA256SUMS` (7 files, kept as the workflow artifact `release-files` for 7 days), the
   smoke test, and the image for both platforms with *push* off. It cannot create a release or push an image, whatever you type.
   Wait for green and look at the artifact.
5. **Tag and push:** `git tag vX.Y.Z && git push origin vX.Y.Z`.
6. **Verify the published release.** The last job of `release.yml`, *verify*, does it by itself: wait for it to turn green. Or run
   it yourself, any time: `scripts/verify-release.sh vX.Y.Z` (needs `gh`; add `--strict` to make a check that could not run, for example
   without Docker, a failure). It reads only. It downloads what users download and checks it: the release is published (not a draft),
   is marked pre-release exactly when the tag has a suffix, has exactly the seven files (six programs and `SHA256SUMS`, nothing more); the
   checksums pass with the command of `docs/install.md`; the program for your machine starts and serves the web app and the API (the
   Linux arm64 one too under qemu, where there is any); the image `ghcr.io/andrewloable/kantahe:vX.Y.Z` runs for amd64 and arm64
   (the smoke test of the image); and `:latest` is that image for a final version and did **not** move for a pre-release.

Before the very first release: the old `v0.2.0` pre-release ("Initial Release", no files, its tag on a commit of 2020) is to
be removed, as decided. It is left alone by every script; to remove the release and its tag run
`gh release delete v0.2.0 --cleanup-tag --yes`, and `git tag -d v0.2.0` in your clone. Then delete this paragraph.

**If *verify* is red.** The release and the image stay published; the job only reports. Read its log: each line says `ok`, `skipped`
or `FAILED` and why. A file missing or wrong on the release: fix the release by hand on the Releases page (or mark it pre-release
until fixed), then run *Re-run failed jobs*, which verifies again. A wrong image or `:latest`: do not move tags by hand; push a fixed tag
(a new patch version) and let the workflow release it. A failure of the checks themselves (a port in use, a registry timeout) is cleared
by *Re-run failed jobs*.

## What the release workflow does

* **The tag is checked first**, in seconds, before the checks and the build: it must be `vMAJOR.MINOR.PATCH` or
  `vMAJOR.MINOR.PATCH-suffix` (so `v1.2`, `vtest` and `1.2.3` are refused), and greater than every other version tag of the
  repository by semantic-version order (`v1.2.3-rc.1` is below `v1.2.3`, `rc.10` is above `rc.2`). A version with a suffix is a
  pre-release: GitHub marks it so and the image tag `latest` does not move. The rules are in `scripts/release-checks.py`; a
  rehearsal only warns where a release would be refused.
* **Publishing can be run again.** The release is created as a **draft**, every file is uploaded (a file of the same name is
  replaced), the script checks that every file is on it, and only then the draft is published, so nobody sees a release with
  files missing. If a run fails half way, use *Re-run failed jobs* (or *Re-run all jobs*): an existing release, draft or
  published, is used as it is. A draft left behind is invisible to others; delete it on the Releases page if you give up the tag.
  The steps are in `scripts/publish-release.sh`.
* **Release notes.** They are generated by GitHub from the commits since the newest earlier release **that has files** (a
  release of a stable version skips the pre-releases before it). When there is no such release, as for the first one, the notes
  are `docs/release-notes-template.md`; edit the notes on the Releases page afterwards if you want more.
* **Verification.** After the release and the image, the *verify* job checks what was published (step 6 above). It has read-only
  permissions (`contents: read`, `packages: read`), runs only for a pushed tag, and its result never changes the release.
* **Permissions and order.** The workflow can only read by default. Only the release job writes contents, only the image job
  writes packages, and the checks never write. Releases run one at a time (two tags would race for the image tag `latest`):
  a second tag pushed while one is releasing waits for it, and a third replaces the second in the queue, so push the tags of
  a release one by one. A release that has started is never cancelled. A rehearsal has its own queue.

**The Windows job.** `ci.yml` has a job `go-windows` on `windows-latest`: `go vet`, `go build`, `go test` (without `-race`, which
needs cgo), then the real program twice with `scripts/smoke-windows.py`: from a console (it serves `/healthz`, `/` and `/library`,
stops on Ctrl+Break and leaves the data folder deletable) and as a Windows service with the commands of `docs/install.md`
(`sc.exe create`, `start`, `stop` within 30 seconds, `delete`). On a failed run the test output is the artifact
`windows-test-log`. Windows cannot run on your machine, so `ci-local.sh` has a job `windows-compile` instead: it vets, builds and
compiles every test binary for Windows (the `_windows.go` files included, which a Mac or Linux build never looks at), and the
smoke script is tested against stubs. `scripts/test_ci_local.py` maps each step of `go-windows` to a command of the script, so a
new Windows step without a counterpart fails.

What `scripts/ci-local.sh` cannot check on your machine, and CI still does: the Windows behaviour itself (file locks, paths, the
service manager), the Linux-only pieces (`systemd-analyze verify`
of the unit), Docker when the daemon is not running, other tool versions than yours (the script warns when yours differ:
CI uses Node 24 and the Go of `server/go.mod`). `scripts/test_ci_local.py` fails when a step is added to `ci.yml` without
its counterpart in the script.

## When a test fails in CI but not on your machine

The checks are made to show such tests, not to hide them: the Go tests run with `-race -shuffle=on`, and the Go, web and Flutter tests run
a second time with `TZ=Pacific/Kiritimati` (UTC+14), so a test that only passes in the time zone it was written in fails
here too. Do not set `TZ` for the whole workflow and do not add retries.

* **Go, shuffled order:** the output of a failing package starts with `-test.shuffle <seed>`. Reproduce it with
  `go test -race -shuffle=<seed> ./internal/<package>/`.
* **Web, shared page:** the web tests of one worker share a `document` (Vitest runs without isolation, like Karma did), so a
  listener or timer left by one spec shows up in another. Reproduce an order problem by running one worker with a random order
  (`--runner-config` with `test: { maxWorkers: 1, sequence: { shuffle: true, seed: N } }`), and slow machines by raising the
  load while the suite runs. A spec must undo what it adds to the page, and a timer must be checked by what it would do
  (`vi.getTimerCount()` also counts the timers of Angular's change detection).
* **Time zone and language:** `TZ=Pacific/Kiritimati LC_ALL=de_DE.UTF-8 npx ng test --watch=false` (and `flutter test`, `go test`).
* **No downloads in unit tests:** a test that needs a tool or a network skips with its reason, or runs only when asked
  (`KANTAHE_TEST_ONLINE=1` runs the test of `ci-local.sh` that downloads the real actionlint).
