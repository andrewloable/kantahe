# User guide

This is for the people who sing. The person who installs and looks after the server has the [admin guide](admin-guide.md).

## Signing in

* Open the address of your server in a browser (for example `http://192.168.1.20:8080`) and sign in with your **email
  and password**. The admin made your account; there is no sign-up.
* If the admin reset your password, or gave you a temporary one, you must **choose a new password** right after signing
  in: nothing else opens until you have.
* Every browser or app you sign in on is a **device** with a name. *Me → Devices* lists them and lets you sign one out.
  Changing your password signs out all your other devices.
* The Android, iOS and Android TV apps **look for your server on the network** when they start. With one server they
  connect to it by themselves, with several they list them (by name) to choose from, and only when they find none do
  they ask for the **server address**. Then comes the same email and password. TVs that have no keyboard use a code: see
  [Singing on a TV](#singing-on-a-tv). On iOS, allow the app to find devices on your local network when asked.
  A server that runs in Docker on its default network cannot be found this way; see [install.md](install.md).

## Getting around

The menu has **Library**, **Queue**, **Player** and **Me** (and **Admin** for administrators), each with a small picture and its
name; the page that is open is the filled one. On a phone the menu is a bar at the bottom of the screen, in reach of the thumb; on a
wider screen it is a row under the name Kantahe. The last line of every page shows the copyright and the version of the
server (for example *Kantahe 1.2.0*); say it when you ask for help.

## Finding a song

The *Library* page has three ways in:

* **Search**: type part of a title or an artist (an empty box lists every song). Digits only look for a song number. The *All / MP3 / MIDI* buttons
  narrow the list to one format.
* **Number**: tap the digits of a song number, as in a karaoke bar, and the song appears.

Every entry has a number, and a badge that says **MP3** or **MIDI**. A small **W** beside it says the lyrics are timed word by word (the words light up one at a time), an **L** says line by line; songs made with Kantahe Maker 1.2.6 or later say it themselves, older ones are read from their lyrics. A **V** says the song has a separate vocals track that the *Vocals* button of the player can play. The same song can be in the library twice, once
in each format. A song marked as unplayable cannot be queued. The star makes a song a **favourite**. The **⋯** button (*More actions*)
opens a short menu: **Play next** puts the song right after the one that is playing, ahead of the rest of the queue (the
message that confirms it has **Undo**), and **Add to a playlist** puts it on one of your playlists (in the Library,
administrators also find **Delete** there; your own lists never delete anything from the library). On a TV the **+** and the delete button stay in the row. Long titles are
cut to two lines in the list; hold the pointer over one to read all of it. Songs are added to the library by an administrator (ordinary users have no Upload); ask yours if a song is missing.

Lists are shown **50 songs at a time**, however many songs the library has. **Previous** and **Next** under the list move
between pages, and the page number is shown between them. The next page is read in the background, so Next is usually
instant. The same goes for Favourites and for the administrator's Songs table.

## Help in the app

*Me → Help* is the short version of this guide, inside the app. Under every list of songs one line says what the small **W**,
**L** and **V** badges mean; **Hide** removes it (the browser remembers), and **What do W, L and V mean?** brings it back.
A library with no songs says how songs get in: administrators are pointed to *Admin → Upload*, others are asked to talk to
their administrator.

## Keyboard shortcuts

On a computer a few single keys save the trip to the mouse. On the **player**: **Space** or **K** plays or pauses, **N** skips,
**F** fills the screen, **+** and **−** change the volume, **V** switches the guide vocals on and off (for songs that have them).
In the **Library**: **/** goes to the search box. Anywhere: **?** shows this list. The keys never act while you type in a field or
hold Ctrl, Alt or Cmd, and they are not used on a TV or inside the phone apps. *Me → Appearance and account* has a
**Keyboard shortcuts** switch that turns them all off.

## Light or dark

*Me → Appearance and account* chooses the theme: *Auto (system)*, *Light* or *Dark*. Auto follows your device; the choice is
remembered in that browser. The player is always dark. The same page shows the account you are signed in with and has
**Sign out**. On a wider screen the theme choice and Sign out are also in the top bar (and before signing in the theme choice is
there on a phone too).

## Your queue

* Choosing a song adds it to **your queue**. The queue is yours alone, kept on the server, and the same on all your
  devices. A song you add while another plays waits its turn.
* A slim bar under the top of every other page says what is playing, on which device, and how many songs are coming up; tap it to open *Queue*.
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

While a song plays and nothing moves for three seconds, the buttons fade away and the pointer hides; move the mouse,
touch the screen or press a key and they come back. **Full screen** (where the browser allows it) fills the whole
screen. **Back to Kantahe** returns to the library (and **Admin** to the admin pages, for administrators); leaving the
player pauses the song if this device was playing it.

**Volume down** and **Volume up** change how loud this device plays the song that is on: the *MIDI songs* volume for a MIDI
song, the *MP3 songs* volume for an MP3 song, in steps of 5 percent from 0 to 200 (100 is the song's own level). The words
beside the buttons say which one it is. The Android, iOS and TV app have the same two buttons next to Skip (on a TV the remote reaches them like the
others). It is the same setting as *Me → Devices*, so it is kept for this device.

**Vocals.** A song that has a vocals track (a `.karmp3` made with Kantahe Maker 1.1 or later with the singer's voice included) shows a
**Vocals** button next to the volume buttons, on the device that is playing; songs without one show nothing. It starts **off**, as
every song always has. Switch it on and the singer's voice plays together with the music as a guide, starting where the music is now;
the button says *Vocals: loading…* until the voice is ready, and the music keeps playing meanwhile. **Vocals quieter** and **Vocals
louder** change how loud the voice is (steps of 10 percent from 0 to 100; it starts at 60, and it follows the song's volume above).
The choice and the level are kept until you close the page or the app, and apply to the next song that has vocals. If the voice cannot be
loaded the button switches itself off with a short message and the song goes on. The Android, iOS and TV app have the same buttons next
to Skip.

If the admin has added background videos, they play behind the lyrics, one after another and round again, without a gap, also
while nothing is playing and while the score shows; a paused song pauses them. They are **pictures only: no sound ever comes
from them.** The lyrics are on a dark layer over the picture so that they stay easy to read. Each device has a *Background
video* choice under *Me → Devices*; on **Auto** a weak device, or one that already uses a lighter sound mode, shows a plain
background instead, and so does a browser that asks for less motion (**On** shows the videos anyway).

## Score

After a song that ends **on its own** (not one you skipped) a score screen shows for a few seconds, with a fanfare for
70 and above, and then the next song starts. Choose how it scores in *Me → Score*:

* **Off**: no score. **Random**: a score for every song, for fun. **Microphone**: the score follows how loud you sing,
  and needs a device that can use its microphone (a browser on HTTPS or localhost, or the phone apps); a song with too
  little singing gets "No score this time".
* The level is **Low** (scores from 50 to 100), **Middle** (60 to 100) or **High** (80 to 100).

New accounts start with Random and Low.

## Favourites, history and playlists

*Me* holds your own lists: **Favourites** (the stars; taking a star off says so with **Undo**, and in Favourites the
song leaves the list until you undo it), **History** (the songs you sang, with their scores) and
**Playlists** (named lists; *Add all to queue* queues a whole playlist). The **⋯** button of a song in History or in a
playlist has **Play next** too. They belong to you, other users do not see them.

## MIDI songs on different devices

A MIDI song has no recording in it: a device has to turn the notes into sound. *Me → Devices* lists your devices, this one
first, one line each (name, type, online or offline, the MIDI mode in use); the **Settings** button of a line opens that
device's settings (this device's are open from the start). **Remove devices offline for 30 days** signs out, after asking,
the devices that are offline and were last seen more than 30 days ago (never the one you are using). Each device has a **MIDI mode**:

* **Auto** (the default) chooses by the device's memory and steps down by itself if the sound stutters.
* **Full**: the full sound; needs plenty of memory. **Low power**: lighter, for a weak device. **Server**: the server
  makes the sound and the device plays it like an MP3 (the server needs to be able to do that).

The same page has a **Background video** choice for each device (moving pictures behind the lyrics; the admin adds the
videos, and they never make any sound):

* **Auto** (the default) shows them, unless the device is weak or already uses a lighter sound mode.
* **On** always shows them on this device. **Off** shows a plain background, which is easier on a weak device.

MP3 songs are not affected. A browser that opens the server through a plain `http://` address on the network cannot start
the sound engine at all; such a device plays MIDI songs through the server automatically, and microphone scoring is not
offered on it. Ask the admin about HTTPS if you want the full engine there.

## Singing on a TV

TV apps ([Android TV](../app/README.md), [Samsung](tv-samsung.md), [LG](tv-lg.md)) show a **code** and a QR code instead of
asking for a password:

1. On an Android TV the app looks for your server by itself (when it finds none it asks for the address, which you type
   with the on-screen keyboard). A Samsung or LG TV does the same, but only finds a server that listens on port 8080 or
   80, looking at addresses near its own first (*Search again* looks further); for any other port, type the address with
   its port and choose *Connect*.
2. The TV shows a code. On your phone or computer, signed in, open **Me → Approve a TV** and enter the code (or
   scan the QR code, which opens that page).
3. The TV signs in as you. The code works once and runs out after five minutes: *New code* gets another.

On the TV use the arrow keys and OK. Back goes back, and leaves the app from the first page. You can also queue songs from
your phone while the TV plays.

The **Android, iOS and TV app open in the player**, the screen that plays (once the server has answered; opening it never starts a
song). The navigation, a bar at the bottom on a phone or tablet and a rail at the side on a TV, lists **Library, Queue, Player and
Me**; *Player* opens the player again at any time. The player's buttons (Close, Play/Pause, Skip, and Play here when
another device is the player) fade out after four seconds while a song plays; press any key on the remote to bring them
back. *Close* leaves the player for the screen you were on before (the Library at the start); the player is opened again with
*Player* in the navigation, with *Open player* on the Queue page, or when the app starts next time. In a text box the arrow keys move the cursor, and Up and Down (or Left at the start,
Right at the end) move on to the next control. *Me → Appearance* chooses *Auto (system)*, *Light* or *Dark*.

**Background videos on the Android TV.** The picture plays behind the lyrics like on any other screen, and nothing but the song is
heard. On a TV that reaches your server over plain `http://` the page cannot run the MIDI synthesizer, so the server renders MIDI songs
and the device counts as using a lighter sound mode: under *Auto* it then shows **no** video. Choose *Me → My devices → Background video →
On* for that TV to see them. One Sony Android TV (3 GB) played 1080p and 720p loops for ten minutes next to MIDI and MP3 songs without trouble.

## Installing Kantahe on a phone

Kantahe can sit on the home screen of your phone and open like an app, without the browser's address bar. It needs the server to
be reached through **https://** (ask your administrator if yours is not).

* **Android** (Chrome and similar browsers): a bar at the top says *Install Kantahe on this phone*; press **Install** and confirm.
  *Not now* hides the bar for 30 days; *Me → Install the app* does the same later. The browser's own menu also has *Install app*
  (or *Add to Home screen*).
* **iPhone and iPad** (Safari): press **How to** in the bar (or *Me → Install the app*). The steps are: tap the **Share** button,
  choose **Add to Home Screen**, tap **Add**.

Nothing is offered where Kantahe already runs installed, in the Android, iOS and TV apps, or on a page that is not https.

## Songs kept on the device

A screen that plays songs keeps the ones it has played, so the next play starts at once and does not use the network again. The song that
is next in the queue is fetched while the current one plays. When the space is used up, the oldest songs are removed first, and some room is
always left for the other apps on the device. *Me → Devices* shows what is kept on the device you are using, with a switch **Keep played
songs on this device** and a **Clear song cache** button. If the admin replaces a song's file, the device fetches the new one by itself.

A browser that opens the server through a plain `http://` address on the network (not `https://`) cannot tell how much room the device has,
so it keeps nothing and the songs come from the server every time. The phone and TV apps know the free space of the device and keep songs
whatever the address.

## When something is wrong

* *"Reconnecting…"* means the screen lost its link to the server and shows the last known state; it comes back by itself.
* A song that does not play is marked as unplayable after the server could not read it; tell the admin.
* If you can sign in on a TV but a MIDI song stutters, set that device's MIDI mode to *Server* or *Low power*.
