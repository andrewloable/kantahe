# S1: measure the browser MIDI synthesizer on real devices

A throwaway page (no framework, no build) that plays a MIDI/KAR file with spessasynth (the synthesizer the web
player uses, pinned to 4.4.2) and shows, live: SoundFont load time, JS heap where the browser tells, the device's
reported memory, audio dropouts (2-second windows in which the audio clock fell more than 100 ms behind the wall
clock, the rule the player uses) and lyric drift (lyric time from the MIDI tempo map minus the sequencer's time when
the lyric event fired). It also tests autoplay without a tap and the microphone. Report: `docs/spikes/s1-web-player.md`.

Nothing here is committed that a tester brings: `.gitignore` excludes `*.sf2 *.sf3 *.mid *.kar *.karmp3`.

## Serve it

On any computer on the same network as the device:

```sh
cd spikes/s1-web-player
npm install                                 # spessasynth_lib 4.4.2 into node_modules (not committed)
npx http-server . -p 8099 -c-1 --cors       # or: npm run serve
node --test measure.test.mjs                # the two measurement functions
```

Put the files to test next to `index.html` (they stay uncommitted): the full bank (GeneralUser GS from
https://github.com/mrbumpy409/GeneralUser-GS, about 31 MB, saved as `full.sf2`), a small bank of about 6 to 8 MB
(`small.sf2`: the server's per-song trimmed SoundFont of one song, or any small bank), and a song (`song.kar` or
`song.mid`, the longer the better: 3 to 4 minutes). Then open `http://COMPUTER:8099/` on the device.

**The page needs a modern browser** (ES modules and import maps: Chrome/WebView 89 or newer, Safari 16.4 or newer).
A device whose browser cannot even show the page is a result too: write the browser version and "page did not run".
**MIDI on a plain `http://` address:** browsers give an AudioWorklet only to HTTPS pages and `localhost`, so on
`http://192.168.x.y:8099` the synthesizer cannot start (this is decision D10 and why the server renders MIDI for such
devices). To measure the synthesizer itself on a device, serve over HTTPS (for example
`npx http-server . -S -C cert.pem -K key.pem` with a self-signed certificate you accept in the browser, or a tunnel)
or use `adb reverse tcp:8099 tcp:8099` and open `http://localhost:8099/` on an Android device.

## One run

For each combination below: open the page, give the SoundFont and the song (file picker, or the address field with
`http://COMPUTER:8099/full.sf2`), choose the mode, press **Load**, press **Play**, let the whole song play, then press
**Copy results** and paste the JSON into the report (a TV browser without a clipboard shows the text in a box:
write it down or photograph the screen). Combinations: full bank + Normal; full bank + Low power; small bank + Normal;
small bank + Low power. Run **Autoplay test** once per device with both files given by address (it reloads the page and
tries to start the audio with no tap) and **Microphone test** once (needs HTTPS or localhost; allow the prompt, say
something). The JSON has `soundFontLoadMs`, `totalLoadMs`, `usedJSHeapMB` (Chromium only: the main thread, not the
synthesizer's audio thread, so it is a floor), `deviceMemoryGB`, `dropoutWindows` of `windows`, `lyricDrift`,
`autoplay` and `microphone`.

Memory of the whole browser is what matters on a weak box. Where you can, also note it from outside while the song
plays: on Android `adb shell dumpsys meminfo <browser or WebView app package>` (the "TOTAL PSS" line) and the free
memory (`adb shell cat /proc/meminfo`, "MemAvailable") before loading and while playing.

Keep the page in front and the screen on while a song plays: a browser may put a hidden page's audio to sleep, which
the page would count as a dropout.

## What to record for each device

Model, chipset, RAM, OS or firmware, browser and its version; then the numbers above for each combination and the
words "audible dropouts: none / some / constant" from listening. For Samsung and LG TVs also the model year, and
whether the page ran at all: that sets the oldest model that can run the Angular build. Mark anything not tried as
"untested"; do not estimate.

## Files

* `index.html`, `main.js`: the page.
* `measure.mjs`, `measure.test.mjs`: `dropoutWindows(samples)` and `lyricDrift(events)` and their tests.
