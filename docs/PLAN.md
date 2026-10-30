# Kantahe: plan and roadmap

Status: **draft v3 for manual review** (v2 + review fixes + owner answers; all open questions
answered, see section 12). Nothing is built yet. No bd tasks exist yet; they get written after this
plan is agreed.

Target hardware floor: **Raspberry Pi 3B+ (1 GB RAM), HDMI audio**. Kiosk Angular player on it is the
baseline (owner: should be fine).

## 1. What we are building

A videoke machine that is a Raspberry Pi. It boots straight into a full-screen player on the TV. It
hosts its own Wi-Fi; phones join it by scanning a QR code on the TV and get a remote-control web page
automatically.

| Piece | Tech | Role |
|---|---|---|
| `server/` | Go, one static binary for the Pi | Song library, search/browse, lyrics, audio, queue, random fill, state push. Also serves both web apps. |
| `web/` (Angular workspace) → app **player** | Angular (latest stable; 22.x at the time of writing) | The videoke itself. Runs in Chromium kiosk on the Pi. Plays audio, shows lyrics, has **Play/Pause**, **Skip**, and a button to add songs. |
| `web/` → app **remote** | Angular | Opened on users' phones. Browse/search/number entry, add to the queue, see the queue, Play/Pause/Skip. **Cannot play** audio. |
| `web/` → library **shared** | Angular library | Generated connect-es clients, models, state store, the song picker (search, number pad, browse). |
| `proto/` + `gen/` | Protobuf, buf | The ConnectRPC contract and generated Go code. |
| `deploy/` | shell, systemd, NetworkManager, dnsmasq | Wi-Fi hotspot, captive portal, kiosk, install script. |

Song formats: `.kar` (Standard MIDI file with lyrics as text events) and `.karmp3` (a ZIP holding
`.mp3` + `.lrc` + `.nfo`).

Build order (owner): **the Angular player first**, then the Go server, then the Angular remote, then
Pi packaging (section 11).

### Non-goals (cut on purpose, add only if asked)

* Not a general media player; no video/CD/USB browsing.
* No reverse-engineering code. The KS100 extractor (`videoke-ks100/src`) stays a separate project;
  Kantahe only reads its `.kar` / `.karmp3` output.
* **No songs shipped** (decided). Bring-your-own library folder.
* No accounts, no sessions/join codes, no cloud, no internet needed, no multi-room.
* Not reachable from a home network over Ethernet (decided: hotspot only).
* Not in the MVP: volume, key change, tempo, favourites, history UI.

## 2. Required behaviour (the owner's rules)

1. Boots into the Angular player in kiosk mode, **paused** (nothing plays until someone presses Play).
2. Users pick songs by **browsing**, **searching**, or **entering song numbers**; a picked song goes to
   the **queue**. Every listed song shows whether it is **MP3** or **MIDI**.
3. **Play** plays the songs in the queue in order.
4. The player has only **Play, Pause, Skip**, plus a button to open the song picker.
5. If the queue is empty, the player **picks a random song**, and keeps doing so until users add songs.
6. Songs stop **only** when the user presses **Pause**. Nothing interrupts a song. The **score**
   appears when a song ends on its own and never cuts a song short.
7. **Skip while paused** loads the next song and stays paused.
8. The remote web app controls the player from other devices (queue, Play/Pause/Skip) but **cannot
   play the videoke**.
9. The player shows a notification with a **QR code for the Pi's Wi-Fi** (the Pi is the hotspot). When a
   device joins that Wi-Fi, the **remote app opens automatically** (captive portal).
10. The QR is **hidden while at least one phone is joined to the Pi's Wi-Fi**, **comes back by itself
    when none is**, and can be **shown again on demand from the remote app**.

11. A song added while another plays waits its turn; it never interrupts.

## 3. What the sample app (`videoke-ks100/web/index.html`) tells us

One 1,231-line HTML file, no build. A behaviour spec, not reusable code.

| Sample feature | Plan |
|---|---|
| Parse `.kar`: tempo map, lyric text events → lines → words with times (`parseMidi`, `buildMidiSong`, `makeTimeMap`) | **Go server** (D1). Reuse from `videoke-ks100/src`: `ParseKar`, tempo map (`kar.go`, `karaoke.go`). |
| Parse `.karmp3`: unzip, `.lrc` (`[mm:ss.xx]`, `<mm:ss.xx>` per word), `.nfo` (`Key : value`) | **Go server** (`karmp3.go` reading code). |
| Word timing: a word's wipe ends at the next word; last word capped 0.3–1.2 s; `activeLineIndex` | Go (`layoutWords` rules); clients receive `startMs`/`endMs`. |
| Lyrics view: two rows, current row bright, `clip-path` colour wipe, count-in dots | **Rebuild in Angular player**, same look. |
| `.kar` audio via a 31 MB SoundFont synth in the browser | **Dropped** (a 3B+ cannot run it). Server renders the audio (D2). |
| Score (Off / Random / Microphone; levels Low/Middle/High), score screen with rolling number, comment, fanfare by band | **In the MVP** (owner). Rules ported to Go from `videoke-ks100/src/score.go`; the player draws the screen (section 6). |

