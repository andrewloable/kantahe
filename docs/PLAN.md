# Kantahe: plan and roadmap

Status: **draft for manual review**. Nothing is built yet. No bd tasks exist yet; they get written
after this plan is agreed. Owner answers to the first round of questions are recorded in
section 12 and applied below. Target hardware floor: **Raspberry Pi 3B+ (1 GB RAM), HDMI audio**.

## 1. What we are building

An open-source videoke (karaoke machine) that runs on a Raspberry Pi.

| Piece | Tech | Role |
|---|---|---|
| `server/` | Go | Song library, search, lyrics, audio, session, queue. Runs on the Pi. |
| `player-web/` | Angular (latest stable; 22.x at the time of writing) | The **default player**: full-screen lyrics and audio on the TV, shown by Chromium in kiosk mode on the Pi. Also has a phone-friendly **remote** route. |
| `app/` | Flutter | Android, iOS, Linux, macOS, Windows. **Remote** (join, search, queue, control) and **player mode** (lyrics + audio on that device, so a laptop or tablet on a TV can be the screen). Same features as the Angular app. |

Song formats: `.kar` (Standard MIDI file with lyrics as text events) and `.karmp3` (a ZIP holding
`.mp3` + `.lrc` + `.nfo`). Both are described in section 3.

### Non-goals (cut on purpose, add only if asked)

* Not a general media player, no video/CD/USB-stick browsing.
* No reverse-engineering code. The KS100 card extractor (`videoke-ks100/src`) stays a separate
  project; Kantahe only reads its `.kar` / `.karmp3` output.
* **No songs shipped** (decided). The recovered library is a commercial machine's catalogue. Kantahe
  points at a user-supplied folder and bundles no song data.
* No multi-room (several sessions on one server), no accounts, no cloud, no internet access needed.
* No phone-as-microphone in v1 (browsers only allow the mic on HTTPS or localhost; see section 9).

## 2. What the sample app (`videoke-ks100/web/index.html`) tells us

One 1,231-line HTML file, no build. Good as a behaviour spec; not reusable as code in Angular.

| Sample feature | Where | Plan |
|---|---|---|
| Parse `.kar` / `.mid`: tempo map, lyric text events → lines → words with times | `Core.parseMidi`, `buildMidiSong`, `makeTimeMap` | **Move to Go server**, clients get JSON (D1) |
| Parse `.karmp3`: unzip, `.lrc` (`[mm:ss.xx]` lines, `<mm:ss.xx>` words), `.nfo` (`Key : value`) | `readZip`, `parseLrc`, `parseNfo` | **Move to Go server** |
| Word timing: each word's wipe ends at the next word; last word capped 0.3–1.2 s; `activeLineIndex` | `layoutWords` | Move to Go (lines/words get `start`/`end`) |
| Lyrics view: two rows, current row bright, colour wipe by `clip-path`, count-in dots | `LyricsView`, CSS | **Rebuild in Angular**, same look and behaviour |
| `.kar` audio via SoundFont synth in the browser (spessasynth + GeneralUser GS, 31 MB) or a tiny oscillator synth | `SfSynth`, `Synth`, `MidiEngine` | Replaced by server-side rendering (D2); browser synth only as fallback |
| `.karmp3` audio: plain `<audio>` | `Mp3Engine` | Same, but URL points at the server |
| Score: modes Off / Random / Microphone; levels Low/Middle/High = `timer % mod + base` with (26,75), (21,80), (11,90); mic needs 21 "loud" readings (every 100 ms); comments by band; fanfare tier by band (70–80, 81–90, 91+) | `Core.scoreFromTimer`, `scoreComment`, `fanfareTier`, `Mic` | Port to Go (`videoke-ks100/src/score.go` already exists in Go); player only counts loud readings and shows the result |
| Score screen: number rolls 1.4 s then lands, tier colour, comment, fanfare MP3, "Play again" | `showScore` | Rebuild in Angular, reuse `web/fanfare/fan0-2.mp3` |
| Transport: play/pause/stop/seek/volume, Space toggles play | controls | Rebuild; commands go through the server (section 5) |

