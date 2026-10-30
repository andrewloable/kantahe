# Kantahe: plan and roadmap

Status: **draft v4 for manual review**. v4 replaces the earlier Raspberry Pi plan: Kantahe is now a
self-hosted karaoke **server** that people install on any computer or Docker host, with web, mobile
and TV clients. Nothing is built yet. No bd tasks exist yet; they get written after this plan is
agreed. All owner decisions are recorded in section 13.

## 1. What we are building

A self-hosted karaoke media server. An admin installs it, uploads `.kar` / `.karmp3` songs (or points
it at a folder of them), and creates accounts. Users sign in with **email and password** from any
client, build their own queue, and sing on whichever of their devices they choose; their other
devices act as remotes.

| Piece | Tech | Role |
|---|---|---|
| `server/` | Go, one static binary, pure Go (no cgo, no external programs) | Accounts, library (upload + watched folders), search, lyrics, media, per-user queue and playback state, favourites, history, playlists. Serves the web app. Runs on Linux, macOS, Windows (amd64/arm64) and Docker. |
| `web/` | Angular (latest stable; 22.x at the time of writing) | The **default client**: full app in any browser (library, queue, player, admin, upload). Also packaged as a **Samsung Tizen** and an **LG webOS** TV app. Provides the **player page** that the Flutter apps embed. |
| `app/` | Flutter | **Android, iOS, Android TV** apps. Native screens for sign-in, library, queue, devices, favourites/history/playlists, upload; the full-screen **player is the Angular player inside a WebView**. |
| `proto/` | Protobuf, buf | The ConnectRPC contract; generated code for Go, TypeScript and Dart. |
| `deploy/` | Dockerfile, compose, service files, proxy examples | Packaging. |

Song formats: `.kar` (Standard MIDI file with lyrics as text events) and `.karmp3` (a ZIP holding
`.mp3` + `.lrc` + `.nfo`).

### Non-goals (cut on purpose, add only if asked)

* **No songs shipped.** Users upload their own; the project bundles no song data.
* **One user per queue**: no shared/party queues, no guests.
* No offline downloads, no single sign-on, no email (password reset is done by an admin).
* No built-in HTTPS: internet access goes through the user's own reverse proxy.
* No PostgreSQL: SQLite only.
* Server-side audio rendering only as a per-device fallback for weak devices: MIDI is synthesized by
  the client by default (section 4, D2).
* Not in the MVP: volume, key change, tempo, LAN auto-discovery of servers.

## 2. Behaviour (the owner's rules)

**Accounts**
1. Sign-in is **email + password only**. On first start, a setup page creates the admin account.
2. The **admin creates users** (email, display name, temporary password) and decides who may upload.
   There is no self sign-up.
3. Forgotten password: the **admin resets** it to a temporary one; the user must change it at the next
   sign-in.
4. **TV apps can sign in with a code**: the TV shows a short code; the user approves it from a device
   where they are already signed in.

**Library**
5. **One shared library** for everyone. Users with upload permission upload single files, several
   files, or a ZIP; the server also imports files placed in **watched folders**.
6. **Every file is its own entry with a unique number** (number pad, search, browse). A song present
   as both `.karmp3` and `.kar` is listed twice; every entry shows an **MP3** or **MIDI** badge.
7. The **admin can edit a song's title and artist** and delete songs; edits survive rescans.

**Playback (per user)**
8. Each user has **one queue and one now-playing song**, kept on the server and shared by all of the
   user's signed-in devices.
9. **One device plays at a time** ("Play here" moves playback to the device you are holding); the user's
   other devices are **remotes** for it.
10. Controls are **Play, Pause, Skip**. Songs stop **only on Pause**. Skip keeps the current status.
11. A song added while another plays waits its turn.
12. When the queue is empty, a **random song** plays, and keeps doing so until the user adds songs.
13. **Score** (rules in section 3): after a song ends on its own, a ~6 s score screen with fanfare, then the
    next song. Skipped songs get no score. Mode (Off / Random / Microphone) and level are per user;
    default Random / Low.
14. Per user: **favourites**, **history** (songs sung, with scores), **playlists** (named lists that can
    be queued in one go).

## 3. Song formats, lyric timing and scoring

