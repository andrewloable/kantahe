# Admin guide

For the person who runs the server. [Installation](install.md) covers getting it running and [the reverse proxy
guide](reverse-proxy.md) covers HTTPS. The people who sing have the [user guide](user-guide.md).

## The first start

Open the server's address. While there is no user, the page asks you to create the **admin** account: email, name and
password. This works only once. From then on accounts are made by an admin; there is no sign-up.

## Users

*Admin → Users* lists everyone, with **Admin** and **Disabled** switches:

* **New user**: the button above the list opens a window for an email, a name and a **temporary password** (8 to 256
  characters; the window can make one). Pass it on; the user must change it at the first sign-in.
* **Admin** lets a user manage the server, and add, download and replace songs (only administrators upload; the old *Uploader*
  setting has no effect any more). **Disabled** stops a user signing in without deleting anything.
* **Reset password**: sets a new temporary password for someone who forgot theirs, shown to you once. They can do nothing
  but change it after signing in. There is no email: you tell them.
* **Sign out devices**: signs out everything the user is signed in on (a lost phone). The user can also do this for
  single devices in *Me → Devices*.
* **Delete**: removes the account with its queue, favourites, history and playlists; you type the email to confirm.

Wrong passwords slow a sign-in down: after five failures for one email or one address, further attempts wait longer. Behind a
reverse proxy, start the server with `--trusted-proxies` so that it sees the real address (see the proxy guide).

## Adding songs

Two ways, both feeding one shared library:

* **Upload**: administrators use *Admin → Upload* in the web app (the first page of *Admin*; the old address `/upload` still leads there; ordinary users have no Upload, and the Android, iOS and TV apps do not upload) to send `.kar` and `.karmp3` files, several at once, or
  ZIP files of them (they are opened in the browser, and each song is sent on its own with a progress count and a report of
  what was added, what was already there and what was refused and why; a `.kar` with no audible instrument notes, only
  lyric timing, is refused with "the file contains no music" before it is stored). The limit is **50 MB per file** by default;
  change it under *Admin → Settings → Largest song file (MB)* (1 to 1024). A proxy in front must allow more than the limit.
* **Watched folders**: songs in a folder given with `--library` (repeatable) are found when the server starts, every ten
  minutes, and at once when you press **Rescan** in *Admin → Songs*. They are used where they are.

