# Store listing text

The words for the app stores (Google Play, the App Store) and for the TV stores' descriptions. Limits are the stores' own
and are checked by `python3 -m unittest discover -s scripts -p 'test_branding.py'`. Kantahe is a client for a server the user
runs: the listings say so up front, so that nobody installs the app expecting songs.

## Name

```
Kantahe
```

## Google Play: short description

```
Karaoke from your own server: your songs, your queue, on any screen.
```

## Google Play: full description

```
Kantahe is the app for your own Kantahe karaoke server.

Install the Kantahe server on a computer at home (it is free and open source), add your own karaoke songs, and sing from this phone, a browser or a TV. You need a running Kantahe server. Kantahe ships no songs: you add your own.

WHAT YOU CAN DO
• Find a song: search, type its number on a number pad like in a karaoke bar, or browse by letter.
• Keep your own queue: add songs, move one to the top, remove one. When the queue runs out, a random song plays.
• Sing here, control from there: "Play here" makes this device the screen; your other devices become remote controls.
• Follow the words: lyrics light up as they are sung, with count-in dots before a line.
• Get a score after a song, for fun, or by how loudly you sing with the microphone.
• Keep favourites, a history of what you sang with its scores, and playlists you can queue in one go.
• Upload songs (.kar and .karmp3, or ZIP files of them) if the admin allows it.
• Sign in a TV with a short code instead of typing a password.

YOUR DATA STAYS WITH YOU
The app talks only to the server whose address you type in. There are no ads, no analytics and no account with us.

Kantahe is open source (MIT). The server, the web app and the TV apps are at github.com/andrewloable/kantahe.
```

## App Store: subtitle

```
Your karaoke server, anywhere
```

## App Store: keywords

```
karaoke,kar,midi,lyrics,singing,videoke,songbook,queue,remote,self-hosted,server
```

## App Store: description

```
Kantahe is the app for your own Kantahe karaoke server. Install the free, open-source server on a computer at home, add your own karaoke songs, and sing from your iPhone, a browser or a TV. You need a running Kantahe server. Kantahe ships no songs: you add your own.

• Find a song by search, by typing its number on a number pad, or by browsing letters.
• Keep your own queue. A random song plays when it runs out.
• "Play here" turns the device in your hand into the screen; your other devices become remotes.
• Lyrics light up as they are sung, with count-in dots.
• A score after each song, for fun or by how loudly you sing.
• Favourites, history and playlists.
• Upload your own .kar and .karmp3 songs if the admin allows it.

The app talks only to your server. No ads, no analytics, no account with us.
```

## Features (for screenshots and TV store pages)

* Library with search, a number pad and A to Z browsing, MP3 and MIDI badges.
* Queue with "Coming up", Play here, Play, Pause, Skip.
* The player with two-row lyrics and count-in dots.
* The score screen.
* Favourites, history, playlists.
* TV: the code screen with its QR code, the library with the remote's focus ring.

## Screenshots (owner)

Phone and tablet screenshots, and TV screenshots (1920 by 1080), have to be taken by the owner on real devices of the sizes
each store asks for, using a server with songs the owner has the right to show (the project ships none). The branded
assets are in `branding/export/`: the app icon (`icon-1024.png`, and `icon-ios-1024.png` without alpha), the Android TV
banner (`tv-banner-320x180.png`), the Samsung icon (`icon-512.png`), the LG icons (`icon-80.png`, `icon-130.png`) and a
1920 by 1080 splash (`splash-1920x1080.png`).

## Categories and ratings

Google Play: Music & Audio. App Store: Music. Content rating: the app has no content of its own; what people sing is what
they add to their own server. Say so in the rating questionnaires, and that the app has no user-generated content shared
between users of different servers.

## Privacy

Kantahe is self-hosted: there is no Kantahe cloud. The app connects only to the server the user enters, which the user (or a
person they trust) runs: your own server. What is stored there (accounts, queues, favourites, history, songs) lives on that
server, not with the developer.

* **No analytics, no ads, no tracking, no accounts with the developer.** Nothing is sent anywhere but to the user's server.
* **Account data**: the email address and display name the server's admin entered, a sign-in token kept in the device's
  secure storage (Keychain, Keystore), and the user's own lists. Signing out removes the token.
* **Microphone**: used only when the user chooses the Microphone score mode and allows it. The sound is not recorded or
  sent: the app counts how often the level is loud and reports those counts to the server.
* **Local network** (iOS): needed to reach a server at a private address such as 192.168.1.20.
* **Files**: the app reads only the song files the user picks to upload.

For the store forms: data collected by the developer: none; data shared with third parties: none; data sent to the user's
own server: the account and activity above, over the connection the user configured (plain `http://` on a home network, or
`https://` through the user's reverse proxy).
