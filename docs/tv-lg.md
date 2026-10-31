# Kantahe on an LG TV (webOS)

The LG TV app is the web app packaged as a webOS web application (`.ipk`). You install it on a TV that is in Developer
Mode, over the network, with LG's command-line tools. This page is the whole procedure. It was written from LG's
documentation and **has not yet been run on a real TV**: the owner's acceptance run (the last section) confirms it.

## What you need

* An LG TV with webOS TV 5 (2020 models) or newer is expected to work: the app is built with ES modules and an
  AudioWorklet, which the web engines of older webOS versions do not have. Which models really run it, and which play
  MIDI songs without dropouts, comes from spike S1 ([report](spikes/s1-web-player.md), empty until it has been run on
  TVs); an older model that does not run it is a result worth writing down there. MP3 songs do not need the synthesizer.
* A computer on the same network as the TV with Node.js, this repository and the webOS TV CLI:
  `npm install -g @webos-tools/cli` (it provides `ares-package`, `ares-setup-device`, `ares-install`, `ares-launch`).
* An LG developer account (free), for the Developer Mode app.
* A running Kantahe server the TV can reach, for example `http://192.168.1.20:8080`.

## 1. Developer Mode on the TV

1. Install the **Developer Mode** app from the LG Content Store on the TV, open it and sign in with your LG developer
   account.
2. Switch *Dev Mode Status* on, and *Key Server* on. The TV restarts. Note its IP address (shown in the app).
3. The session runs out after a while: open the app now and then and extend it, or the installed app stops opening.

## 2. Tell the CLI about the TV

```sh
ares-setup-device --add tv -i "host=TV_IP" -i "port=9922" -i "username=prisoner"
ares-novacom --device tv --getkey      # asks for the passphrase shown in the Developer Mode app
ares-setup-device --list               # the TV is "tv"
```

The key this creates lives in your home folder; it is never part of the repository and the scripts never read it.

## 3. Build the package

From the repository root:

```sh
bash scripts/build-webos.sh
```

It builds the `webos` configuration of the web app, assembles `build/webos/` (the build, `tv/webos/appinfo.json` and the
two icons), checks the `appinfo.json` (`scripts/check-webos-appinfo.py`: the keys webOS needs, the icon files and their
sizes), and runs `ares-package build/webos -o dist`, which leaves `dist/com.loabletech.kantahe_1.0.0_all.ipk`. Without
`ares-package` the script stops at once and says so. `bash scripts/build-webos.sh --stage-only` assembles and checks
the folder without packaging.

## 4. Install and start it

```sh
ares-install --device tv dist/com.loabletech.kantahe_1.0.0_all.ipk
ares-launch --device tv com.loabletech.kantahe
```

Kantahe is then in the TV's app list. To remove it: `ares-install --device tv --remove com.loabletech.kantahe`.

## 5. First start

1. The app asks for the **server address**. Type it with the on-screen keyboard (`http://192.168.1.20:8080`) and choose
   *Connect*. A server that has no account yet is set up in a web browser first.
2. It shows a **code** and a QR code. On a phone or computer, sign in to Kantahe, open *Approve a TV* in the menu (or
   scan the QR code), and enter the code. The TV signs in.
3. Use the arrow keys and OK to search and queue songs, or queue from your phone. *Back* goes back through the pages
   and, on the first page, leaves the app: `appinfo.json` has `disableBackHistoryAPI` off, so webOS handles the Back key
   through the history of the app, which the app keeps clean (the code screen is not left in it). "Use another server"
   on the code screen starts over with another address.

## Notes

* **Why nothing needs HTTPS here.** The app is loaded from the TV itself, which the web engine treats as a secure page,
  so the MIDI synthesizer can start; the server it talks to can be plain `http://`. The server answers cross-origin
  requests for the API and the media (decision D10 and PLAN section 8).
* **Changing the version or the id.** `tv/webos/appinfo.json` (`scripts/check-webos-appinfo.py` refuses a bad one). If you
  change the id, change it in the commands above too.
* **Not working?** `ares-setup-device --list` must show the TV and `ares-install` must find it. A blank screen on start
  means the web engine could not load the app: note the TV model and year in the S1 table as "did not run".

## Acceptance (owner)

Not done yet. On a real LG TV: install the `.ipk`, connect, sign in with a code, then sing one MP3 and one MIDI song, press
Back once on a page that has a page before it (it must go back exactly one page) and on the first page (it must leave the
app), and write the model, the year, the mode the player used and any dropouts in `docs/spikes/s1-web-player.md`.
