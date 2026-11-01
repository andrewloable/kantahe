# Kantahe

A self-hosted karaoke server. You install it on any computer or Docker host, add your own `.kar` and `.karmp3`
songs, create accounts for the people at home, and everyone sings from a browser, a phone or a TV: each person has their
own queue, and any of their devices can be the screen while the others are remote controls.

Kantahe is open source (MIT). It ships **no songs**: you bring your own.

## What it does

* **Songs**: `.kar` (a MIDI file with lyrics) and `.karmp3` (an MP3 with timed lyrics) files, uploaded in the browser or
  read from folders on the server. Every file is its own entry with a number you can type on a number pad, and an MP3
  or MIDI badge. Search, browse by letter, favourites, history and playlists.
* **Accounts**: email and password. The first start creates the admin; the admin creates the other users, decides who
  may upload, and resets forgotten passwords. TVs sign in with a short code approved from a phone.
* **Per-user queue**: one queue and one now-playing song per person. "Play here" moves the singing to the device in
  your hand; your other devices become remotes. Songs wait their turn, and when the queue runs dry a random song plays.
* **Lyrics and score**: words light up as they are sung, with count-in dots before a line. After a song a score screen
  and fanfare, for fun (random) or following how loudly you sing (microphone).
* **Background videos**: the admin uploads H.264 MP4 clips that loop, with no sound, behind the lyrics on the screen that plays;
  each device can switch them off.
* **MIDI that works on weak devices**: the browser synthesizes MIDI songs itself; a TV or an old phone can use a lighter
  mode or let the server render the audio.
* **One program**: the server is a single static binary with the web app inside, for Linux, macOS and Windows
  (amd64 and arm64), and a multi-arch Docker image. Data is a SQLite database and plain files.

## Quick start (Docker)

```sh
# edit the path of your karaoke folder in deploy/compose.yaml, then
docker compose -f deploy/compose.yaml up -d
```

Open <http://localhost:8080> and create the first (admin) account. More ways to run it, and what to back up, are in the
[installation guide](docs/install.md). For use outside your home network, put a reverse proxy with HTTPS in front
([reverse proxy guide](docs/reverse-proxy.md)).

## Guides

* [Installation](docs/install.md): Docker, Linux, macOS, Windows, backups, upgrades.
* [User guide](docs/user-guide.md): signing in, finding and queueing songs, the player, score, favourites, playlists, TVs.
* [Admin guide](docs/admin-guide.md): users, uploads and watched folders, settings, deleting songs, backups.
* [Reverse proxy](docs/reverse-proxy.md): HTTPS with Caddy or nginx.
* TV apps: [Samsung](docs/tv-samsung.md), [LG](docs/tv-lg.md).
* [Plan and decisions](docs/PLAN.md): how it works and why.
* [Releasing](docs/releasing.md): the checklist before a tag, with `scripts/ci-local.sh`.

## Apps

| Where | What |
|---|---|
| Any browser | The web app, served by the server itself. |
| Android, iOS, Android TV | A Flutter app in `app/` (native screens, with the web player inside). |
| Samsung and LG TVs | The web app packaged for each TV (`tv/`), installed in developer mode. |

## Status

The server, the web app and the Android and iOS apps are built and tested, including against a real server in an
emulator. The TV packages (Android TV, Samsung, LG) have run on emulators and in a desktop browser, not yet on real TVs,
and which TV models play MIDI songs without dropouts is still to be measured ([spike S1](docs/spikes/s1-web-player.md)).

## Building from source

The layout and commands are in [CLAUDE.md](CLAUDE.md). In short: `cd server && go test ./...`, `cd web && npx ng test`,
`cd app && flutter test`, and `scripts/build-release.sh` builds the release binaries.

## Licence

MIT, see [LICENSE](LICENSE). The software Kantahe is built from, and the SoundFont it embeds in releases, are listed with
their licences in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (`scripts/licenses.sh` checks and regenerates it).