Library facts (from `videoke-ks100/recovered`): 21,627 index rows; 21,460 `.kar` (824 MB) and 2,189
`.karmp3` (5.5 GB). Name pattern `NNNNN - Artist - Title.ext`; `NNNNN` is the number users type. Some
names have damaged characters (for example `Bisrock�pÏ`): prefer the title/artist inside the file
over the filename, keep the raw name. A song can exist as both `.kar` and `.karmp3` under one number
(in this set, all 2,189 `.karmp3` numbers also have a `.kar`, so 2,189 MIDI entries will be
renumbered; section 5). About 195 `.kar`
files are under 3 KB (likely no real music): the random picker must skip any song that fails to load
or render.

## 4. Architecture

```
          Raspberry Pi 3B+  (hotspot "Kantahe", 10.42.0.1)
 ┌────────────────────────────────────────────────────────────────────────┐
 │ kantahe-server  10.42.0.1:80 + 127.0.0.1:80  (Go)                      │
 │  ├ library scanner + background metadata pass ─► SQLite (FTS5)          │
 │  ├ lyrics normaliser (.kar/.lrc → Lyrics message)                       │
 │  ├ audio: .karmp3 streamed · .kar rendered (fluidsynth) & cached        │
 │  ├ queue + random fill + play state (source of truth)                   │
 │  ├ ConnectRPC kantahe.v1.* (connect-go) · plain HTTP /media/ for audio  │
 │  ├ static: /player/ and /remote/ (go:embed Angular builds)              │
 │  ├ captive-portal responder (probes, unknown hosts → /remote/; release) │
 │  └ Wi-Fi station watcher (iw station dump → QR visibility)              │
 │ NetworkManager hotspot + dnsmasq (DNS: every name → 10.42.0.1)          │
 │ cage + Chromium --kiosk http://localhost/player/  ──► HDMI (video+audio)│
 └──────────▲──────────────────────────────────────────▲──────────────────┘
            │ localhost                                │ Wi-Fi (WPA2)
        player app  (the only client allowed to play)  remote app on phones
```

### Decisions (with the rejected alternative)

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | **Thin clients.** Server parses `.kar`/`.lrc`/`.nfo`; clients get a `Lyrics` message and an audio URL. | Parsing written once, tested once in Go. | Parser in TS. |
| D2 | **Server renders `.kar` to audio** (`fluidsynth` + GeneralUser GS, disk cache, one render at a time, `nice`d). Renders the queue head and the next pick ahead of time; optional `kantahe-server prerender` renders the whole library offline (on a faster machine, then copy the cache). **Output format chosen by spike S1** among WAV, FLAC, Opus and MP3: only the kiosk Chromium ever plays it, so the fastest one to produce on a 3B+ that fits the cache wins. | 3B+ cannot run a browser SoundFont synth; clients stay trivial. | spessasynth in the browser (as in the sample). |
| D3 | **ConnectRPC between the Go server and both Angular apps** (owner requirement): `connect-go` on the server, `connect-es` (`@connectrpc/connect-web`, Connect protocol) in Angular. Browsers only get **unary and server-streaming** calls, so the API uses only those: commands are unary; `WatchState` is a server stream that sends a full state snapshot at once and after every change (no deltas); the player's reports are unary calls. **Audio is not RPC**: plain HTTP `GET /media/…` with Range, so `<audio>` can stream and seek. Captive-portal probes and the static apps are plain HTTP too. | Typed contract and generated clients on both sides; same stack as TianEye; push without a hand-rolled WebSocket protocol; reconnect = reopen the stream and take the first snapshot. | REST (OpenAPI) + WebSocket. |
| D4 | **No sessions, no tokens.** One global queue and play state. The Wi-Fi password is the access control; the server listens only on the hotspot address and loopback. | Wi-Fi join *is* the pairing step; less to build. | Join codes, per-device tokens. |
| D5 | **Only localhost may be the player.** A Connect interceptor on `PlayerService` (`Ready`, `ReportPosition`, `Ended`, `Rescan`) rejects any peer that is not loopback with `PERMISSION_DENIED`. | Enforces "remote cannot play the videoke" with one check. | A pairing protocol. |
| D6 | **SQLite, pure Go (`modernc.org/sqlite`), FTS5, WAL.** | `CGO_ENABLED=0` cross-compile from the Mac; queue survives power-off. | Postgres / in-memory. |
| D7 | **Protobuf is the contract.** `proto/kantahe/v1/*.proto`, generated with `buf` into `gen/` (Go + connect-go) and `web/projects/shared/src/gen` (TS, `protoc-gen-es`); generated code is committed. The player is built first against an **in-memory implementation of the same service interfaces** (connect-es `createRouterTransport`), then switched to the real server by swapping the transport. | Player can come first; the mock cannot drift from the contract because it implements the generated interfaces. | Hand-written client. |
| D8 | **Player is the playback clock.** It reports position about once a second; the server keeps it in memory, advances the queue on `Ended`/Skip. | Lyrics and sound are on one device, so no clock sync. | Server-side clock. |
| D9 | **One Angular workspace, two apps + shared lib; the server embeds both builds** at `/player/` and `/remote/`. | Shared picker/client code; one binary to deploy. | Two repos / nginx. |
| D10 | **Never trust the wall clock.** The Pi has no RTC and no internet; timers, grace periods and `positionAt` use the server's monotonic clock; stored timestamps are informational only. | Boot time is wrong until set. | NTP (no internet). |

