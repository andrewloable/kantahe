# Admin guide

For the person who runs the server. [Installation](install.md) covers getting it running and [the reverse proxy
guide](reverse-proxy.md) covers HTTPS. The people who sing have the [user guide](user-guide.md).

## The first start

Open the server's address. While there is no user, the page asks you to create the **admin** account: email, name and
password. This works only once. From then on accounts are made by an admin; there is no sign-up.

## Users

*Admin → Users* lists everyone, with **Admin**, **Uploader** and **Disabled** switches:

* **New user**: an email, a name and a **temporary password** (8 to 256 characters; the form can make one). Pass it on; the
  user must change it at the first sign-in.
* **Uploader** lets a user add songs (admins can always). **Admin** gives all of this. **Disabled** stops a user signing
  in without deleting anything.
* **Reset password**: sets a new temporary password for someone who forgot theirs, shown to you once. They can do nothing
  but change it after signing in. There is no email: you tell them.
* **Sign out devices**: signs out everything the user is signed in on (a lost phone). The user can also do this for
  single devices in *Me → Devices*.
* **Delete**: removes the account with its queue, favourites, history and playlists; you type the email to confirm.

Wrong passwords slow a sign-in down: after five failures for one email or one address, further attempts wait longer. Behind a
reverse proxy, start the server with `--trusted-proxies` so that it sees the real address (see the proxy guide).

## Adding songs

Two ways, both feeding one shared library:

* **Upload**: users with the uploader role (and admins) use *Upload* to send `.kar` and `.karmp3` files, several at once, or
  ZIP files of them (they are opened in the browser, and each song is sent on its own with a progress count and a report of
  what was added, what was already there and what was refused and why). The limit is **50 MB per file** by default;
  change it under *Admin → Settings → Largest song file (MB)* (1 to 1024). A proxy in front must allow more than the limit.
* **Watched folders**: songs in a folder given with `--library` (repeatable) are found when the server starts, every ten
  minutes, and at once when you press **Rescan** in *Admin → Songs*. They are used where they are.

Only the songs matter to Kantahe: it ships none, and what you upload is your responsibility.

### Numbers

Every file is its own entry with a **unique number that never changes**. A number at the start of the file name
(`01052 - Artist - Title.kar`) is kept when it is free; otherwise the next free number is given. When a `.karmp3` and a
`.kar` want the same number the `.karmp3` keeps it and the `.kar` gets another; the original number is remembered as the
songbook number. Numbers of deleted songs are not reused.

### Titles and artists

Kantahe reads the title and artist from inside each file in the background. In *Admin → Songs* press **Edit** to change
them: your edit always wins and survives rescans (empty a field to go back to what the file says).

## Deleting songs

**Delete** in *Admin → Songs*, or the red trash button on a row of the *Library* page (administrators only, after a
confirmation), removes the entry **together with its file**, for uploaded songs and for songs in a watched
folder alike. A watched folder must therefore be writable; if the file cannot be deleted (a read-only mount, permissions)
nothing changes and you are told why. Mount the folder read-only (`:ro` in Docker) if you do not want anyone to be able to
delete files from it. A file that disappears from a watched folder disappears from the library at the next scan.

## Settings

*Admin → Settings*: the largest upload (above) and how long the score is shown (seconds). Server flags (see
`kantahe --help`, and the [installation guide](install.md)): `--data`, `--library`, `--listen`, `--public-url`,
`--trusted-proxies`, `--soundfont`, `--score-seconds`, `--render-cache-gb`.

* `--public-url` is the address TVs show in the QR code of their sign-in code; set it when the server is behind a proxy.
* `--soundfont` replaces the built-in SoundFont (the instrument sounds for MIDI songs).
* `--render-cache-gb` limits the disk used by audio the server renders for devices that cannot play MIDI themselves (default
  5; `0` switches it off, and such devices then use a lighter mode).

## Backups and upgrades

Stop the server, copy the whole **data folder** (the database and the songs people uploaded), start it again. The `cache`
folder inside it can be left out and deleted at any time. Your own watched folders are backed up like any other folders.
To upgrade, make a backup, then replace the program or pull the new image; the database is upgraded on start, and going back
to an older version is done by restoring the backup.

## Reverse proxy and HTTPS

For use outside the home network, and for microphone scoring in browsers, put a reverse proxy with HTTPS in front. The proxy
must not buffer the two streaming calls and must allow big uploads; the [proxy guide](reverse-proxy.md) has complete Caddy
and nginx examples and a check to run.

## TVs

[Android TV](../app/README.md), [Samsung](tv-samsung.md) and [LG](tv-lg.md) apps sign in with a code the user approves. Each TV
asks for the server address once. A TV on a plain `http://` address works; MIDI songs then play through the server's
rendering unless the TV can start its own sound engine.