What the sample does **not** have, and a videoke needs: song search/number entry, queue, sessions,
multiple devices, key change, tempo. These are the new work.

Library facts that shape the design (from `videoke-ks100/recovered`):

* 21,627 index rows; 21,460 `.kar` (824 MB, median ~38 KB) and 2,189 `.karmp3` (5.5 GB, ~96 kbps MP3).
* Name pattern `NNNNN - Artist - Title.ext`. `NNNNN` is the songbook number and is the key people type.
* Some names contain damaged characters (for example `Bisrock�pÏ`). Prefer the title and artist inside
  the file (`@T` lines in `.kar`, `.nfo` in `.karmp3`) over the filename, and keep the raw name too.
* A song can exist as both `.kar` and `.karmp3`. The `.karmp3` has the real recording; prefer it, keep
  the `.kar` as a second variant.
* Lyric timing in a `.karmp3` comes from the MIDI arrangement and can drift from the MP3
  (`recovered/check/sync.csv`; for 277 songs it is verified in sync, for 1,762 it cannot be told).
  Kantahe displays what the file says; a per-song lyric offset (a nudge control) is in phase 6.

## 3. Architecture

```
                    Raspberry Pi (one box = one videoke machine)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  kantahe-server (single static Go binary, arm64)                      │
 │   ├─ library scanner ──► SQLite (catalog, FTS5, session, history)     │
 │   ├─ lyrics normaliser  (.kar / .lrc  ──► one JSON shape)             │
 │   ├─ audio:  .karmp3 → stream the mp3                                 │
 │   │          .kar    → fluidsynth + ffmpeg → cached mp3 (D2)          │
 │   ├─ session + queue + score (server is the source of truth)          │
 │   ├─ REST /api/v1  +  WebSocket /api/v1/ws                            │
 │   ├─ mDNS advert  _kantahe._tcp   and   QR code payload               │
 │   └─ serves the Angular build (go:embed)                              │
 └───────────────▲──────────────────────────────▲───────────────────────┘
                 │ localhost                    │ Wi-Fi / LAN
        Chromium kiosk (cage)           phones, tablets, laptops
        Angular **player** → HDMI/DAC   Angular remote (browser) or Flutter app
```

Two client roles, one API:

* **Player**: draws lyrics, plays audio, is the playback clock, counts mic readings. Exactly one at a
  time; on the Pi it is the kiosk browser.
* **Remote**: searches, queues, controls, shows progress. Any number.

### Decisions (with the alternative that was rejected)

| # | Decision | Why | Rejected alternative |
|---|---|---|---|
| D1 | **Thin clients.** The server parses `.kar`/`.lrc` and serves one lyrics JSON. Clients never parse MIDI/ZIP. | Written once in Go with tests; Angular and Flutter stay small and cannot disagree. | Port the JS parser to Dart and TS: three copies of the same bug surface. |
| D2 | **Server renders `.kar` to audio** (`fluidsynth` + GeneralUser GS SoundFont, encoded to MP3 by `ffmpeg`, cached on disk). Every client just plays an MP3. Rendering for the next queued song starts when it is queued; an optional `kantahe-server prerender` command renders the whole library in advance (can be run on a faster machine and the cache copied over). | Flutter on five platforms would otherwise each need a SoundFont synth. A 3B+ cannot run a 31 MB SoundFont synth in WebAudio. Also makes key/tempo changes a server job. | Browser synth (spessasynth) as in the sample: **dropped**, not viable on a 3B+. If S1 shows even server rendering is too slow on the 3B+, fall back to pre-render-only plus a smaller SoundFont (section 9). |
| D3 | **REST (JSON, OpenAPI 3.1) for commands + one WebSocket for events.** Server pushes a **full state snapshot** on every change (queue is tiny); no delta protocol. | Curl-able, easy in Go/TS/Dart, stdlib-friendly. | ConnectRPC (used in TianEye): Dart support is less mature. gRPC: no browser story. |
| D4 | **One active session per server.** "Start party" creates it, "End party" closes it (history is kept). | A Pi is one machine. Multi-room is speculative. | Session IDs and rooms in every URL. |
| D5 | **SQLite via a pure-Go driver (`modernc.org/sqlite`)**, FTS5 for search. | No cgo, so `GOOS=linux GOARCH=arm64` cross-compiles from the Mac. Survives power cuts, so the queue resumes after reboot. | Postgres, or in-memory only. |
| D6 | **OpenAPI is the contract.** TS client (Angular) and Dart client (Flutter) are generated from `api/openapi.yaml`; CI fails on drift. WebSocket events are documented in `api/events.md` with JSON examples. | One source of truth for three codebases. | Hand-written clients. |
| D7 | **Server embeds the Angular build** (`go:embed`) so there is one file to deploy. | Fewest moving parts on the Pi. | Separate nginx. |
| D8 | **Player is the playback clock.** Server stores the last reported position (player sends it about once a second) and advances the queue on `ended`. Remotes' play/pause/seek go server → player. | Audio and lyrics are on the same device, so lyrics cannot drift from sound. No network clock sync needed. | Server-side clock with synchronized clients (needed only if several devices play audio at once; not in scope). |