## 5. Library, search and browse (server)

* Config by flags/env only: `--library DIR`, `--data DIR`, `--listen 10.42.0.1:80,127.0.0.1:80`,
  `--soundfont FILE`, `--cache-gb 2`, `--wifi-ssid`, `--wifi-pass`, `--wifi-iface wlan0`,
  `--score-seconds 6`.
* **Scan** on start and via `PlayerService.Rescan` (localhost only): walk the folder, parse filenames,
  store path/size/mtime. Then a **background metadata pass** (low priority, one file at a time, skipped
  when mtime+size are unchanged) reads the title/artist inside each file and updates the catalog and
  the search index, so search is good before songs are played.
* **One entry per file** (owner): every `.karmp3` and every `.kar` is its own song entry with its own
  unique number. A song that exists in both formats appears **twice** in every list, once as MP3 and
  once as MIDI, and tapping either queues exactly that entry.
* **Song numbers** (owner: auto-number; every entry has a unique number):
  * `NNN… - Artist - Title.ext`: the leading digits are the number, any length.
  * No leading number: the entry gets the next free number above the highest one in the library.
  * Number already taken: the `.karmp3` keeps the songbook number, the `.kar` with the same number
    is given the next free number (owner: "give MIDI its own number"); two files of the same format
    with one number: the first by path keeps it, the other is renumbered and logged.
  * Assigned numbers are stored by path in SQLite, so they stay the same across rescans and do not
    move when files are added.
* **Catalog row**: `number` (digit string, PK), `format` (`mp3` = `.karmp3`, a real recording;
  `midi` = `.kar`, rendered from MIDI), `path`, `title`, `artist`, `raw_name`, `songbook_number`
  (the number in the filename, kept for reference when it was renumbered), `duration_ms` (nullable),
  `failed` (load/render error, excluded from random).
* **Format shown everywhere an entry is listed** (owner): search results, number-pad preview, browse
  lists, queue, "Up next" and the now-playing title show a badge **MP3** or **MIDI**. Search and
  browse accept a `format` filter so the picker can offer an "MP3 only / MIDI only / All" chip.
* **Search** `CatalogService.SearchSongs(query)`: digits only → number prefix; otherwise FTS5 over
  title+artist, accent-folded, prefix on the last token. 50 per page. Target < 50 ms on a 3B+ for 24k
  rows.
* **Number entry**: `CatalogService.GetSong(number)` returns the song or `NOT_FOUND`; the number pad
  shows the title live as digits are typed, then **Add**.
* **Browse**: `SearchSongs` with `sort` (title/artist/number), `letter` (`#` for digits and other
  scripts) and a page token, plus `CatalogService.ListArtists(letter)` (artists with song counts).
  UI: A–Z strip → list → tap to add.
* **Lyrics** (`CatalogService.GetLyrics`, message `Lyrics`; shown here in its JSON form):

  ```json
  { "songNumber": "01052", "source": "lrc|kar", "durationMs": 231000,
    "lines": [ { "startMs": 7310, "endMs": 11200,
                 "words": [ { "text": "Heto ", "startMs": 7310, "endMs": 7800 } ] } ] }
  ```
* **Audio** (plain HTTP, not RPC) `GET /media/{number}`: an MP3 entry → its MP3; a MIDI entry → the
  rendered file. Range supported so seeking works. The player never requests audio that is not ready:
  readiness is in `State` (`now.audioReady`, `upNext.audioReady`) and the player shows "preparing…"
  until it is true. A direct request for an unrendered song gets `503` with `Retry-After` and starts the
  render.

