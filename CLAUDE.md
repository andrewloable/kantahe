# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Kantahe is an open-source (MIT) videoke machine for a Raspberry Pi. The repo is **pre-code**: only
the plan, branding and fanfare assets exist. [docs/PLAN.md](docs/PLAN.md) is the source of truth for
behaviour, API, decisions (D1–D9) and the roadmap; read it before building anything and keep it
updated when a decision changes. Commands below marked *planned* do not work until that part is
scaffolded; replace them with the real ones when it is.

The earlier Blazor/.NET version of this repo was removed; ignore it in git history.

## Layout

| Path | What | State |
|---|---|---|
| `server/` | Go server, one static arm64 binary; embeds both web builds | planned |
| `web/` | One Angular workspace: app `player` (TV kiosk), app `remote` (phones), library `shared` (generated API client, state store, song picker, format badge) | planned |
| `proto/kantahe/v1/` | Protobuf contract for ConnectRPC (`buf.yaml`, `buf.gen.yaml` at the root) | planned |
| `gen/` | Generated Go + connect-go code (committed; TS goes to `web/projects/shared/src/gen`, also committed) | planned |
| `deploy/` | install script, systemd units, NetworkManager hotspot, dnsmasq captive-portal drop-in | planned |
| `branding/` | Logo: `build.py` writes every SVG and `export/` (favicons, PWA icons, lockups, 1920×1080 splash) | exists |
| `fanfare/` | Score fanfares: `fanfare1.mp3` (70–80), `fanfare2.mp3` (81–90), `fanfare3.mp3` (91+) | exists |

## Commands

```sh
python3 branding/build.py          # regenerate all logo SVGs + exports (needs Google Chrome and ImageMagick)

# planned
buf generate && buf lint                          # after editing proto/; commit the generated code
buf breaking --against '.git#branch=master'       # only after the first release
cd server && go test ./...                        # all Go tests
cd server && go test ./... -run TestQueueSkip     # one test
cd server && GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build ./...   # Pi build; GOARCH=arm GOARM=7 if spike S1 picks 32-bit Pi OS
cd web && ng build player && ng build remote
cd web && ng test player                          # Angular unit tests for one app
```

Edit logo shapes in `branding/build.py` (`mark()`, `wordmark()`), never in the generated SVGs.
ImageMagick's own SVG renderer is wrong for clip paths and gradients, so rendering goes through
headless Chrome and ImageMagick only resizes and builds `favicon.ico`.

## Architecture (from the plan)

* **Pi = server + kiosk + Wi-Fi hotspot.** Go listens only on `10.42.0.1:80` (hotspot) and
  `127.0.0.1:80`, never on Ethernet, and serves `/player/` and `/remote/`. Chromium in `cage` kiosk shows
  `http://localhost/player/` on HDMI. dnsmasq resolves every name to the Pi; the server answers OS
  captive-portal probe URLs with a 302 to `/remote/` until that phone has loaded the remote, then
  **releases** it (answers probes with the expected 204/"Success") so Android stops routing the
  browser over mobile data.
* **No wall clock (D10).** The Pi has no RTC and no internet; use the monotonic clock for all timing.
* **Thin clients (D1).** Only the server parses `.kar` (MIDI + lyric text events) and `.karmp3` (ZIP of
  `.mp3` + `.lrc` + `.nfo`). Clients get one lyrics JSON (lines → words with `startMs`/`endMs`) and an
  audio URL. Do not put MIDI/LRC parsing in Angular.
* **`.kar` audio is rendered on the server (D2)** with `fluidsynth` + a SoundFont, encoded by `ffmpeg`,
  cached on disk, rendered ahead for the queue head and the next pick. No browser synth (target is a
  Pi 3B+ with 1 GB RAM).
* **ConnectRPC is required between the Go server and both Angular apps (D3, D7)**: connect-go on the
  server, connect-es (`@connectrpc/connect-web`) in Angular, contract in `proto/`. Browsers only get
  unary and server-streaming calls, so never design a client-streaming or bidi RPC. Commands are
  unary; `SessionService.WatchState` streams a full `State` snapshot at once and after every change.
  **Audio is plain HTTP** (`GET /media/{number}` with Range) so `<audio>` can seek; static
  apps and captive-portal probes are plain HTTP too.
* **Server is the source of truth (D8).** The player is the playback clock: it reports
  position/`Ended` via `PlayerService`, the server advances the queue.
* **The player is built first against an in-memory mock** (connect-es `createRouterTransport`
  implementing the generated service interfaces), then switched to the real server by swapping the
  transport.
* **Only localhost may act as the player (D5).** A Connect interceptor rejects `PlayerService` calls
  (`Ready`, `ReportPosition`, `Ended`, `Rescan`) from non-loopback peers; this is what makes "the remote cannot play" true. No accounts or
  sessions (D4): joining the Wi-Fi is the access control.
* **Queue rules live only in the server** (PLAN.md section 6): boot paused, interrupted song dropped
  after power loss, queue kept; Skip keeps the current status; adding never interrupts; empty queue →
  uniformly random entry, MP3 and MIDI alike (excluding recent and failed ones), pre-picked so it can render ahead; a song
  that ends on its own gets a ~6 s score interlude (KS100 rules), skipped songs get none. Position
  reports update memory only and never trigger a state push.
* **Wi-Fi QR** shows while no phone is associated with the hotspot (`iw … station dump`, 60 s grace)
  or when forced by `SHOW_QR` from the remote; the player has no QR button.
* **Audio readiness** is in `State` (`audioReady`); the player never points `<audio>` at a song that
  is still rendering.
* **One entry per file, formats user-visible**: every `.karmp3` and `.kar` is its own entry with a
  unique number and a `format` (`mp3` / `midi`); a song in both formats is listed twice, each with an
  MP3/MIDI badge. On a number clash the `.karmp3` keeps the songbook number and the `.kar` is
  renumbered (original kept as `songbook_number`).
* Library is a user-supplied folder of `NNNNN - Artist - Title.kar|.karmp3`; the leading digits (any
  length) are the number people type; files without one are auto-numbered, stably by path. A
  background pass reads in-file title/artist (filenames may contain damaged characters). Catalog in
  SQLite (`modernc.org/sqlite`, WAL) with FTS5.

## Rules specific to this repo

* **Never commit song files** (`.kar`, `.karmp3`, `.mid`, `.mp3` outside `fanfare/`). The library is a
  commercial catalogue; Kantahe ships none. Go tests generate synthetic MIDI/LRC/ZIP fixtures; tests
  that need a real library read `KANTAHE_TEST_LIBRARY` and skip when it is unset.
* Build order chosen by the owner: Angular player first (against the in-memory mock), then the Go
  server, then the remote app, then Pi packaging.
* Keep the Pi 3B+ budget in mind: one render at a time, `clip-path`/`transform`-only animation in the
  player, no large client-side assets.
* Reference implementation for formats, lyric timing and scoring lives in the sibling project
  `../../videoke-ks100` (`web/index.html` for player behaviour, `src/kar.go`, `src/karaoke.go`,
  `src/karmp3.go`, `src/score.go` for code to copy). Copy the format-reading parts only; nothing about
  the card image or firmware belongs here.
