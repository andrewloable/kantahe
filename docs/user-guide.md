# User guide

This is for the people who sing. The person who installs and looks after the server has the [admin guide](admin-guide.md).

## Signing in

* Open the address of your server in a browser (for example `http://192.168.1.20:8080`) and sign in with your **email
  and password**. The admin made your account; there is no sign-up.
* If the admin reset your password, or gave you a temporary one, you must **choose a new password** right after signing
  in: nothing else opens until you have.
* Every browser or app you sign in on is a **device** with a name. *Me → Devices* lists them and lets you sign one out.
  Changing your password signs out all your other devices.
* The Android, iOS and Android TV apps ask for the **server address** first, then the same email and password. TVs that
  have no keyboard use a code: see [Singing on a TV](#singing-on-a-tv).

## Finding a song

The *Library* page has three ways in:

* **Search**: type part of a title or an artist. Digits only look for a song number. The *All / MP3 / MIDI* buttons
  narrow the list to one format.
* **Number**: tap the digits of a song number, as in a karaoke bar, and the song appears.
* **Browse**: pick a letter, and then an artist or a title.

Every entry has a number, and a badge that says **MP3** or **MIDI**. The same song can be in the library twice, once
in each format. A song marked as unplayable cannot be queued. The star makes a song a **favourite**; *Add to playlist…*
puts it on one of your playlists.

## Your queue

* Choosing a song adds it to **your queue**. The queue is yours alone, kept on the server, and the same on all your
  devices. A song you add while another plays waits its turn.
* *Queue* shows what is now playing and "Coming up". *Move to top* and *Remove* change the order.
* When the queue is empty a **random song** plays, and keeps doing so until you add songs. The next one is already
  chosen, so you can see what is coming.

## Who plays: "Play here"

Only **one of your devices plays at a time**; your other devices are remotes. To sing on the device in your hand, open
*Queue* on it and press **Play here**: it becomes the player (the one that was playing stops and becomes a remote).
*Play*, *Pause* and *Skip* work from any of your devices. A song stops only when you press Pause, and Skip keeps playing
or paused as it was. If the playing device goes away for more than about 30 seconds, playback pauses where it was and
any device can press Play here to carry on.

## The player

*Player* is the full-screen view: the lyrics, the song, and big buttons. The lyrics have two rows, the line being sung
bright and the next one dimmed; each word fills in as it is sung, and four dots count you in before a line that comes
after a long gap. The player makes the sound, so keep it open on the device that is playing.

## Score

After a song that ends **on its own** (not one you skipped) a score screen shows for a few seconds, with a fanfare for
70 and above, and then the next song starts. Choose how it scores in *Me → Score*:

* **Off**: no score. **Random**: a score for every song, for fun. **Microphone**: the score follows how loud you sing,
  and needs a device that can use its microphone (a browser on HTTPS or localhost, or the phone apps); a song with too
  little singing gets "No score this time".
* The level is **Low** (scores from 50 to 100), **Middle** (60 to 100) or **High** (80 to 100).

New accounts start with Random and Low.

## Favourites, history and playlists

*Me* holds your own lists: **Favourites** (the stars), **History** (the songs you sang, with their scores) and
**Playlists** (named lists; *Add all to queue* queues a whole playlist). They belong to you, other users do not see them.

## MIDI songs on different devices

A MIDI song has no recording in it: a device has to turn the notes into sound. *Me → Devices* has a **MIDI mode** for each
of your devices:

* **Auto** (the default) chooses by the device's memory and steps down by itself if the sound stutters.
* **Full**: the full sound; needs plenty of memory. **Low power**: lighter, for a weak device. **Server**: the server
  makes the sound and the device plays it like an MP3 (the server needs to be able to do that).

MP3 songs are not affected. A browser that opens the server through a plain `http://` address on the network cannot start
the sound engine at all; such a device plays MIDI songs through the server automatically, and microphone scoring is not
offered on it. Ask the admin about HTTPS if you want the full engine there.

## Singing on a TV

TV apps ([Android TV](../app/README.md), [Samsung](tv-samsung.md), [LG](tv-lg.md)) show a **code** and a QR code instead of
asking for a password:

1. On the TV, type the server address the first time and choose *Connect*.
2. The TV shows a code. On your phone or computer, signed in, open **Approve a TV** in the menu and enter the code (or
   scan the QR code, which opens that page).
3. The TV signs in as you. The code works once and runs out after five minutes: *New code* gets another.

On the TV use the arrow keys and OK. Back goes back, and leaves the app from the first page. You can also queue songs from
your phone while the TV plays.

## When something is wrong

* *"Reconnecting…"* means the screen lost its link to the server and shows the last known state; it comes back by itself.
* A song that does not play is marked as unplayable after the server could not read it; tell the admin.
* If you can sign in on a TV but a MIDI song stutters, set that device's MIDI mode to *Server* or *Low power*.