## 4. Library and catalog (server)

* **Config**: flags/env only, no config file: `--library DIR`, `--data DIR` (SQLite + render cache),
  `--addr :8080`, `--soundfont FILE`, `--cache-gb 2`.
* **Scan**: on start and on `POST /api/v1/library/rescan`. Walk the folder, parse the filename
  (`NNNNN - Artist - Title`), store path/size/mtime. Do **not** open 23k files at scan time; read the
  inner title/artist lazily the first time a song is needed (and when playing). Unchanged files
  (same mtime+size) are skipped on re-scan.
* **Catalog row**: `number` (PK, 5-digit string), `title`, `artist`, `raw_name`, variants
  (`karmp3` path, `kar` path), `duration_ms` (nullable until known), `lang` (nullable).
* **Search** (`GET /songs?q=`): digits only → number prefix match (the numpad flow). Otherwise FTS5
  over title+artist, accent-folded, prefix match on the last token, punctuation ignored.
  Cap 50 per page. Target: < 50 ms on a Pi 4 for 24k rows.
* **Lyrics JSON** (the shape every client renders):

  ```json
  { "songNumber": "01052", "source": "lrc|kar", "durationMs": 231000,
    "lines": [ { "startMs": 7310, "endMs": 11200,
                 "words": [ { "text": "Heto ", "startMs": 7310, "endMs": 7800 } ] } ] }
  ```
  Clients highlight with `now >= word.startMs`; they do not compute timing (the sample's
  `layoutWords` rules live in Go).
