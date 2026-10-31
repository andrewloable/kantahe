# Installing Kantahe

Kantahe is one program with its web app inside. It listens on port 8080 over plain HTTP; for the
internet (and for microphone scoring in browsers, which needs HTTPS) put a reverse proxy in front of it,
see [reverse-proxy.md](reverse-proxy.md).

You need two folders:

* a **data folder** for the database, uploaded songs and settings (Kantahe creates it);
* optionally a **library folder** with your karaoke files (`.kar`, `.karmp3`), which Kantahe scans.
  Kantahe ships no songs.

Settings are flags or environment variables (`kantahe --help` lists them): `--data`, `--library`
(repeatable), `--listen` (default `:8080`), `--public-url`, `--trusted-proxies`, `--soundfont`,
`--score-seconds`, `--render-cache-gb`. Releases are on the project's GitHub releases page, one file per
system named `kantahe-VERSION-OS-ARCH`, with a `SHA256SUMS` file.

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

To start it when the PC starts, use the built-in Task Scheduler (run in an administrator terminal):

```bat
schtasks /Create /TN Kantahe /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "\"C:\Kantahe\kantahe.exe\" --data C:\Kantahe\data --library D:\Karaoke"
schtasks /Run /TN Kantahe
netsh advfirewall firewall add rule name="Kantahe" dir=in action=allow protocol=TCP localport=8080
```

Stop it with `schtasks /End /TN Kantahe`. The task runs as SYSTEM, so the library folder must be
readable (and writable, if admins may delete songs) for that account.

`sc.exe create` does not work with this program: Windows only keeps a service running if the program
speaks the service protocol, and Kantahe (a plain command-line program) does not, so the service fails
with error 1053 after thirty seconds. Use the scheduled task above.

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