A `.karmp3` made with Kantahe Maker 1.1 or later may carry a **vocals track** (the singer's voice alone), which players can
switch on as a guide. Such files are supported: nothing needs to be done for them. A file like that in a watched folder that an
older version refused (it was listed as broken, "more than one .mp3 entry") is read again by itself at the first start of the new
version; *Check for broken songs* brings back any that are left. A refused upload was never stored and must be uploaded again.
If a file names a vocals track that is missing or damaged, the song still plays without it and the server log says so once. *Admin → Settings → Amateur singer mode* makes the vocals play by themselves at the start of every song that has them (below).

Only the songs matter to Kantahe: it ships none, and what you upload is your responsibility.

### Numbers

Every file is its own entry with a **unique number that never changes**. A number at the start of the file name
(`01052 - Artist - Title.kar`) is kept when it is free; otherwise the next free number is given. When a `.karmp3` and a
`.kar` want the same number the `.karmp3` keeps it and the `.kar` gets another; the original number is remembered as the
songbook number. Numbers of deleted songs are not reused.

### Titles and artists

Kantahe reads the title and artist from inside each file in the background. In *Admin → Songs* press **Edit** to change
them: your edit always wins and survives rescans (empty a field to go back to what the file says).

## Filtering and sorting the song list

*Admin → Songs* lists every song, 50 rows to a page. Under the search field three choices narrow the list (they work together, and with
the search text):

* **Format**: all, MP3 or MIDI.
* **Vocals**: any, with vocals (the song has a separate vocals track, the **V** badge) or without vocals.
* **Lyrics**: any, by word (**W**) or by line (**L**), as the file says how its lyrics are timed.

**Clear filters** puts all three back. The column headers (**Number, Title, Artist, Format, Lyrics, Vocals**) are buttons: press one to sort
by it, press it again to turn the order round; an arrow shows which column sorts and which way. Songs without timed lyrics come first
when sorting by Lyrics, and songs without vocals come first when sorting by Vocals. With no header chosen, a search lists the best match
first and a plain list goes by number. On a narrow screen, where the table turns into blocks and the header row is hidden, a **Sort by**
choice and an Ascending/Descending button above the list do the same. The filters and the sorting are done by the server, so they cover the
whole library and not only the page on show.

## Downloading and replacing song files

In *Admin → Songs* every song has a **Download** button and a **Replace file** button (administrators only).

* **Download** saves the song's file exactly as the server holds it: a `.karmp3` (the ZIP) or a `.kar`, named `NUMBER - Artist - Title`
  and the extension. The address the browser uses works for ten minutes, only for you.
* **Replace file** takes a `.kar` or `.karmp3` of the same kind as the song and puts its content in the song's place. The song keeps
  its **number**, your edits of its title and artist, its place in favourites and playlists, the queue and the history. The new file
  is checked like an upload; a file that is the same as the song's own does nothing, and a file that is already another song of the
  library is refused (the message says which one). A song that was uploaded gets the new file and loses the old one; a song in a
  watched folder has its file in that folder overwritten (the folder must be writable, as for deleting).

## Removing and deleting songs

Deleting a single song (*Admin → Songs*, or the red trash button on a row of the *Library* page; administrators only) asks
what you want:

* **Remove from list** takes the song off the list and **keeps its file**.
* **Delete file too** removes the entry **together with its file**, for uploaded songs and for songs in a watched folder
  alike. A watched folder must therefore be writable; if the file cannot be deleted (a read-only mount, permissions)
  nothing changes and you are told why. Mount the folder read-only (`:ro` in Docker) if you do not want anyone to be able
  to delete files from it.

**Choosing several songs.** Every row has a checkbox, and the box in the header chooses all the songs of the page on show (it
looks half-filled when only some are chosen). The choice stays while you turn pages and search, up to 1000 songs. A bar
above the list says how many are chosen and offers **Remove from list** (the files stay), **Delete files too** (the files are
deleted as well, only inside the data and the watched folders; a file elsewhere is left and counted) and **Clear selection**.
Both removals ask first, and deleting files cannot be undone.

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

Only one check runs at a time.

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

The recommendation above is the safe one: it was tried for ten minutes, next to MIDI and MP3 songs, on one Android TV (Sony, 3 GB) and
played without trouble; that TV also played a 3840x2160 and a 10-bit H.264 clip, but weaker boxes, phones, Samsung and LG TVs have not been
tried, so keep to 1080p30 for anything you do not know. HEVC, VP9, WebM and files wider than 3840 px are refused at upload.

**The list.** The videos play one after another in the order of the list, over and over; the numbers show the order. *Move up* and
*Move down* change it. *Play this video* switches one off without deleting it. *Rename* changes the name shown here. *Preview*
plays a small silent preview. *Delete* asks first and then deletes the video and its file; if the file is in use at that moment
(a player or a virus scanner has it open) the video stays and you can try again. The files are kept in `<data>/videos`.

**Options.** *Play background videos on the players* switches the whole thing off for everyone; *Shuffle the order on every
round* plays the videos in a new random order each time round. Each person can also choose, per device, under *Me → Devices* in
the *Background video* setting: **Auto** (the default) shows the videos unless the device is weak or already uses a lighter sound
mode, **On** always shows them, **Off** never does. A browser that asks for less motion shows none on **Auto**.

## Settings

*Admin → Settings*: the largest upload (above), the largest background video, how long the score is shown (seconds), and **Amateur
singer mode** (off by default). With it on, every song that has a vocals track plays the singer's voice by itself from the start until the
third line of its lyrics begins (it fades out over about 0.3 seconds), as a guide for singers who do not know the song; a singer can still
switch the voice off, and the next song is guided again. Songs without a vocals track, MIDI songs and songs with fewer than three lines of
lyrics are not affected. A change applies from the next song a player loads. Server flags (see
`kantahe --help`, and the [installation guide](install.md)): `--data`, `--library`, `--listen`, `--public-url`,
`--trusted-proxies`, `--soundfont`, `--score-seconds`, `--render-cache-gb`, `--transfer-root`.

* `--public-url` is the address TVs show in the QR code of their sign-in code; set it when the server is behind a proxy.
* `--soundfont` replaces the built-in SoundFont (the instrument sounds for MIDI songs).
* `--render-cache-gb` limits the disk used by audio the server renders for devices that cannot play MIDI themselves (default
  5; `0` switches it off, and such devices then use a lighter mode).

## Moving to another server

*Admin → Transfer* copies a whole server into a folder on the server's disk and, on another server, replaces everything with
such a folder. Only administrators see it, and only the web app has it.

**What is moved:** users with their passwords and roles, the devices that are signed in, queues, history, favourites, playlists,
the settings, the titles and artists you edited, every song (also the songs of the watched folders, and the guide vocals of a
song that has them) and the background videos. **What is not moved:** the server's own options (`--name`, `--public-url`,
`--library`, `--listen` and so on, which belong to the machine) and the cache.