## 6. Queue, play state and API

**State** (message `State`, sent on the `WatchState` stream at once and after every change; shown
in its JSON form):

```json
{ "status": "paused|playing",
  "playerConnected": true,
  "now": { "songNumber": "01052", "format": "mp3", "source": "queue|random",
           "audioReady": true, "positionMs": 41200, "positionAtMs": 918273 },
  "queue": [ { "id": "q42", "songNumber": "00003", "format": "midi" } ],
  "upNext": { "songNumber": "00977", "format": "midi", "source": "random", "audioReady": false },
  "wifi": { "ssid": "Kantahe", "qr": "WIFI:T:WPA;S:Kantahe;P:...;;",
            "remoteUrl": "http://10.42.0.1/remote/", "showQr": false, "phones": 2 },
  "settings": { "scoreMode": "off|random|microphone", "scoreLevel": "low|middle|high",
                "micAvailable": false },
  "score": null }
```

`score` is `null` normally, or `{ "songNumber": "01052", "value": 87, "comment": "You are a good singer.",
"fanfare": 1 }` (or `value: null` with a reason, such as "Not enough singing was heard") while the
score screen is up. `positionAtMs` is the server's monotonic time of the last position report; remotes
extrapolate the progress bar from it while `status` is `playing`.

**Rules** (the server is the only place they live):

* **Add**: appends to the queue. Never interrupts the current song.
* **Play**: status → playing. If nothing is loaded, take the queue head, else a random song.
* **Pause**: status → paused; keeps position (the player pauses audio). The only way playback stops.
* **Skip**: load the next song (queue head, else the pre-picked random one); keep the current status
  (so Skip while paused stays paused).
* **Song ended** (player calls `Ended {loudReadings}`): if `scoreMode != off`, the server computes
  the score (KS100 rules: `timer % mod + base` with Low 26/75, Middle 21/80, High 11/90 using
  `crypto/rand`, signed remainder as in C; Microphone mode gives no score unless `loudReadings >= 21`;
  comment bands ≤69 / ≤80 / ≤90 / above; fanfare tiers 70–80 / 81–90 / 91+, none below 70), sets
  `score` for `--score-seconds` with status still `playing`, then behaves like Skip. With
  `scoreMode == off` it behaves like Skip immediately. Skip or Pause during the score screen clears
  it. A skipped song gets no score.
* **Random pick** (owner: equal per entry): uniform over all entries (MP3 and MIDI alike) not marked
  `failed` and not among the last 100 played. Picked as soon as the current song starts,
  so a MIDI pick can render during the current song. A MIDI pick reached before its render finishes
  shows "preparing…". If a song fails to load or render it is marked `failed`, logged, and another
  random song is picked. If a user queues a song, the queue wins and the pre-pick is discarded.
* **Remove from queue** / **move to top**: allowed for any device on the Wi-Fi (D4).
* **Position**: `ReportPosition` (about 1/s) updates memory only and does **not** trigger a state
  push. Snapshots are pushed on real changes (status, song, queue, settings, readiness, score, QR).
  Position is written to SQLite only on Pause and about every 30 s (SD-card wear).
* **Player connection**: `playerConnected` is true while the loopback `WatchState` stream is open.
  If Chromium restarts, the player reloads `now` at the last known position with the current status.
  Remotes show "No screen connected" while it is false.
* **Wi-Fi QR visibility** (`wifi.showQr`, computed by the server so every screen agrees; owner: count
  phones joined to the Wi-Fi):
  `showQr = (phones == 0) OR forceQr`, where `phones` is the number of stations associated with the
  hotspot (`iw dev <wifi-iface> station dump`, polled every 5 s). A phone whose screen locks stays
  associated, so the QR does not flash back. `phones` drops to 0 only after 60 s with no stations.
  `forceQr` is set by `SHOW_QR` (remote menu) and cleared by `HIDE_QR` or after 2 minutes. Showing the
  QR never affects playback.
* **Boot** (owner): status `paused`; the song that was playing at power-off is **dropped**; the queue is
  kept; settings are kept.

**Services** (sketch; final shape is `proto/kantahe/v1/*.proto`; unary and server-streaming only):