* **Reuse from `videoke-ks100/src`** (copy, don't import; the format-reading parts only): `ParseKar`
  and the tempo map (`kar.go`, `karaoke.go`), LRC/NFO reading (`karmp3.go`), `score.go`. Leave out
  everything about the card, firmware and sync analysis.

## 5. Session, queue and API

**Session** = one party. Created from the player screen ("Start") or any remote. A QR code and a
4-character join code are shown on the idle player screen.

**Queue item**: `id`, `songNumber`, `requestedBy` (device display name), `addedAt`, optional
`keyShift`. Operations: add, remove, move to top ("play next"), reorder. Phase 6 adds "fair order"
(round-robin by singer).

**Permissions** (decided): anyone can add and remove their own items; only the *host* device (the one
that started the session, or the kiosk) can pause/skip/seek/reorder others'/end. Setting
`guestsCanControl` flips this.

**Auth**: LAN-only. Joining with the code returns a bearer token (random, stored in the DB). No
passwords, no TLS by default. The host can rotate the code.

**Endpoints** (sketch, final shape is the OpenAPI file):

```
GET    /api/v1/info                          version, library size, capabilities
GET    /api/v1/songs?q=&limit=&offset=       search
GET    /api/v1/songs/{number}                metadata + variants
GET    /api/v1/songs/{number}/lyrics         lyrics JSON
GET    /api/v1/songs/{number}/audio?key=0&tempo=1   audio, supports Range requests
POST   /api/v1/library/rescan
POST   /api/v1/session                       start party        -> host token
POST   /api/v1/session/join {code,name}      -> token
DELETE /api/v1/session                       end party
GET    /api/v1/session                       full state snapshot
POST   /api/v1/session/queue {songNumber}
DELETE /api/v1/session/queue/{itemId}
POST   /api/v1/session/queue/{itemId}/move {top:true | toIndex:n}
POST   /api/v1/session/control {action: play|pause|next|stop|seek|replay, positionMs?}
PATCH  /api/v1/session/settings {scoreMode, scoreLevel, volume, keyShift, tempo}
POST   /api/v1/session/player/ended {loudReadings}   player only: song finished
GET    /api/v1/ws?token=                     events (below)
```

**WebSocket**: server → clients: `{"type":"state","state":{…}}` on connect and after every change
(queue, now-playing, settings, who is connected, last score). Player → server: `player.hello`,
`player.position {ms}` (about 1/s), `player.ready {songNumber}`. Clients reconnect with backoff and
re-read the snapshot; there is nothing to replay.

**Now-playing state machine**: `idle → loading → playing ⇄ paused → scoring → idle|loading(next)`.
Server moves `idle → loading` when the queue is non-empty and a player is connected. Player replies
`ready` once audio is buffered, server flips to `playing`. On `ended` the server computes the score
(Go port of the firmware rules), stores it in history, broadcasts `scoring`, and after the score
screen timeout (configurable, default 8 s) loads the next song. No player connected → queue is kept,
state shows "no screen connected".

## 6. Player (Angular)

Latest stable Angular at scaffold time (check `ng version`; use signals, standalone components,
zoneless, the default test runner). Routes:

| Route | Screen |
|---|---|
| `/player` | Kiosk. **Idle**: logo, QR code + join code, "next up" list. **Playing**: title/artist, two-row lyrics with colour wipe and count-in dots, thin progress bar. **Score**: roll-up number, comment, fanfare. Hides cursor, no chrome. |
| `/remote` | Phone layout: search box (numpad toggle), results, queue with drag reorder, now-playing card with transport buttons, settings (score mode/level, volume). |
| `/` | Redirect: `/player` if opened on the Pi (localhost), else `/remote`. |

Player rules: autoplay needs a user gesture in a normal browser, but the kiosk Chromium is launched
with `--autoplay-policy=no-user-gesture-required`. Lyric highlight is driven by
`requestAnimationFrame` reading `audio.currentTime`, as in the sample. Mic scoring uses
`getUserMedia` on `localhost` (allowed without HTTPS) with a USB mic on the Pi; the player counts
loud readings and sends the count on `ended`.

## 7. Flutter app

Two modes (decided): **remote** and **player** (a laptop or tablet wired to a TV). D2 keeps player mode
small: an audio player (`just_audio`) plus a lyrics widget driven by the same lyrics JSON and the same
WebSocket player messages as the Angular player; no synth. Only one player is active at a time; the
server tracks which one ("take over screen" in the UI).

* Dart client generated from the OpenAPI file; one `Session` service owning the WebSocket and the
  latest snapshot; screens mirror the Angular `/remote` route one-to-one (join, search, queue,
  now-playing, settings).
* Discovery: mDNS `_kantahe._tcp` first, then QR scan (mobile only), then manual host entry. Desktop
  has no camera path; it uses mDNS or typing the address.
* Platform chores to budget for: iOS local-network permission text and Bonjour service entry;
  Android cleartext HTTP allowed for LAN and multicast lock for mDNS; macOS sandbox network client
  entitlement; Windows firewall prompt.
* State management: pick one boring option (Riverpod) and keep it. Flutter web is out of scope (the
  Angular remote already covers browsers).

## 8. Raspberry Pi deployment

* **Target**: **Pi 3B+ (1 GB RAM, USB 2.0, HDMI audio) is the floor** (decided); Pi 4/5 just have more
  headroom. 64-bit Raspberry Pi OS Lite. Library on a USB stick/SSD or the SD card (6.3 GB for the
  recovered set; the render cache needs another 2 GB or more).
* **3B+ budget**: with 1 GB, Chromium kiosk (about 300–400 MB), the Go server (~50 MB) and one
  `fluidsynth` render must fit together. Rules: render only one song at a time at low CPU priority
  (`nice`); no swap-heavy tricks; GPU memory split kept small; lyrics wipe animates only
  `clip-path`/`transform` and may drop to 30 fps; the player never holds more than one decoded song.
  S1 must prove this on the actual board, with the measured numbers written into this file.
* **Packages**: `fluidsynth`, `ffmpeg`, `chromium`, `cage` (Wayland kiosk compositor), `avahi-daemon`.
* **Build**: `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build` after `ng build`; output is one binary.
* **Services**: `kantahe-server.service` (Go) and `kantahe-kiosk.service`
  (`cage -- chromium --kiosk http://localhost:8080/player --autoplay-policy=no-user-gesture-required`).
* **Packaging**: `deploy/install.sh` first (apt packages, binary, units, user, data dir); a `.deb`
  or a flashable image (pi-gen) only after the MVP works.
* **Audio**: ALSA default device selectable by one env var (`KANTAHE_ALSA`); HDMI by default,
  USB DAC / 3.5 mm documented.
* **Network**: hostname `kantahe.local`; the kiosk shows the QR code so nobody needs the IP.

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Rendering a `.kar` on a 3B+ is slow (first play of an un-rendered song) | Dead air before song one | Spike S1. Render on enqueue. Show "preparing…". Fallbacks, in order: `prerender` the library offline on a faster machine; a smaller SoundFont; lower sample rate (22 kHz). |
| Chromium kiosk does not fit or stutters on a 3B+ (1 GB) | Player unusable on the target board | Spike S1 runs the sample HTML in the kiosk first. **Fallback plan:** on the 3B+ the Pi is server-only and the screen is another device (Flutter player mode, or any browser on a TV/laptop); the kiosk stays for Pi 4/5. |
| Key change on a `.karmp3` (needs pitch shift without tempo change) | Feature gap | `.kar`: shift note numbers in Go and re-render (cheap, exact). `.karmp3`: ffmpeg `rubberband`, spike in phase 6; if poor, key change is `.kar`-only. Mid-song change restarts the render at the current position. |
| mDNS blocked on guest/Wi-Fi-isolated networks | Flutter can't find the Pi | QR + manual address always available. |
| Mic over HTTP from a phone is blocked by browsers | No phone mic | Out of scope v1; mic is the Pi's USB mic. |
| Damaged characters in filenames | Ugly or unsearchable titles | Prefer in-file metadata; fold/strip in search; keep raw name. |
| Copyright of the song library | Legal exposure for the project | Ship no songs; document "bring your own library". |
| Three codebases drift | Bugs per client | OpenAPI-generated clients, server owns all logic (D1, D6), shared fixtures. |

## 10. Testing

* **Go**: table tests; fixtures are **generated in tests** (tiny synthetic MIDI with lyric events, an
  `.lrc`, a ZIP built in memory), never real commercial songs in git. Real-library tests read
  `KANTAHE_TEST_LIBRARY` and skip when unset (same pattern as the sample's card tests). Port the
  assertions of `videoke-ks100/web/test/core.test.mjs` (score ranges, signed remainder 0xFFFFFFFF →
  74, comment and fanfare bands, LRC word split) as the first Go tests. `httptest` for the API and
  WebSocket flow. Each parser change needs a regression test that fails on the old code.
* **Angular**: component tests for the lyrics wipe and score screen; one Playwright run against a real
  server with the synthetic library (search → queue → play → score).
* **Flutter**: widget tests; one integration test against the Go binary with the synthetic library.
* **Contract**: CI regenerates both clients from `openapi.yaml` and fails on a diff.
* **Pi acceptance** (manual, owner): 30-minute session, 5 phones, queue 10 songs, power-cycle, queue
  resumes.

## 11. Roadmap

Each phase has an exit check. Phases 0–4 are the **MVP: "sing at home with phones as remotes"**.

| Phase | Scope | Exit check |
|---|---|---|
| **0 Spikes and decisions** | S1 on the owner's **Pi 3B+**: run a stripped copy of the sample HTML (MP3 mode, no SoundFont) in kiosk Chromium and record memory and lyric frame rate; time `fluidsynth → ffmpeg` on a 4-minute `.kar` at 44.1 and 22 kHz while Chromium runs; check Range seeking of the result. Decide kiosk-on-3B+ vs server-only-on-3B+. S2: draft `openapi.yaml` and the event examples. Scaffold the repo layout. | Written S1 numbers; D2 confirmed or its fallback chosen; kiosk-vs-server-only decided; OpenAPI draft reviewed. |
| **1 Server: library** | Scanner, SQLite catalog, search, `.kar`/`.lrc` → lyrics JSON, `.karmp3` audio, `.kar` render + cache, `/info`. | Search by number and text returns correct hits on the real library; a rendered `.kar` plays in a browser tab. |
| **2 Server: session** | Session, join code/tokens, queue ops, state machine, WebSocket snapshot push, score (Go port), history, restart resume. A tiny Go test client plays a fake player. | A scripted two-client run: queue → play → ended → score → next, with reconnect. |
| **3 Angular** | `/player` (idle, lyrics, score, fanfare) and `/remote`. Generated TS client. Playwright run. | A phone queues a song and the TV page plays it start to finish with lyrics and score. |
| **4 Pi packaging (MVP)** | Cross-build, `install.sh`, systemd units, kiosk, mDNS name, QR on idle screen, ALSA selection. | Fresh Pi OS Lite → install script → boots straight into the idle screen; owner acceptance test passes. |
| **5 Flutter remote + player** | Generated Dart client, discovery (mDNS/QR/manual), remote screens mirroring `/remote`, then player mode (lyrics widget, audio, take-over-screen). Android + iOS first, then Linux/macOS/Windows. | Same user flow as phase 3 from each platform; a laptop in player mode sings a full song with score. |
| **6 Videoke features** | Key change, tempo, fair-order queue, per-device favourites, history and score leaderboard, per-song lyric offset, "random play" when queue is empty (the old Blazor app had it), guest/host permissions UI. | Each feature has a regression test; key change works for `.kar` (and `.karmp3` if the rubberband spike passes). |
| **7 Polish and release** | Backgrounds (images/gradients; videos only if a source exists), flashable image or `.deb`, README and user guide, licence notices (GeneralUser GS, fanfare clips), versioned API. | A stranger can build a Pi from the README. |

Possible later (not scheduled): phone microphone over HTTPS, real pitch-based scoring, multi-room, OTA update.

## 12. Decisions recorded from the owner

| Question | Answer |
|---|---|
| Ship songs? | No. Bring your own library. |
| Flutter role | Remote **and** player mode in v1 (phase 5). |
| Playback permissions | Host only; guests queue and remove their own. |
| Pi hardware | Pi 3B+, HDMI audio. Floor of the project; gated by spike S1 (sections 8, 9, 11). |
| Score | Keep KS100 behaviour (random by level; mic only decides whether a score appears). |
| Legacy Blazor app | Stays deleted (history keeps it). The deletion is uncommitted; the owner commits it. |
| Repo layout | `server/`, `player-web/`, `app/`, `api/`, `deploy/`, `docs/` at the root. |

Still open (not blocking, answer in review): is a USB microphone planned for the Pi (Microphone score
mode needs one; HDMI carries audio out only)?