**`.kar`**: a Standard MIDI File (format 0 or 1). Lyrics are text (`FF 01`) or lyric (`FF 05`) meta
events, usually in a track named `Words`: `/` before a syllable starts a new line, `\` starts a new
paragraph. Title, artist and credits come from `@T` lines (in a track whose events start with
`@KMIDI KARAOKE FILE`, `@V…`, `@I…`), else from the track name. Event times are converted to
milliseconds with the file's division and its tempo map (every `FF 51` tempo change).

**`.karmp3`**: a ZIP with three entries sharing one base name: `NAME.mp3` (the recording), `NAME.lrc`
(`[mm:ss.xx]` per line, `<mm:ss.xx>` before each word or syllable; `[ti:…]`/`[ar:…]` tags) and
`NAME.nfo` (`Key : value` lines such as `Title`, `Artist`). Titles prefer `.nfo`, then LRC tags.

**Lyric timing** (computed on the server, D1; clients only compare times):
* A word's colour wipe runs from its start to the next word's start (at least 50 ms).
* The last word of a line wipes for the line's median gap between words, clamped to 0.3–1.2 s and
  never past the next line's start (at least 50 ms).
* A line starts at its first word and ends when its last word's wipe ends.
* The active line at time `t` is the last line whose start is ≤ `t + 50 ms` (none before the first).

**Lyrics view** (Angular player): two rows; the active line is bright, the other dimmed; lines
alternate between the rows (even lines in the top row, odd in the bottom), so the next line is
already visible; each word wipes from white to the "sung" colour left to right (`clip-path` only);
a line wider than the screen is scaled down to fit. **Count-in dots**: four dots light up during the
last 4 seconds before the first line (only if it starts at 4 s or later) and before any line that
follows a gap of 5 s or more; dot *n* is lit while fewer than *n* whole seconds remain.

**Score** (server, after a song ends on its own; per-user mode and level):
* Off: no score. Random: always a score. Microphone: a score only if the player counted at least 21
  "loud" readings (one reading every 100 ms; loud = microphone RMS above 0.02); otherwise "No score
  this time".
* Value: take a random 32-bit number `r` (`crypto/rand`), read it as a signed 32-bit integer, and
  compute `r % mod + base` with C/Go truncated remainder (so about half the results fall below the
  base): Low `mod 26, base 75` (50–100), Middle `mod 21, base 80` (60–100), High `mod 11, base 90`
  (80–100).
* Comment: ≤ 69 "You can do better.", ≤ 80 "You have the talent.", ≤ 90 "You are a good singer.",
  above "You are excellent!".
* Fanfare: 70–80 `fanfare1.mp3`, 81–90 `fanfare2.mp3`, 91 and above `fanfare3.mp3`, none below 70.
* Screen: the number rolls through random values for about 1.4 s, then lands, coloured by fanfare tier,
  with the comment; shown for `--score-seconds` (6).

**Test library**: real libraries are large (one owner test set has about 21,500 `.kar` and 2,200
`.karmp3` files, every `.karmp3` number also present as a `.kar`), some filenames contain damaged
characters (for example `Bisrock�pÏ`), which is why in-file metadata and admin edits matter, and a
few `.kar` files under 3 KB contain no music (they must be marked `failed`, not crash the player).

## 4. Architecture

```
 ┌──────────────────────── kantahe server (Go, any OS / Docker) ───────────────────────┐
 │ Auth · Admin · Upload · Catalog · Session · UserLibrary services                     │
 │   (ConnectRPC, connect-go)                                                           │
 │ plain HTTP: /media/* (signed URLs, Range) · static web app                           │
 │ importer: uploads + watched folders → numbering → metadata pass                      │
 │ SQLite (WAL, FTS5) in the data folder · uploaded songs + extracted MP3s on disk       │
 └───────▲────────────────────────▲──────────────────────────▲──────────────────────────┘
         │ HTTP (HTTPS via the user's reverse proxy for internet access)
   Angular web app           Samsung / LG TV apps          Flutter app (Android, iOS, Android TV)
   (browser)                 (the Angular app packaged)    native screens + WebView → /embed/player
   └───────────────── every device can be the player or a remote for the same user ─────────────────┘
```

### Decisions (with the rejected alternative)

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | **Server parses lyrics.** `.kar` lyric events and `.karmp3` `.lrc`/`.nfo` become one `Lyrics` message (lines → words with `startMs`/`endMs`). | Written and tested once in Go; no parser in TS or Dart. | Parser per client. |
| D2 | **MIDI is synthesized on the client** (owner) by **one web player**: spessasynth + a SoundFont served by the server. Browsers and TV apps run it directly; the Flutter apps embed the same player in a WebView. To make it fit cheap Android TV boxes and TVs (section 4.1): **per-song trimmed SoundFonts**, a per-device **low-power synth mode**, and a per-device **server-render fallback**. | One synth and one lyrics renderer for every platform; the server stays pure Go with no external programs. | Server-side rendering for everyone; a native synth plugin per Flutter platform; Android's built-in MIDI player (poor sound, second clock for lyrics). |
| D3 | **ConnectRPC** for all client–server calls: connect-go, connect-es (Angular), connect-dart (Flutter). Unary and server-streaming only (browsers cannot do more). `WatchState` streams the user's full state snapshot at once and after every change. **Uploads are ConnectRPC too** (owner): one unary call per file (browsers cannot stream uploads), 50 MB limit; ZIPs are unpacked on the client and sent file by file. **Only media is plain HTTP** (audio needs HTTP Range so `<audio>` can seek). | Typed contract on three platforms; push without a hand-made WebSocket protocol; one API style for everything but audio. | REST + WebSocket; multipart upload endpoint. |
| D4 | **Bearer tokens per device**, opaque, stored hashed. Sent in the `Authorization` header. Media URLs are **short-lived signed URLs** issued by the server, because `<audio src>` cannot send headers. No cookies, so no CSRF. | Same scheme for same-origin web, packaged TV apps (different origin) and Flutter. | Cookies (break for packaged TV apps). |
| D5 | **Playback ownership by device.** Player reports (`Ready`, `ReportPosition`, `Ended`) are accepted only from the user's current player device. Commands (Play/Pause/Skip, queue) are accepted from any of the user's devices. | "One device plays at a time" enforced in one place. | Trusting clients. |
| D6 | **SQLite, pure Go (`modernc.org/sqlite`), WAL, FTS5.** | Zero setup on every OS and in Docker; cross-compiles without cgo. | PostgreSQL. |
| D7 | **Protobuf contract** in `proto/kantahe/v1/`, `buf generate` into `server/gen/` (Go), `web/src/gen/` (TS) and `app/lib/gen/` (Dart); generated code is committed. | One source of truth for three codebases. | Hand-written clients. |
| D8 | **The player device is the playback clock.** It reports position about once a second (kept in memory, saved every ~30 s and on Pause); the server advances the queue on `Ended`/Skip. If the server restarts, the player keeps playing and resynchronises when its stream reconnects. | Lyrics and sound are on one device; no clock sync. | Server-side clock. |
| D9 | **Single Angular app** with a separate **`/embed/player`** route (player only, no navigation) for the Flutter WebView; TV packages are build configurations of the same app. | One web codebase. | Separate player project. |
| D10 | **HTTP only; HTTPS by reverse proxy.** Documented Caddy and nginx examples (no response buffering and long timeouts for `WatchState`, large upload size). | Users already run proxies; no certificate code in the server. | Built-in Let's Encrypt. |

### 4.1 MIDI on weak devices (cheap Android TV boxes, TVs, old phones)

Why they struggle: the WebView/TV browser itself needs a few hundred MB, the full 31 MB SoundFont is
decoded into sample memory (which can be larger than the file), and the synth mixes dozens of voices
with reverb in JavaScript on slow ARM cores. Boxes often have 1–2 GB RAM. MP3 songs are unaffected.
Three layers, cheapest first; each device ends up on the lightest one it needs:

1. **Per-song trimmed SoundFont (default for every client).** A karaoke MIDI uses roughly 6–12
   instruments plus drums. The server builds a SoundFont containing only the presets (and their
   samples) that the song's MIDI selects (program changes per channel, bank select, the drum kit on
   channel 10, and the default piano when a channel has no program change), caches it next to the song
   as `<sha256>.sf2`, and the player loads that instead of the full bank. Memory and download go from
   tens of MB to a few MB per song. Built in Go (SF2 is a documented RIFF format: copy the used
   `phdr/pbag/pgen/inst/ibag/igen/shdr` records and the referenced sample data, renumbering indices).
   Built on first request and ahead of time for the queue head and `upNext`; the whole-bank file stays
   available for fallback.
2. **Low-power synth mode (per device).** Voice limit 32 (instead of spessasynth's default), reverb and
   chorus off, 22.05 kHz audio context. Roughly halves CPU or better; slightly thinner sound.
3. **Server render (per device).** The server renders the song's MIDI with the trimmed SoundFont using
   a pure-Go SoundFont synth (candidate: go-meltysynth; checked in spike S1), encodes it, caches it, and
   the device plays it like an MP3 entry. Lyrics stay the same (same MIDI timing). Costs server CPU on
   first play (seconds per song on a normal PC) and cache disk (`--render-cache-gb`, default 5, least
   recently used evicted). The encoder must also be pure Go (or the output is WAV/FLAC); decided in S1.

Per-device setting `midiMode`: `auto` (default), `full`, `lowPower`, `server`. `auto` uses the device's
reported memory (Flutter reads it natively; browsers use `navigator.deviceMemory` where available):
≥ 3 GB → full synth, 2 GB → low power, ≤ 1 GB or unknown on a TV build → server render; and it steps
down one level for the rest of the session when the player detects audio dropouts (the audio clock
falling behind real time by more than 100 ms). Users can override it in the device's settings.

Published minimum spec (from spike S1 numbers): MP3 songs on any supported device; MIDI songs per
mode, for example "full synth needs ~2 GB RAM; anything else uses server render".

## 5. Accounts and sign-in

* **Setup**: while no user exists, `AuthService.Setup` (and the `/setup` page) creates the first admin.
  It is refused once any user exists.
* **Users**: email (unique, case-insensitive), display name, password hash (argon2id via
  `golang.org/x/crypto/argon2`), roles `admin` and `uploader`, `must_change_password`, `disabled`.
* **Sign-in**: `Login(email, password, deviceName, deviceType)` returns a device token. After 5
  failures for one email or IP, further attempts are slowed (exponential back-off). Disabled users
  cannot sign in.
* **Tokens**: 32 random bytes, stored as SHA-256, one per device, with `last_seen`. A token unused for
  90 days expires. Users see and revoke their devices; a password change revokes all
  other devices; the admin can revoke all of a user's devices.
* **Admin password reset**: sets a temporary password and `must_change_password`; the user can do
  nothing but change it after signing in.
* **Code sign-in for TVs**: the TV calls `StartCodeLogin` and shows a 6-character code (and a QR to the
  approval page); a signed-in user opens "Approve a TV" (`/code` in the web app, or the Flutter app) and
  calls `ApproveCode(code)`; the TV's `WaitCodeLogin` stream then returns its device token. Codes
  expire after 5 minutes and work once.

## 6. Library

* **Storage**: `--data DIR` holds the SQLite database, uploaded songs (`songs/`, named by SHA-256)
  and extracted MP3s (`media/`; MP3s inside a `.karmp3` ZIP are deflated, so they are extracted once
  at import to allow HTTP Range). `--library DIR` (repeatable) are **watched folders**: files are
  referenced in place, scanned at start, every 10 minutes and on the admin's "Rescan".
* **Upload** (users with `uploader`): `UploadService.UploadSong(filename, bytes)`, one ConnectRPC call
  per `.kar` or `.karmp3`. A `.zip` of songs is unpacked **on the client** (web: fflate, as in the
  sample; Flutter: the `archive` package) and its songs are sent one call at a time with a progress
  bar. Server checks: `.kar` starts with `MThd`; `.karmp3` is a ZIP containing an `.mp3`, with entry
  count and uncompressed-size limits (ZIP bombs); size limit 50 MB per file (admin setting; the
  connect-go handler's read limit matches it); duplicates by SHA-256 are skipped. Each call returns
  added (with its number), duplicate, or rejected (with the reason); the client shows a report.
* **Numbers** (unique per entry):
  * leading digits of the original filename (`NNN… - Artist - Title.ext`), any length;
  * no number: next free number above the highest one;
  * number taken: the `.karmp3` keeps it and a `.kar` gets the next free number; two files of the same
    format: the first one keeps it; the original number is kept as `songbook_number`;
  * assigned numbers never change, whatever is added later.
* **Metadata**: a low-priority background pass reads title/artist inside each file. Admin edits
  (`AdminService.UpdateSong`) are stored separately and always win.
* **Delete** (admin): the entry is removed **together with its file**, for uploads and for watched-folder
  files alike (owner). A watched folder must therefore be writable for deletion; if the file cannot be
  deleted (read-only mount, permissions), the call fails with that reason and nothing changes.
  Deleted numbers are never reused.
* **Catalog row**: `number`, `format` (`mp3`/`midi`), `title`, `artist`, `songbook_number`, `source`
  (`upload`/`folder`), `path`, `sha256`, `duration_ms`, `failed` (excluded from random).
* **Search** `CatalogService.SearchSongs`: digits only → number prefix; otherwise FTS5 over title and
  artist, accent-folded, prefix match on the last word; `format` filter; 50 per page.
  **Browse**: by title / artist / number with an A–Z (`#`) letter; `ListArtists(letter)`.
  **Number pad**: `GetSong(number)`.

## 7. Per-user playback state and API

**State** (message `State`, per user, sent on `WatchState` at once and after every change; JSON form):

```json
{ "status": "paused|playing",
  "playerDeviceId": "d7",
  "devices": [ { "id": "d7", "name": "Living room TV", "type": "androidtv", "online": true,
                 "micAvailable": false, "memoryMb": 1024, "midiMode": "auto", "effectiveMidiMode": "server" } ],
  "now": { "number": "01052", "format": "mp3", "title": "…", "artist": "…", "source": "queue|random",
           "positionMs": 41200, "positionAtMs": 918273 },
  "queue": [ { "id": "q42", "number": "00003", "format": "midi", "title": "…" } ],
  "upNext": { "number": "22891", "format": "midi", "source": "random" },
  "settings": { "scoreMode": "off|random|microphone", "scoreLevel": "low|middle|high" },
  "score": null }
```

**Rules** (only on the server):

* **Play here** (`Control PLAY` from a device) makes that device the player and starts playing; the
  previous player is told to stop and becomes a remote. Play from a remote resumes on the current
  player.
* **Pause** / **Skip** / **Add** / **Remove** / **Move to top** / **Add playlist**: from any of the user's
  devices. Add never interrupts; Skip keeps the status.
* **Ended** (from the player, with `loudReadings`): score per section 3, `score` shown for
  `--score-seconds` (6), history entry written, then the next song. Skipped songs: no score, history
  entry without score.
* **Random fill**: when the queue is empty, uniform over all entries not `failed` and not in the
  user's last 100 played. Pre-picked as `upNext` when the current song starts.
* **Player gone**: if the player device's stream is closed for more than 30 s, status becomes `paused`
  at the last position; any device can Play here to continue from there.
* **Position** reports update memory only and never trigger a push; remotes extrapolate from
  `positionAtMs` (server monotonic clock).
* **Microphone mode**: offered only when the player device reports a usable microphone (web over HTTPS
  or localhost, Flutter apps; TV apps normally not).

**Services** (sketch; final shape is `proto/kantahe/v1/*.proto`):

```proto
service AuthService {
  rpc Setup(SetupRequest) returns (LoginResponse);                 // only while no users exist
  rpc Login(LoginRequest) returns (LoginResponse);                 // email, password, device name/type
  rpc Logout(LogoutRequest) returns (LogoutResponse);
  rpc ChangePassword(ChangePasswordRequest) returns (ChangePasswordResponse);
  rpc Me(MeRequest) returns (User);
  rpc ListMyDevices(ListMyDevicesRequest) returns (DeviceList);
  rpc RevokeDevice(RevokeDeviceRequest) returns (RevokeDeviceResponse);
  rpc StartCodeLogin(StartCodeLoginRequest) returns (CodeLogin);    // TV: code + expiry
  rpc WaitCodeLogin(WaitCodeLoginRequest) returns (stream CodeLoginEvent); // TV: token when approved
  rpc ApproveCode(ApproveCodeRequest) returns (ApproveCodeResponse);       // signed-in user
}
service AdminService {        // admin only
  rpc ListUsers / CreateUser / UpdateUser / ResetPassword / DeleteUser / RevokeUserDevices;
  rpc UpdateSong(UpdateSongRequest) returns (Song);                // title, artist
  rpc DeleteSong(DeleteSongRequest) returns (DeleteSongResponse);
  rpc Rescan(RescanRequest) returns (RescanResponse);
  rpc GetSettings / UpdateSettings;                                // upload limits, score seconds, SoundFont
}
service UploadService {       // users with the uploader role
  rpc UploadSong(UploadSongRequest) returns (UploadSongResponse);  // filename + bytes (≤ 50 MB); added/duplicate/rejected
}
service CatalogService {
  rpc SearchSongs / ListArtists / GetSong / GetLyrics;
  rpc GetPlayback(GetPlaybackRequest) returns (Playback);          // signed URLs per the device's MIDI mode, lyrics
}
service SessionService {      // always the caller's own user
  rpc WatchState(WatchStateRequest) returns (stream State);
  rpc GetState(GetStateRequest) returns (State);                   // polling fallback
  rpc AddToQueue / AddPlaylistToQueue / RemoveFromQueue / MoveToTop;
  rpc Control(ControlRequest) returns (ControlResponse);           // PLAY (here) | PAUSE | SKIP
  rpc UpdateSettings(UpdateSettingsRequest) returns (Settings);    // score mode/level
  rpc Ready / ReportPosition / Ended / ReportMic;                  // current player device only
  rpc ReportDevice(ReportDeviceRequest) returns (Device);          // memory, dropouts seen → effective MIDI mode
  rpc SetMidiMode(SetMidiModeRequest) returns (Device);            // auto | full | lowPower | server
}
service UserLibraryService {  // favourites, history, playlists of the caller
  rpc SetFavourite / ListFavourites / ListHistory;
  rpc ListPlaylists / GetPlaylist / CreatePlaylist / UpdatePlaylist / DeletePlaylist;
}
```

Plain HTTP (everything else is ConnectRPC): `GET /media/song/{number}?exp=&sig=` (MP3 with Range,
or the `.kar` file), `GET /media/soundfont/{number}.sf2?exp=&sig=` (per-song trimmed SoundFont),
`GET /media/rendered/{number}?exp=&sig=` (server-rendered MIDI audio with Range; `503` + `Retry-After`
while rendering), `GET /media/soundfont.sf2` (full bank) and `GET /media/fanfare/{1|2|3}.mp3` (cacheable, no
secret content), and the static web app (with `/embed/player`).

## 8. Clients

**Angular web app** (`web/`): signals, standalone components, zoneless, default test runner.

| Route | Screen |
|---|---|
| `/setup`, `/login`, `/code` | First admin; email + password sign-in; approve a TV code. |
| `/library` | Search · Number pad · Browse (A–Z, artists), MP3/MIDI badges, format filter, add to queue, favourite. |
| `/queue` | Queue (remove, move to top), up next, now playing, **devices** with "Play here" / which one plays, Play/Pause/Skip. |
| `/player` | Full-screen player: lyrics with colour wipe and count-in dots, title + badge, progress, Play/Pause/Skip, score screen with fanfare, "preparing…" while the SoundFont loads. |
| `/embed/player` | The same player without app navigation, for the Flutter WebView. Receives the device token from Flutter through a JavaScript channel (never in the URL). |
| `/me` | Favourites, history, playlists, my devices, change password, score settings. |
| `/admin` | Users (create, roles, reset password, revoke), songs (upload, edit title/artist, delete, rescan, import report), server settings. |

Player internals: MP3 (and server-rendered MIDI) through `<audio>`; otherwise MIDI through
spessasynth's sequencer and synth with the song's trimmed SoundFont (full or low-power settings per
the device's effective MIDI mode, section 4.1). The player shows "preparing…" until the trimmed
SoundFont or the rendered audio is ready, and watches for dropouts (`ReportDevice`). Lyrics follow the
current playback time in both cases. Microphone loudness readings as in the sample (counts loud
100 ms samples; reported on `Ended`).

**Samsung Tizen / LG webOS** (phase 6): build configurations of the same Angular app, packaged as a
Tizen `.wgt` and a webOS `.ipk`. Differences: first-run "server address" screen, code sign-in,
D-pad focus navigation, large type. Minimum TV model years come from spike S1.

**Flutter app** (`app/`: Android, iOS, Android TV):

* Native screens mirroring the web app: server address, email/password sign-in (code sign-in on
  Android TV), library (search, number pad, browse), queue + devices, favourites/history/playlists,
  settings, upload (file picker) for uploaders.
* **Player**: a full-screen WebView loading `{server}/embed/player`; the device token is passed in via
  a JavaScript channel. Play/Pause/Skip are native controls that call `SessionService.Control`; the
  embedded player reacts to the state stream like any other player. On Android TV the D-pad drives
  the native controls; the WebView never needs focus. WebView settings: media playback without a user
  gesture; microphone permission forwarded for Microphone score mode.
* Dart client generated from the protos (connect-dart, checked in spike S2). Tokens in the platform
  keystore (`flutter_secure_storage`).
* iOS: App Transport Security exceptions for plain-HTTP servers on the local network
  (`NSAllowsLocalNetworking`), local-network permission text. Android: cleartext traffic allowed.

## 9. Deployment

* **Binaries**: `CGO_ENABLED=0` builds for linux/macos/windows × amd64/arm64 attached to each release.
  The Angular build, fanfares and the default SoundFont are embedded with `go:embed`.
* **Docker**: multi-arch image (linux/amd64, linux/arm64) on a minimal base;
  `docker run -p 8080:8080 -v kantahe-data:/data -v /path/to/karaoke:/library <image>` (mount the
  library read-only with `:ro` if admins should not be able to delete songs from it); a compose
  example in `deploy/`.
* **Service files**: systemd unit, launchd plist, Windows service instructions in the docs.
* **Config**: flags/env only: `--listen :8080`, `--data`, `--library` (repeatable), `--soundfont`,
  `--render-cache-gb` (server-render cache, default 5),
  `--public-url` (for the approval QR shown on TVs).
* **Reverse proxy**: Caddy and nginx examples in `deploy/` (HTTPS, streaming without buffering for
  `/kantahe.v1.SessionService/WatchState` and `/kantahe.v1.AuthService/WaitCodeLogin`, request body
  limit above 50 MB for `/kantahe.v1.UploadService/UploadSong`).
* **SoundFont**: GeneralUser GS (licence allows redistribution), fetched at build time from a pinned
  URL with a SHA-256 check and embedded; admins can point `--soundfont` at another file.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| spessasynth + a 31 MB SoundFont is too heavy for TV browsers (Tizen, webOS), cheap Android TV boxes or WebViews | MIDI songs stutter or fail on weak devices | Section 4.1: per-song trimmed SoundFonts for everyone, low-power synth mode, server-render fallback chosen per device automatically (memory, dropouts) or by the user; S1 measures each layer on the owner's box; published minimum spec. MP3 songs unaffected. |
| Server-render fallback is slow on a weak server (NAS, small ARM board) | "Preparing…" on weak devices | Render ahead for the queue head and `upNext`; render cache; only devices that need it use it. |
| Older TV web engines cannot run the latest Angular | TV app limited to newer models | S1 finds the minimum model years; state them in the docs. |
| Lyrics drift from spessasynth playback | Words lit at the wrong time on MIDI songs | Server and player use the same MIDI tempo map; S1 measures it; the player can follow the sequencer's own clock. |
| App Store review of an app whose player is a WebView | iOS release delayed | Native screens for everything except the player (owner's choice for this reason). |
| Server exposed to the internet | Account takeover, abuse | Sign-in back-off, argon2id, device revocation, HTTPS by proxy (documented as required for internet use), upload permission and limits, short-lived signed media URLs. |
| Microphone needs HTTPS (browsers) | Microphone score mode missing on plain-HTTP web | Mode offered only where available; Random is the default. |
| connect-dart maturity (streaming over HTTP/1.1 on Android/iOS) | Flutter cannot use `WatchState` | Spike S2; fallback: polling `GetState`, or a small hand-written Connect JSON client. |
| Users upload copyrighted songs | Legal exposure for operators | Self-hosted; the project ships no songs; docs say users are responsible for what they upload. |
| The licence of the three fanfare clips in `fanfare/` is not confirmed | May not be redistributable | Owner confirms their licence before publishing; otherwise replace the three files under the same names (no code change). |

## 11. Testing

* **Go**: table tests with synthetic fixtures (tiny MIDI with lyric events, `.lrc`, in-memory ZIPs);
  never commercial songs in git; real-library tests read `KANTAHE_TEST_LIBRARY` and skip when unset.
  Must-have regression tests:
  * auth: setup works only once; wrong password back-off; disabled user refused; temporary password
    forces a change; password change revokes other devices; a revoked token is refused; code sign-in
    expires after 5 minutes and works once; a non-admin calling `AdminService` is refused;
  * isolation: a user can never read or change another user's queue, state, favourites, history or
    playlists;
  * playback: only the player device's reports are accepted; Play here moves the player; Add never
    interrupts; Skip keeps the status; random fill when empty, excluding the last 100 and failed songs;
    player gone for 30 s pauses at the last position; score rules (ranges per level over many draws: Low 50–100,
    Middle 60–100, High 80–100; `0xFFFFFFFF` → 74 and 27 → 76 on Low; comment at 69/70; fanfare tier
    for 69, 70, 80, 81, 90, 91 → none, 1, 1, 2, 2, 3; Microphone threshold; no score on Skip);
  * library: numbering (leading digits, auto-number, MP3 keeps the number, MIDI renumbered, numbers
    stable when files are added, deleted numbers not reused); `UploadSong` checks (non-uploader
    refused, bad MIDI header, `.karmp3` without MP3, over 50 MB, ZIP bomb inside a `.karmp3`,
    duplicate); delete removes the file, and a read-only folder makes the delete fail with nothing
    changed; admin edits survive rescans; signed media URLs expire and are bound to the user;
  * lyrics: `[00:01.00]<00:01.00>He<00:01.50>llo <00:02.00>you` → words `He`, `llo `, `you`; with a
    second line at 5.00 s the active line is none at 0.5 s, the first at 3 s, the second at 5.1 s;
    every word ends after it starts; lines are ordered; the count-in rules of section 3;
  * SoundFont trimming: a synthetic MIDI using programs 0, 24 and drums produces an SF2 holding exactly
    those presets (bank 128 kit included, default piano for a channel without program change), which
    the Go reader parses back; a song with a program change mid-song keeps both presets; output is
    cached by SHA-256;
  * MIDI mode: `auto` picks full / lowPower / server from reported memory; a dropout report steps
    down one level; a user override wins; `GetPlayback` returns the URL matching the effective mode;
  * server render: synthetic MIDI renders to non-silent audio whose length matches the MIDI duration
    within 0.5 s; the render cache evicts least recently used files above the limit.
* **Angular**: component tests (lyrics wipe, number pad, browse, badges, state store with reconnect and
  polling fallback) and one Playwright run against a real server with a synthetic library: setup →
  admin creates a user and uploads → user searches → queues an MP3 and a MIDI entry → both play with
  lyrics → score → random fill → second browser "Play here" takes over → favourite, history, playlist.
* **Flutter**: widget tests; one integration test against the Go binary with the synthetic library
  (sign-in, queue, player WebView plays, remote control of a web player).
* **Contract**: `buf lint` and `buf generate` in CI; fail if committed generated code differs;
  `buf breaking` after the first release.
* **Packaging**: CI starts the Docker image (amd64 and arm64) and each native binary and checks that the
  setup page answers.

## 12. Roadmap

Phases 0–3 are the **MVP** (server + web). Each phase has an exit check.

| Phase | Scope | Exit check |
|---|---|---|
| **0 Spikes and contract** | **S1** web player on real targets (desktop browsers, Samsung Tizen TV, LG webOS TV, Android TV WebView, iOS WKWebView, Android WebView): SoundFont load time and memory, glitches, lyric sync on MIDI, autoplay, microphone; minimum TV model years. On the **owner's cheap Android TV box**: free memory, load time and dropouts for full bank vs per-song trimmed SoundFont, full vs low-power synth; time a pure-Go server render (go-meltysynth or alternative) and pick its output encoding. Results set the `auto` thresholds and the published minimum spec. **S2** connect-dart unary + server streaming on Android, iOS and Android TV. **S3** Flutter WebView embedding `/embed/player`: token hand-off, native controls, D-pad. Draft `proto/kantahe/v1/*.proto`; scaffold `server/`, `web/`, `app/`, `deploy/`. | Results written into this file; protos reviewed. |
| **1 Go server** | Setup, accounts, tokens, code sign-in, admin; upload + watched folders, numbering, metadata pass, admin edits; search/browse/lyrics; media (MP3 extraction, signed URLs, full and per-song trimmed SoundFonts, fanfares); device MIDI modes; per-user state, devices, Play here, random fill, score; favourites, history, playlists; `WatchState`. | All section 11 Go tests pass; a large real library (`KANTAHE_TEST_LIBRARY`) imports with correct numbers and searches correctly. |
| **2 Angular web app** | All routes in section 8 including admin, upload and `/embed/player`. | The section 11 Playwright run passes. |
| **3 Packaging (MVP done)** | Release binaries, Docker image, compose, service files, reverse-proxy examples, install docs. | Fresh Docker host and fresh macOS/Windows/Linux machines reach the setup page and complete the Playwright flow. |
| **4 Flutter Android + iOS** | Native screens, Dart client, player WebView, upload, phone as remote. | The same flow from both apps; a phone controls a web player and vice versa. |
| **5 Server render + Android TV** | Server-render fallback (pure-Go synth, encoding, render cache, `/media/rendered`, `auto` step-down to server); Flutter Android TV: D-pad navigation, code sign-in, TV layout. | On the owner's cheap box: sign in with a code, queue from a phone, sing MP3 and MIDI songs without dropouts (in whatever mode `auto` picks). |
| **6 Samsung Tizen + LG webOS** | Package the Angular app; server address screen, code sign-in, D-pad. | Installs and plays MP3 and MIDI songs on one Samsung and one LG TV. |
| **7 Polish** | User guide, store listings, licence notices (GeneralUser GS, spessasynth, fanfares), app icons and splash from `branding/`. | A stranger installs the server and an app from the docs alone. |
| **Later** | Offline downloads, email password reset, single sign-on, shared/party queues, guests, LAN discovery, volume, key/tempo, real pitch scoring. | — |

## 13. Decisions recorded and open items

Decided by the owner:

| Topic | Decision |
|---|---|
| Product | Self-hosted server on any OS and Docker; no Raspberry Pi. |
| Clients | Angular web app (default; also packaged for Samsung Tizen and LG webOS TVs); Flutter apps for Android, iOS and Android TV. All are full players and remotes. |
| Flutter player | Native Flutter screens; the player is the Angular player in a WebView. |
| MIDI audio | Synthesized on the client (spessasynth in the web player) with per-song trimmed SoundFonts; low-power mode and server render as per-device fallbacks for weak devices (section 4.1). |
| Accounts | Email + password only; first-run admin setup; admin creates users and resets passwords. TV apps can sign in with a code. |
| Library | One shared library; upload (files or ZIP) by permitted users + watched folders; admin edits title/artist. |
| Numbers | Kept: every entry has a unique number; MP3 keeps the songbook number, MIDI is renumbered. |
| Playback | Per-user queue and now-playing on the server; one player device at a time; other devices are remotes; one user per queue. |
| Queue rules | Play/Pause/Skip; stop only on Pause; random fill; added songs wait their turn. |
| Score | Score screen kept (rules in section 3); default Random / Low; per-user setting. |
| Extras in MVP | Favourites, history, playlists. |
| Network | Plain HTTP; internet access via the user's reverse proxy. |
| Database | SQLite only. |
| Offline | Not in the MVP. |
| API | ConnectRPC (connect-go, connect-es, connect-dart) between the server and every frontend, including uploads (one file per call, ZIPs unpacked on the client); only audio media is plain HTTP. |
| Deleting songs | Removes the entry and its file, also in watched folders. |
| Sign-in tokens | Expire after 90 days unused; revocable any time. |
| Defaults | GeneralUser GS embedded as the default SoundFont (replaceable); player gone 30 s → paused at the last position, resumable on any device; port 8080; upload limit 50 MB per file. |
| Build order | Server → Angular web → packaging → Flutter Android/iOS → Android TV → Samsung/LG. |
| Fanfares | The three clips in `fanfare/`. |

No open questions remain. Next step: turn this plan into bd tasks.
