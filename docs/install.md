# Installing Kantahe

Kantahe is one program with its web app inside. It listens on port 8080 over plain HTTP; for the
internet (and for microphone scoring in browsers, which needs HTTPS) put a reverse proxy in front of it,
see [reverse-proxy.md](reverse-proxy.md).

**What plain HTTP cannot do.** Browsers (and the apps' embedded player) give some features only to HTTPS pages
and to `localhost`: the microphone, and the MIDI synthesizer of the web player (it needs an AudioWorklet). On a
plain `http://192.168.x.y:8080` address MP3 songs play as usual; for MIDI songs the player switches that device
to the server's rendered audio by itself (it says so once), and microphone scoring is not offered. With the
server's audio rendering switched off (`--render-cache-gb 0`) MIDI songs then cannot play on that device: use
HTTPS through a reverse proxy.

You need two folders:

* a **data folder** for the database, uploaded songs, background videos and settings (Kantahe creates it). Background videos
  (optional, uploaded by the admin) are kept in `<data>/videos`: a one-minute 1080p clip at 6 Mbps is about 45 MB, and the largest
  one allowed is 500 MB unless the admin changes it, so leave some room;
* optionally a **library folder** with your karaoke files (`.kar`, `.karmp3`), which Kantahe scans.
  Kantahe ships no songs.

Settings are flags or environment variables (`kantahe --help` lists them): `--data`, `--library`
(repeatable), `--listen` (default `:8080`), `--public-url`, `--trusted-proxies`, `--soundfont`,
`--score-seconds`, `--render-cache-gb`, `--name` and `--discovery`. Releases are on the project's GitHub releases page, one file per
system named `kantahe-VERSION-OS-ARCH`, with a `SHA256SUMS` file.

## Finding the server from the apps

Kantahe announces itself on the local network (mDNS, service `_kantahe._tcp`) so that the apps can find it without
being told its address. `--name` (or `KANTAHE_NAME`) is the name the apps show when they find more than one server;
by default it is "Kantahe on" and the machine's name, and it may be at most 63 bytes. `--discovery=false` (or
`KANTAHE_DISCOVERY=false`) switches the announcement off. A server that listens on a loopback address only
(`--listen 127.0.0.1:8080`) is not announced. The announcement uses the port of `--listen`, so a server on another
port is found too. If the machine has no network interface that can carry multicast, the server logs "LAN discovery is
off" and goes on serving.

## Docker

```sh
# edit the library path in deploy/compose.yaml, then
docker compose -f deploy/compose.yaml up -d
```

The image is `ghcr.io/andrewloable/kantahe` (linux/amd64 and linux/arm64). The program runs as the
unprivileged user 65532 and keeps its data in the `kantahe-data` volume. Mount your songs at `/library`;
add `:ro` if admins should not be able to delete songs from that folder (uploaded songs go to the data
volume, not to the library). If you mount a host folder for `/data` instead of the volume, it must be
writable by user 65532. To change flags, repeat the whole command in the compose file, for example to
add `--public-url`.

**Discovery from Docker.** Announcements do not leave Docker's default bridge network, and a published port such as
`-p 9000:8080` would announce the wrong port. For the apps to find the server, run the container on the host's
network (`network_mode: host` on Linux, see the commented lines in `deploy/compose.yaml`) or on a macvlan network. The
port the program listens on is then the port clients use: change it with `KANTAHE_LISTEN`, not with a `-p` mapping.
Set `KANTAHE_NAME` as well, because inside a container the machine's name is a container id. On the default network
nothing breaks: the apps simply find no server and ask for its address.

## Linux (systemd)

```sh
# 1. the program (pick amd64 or arm64) and its checksum
sha256sum -c --ignore-missing SHA256SUMS
sudo install -m 755 kantahe-VERSION-linux-amd64 /usr/local/bin/kantahe

# 2. an unprivileged user and the library folder
sudo useradd --system --home-dir /var/lib/kantahe --shell /usr/sbin/nologin kantahe
sudo install -d -o kantahe -g kantahe /srv/karaoke

# 3. the service
sudo cp deploy/systemd/kantahe.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kantahe
sudo journalctl -u kantahe -f
```

The unit keeps the program away from the rest of the system: it can write only to `/var/lib/kantahe`
(the data folder) and `/srv/karaoke` (so that an admin can delete songs). Edit the `ExecStart` line to
change folders or flags; behind a proxy on the same machine use the flags in the comment there.
If your library is under `/home`, change `ProtectHome=yes` to `ProtectHome=read-only` in the unit and keep the
folder in `ReadWritePaths`; otherwise the program cannot see it.

## macOS

```sh
sudo install -m 755 kantahe-VERSION-darwin-arm64 /usr/local/bin/kantahe     # darwin-amd64 on Intel Macs
sudo xattr -c /usr/local/bin/kantahe                                   # clears the download quarantine; the program is not signed
mkdir -p ~/Music/Karaoke
cp deploy/launchd/com.loabletech.kantahe.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.loabletech.kantahe.plist
```