```proto
service CatalogService {     // any client
  rpc GetInfo(GetInfoRequest) returns (Info);                // version, library size, scan progress
  rpc SearchSongs(SearchSongsRequest) returns (SongPage);    // query, sort, letter, format, page token
  rpc ListArtists(ListArtistsRequest) returns (ArtistPage);  // letter
  rpc GetSong(GetSongRequest) returns (Song);                // NOT_FOUND if unknown
  rpc GetLyrics(GetLyricsRequest) returns (Lyrics);
}
service SessionService {     // any client
  rpc WatchState(WatchStateRequest) returns (stream State);  // snapshot now + after every change
  rpc GetState(GetStateRequest) returns (State);             // polling fallback (section 9)
  rpc AddToQueue(AddToQueueRequest) returns (QueueItem);     // song_number (unique per entry)
  rpc RemoveFromQueue(RemoveFromQueueRequest) returns (RemoveFromQueueResponse);
  rpc MoveToTop(MoveToTopRequest) returns (MoveToTopResponse);
  rpc Control(ControlRequest) returns (ControlResponse);     // PLAY | PAUSE | SKIP | SHOW_QR | HIDE_QR
  rpc UpdateSettings(UpdateSettingsRequest) returns (Settings); // score mode, score level
}
service PlayerService {      // loopback peers only (interceptor, D5)
  rpc Ready(ReadyRequest) returns (ReadyResponse);           // song_number buffered
  rpc ReportPosition(ReportPositionRequest) returns (ReportPositionResponse); // about 1/s
  rpc Ended(EndedRequest) returns (EndedResponse);           // loud_readings
  rpc ReportMic(ReportMicRequest) returns (ReportMicResponse); // mic present? → settings.micAvailable
  rpc Rescan(RescanRequest) returns (RescanResponse);
}
```

Plain HTTP, not RPC: `GET /media/{number}`, `/player/`, `/remote/` (static apps),
captive-portal probe URLs (section 8).

## 7. Angular workspace (`web/`)

One Angular CLI workspace: apps `player` and `remote`, library `shared`. Latest stable Angular
(check `ng version` at scaffold time); signals, standalone components, zoneless, the default test
runner. The player's on-TV picker is a convenience: it works with keyboard, mouse or touch, and with
arrow-key/OK focus navigation if the TV remote reaches the Pi over HDMI-CEC (spike S3). If it does
not, the TV is display-only and phones use the remote app.

**Player** (`/player/`, big type for a TV; controls are only Play/Pause, Skip, Add songs):

| State | Screen |
|---|---|
| Idle / paused, nothing loaded | Logo, "Press Play", queue list, Wi-Fi card (when shown). |
| Playing | Title/artist with format badge, two-row lyrics with colour wipe and count-in dots, thin progress bar, "Up next" strip, controls **⏯ Play/Pause**, **⏭ Skip**, **＋ Add songs**. |
| Preparing | "Preparing…" with the song title while `now.audioReady` is false. |
| Score | When `state.score` is set: big rolling number that lands after ~1.4 s, tier colour, comment, fanfare from `fanfare/` (or "No score this time" in Microphone mode without enough singing). Disappears when `score` clears. |
| Song picker overlay | Tabs **Search · Number · Browse** (shared library). Playback keeps going underneath. Adding shows a toast and keeps the overlay open; Back closes it. |
| Wi-Fi card | Follows `state.wifi.showQr`. Step 1: QR to join the Wi-Fi (SSID shown). Step 2: QR for `http://10.42.0.1/remote/` ("if the remote did not open by itself"). Never stops audio. No button on the player (owner). |

The player sets the audio source only when `audioReady` is true. Lyrics highlight is driven by
`requestAnimationFrame` reading `audio.currentTime`. On the 3B+ animate only `clip-path`/`transform`,
allow 30 fps, hold one decoded song at a time. On start it checks for an audio input
(`enumerateDevices`) and calls `ReportMic`; the Microphone score mode is offered only when one exists.

**Remote** (`/remote/`, phone layout): the same picker as the player, a queue tab (remove, move to
top), a now-playing bar with format badge and **Play/Pause/Skip** (no audio is ever played by this
app), a menu with **"Show Wi-Fi QR on TV"** (sends `SHOW_QR`, toggles to "Hide") and score mode/level,
a "No screen connected" banner when `playerConnected` is false. Bookmarkable at
`http://10.42.0.1/remote/`.

**Shared**: generated connect-es clients, transport factory (real `createConnectTransport` or the
in-memory mock), state store (one `WatchState` stream, signal holding the latest snapshot, reopen
with backoff, falls back to polling `GetState` every 2 s after two stream failures), `SongPicker`,
`NumberPad`, `AlphaBrowse`, `FormatBadge` (MP3 / MIDI, distinct colour and text), models.

## 8. Raspberry Pi: kiosk, Wi-Fi hotspot, captive portal

* **OS**: current Raspberry Pi OS Lite (NetworkManager). 32-bit vs 64-bit is decided by spike S1
  (64-bit Chromium uses noticeably more RAM on 1 GB); the Go build targets `arm64` or `arm` (GOARM=7)
  to match. Packages: `fluidsynth`, `ffmpeg` (if S1 picks an encoded format), `chromium`, `cage`,
  `dnsmasq-base`, `iw`, `fake-hwclock`.
