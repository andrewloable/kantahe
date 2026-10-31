# Kantahe on a Samsung TV (Tizen)

The Samsung TV app is the web app packaged as a Tizen web application (`.wgt`). Samsung TVs normally do not take such
a file from a USB stick: you sign it with your own certificate and install it over the network on a TV that is in
developer mode. This page is the whole procedure. It was written from Samsung's documentation and **has not yet been
run on a real TV**: the owner's acceptance run (the last section) is what confirms it.

## What you need

* A Samsung TV from 2018 or later (Tizen 5.0 or newer). The package asks for Tizen 5.0. Which models really run it,
  and which play MIDI songs without dropouts, comes from spike S1 ([spikes/s1-web-player](../spikes/s1-web-player/README.md),
  report in [spikes/s1-web-player.md](spikes/s1-web-player.md)); the table there is empty until it has been run on TVs.
  MP3 songs do not need the synthesizer.
* A computer on the same network as the TV, with [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)
  or its command-line package (it provides `tizen` and `sdb`), Node.js and this repository.
* A Samsung account, for the certificate.
* A running Kantahe server the TV can reach, for example `http://192.168.1.20:8080`.

## 1. Developer mode on the TV

1. On the TV open the *Apps* panel, press **1 2 3 4 5** on the remote, and switch *Developer mode* on.
2. Enter the IP address of your computer and restart the TV.
3. Note the IP address of the TV (Settings, Network).

## 2. A certificate

In Tizen Studio open *Certificate Manager* and create a **Samsung** certificate profile: an author certificate and a
distributor certificate that includes the TV's DUID (Tizen Studio reads it from the TV when it is connected in Device
Manager). Give the profile a name; that name is the argument of the build script. The certificate files stay on your
computer: nothing in this repository holds or asks for them.

## 3. Build the package

From the repository root:

```sh
bash scripts/build-tizen.sh MyProfile
```

It builds the `tizen` configuration of the web app, assembles `build/tizen/` (the build, `tv/tizen/config.xml` and the
icon), and runs `tizen package -t wgt -s MyProfile -- build/tizen`, which leaves `build/tizen/Kantahe.wgt`. Without the
`tizen` command the script stops at once and says so. `bash scripts/build-tizen.sh --stage-only` assembles the folder
without packaging, to look at what goes in.

## 4. Install and start it

```sh
sdb connect TV_IP
sdb devices                      # note the name of the TV in the list
tizen install -n Kantahe.wgt -t TV_NAME -- build/tizen
tizen run -p KantaheApp.Kantahe -t TV_NAME
```

Kantahe is then in the TV's app list. To remove it, delete it there, or `tizen uninstall -p KantaheApp -t TV_NAME`.

## 5. First start

1. The app asks for the **server address**. Type it with the on-screen keyboard (`http://192.168.1.20:8080`) and choose
   *Connect*. A server that has no account yet is set up in a web browser first.
2. It shows a **code** and a QR code. On a phone or computer, sign in to Kantahe, open *Me → Approve a TV* (or
   scan the QR code), and enter the code. The TV signs in.
3. Use the arrow keys and OK to search and queue songs, or queue from your phone. *Back* goes back; on the first page it
   leaves the app. "Use another server" on the code screen starts over with another address.

## Notes

* **Why nothing needs HTTPS here.** The app runs from a `file:` address inside the TV, which the web engine treats as
  secure, so the MIDI synthesizer can start; the server it talks to can be plain `http://`. The server answers
  cross-origin requests for the API and the media (decision D10 and PLAN section 8).
* **What the privileges are for.** `internet` is the connection to the server; `tv.inputdevice` is the remote's Back and
  media keys. The media keys are registered but not used yet. The app asks for nothing else.
* **Changing the version or the ids.** `tv/tizen/config.xml`: `version`, and `package` (ten letters and digits) with the
  application id `package.Kantahe`. If you change the package, also change the `-p`/`-n` values above.
* **Not working?** `sdb devices` must list the TV. A blank screen on start means the web engine could not load the app:
  note the TV model and year and add it to the S1 table as "did not run".

## Acceptance (owner)

Not done yet. On a real Samsung TV: install the `.wgt`, connect, sign in with a code, then sing one MP3 and one MIDI song
and write the model, the year, the mode the player used and any dropouts in `docs/spikes/s1-web-player.md`.