1. **Export.** On the old server open *Admin → Transfer*, type a folder on the server's disk that does not exist yet or is empty
   (with Docker it must be a mounted folder, see the [installation guide](install.md)), and press *Export*. The folder must not
   be inside the data folder or a watched folder. It fills with plain files (no ZIP): `kantahe.db`, the song, media and video
   folders, and `kantahe-export.json`, which is written last: a folder without it is unfinished and is never imported. The
   server goes on working while it exports. Songs whose file cannot be read are listed at the end and are left out.
2. **Copy the folder** to the other machine (rsync, a USB disk, a shared mount).
3. **Import.** On the new server open *Admin → Transfer*, type the folder, press *Check* and read what it says (the name and
   version of the old server, how many songs, users and videos). Tick the box and press *Replace everything on this server*.
   The server checks every file and the database first; nothing is changed if anything is wrong. Then it **restarts by itself**
   within a few seconds, and the page says when it is back.
4. **Sign in** with an account of the old server: everyone who was signed in on the new server is signed out.

The database that was replaced is kept in the data folder, in `backups/before-import-DATE`; delete it when you no longer need it.
Songs that were in a watched folder of the old server become uploaded songs on the new one and keep their numbers. The new
server's own watched folders are scanned as usual, and files it has already are skipped. A folder made by a newer Kantahe cannot
be imported into an older one: upgrade the new server first.

**Keep the folder private.** It holds the password hashes, the sign-in data of the devices and the key that signs media addresses.
It is created readable by the server's user only. Delete it after the move. To limit where exports and imports may read and write,
start the server with `--transfer-root FOLDER` (or `KANTAHE_TRANSFER_ROOT`): every folder typed in the page must then be inside it.

## Backups and upgrades

Stop the server, copy the whole **data folder** (the database and the songs people uploaded), start it again. The `cache`
folder inside it can be left out and deleted at any time. Your own watched folders are backed up like any other folders.
To upgrade, make a backup, then replace the program or pull the new image; the database is upgraded on start, and going back
to an older version is done by restoring the backup. An export (*Admin → Transfer*, above) is a backup too, and needs no shell
access to the machine.

## Reverse proxy and HTTPS

For use outside the home network, and for microphone scoring in browsers, put a reverse proxy with HTTPS in front. The proxy
must not buffer the two streaming calls and must allow big uploads; the [proxy guide](reverse-proxy.md) has complete Caddy
and nginx examples and a check to run.

## TVs

[Android TV](../app/README.md), [Samsung](tv-samsung.md) and [LG](tv-lg.md) apps sign in with a code the user approves. Each TV
asks for the server address once. A TV on a plain `http://` address works; MIDI songs then play through the server's
rendering unless the TV can start its own sound engine.