* **Memory (1 GB)**: Chromium kiosk (~300–400 MB) + Go (~50 MB) + one `nice`d render at a time; small
  GPU split; render cache on the USB stick/SD, not tmpfs.
* **Kiosk** (`kantahe-kiosk.service`): `cage -- chromium --kiosk http://localhost/player/
  --autoplay-policy=no-user-gesture-required --alsa-output-device=<HDMI device>`, plus a Chromium
  managed policy (`/etc/chromium/policies/managed/kantahe.json`) with `AudioCaptureAllowedUrls:
  ["http://localhost"]` so the microphone works without a prompt nobody can click.
* **Audio**: HDMI. On a 3B+ the ALSA default is often the 3.5 mm jack, so `install.sh` writes
  `/etc/asound.conf` with HDMI as default and passes the same device to Chromium. HDMI is output only:
  score mode **Microphone** needs a USB mic; **Random** needs nothing.
* **Hotspot**: a NetworkManager profile on `wlan0`: SSID `Kantahe` (configurable), WPA2-PSK with a
  generated password from a QR-safe alphabet stored in `/etc/kantahe/kantahe.env`, `ipv4.method shared`
  (gateway `10.42.0.1`), autoconnect on boot. The server reads the same SSID/password to build
  `WIFI:T:WPA;S:<ssid>;P:<password>;;`. No forwarding/NAT. Ethernet, if plugged in, is not served
  (the server listens only on `10.42.0.1` and `127.0.0.1`).
* **Captive portal**:
  * a dnsmasq drop-in (`/etc/NetworkManager/dnsmasq-shared.d/kantahe.conf`): `address=/#/10.42.0.1`, so
    every hostname resolves to the Pi; optional DHCP option 114 (RFC 8910) → `http://10.42.0.1/remote/`;
  * the server listens on :80 (`AmbientCapabilities=CAP_NET_BIND_SERVICE`);
  * OS probe URLs (`/generate_204`, `/gen_204`, `/hotspot-detect.html`, `/library/test/success.html`,
    `/connecttest.txt`, `/ncsi.txt`, `/canonical.html`, `/success.txt`) and HTML requests for unknown
    hosts answer `302 → http://10.42.0.1/remote/` **until that phone is released**, so Android shows
    "Sign in to network" and iOS opens its captive sheet with the remote;
  * **release** (owner): when a phone (by IP) has loaded the remote and opened `WatchState`, its probes
    get the answer the OS expects (`204`, or the Apple/Microsoft "Success" bodies). The phone then marks
    the Wi-Fi as working and routes its normal browser over it, instead of keeping mobile data as the
    default (the Android behaviour that otherwise makes `10.42.0.1` unreachable outside the sheet).
    Releases are kept in memory and expire when the phone leaves the Wi-Fi;
  * the apps, the Connect routes (`/kantahe.v1.*/`) and `/media/` are served for any `Host`.
* **Services**: `kantahe-server.service`, `kantahe-kiosk.service`.
* **Build**: `ng build` both apps, then `CGO_ENABLED=0 go build` with `go:embed`. `deploy/install.sh`
  installs everything and prints the SSID/password. A flashable image or `.deb` comes later.
* **TV remote (HDMI-CEC)**: the 3B+ HDMI port supports CEC. The kernel CEC framework (`cec-ctl` from
  `v4l-utils`) can register the Pi as a playback device and turn TV remote keypresses into Linux
  keyboard events, which Chromium receives as arrow/Enter/Esc. Spike S3 checks the owner's TV; if it
  does not work, the TV is display-only.

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Captive-portal behaviour differs by OS and version (sheet closes on release, "no internet" prompts, Android routing over mobile data) | Remote may not open by itself, or only work inside the sheet | Release per phone (section 8). Spike S2 on the owner's iPhone and Android, with mobile data on. Fallback: step-2 QR with the remote URL; worst case, document "turn off mobile data". |
| 3B+ built-in Wi-Fi in AP mode supports only a handful of clients (commonly ~8) | Large parties can't all connect | Spike S2 measures it; document; optional USB Wi-Fi adapter. |
| Rendering `.kar` on a 3B+ is slow | "Preparing…" before a song, especially a random MIDI pick after quick skips | Render ahead (queue head + pre-pick); fastest output format (S1); `prerender` offline; smaller SoundFont; 22 kHz. |
| Kiosk Chromium memory/stutter on 1 GB | Player unusable | Expected to work (owner). S1 records numbers on 32- and 64-bit OS; if bad, any other browser on a TV/laptop can be the player screen with the Pi as server (requires relaxing D5). |
| A captive sheet does not support streaming `fetch`, so `WatchState` fails there | Remote shows a stale queue | Shared store falls back to polling `GetState` every 2 s (section 7). |
| Pi is unplugged mid-song (common for a party machine) | SD-card corruption | SQLite WAL; few writes (position every 30 s); phase 6: read-only root with overlayfs, data on a separate partition. |
| No RTC, no internet | Wrong timestamps | D10: monotonic clock for all timing; `fake-hwclock`. |
| Unreadable/silent songs picked at random | Dead air | Mark `failed`, exclude, pick again, log. |
| Damaged characters in names | Bad titles/search | Background metadata pass; fold/strip in search. |
| Song library copyright | Legal exposure | No songs shipped; "bring your own library". |
| Fanfare clips in `fanfare/` (`fanfare1.mp3` = score 70–80, `fanfare2.mp3` = 81–90, `fanfare3.mp3` = 91+) are byte-identical (same MD5) to the clips extracted from the KS100 firmware (`videoke-ks100/recovered/fanfare/FAN0–2`) | If they are the manufacturer's audio, they may not be redistributable in an open-source repo | Owner to confirm their licence before the repo is published; if unclear, replace the three files with original or CC0 clips under the same names (no code change). |

