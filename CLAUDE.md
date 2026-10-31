# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Kantahe is an open-source (MIT) self-hosted karaoke server: users upload `.kar` / `.karmp3` songs,
sign in with email and password, and sing from web, mobile and TV clients. The repo is **pre-code**:
only the plan, branding and fanfare assets exist. [docs/PLAN.md](docs/PLAN.md) is the source of truth
for behaviour, API, decisions (D1–D10) and the roadmap; read it before building anything and update it
when a decision changes. Commands marked *planned* do not work until that part is scaffolded; replace
them with the real ones when it is.

Earlier plans (a Blazor app, then a Raspberry Pi videoke box) are superseded; ignore them in git history.
Do not name or compare Kantahe to other media-server products anywhere in the docs or the app.

## Layout

| Path | What | State |
|---|---|---|
| `server/` | Go module: the server (one static binary, pure Go, no cgo); `server/gen/` holds generated Go | planned |
| `web/` | Angular app: the default client, the `/embed/player` page used by Flutter, and the Samsung Tizen / LG webOS TV builds; generated TS in `web/src/gen/` | planned |
| `app/` | Flutter app for Android, iOS, Android TV; generated Dart in `app/lib/gen/` | planned |
| `proto/kantahe/v1/` | Protobuf contract for ConnectRPC (`buf.yaml`, `buf.gen.yaml` at the root) | planned |
| `deploy/` | Dockerfile, compose, service files, reverse-proxy examples | planned |
| `branding/` | Logo: `build.py` writes every SVG and `export/` (favicons, app icons, lockups, splash) | exists |
| `fanfare/` | Score fanfares: `fanfare1.mp3` (70–80), `fanfare2.mp3` (81–90), `fanfare3.mp3` (91+) | exists |

## Commands

```sh
python3 branding/build.py          # regenerate all logo SVGs + exports (needs Google Chrome and ImageMagick)

# planned
buf generate && buf lint                          # after editing proto/; commit the generated code
cd server && go test ./...                        # all Go tests
cd server && go test ./... -run TestQueueSkip     # one test
cd server && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build ./cmd/kantahe   # any OS/arch the same way
cd web && ng build && ng test
cd app && flutter test
```

Edit logo shapes in `branding/build.py` (`mark()`, `wordmark()`), never in the generated SVGs.
ImageMagick's own SVG renderer is wrong for clip paths and gradients, so rendering goes through
headless Chrome and ImageMagick only resizes and builds `favicon.ico`.

## Architecture (from the plan)

* **ConnectRPC between the server and every frontend (D3, D7)**: connect-go, connect-es (Angular),
  connect-dart (Flutter); contract in `proto/`, generated code committed. The Go side uses connect-go
  **v1** (`connectrpc.com/connect` v1.21.0, plugin v1.19.1), not v2: the later tasks and `go 1.25` assume the v1 API. Browsers only get unary and
  server-streaming calls, so never design a client-streaming or bidi RPC. `SessionService.WatchState`
  streams the caller's full `State` snapshot at once and after every change. Uploads are ConnectRPC too;
  only media (audio with HTTP Range) is plain HTTP.
* **Auth (D4)**: email + password (argon2id), per-device opaque bearer tokens stored hashed; media
  uses short-lived signed URLs because `<audio src>` cannot send headers; no cookies. First run creates
  the admin; the admin creates users and resets passwords; TVs can sign in with a code approved on
  another device. Every RPC is scoped to the caller's user; never let one user reach another's queue,
  state, favourites, history or playlists.
* **Per-user playback (D5, D8)**: one queue and one now-playing song per user, one player device at a
  time ("Play here"), the user's other devices are remotes. The player device is the clock; only its
  `Ready`/`ReportPosition`/`Ended` are accepted. Queue rules (PLAN.md section 7): Play/Pause/Skip, stop
  only on Pause, Skip keeps status, Add never interrupts, random fill when the queue is empty, score
  screen after songs that end on their own. Position reports never trigger a push.
* **One web player for every platform (D2, D9)**: MIDI is synthesized on the client with spessasynth +
  a SoundFont served by the server; MP3 plays through `<audio>`. Browsers and the Tizen/webOS packages
  run it directly; Flutter shows native screens and embeds `/embed/player` in a WebView (token passed
  through a JavaScript channel, never in the URL). Do not add a native synth to Flutter.
  Weak devices (PLAN.md 4.1): every player loads a per-song trimmed SoundFont built by the server;
  a per-device `midiMode` (`auto`/`full`/`lowPower`/`server`) adds a low-power synth setting or a
  server-rendered audio fallback (pure-Go synth, cached).
* **Server parses lyrics (D1)**: `.kar` lyric events and `.karmp3` `.lrc`/`.nfo` become one `Lyrics`
  message; clients never parse MIDI lyrics or LRC.
* **Library**: one shared library; upload (users with the `uploader` role, one ConnectRPC call per
  file, ZIPs unpacked on the client) and watched folders; admin delete removes the file too. Every file is its own entry with a unique, never-changing number (MP3 keeps the songbook
  number, a clashing MIDI is renumbered); MP3/MIDI badges everywhere. Admin title/artist edits win
  over file metadata. SQLite (`modernc.org/sqlite`, WAL, FTS5); MP3s are extracted from `.karmp3`
  ZIPs at import so Range works.
* **Deployment (D10)**: plain HTTP; HTTPS only through the user's reverse proxy (proxy must not buffer
  the streaming RPCs). Releases: binaries for linux/macos/windows × amd64/arm64 and a multi-arch Docker
  image; the web app, fanfares and default SoundFont are embedded with `go:embed`.

## Rules specific to this repo

* **Never run `git commit`, `git push` or `bd dolt push`.** Leave changes in the working tree; the
  owner commits and pushes manually. Beads is set to `dolt.local-only` so it does not push either.
* Work is tracked in beads: every implementation task has a review task, and downstream tasks are
  blocked on the upstream review. Start with `bd ready`.
* **Never commit song files** (`.kar`, `.karmp3`, `.mid`, `.mp3` outside `fanfare/`). Kantahe ships no
  songs. Go tests generate synthetic MIDI/LRC/ZIP fixtures; tests that need a real library read
  `KANTAHE_TEST_LIBRARY` and skip when it is unset.
* Build order chosen by the owner: Go server → Angular web app → packaging → Flutter Android/iOS →
  Android TV → Samsung/LG TV packages.
* Song formats, lyric timing, the lyrics view and the score rules are specified in PLAN.md section 3;
  implement from that spec.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