It starts when you log in and restarts if it stops with an error. Data is in
`~/Library/Application Support/Kantahe`, the log in `~/Library/Logs/kantahe.log`, the library in
`~/Music/Karaoke`; edit the plist to change them. Stop it with
`launchctl bootout gui/$(id -u)/com.loabletech.kantahe`. To try it without installing, just run
`kantahe --data ./data --library ~/Music/Karaoke`.

## Windows

Copy `kantahe-VERSION-windows-amd64.exe` (or `arm64`) to `C:\Kantahe\kantahe.exe` and try it in a terminal:

```bat
C:\Kantahe\kantahe.exe --data C:\Kantahe\data --library D:\Karaoke
```

To have it start with the PC, install it as a **Windows service** (run in an administrator terminal; use full paths, a
service does not start in your folder):

```bat
sc.exe create Kantahe binPath= "\"C:\Kantahe\kantahe.exe\" --data C:\Kantahe\data --library D:\Karaoke" start= auto
sc.exe description Kantahe "Kantahe karaoke server"
sc.exe start Kantahe
netsh advfirewall firewall add rule name="Kantahe" dir=in action=allow protocol=TCP localport=8080
```

The program speaks the Windows service protocol when the service manager starts it, so `sc.exe stop Kantahe` stops it
cleanly (within a few seconds) and `sc.exe delete Kantahe` removes the service; started from a terminal it is the same
console program as before. A service runs as the SYSTEM account by default, so the library folder must be readable (and
writable, if admins may delete songs) for it; `sc.exe config Kantahe obj= ...` sets another account. A service has no
console, so its log lines are not kept: if it will not start, `sc.exe query Kantahe` shows the exit code, and running the
same command line in a terminal shows the message. Versions before this one are plain console programs and cannot be a
service (Windows reports error 1053 after thirty seconds): use the scheduled task below with them.

**Alternative: a scheduled task** (also works with every version):

```bat
schtasks /Create /TN Kantahe /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "\"C:\Kantahe\kantahe.exe\" --data C:\Kantahe\data --library D:\Karaoke"
schtasks /Run /TN Kantahe
```

Stop it with `schtasks /End /TN Kantahe`. The task runs as SYSTEM too.

**Files in use.** Windows does not let a program delete or replace a file that another program has open, and a virus scanner or
the search indexer opens every new file for a moment. Kantahe waits a few seconds and tries again, so a short lock is not
noticed. If an admin deletes a song while it is still being played or scanned, the answer is "the song's file is in use (a player
or a virus scanner may have it open); try again in a moment", and nothing has changed: try again. The files Kantahe made
itself (extracted MP3s, per-song SoundFonts, rendered audio) never make an action fail: one that cannot be deleted at once is
removed within about ten minutes. Leaving the data folder out of the virus scanner is optional and makes all of this quicker. Keep
the data folder on a local disk, not on a network share: the database needs local file locking.

**Folders and paths.** Windows spells one folder many ways (`D:\Karaoke`, `d:\karaoke\`, a short name such as `D:\KARAOK~1`, a
link to it), and Kantahe treats them as the same folder: it resolves each watched folder and the data folder to the real place
before it compares anything, and it deletes song files only inside them. So `--library d:\karaoke` and `--library D:\Karaoke` mean
the same, and deleting a song is not refused because a folder was typed in another case. A **junction or symbolic link inside a
watched folder is not followed**: the songs behind it are not listed (the log says so once), and a song file that is reached through
one is never deleted. To use a folder elsewhere, name it with its own `--library`. Use a local folder for `--data` and for the
library (not a mapped network drive that can disconnect).

## First start

Open `http://SERVER:8080`. The first visit asks you to create the **admin** account (email, name,
password). The admin then creates the other users under *Admin → Users* and decides who may upload.
Everyone has their own queue, favourites, history and playlists; the song library is shared.

## Adding songs

* **Upload**: users with the uploader role (and admins) use *Upload* in the menu to send `.kar` and
  `.karmp3` files or ZIP archives of them. The default limit is 50 MiB per file, adjustable by an admin
  under *Admin → Settings* (1 MiB to 1 GiB); a proxy in front must allow more than the limit.
* **Watched folder**: songs placed in a `--library` folder are found when the server starts and every
  ten minutes after; *Admin → Songs → Rescan* looks at once. A deleted file disappears from the library
  on the next scan.

## Backups

Stop Kantahe, copy the whole **data folder** (it holds `kantahe.db` and the uploaded songs), start it
again. The `cache` folder inside the data folder (trimmed SoundFonts and audio the server rendered for devices that
cannot play MIDI) can be left out of a backup and deleted at any time; it fills again as songs are played. Its size is
limited by `--render-cache-gb` (default 5; 0 switches rendering off). The library folder is yours and is backed up like
any other folder. Restoring is the same copy in
the other direction.

## Upgrades

Replace the program (or pull the new image) and restart; the database is upgraded automatically on start.
Make a backup first; going back to an older program after an upgrade is not supported, restore the
backup instead.
