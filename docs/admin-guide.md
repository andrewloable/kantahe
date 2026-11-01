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
  what was added, what was already there and what was refused and why; a `.kar` with no audible instrument notes, only
  lyric timing, is refused with "the file contains no music" before it is stored). The limit is **50 MB per file** by default;
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

## Removing and deleting songs

Deleting a single song (*Admin → Songs*, or the red trash button on a row of the *Library* page; administrators only) asks
what you want:

* **Remove from list** takes the song off the list and **keeps its file**.
* **Delete file too** removes the entry **together with its file**, for uploaded songs and for songs in a watched folder
  alike. A watched folder must therefore be writable; if the file cannot be deleted (a read-only mount, permissions)
  nothing changes and you are told why. Mount the folder read-only (`:ro` in Docker) if you do not want anyone to be able
  to delete files from it.

*Admin → Songs → Remove songs from the list* works on many songs at once, after a confirmation, and **never deletes a
file**:

* **Remove songs with no music** takes off every MIDI song that has no instrument notes, only lyric timing. Such files
  play as silence. (New uploads of that kind are refused, and a watched-folder file like that is marked as failed.)
* **Remove all songs** empties the list.

### Checking the library for broken songs

*Admin → Songs → Check the library → Check for broken songs* looks at **every song file again** and says how far it is while it
works (a library of 20,000 songs takes about a minute). A song is broken when its file is missing (also for an uploaded song
whose file was deleted by hand), when it is a MIDI song without any music (only lyric timing, it plays as silence), when the
file cannot be read, or when a `.karmp3` is damaged. (The extracted MP3 of a `.karmp3` that went missing is made again, and
the song is not counted as broken.) The check **marks the broken songs and hides them from everyone** (they leave every
search and list at once); a song whose file was repaired is shown again at the next check. Nothing is deleted by a check.

The broken songs are listed (50 to a page) with the reason, also when you open the page later without a new check. For each one
you choose, as for any song, **Remove from list** (the file stays) or **Delete file too**. Two buttons work on all of them, each
after a confirmation that names how many songs it is about:

* **Remove all N broken songs from the list**: the files stay where they are.
* **Remove them and delete their files**: the files are deleted for good, but only inside the data folder and the watched
  folders; a song whose file lies elsewhere, or is in use, is taken off the list all the same and the result says how many files
  could not be deleted.

Only one check runs at a time. *Remove all songs* and *Remove songs with no music* still never delete a file.

A song's number is never used again, so a song that is added back later gets a new number. A song in a watched folder is
added again at the next scan while its file is still in the folder; move the file out, or delete it, to keep it off the
list. The file of an uploaded song stays in `<data>/songs`, but nothing lists it any more: to get it back, upload it
again. A file that disappears from a watched folder disappears from the library at the next scan.

## Background videos

Moving pictures can play behind the lyrics, as on a videoke machine. You upload the videos; Kantahe ships none, and you are
responsible for having the rights to what you upload. The videos are **picture only**: no sound ever comes from them, and a
sound track inside an uploaded file is ignored (the list says "has a sound track (never played)").

*Admin → Videos* is where they are managed.

**Adding.** Press *Choose video files* and pick one or several. A file that is not an `.mp4`, `.m4v` or `.mov`, or is larger than
the limit (500 MB unless you change *Largest background video* in *Admin → Settings*), is refused on the page and not sent.
The others go up one after another with a progress bar and a *Cancel* button. A video is sent in pieces of 4 MB, so a large
file is fine, and an interrupted upload can be **resumed**: pick the same file again (also after reloading the page) and it goes
on where it stopped. The result of each file is *Added*, *Already in the list* (the same content was uploaded before) or
*Refused* with the reason.

**What is accepted.** H.264 video in an MP4 (also `.m4v` and `.mov`). HEVC, AV1, VP9, WebM and Matroska are refused with a message;
convert them first, for example with ffmpeg:

```sh
ffmpeg -i in.mov -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p -vf scale=-2:1080 -r 30 -b:v 6M -an -movflags +faststart out.mp4
```

(`-an` leaves the sound out, which makes the file smaller; it is not required.) 1920×1080, 30 frames a second or less and about
6 Mbps are comfortable for a TV box. A file wider than 1920 px is accepted with a warning (a TV box may stutter), and so is one
whose index comes after the picture data (it starts playing more slowly; `-movflags +faststart` fixes that).

**The list.** The videos play one after another in the order of the list, over and over; the numbers show the order. *Move up* and
*Move down* change it. *Play this video* switches one off without deleting it. *Rename* changes the name shown here. *Preview*
plays a small silent preview. *Delete* asks first and then deletes the video and its file; if the file is in use at that moment
(a player or a virus scanner has it open) the video stays and you can try again. The files are kept in `<data>/videos`.

**Options.** *Play background videos on the players* switches the whole thing off for everyone; *Shuffle the order on every
round* plays the videos in a new random order each time round. Each person can also choose, per device, under *Me → Devices* in
the *Background video* setting: **Auto** (the default) shows the videos unless the device is weak or already uses a lighter sound
mode, **On** always shows them, **Off** never does. A browser that asks for less motion shows none on **Auto**.

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