## 10. Testing

* **Go**: table tests; fixtures are generated in tests (tiny synthetic MIDI with lyric events, an
  `.lrc`, an in-memory ZIP), never real commercial songs in git. Real-library tests read
  `KANTAHE_TEST_LIBRARY` and skip when unset. Must-have regression tests:
  * queue rules: add never interrupts; Skip while paused stays paused; random fill when empty; queue
    beats the pre-pick; failed song is marked and skipped; boot drops the interrupted song and keeps
    the queue; position reports do not push snapshots;
  * numbering: leading digits of any length; unnumbered file gets a stable number across rescans;
    `.kar` sharing a `.karmp3`'s number gets a new number and keeps `songbook_number`; duplicate
    number of the same format is re-numbered; adding files never changes existing numbers;
  * QR: `showQr` true at zero stations, false with one, true again 60 s after the last leaves, forced by
    `SHOW_QR` and cleared after 2 minutes (station list injected as a function, no real `iw`);
  * captive: each probe path returns 302 for an unreleased IP and the OS-expected 204/"Success" for a
    released one; release expires when the station leaves;
  * score: ranges per level, `0xFFFFFFFF` → 74 on Low, band → comment → fanfare tier, Microphone mode
    with fewer than 21 loud readings gives no score, skipped songs get no score;
  * `PlayerService` rejects non-loopback peers; search (digits vs text, accents, damaged characters);
    LRC word split and `activeLineIndex` from `videoke-ks100/web/test/core.test.mjs`.
* **Angular**: component tests for lyrics wipe, number pad, A–Z browse, state store reconnect and
  polling fallback, format badge on every entry, MP3 and MIDI entries of one song listed separately,
  "preparing…" until `audioReady`. Playwright (player + remote against a real server and a synthetic
  library): remote adds a song → player queue shows it → Play → lyrics advance → song ends → score →
  next → skip → empty queue → random fill.
* **Contract**: CI runs `buf lint` and `buf generate` and fails if the committed generated code
  differs; `buf breaking` is added after the first release. The Angular mock implements the generated
  service interfaces, so a contract change breaks its compile.
* **Pi acceptance** (manual, owner): boot to idle screen; phone (mobile data on) scans the QR, joins,
  the remote opens by itself and keeps working in the normal browser (iOS and Android); QR hides, and
  returns after all phones leave; 30-minute run with random fill; pull the plug, boot, queue is kept.

## 11. Roadmap

Phases 0–5 are the **MVP**. Each has an exit check.

