# S1: the browser MIDI synthesizer on real devices

**Status: the page and the procedure are done and the desktop run is measured; every real-device row below is
untested until the owner runs it.** Nothing in the device table is estimated. The thresholds in
[PLAN.md](../PLAN.md) section 4.1 are therefore still the plan's own provisional numbers.

## Question

Plan D2 puts MIDI synthesis in the browser on every platform (spessasynth plus a SoundFont). Section 4.1 adds per-song
trimmed SoundFonts, a low-power mode and a server render for weak devices, with thresholds that map reported memory to
a mode. This spike builds a page and a procedure to measure, per device, whether the full bank (about 31 MB), a small
bank (6 to 8 MB, a stand-in for a trimmed one) and the low-power settings (32 voices, no reverb or chorus, 22.05 kHz)
play without dropouts, how long loading takes, how far lyrics drift from the tempo map, and whether autoplay and the
microphone work; and which Samsung and LG models can run the Angular build at all.

## What was built

`spikes/s1-web-player/`: `index.html` and `main.js` (the page, spessasynth_lib 4.4.2), `measure.mjs` (dropout and
lyric-drift functions) with `measure.test.mjs`, and `README.md` (how to serve it and what the owner records per device).
Tests: `node --test measure.test.mjs`, 6 pass; mutations: stub returns 0 (2 fail), tolerance 100 to 200 ms (2 fail),
signed instead of absolute drift (1 fails).

## Procedure

[spikes/s1-web-player/README.md](../../spikes/s1-web-player/README.md).

## Measured: desktop only (agent)

Headless Chromium (Playwright, the version of `web/`) on a 14-core Apple-silicon Mac with 8 GB reported by
`navigator.deviceMemory` (the browser caps that value), page served from `http://127.0.0.1` (a secure context). The
full bank is GeneralUser GS 2.0.3 (32.3 MB); the "small" bank is the 8.0 MB per-song trimmed SoundFont of the S1b
spike; Chromium ran with `--autoplay-policy=no-user-gesture-required` for the five runs, so that Play needed no tap; the song is the synthetic 4-minute MIDI of the S1b spike (30 s played per run); the lyric run uses a synthetic
karaoke file and a 31 KB SoundFont. These are **not** representative of a weak device: they show that the page works
and give the ceiling.

| Run | SoundFont load | Total load | Audio rate | Dropouts | Lyric drift |
|---|---|---|---|---|---|
| tiny SoundFont, karaoke file, normal | 17 ms | 249 ms | 48 kHz | 0 of 14 windows | 7 lyrics, max 16 ms, mean 7 ms |
| full bank 32.3 MB, normal | 33 ms | 149 ms | 48 kHz | 0 of 15 | no lyrics in this file |
| full bank, low power | 32 ms | 145 ms | 22.05 kHz | 0 of 15 | no lyrics |
| small bank 8 MB, normal | 22 ms | 126 ms | 48 kHz | 0 of 15 | no lyrics |
| small bank, low power | 21 ms | 127 ms | 22.05 kHz | 0 of 15 | no lyrics |

Notes: the page's `usedJSHeapMB` read 10 in every run because it is the main thread's heap; the synthesizer's samples
live in the audio thread, which a page cannot see, so memory on a device has to be read from outside (see the README).
The load times are what the page waits for (`addSoundBank` and `isReady`); whether the synthesizer decodes samples
lazily afterwards is not visible here, so the first notes on a weak device may cost more than these numbers.
Autoplay (the page's own test, run twice): with Chromium's default policy the audio context was still "suspended" one second after load, so autoplay without a tap is not allowed (a `resume()` from the page then succeeded in this automated browser, which says nothing about real ones); with `--autoplay-policy=no-user-gesture-required` it was "running" at once. So the test tells the two cases apart. Microphone: the
page's test works with a fake device (RMS 0.49) and reports "NotSupportedError" without one.

## Device table (owner)

| Device | Chipset / RAM / OS / browser | Mode | SoundFont | Load | Memory | Dropouts | Drift | Autoplay | Mic |
|---|---|---|---|---|---|---|---|---|---|
| Desktop Chrome, Safari, Firefox | untested | | | | | | | | |
| Android phone, Chrome | untested | | | | | | | | |
| iPhone, Safari | untested | | | | | | | | |
| The cheap Android TV box (Chrome or WebView test app) | untested | | | | | | | | |
| Samsung TV browser (model, year) | untested | | | | | | | | |
| LG TV browser (model, year) | untested | | | | | | | | |

## Conclusions so far

* The page, the dropout rule and the lyric-drift measure work; lyric drift on the desktop is within 16 ms, under the
  50 ms target, with sync coming from the same sequencer clock the player uses.
* Nothing can be concluded about weak devices, the thresholds of section 4.1, or the oldest Tizen and webOS models
  until the owner has filled the table. When it is filled: write the thresholds here and update section 4.1 and the
  published minimum spec to match, and close the loop for the `auto` mode.