| Phase | Scope | Exit check |
|---|---|---|
| **0 Spikes and contract** | **S1** (Pi 3B+, 32- and 64-bit Pi OS): Chromium kiosk memory/fps with a stripped sample page; render a 4-minute `.kar` with Chromium running and time WAV/FLAC/Opus/MP3 at 44.1/22 kHz; check the rendered audio lines up with the MIDI lyric times; Range seeking. **S2** (Pi 3B+, owner's iPhone + Android with mobile data on): hotspot, dnsmasq catch-all, stub :80 server with 302 + per-phone release; does the remote open by itself, keep working in the normal browser after release, and does a connect-es server stream work in the sheet; station count via `iw`; how many phones stay connected. **S3** (owner's TV): HDMI-CEC keys reach Chromium? Draft `proto/kantahe/v1/*.proto`, `buf.yaml`, `buf.gen.yaml`. Scaffold `web/`, `server/`, `deploy/`. | Numbers and results written into this file; OS bitness and render format chosen; protos reviewed. |
| **1 Angular player (first)** | `player` app + `shared` lib against the **in-memory mock transport**. The Angular dev server serves fixture audio (a generated tone) and the mock returns synthetic lyrics. Screens: idle, preparing, lyrics with wipe, Play/Pause/Skip, queue strip, picker overlay (Search · Number · Browse), Wi-Fi card, score, keyboard/focus navigation. The mock implements the queue rules simply; the Go server is the reference. | Playwright on the mock: add → play → song ends → score → next → skip → random fill, in a desktop browser. |
| **2 Go server** | Scanner + numbering + background metadata pass, catalog, search/browse/artists, lyrics, `.karmp3` audio, `.kar` render+cache, queue/state machine/random fill, score and settings, connect-go services incl. `WatchState`, `/media/`, SQLite persistence, loopback interceptor, listen addresses, station watcher, captive responder + release, embed + serve apps. | All section 10 Go tests pass; real-library search by number/text/browse correct. |
| **3 Player on the real server** | Swap the mock for the server; fix contract gaps; real `.kar`/`.karmp3` playback. | A full real song with synced lyrics in a desktop browser; empty queue picks random songs until you add one. |
| **4 Angular remote** | `remote` app on the shared picker + queue tab + now-playing bar + menu (Show Wi-Fi QR, score mode/level) + "No screen connected"; phone layout; polling fallback. | Two phones add songs while the player plays; both see the same queue live; remote produces no audio. |
| **5 Pi packaging (MVP done)** | Cross-build, `install.sh`, systemd units, cage+Chromium kiosk with flags and policy, `/etc/asound.conf`, hotspot profile, dnsmasq catch-all. | Fresh Pi OS Lite → install → boots to the idle screen with QR; owner acceptance test (section 10) passes. |
| **6 Polish** | A–Z index performance on a 3B+, picker UX on a TV remote, error screens, read-only root, user guide, licence notices (GeneralUser GS, fanfares), flashable image or `.deb`, Pi boot splash from `branding/export/splash-1920x1080.png`. | A stranger can build a Pi from the README. |
| **7 Later (not scheduled)** | Volume, key change/tempo, favourites/history, per-song lyric offset, background images, fair-order queue, real pitch-based score. | — |

## 12. Decisions recorded and open items

Decided by the owner:

| Topic | Decision |
|---|---|
| Library | Bring your own; no songs shipped. Files without a number are auto-numbered. |
| Hardware | Pi 3B+, HDMI audio; Angular kiosk player runs on it. |
| Remote | A second **Angular** web app; cannot play. Play/Pause/Skip and queue management allowed. |
| Boot state | Paused until Play. After a power loss the interrupted song is dropped; the queue is kept. |
| Skip while paused | Loads the next song, stays paused. |
| Random fill | Any entry, equally (MP3 and MIDI entries alike; MIDI picks may show "preparing…"). |
| MP3 + MIDI of one song | Listed as two separate entries; the MIDI one gets its own number; tapping either queues it. |
| Score | ~6 s score screen between songs (`--score-seconds`); default mode Random / Low. |
| Queue | A song added during playback waits its turn; never interrupts. |
| Forced QR | "Show Wi-Fi QR on TV" hides itself after 2 minutes, or on Hide. |
| MVP scope | No volume, key change or tempo; the TV/amp sets volume. |
| TV remote | Check HDMI-CEC (spike S3); if it does not work, the TV is display-only and phones are the remote. |
| Connect flow | Pi hosts Wi-Fi; TV shows a Wi-Fi QR; remote opens automatically (captive portal); a phone is released once the remote has loaded so its normal browser works. |
| QR visibility | Hidden while at least one phone is joined to the Wi-Fi; back when none is; "Show Wi-Fi QR on TV" in the remote. No QR button on the player. |
| Network exposure | Hotspot only; not served on Ethernet/home network. |
| Player controls | Play, Pause, Skip, plus a song-picker button; playback stops only on Pause. |
| Build order | Angular player first, then Go server, then Angular remote, then Pi packaging. |
| API | **ConnectRPC** between the Go server and both Angular apps (D3, D7); audio stays plain HTTP. |
| Repo | `server/`, `web/`, `proto/` + `gen/`, `deploy/`, `docs/`, `branding/` (logo SVGs + exports, rebuilt by `python3 branding/build.py`), `fanfare/` (score fanfares). |
| Fanfares | Use the three clips in `fanfare/`. Both apps take their favicon/PWA icons from `branding/export/`. |
| Legacy Blazor app | Removed (committed in `25673cd`). |

No open questions remain. The next step is turning this plan into bd tasks.
