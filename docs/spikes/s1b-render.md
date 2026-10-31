# Spike S1b: server-side MIDI render in pure Go

Question (PLAN.md 4.1, layer 3): which pure-Go synth and which pure-Go encoder let the server turn a
MIDI/KAR song into audio that every client plays with `<audio>` and HTTP Range?

Code: [spikes/s1b-render](../../spikes/s1b-render) (own Go module; the server does not import it).
`go run . -sf2 GeneralUser-GS.sf2 -in song.kar -out song.flac [-rate 32000]` prints the numbers below.

## Decision

* **Synth: go-meltysynth** (MIT, standard library only). It renders GeneralUser GS at about 85x real time
  on one core of a laptop and is deterministic.
* **Encoder: FLAC with `github.com/mewkiz/flac`** (public domain, pure Go), 16-bit stereo. Lossless,
  about half the size of WAV. Written by this spike's `encodeFLAC` and verified with the reference decoder.
* **Sample rate: 32000 Hz** as the default (a setting can still choose 44100): 22 % smaller files and
  1.5x faster than 44100 Hz; it keeps everything below 16 kHz. **To be confirmed by the owner's listening
  test**; if the difference is audible, change the one constant to 44100.
* **MP3 is not possible** with a permissively licensed pure-Go encoder: the only one found
  (`braheezy/shine-mp3`, a port of Shine) is LGPL-2, which does not fit an MIT project that ships one
  static binary. WAV remains the fallback if FLAC turns out not to play on a device.

## Libraries (all without cgo; `CGO_ENABLED=0 go build` works)

| Library | Version | Licence | Use |
|---|---|---|---|
| github.com/sinshu/go-meltysynth | v0.0.0-20230205031334-05d311382fc4 (no tags; last push April 2023) | MIT | synth |
| github.com/mewkiz/flac | v1.0.14 | Unlicense (public domain) | FLAC encoder and, in tests, decoder |
| github.com/icza/bitio | v1.1.0 | Apache-2.0 | bit writer used by mewkiz/flac |
| github.com/mewkiz/pkg, github.com/mewpkg/term | pseudo-versions | Unlicense | helpers used by mewkiz/flac |
| github.com/braheezy/shine-mp3 | v0.2.0 | LGPL-2 (not used) | MP3, rejected for its licence |

The binary will carry code under MIT, Apache-2.0 and the Unlicense; ship their licence texts with the releases (a NOTICE file) when the render feature is built.

## Numbers

Machine: Apple M4 Pro (14 cores; one core is used), macOS, Go 1.25. Input: a synthetic 4-minute
song made for this test (piano melody, bass, string chords, guitar arpeggio, drums; 7,200 note events),
GeneralUser GS v2.0.3 (32.3 MB). Speeds vary by about 5 % from run to run. No real songs and no server hardware were available to the agent.

| Output | Render | Encode | Size | RSS peak |
|---|---|---|---|---|
| 44100 Hz FLAC | 2.9 s (84x) | 2.9 s (84x) | 21.1 MB (702 kbit/s) | 259 MB |
| 44100 Hz WAV | 2.8 s (87x) | 0.14 s | 42.3 MB | 276 MB |
| 32000 Hz FLAC | 1.9 s (129x) | 2.1 s (113x) | 16.5 MB (551 kbit/s) | 179 MB |
| 22050 Hz FLAC | 1.3 s (187x) | 1.5 s (161x) | 12.7 MB (424 kbit/s) | 157 MB |

With the per-song trimmed SoundFont of PLAN layer 1 (8.0 MB for this song, built by `internal/song/sf2`)
instead of the full bank: the output is **bit-identical** (same PCM MD5 as the full-bank render), the
SoundFont parses in 8 ms instead of 35 ms, and the peak memory drops from 276 MB to 244 MB. Render speed is unchanged.
So the server should render with the trimmed font.

Correctness checks: the FLAC decodes with the reference `flac -t` (ok) and `ffmpeg` to exactly the PCM of
the WAV written from the same render; the stream info holds the true sample count.

## Findings

1. **Modulators are ignored.** go-meltysynth discards every SoundFont modulator ("modulators will not be
   supported" in `modulator.go`) and applies the General MIDI default behaviour in code. GeneralUser GS
   does use them: 448 preset and 1,808 instrument modulator records (about 230 distinct), mostly
   velocity to initial attenuation (curves of 700-800), velocity to filter cutoff (-2400 to -7000 cents),
   and per-instrument reverb (CC91) and chorus (CC93) sends. Expect the server render to sound a little
   duller or flatter than the browser synth, which implements them. This is the main risk of the choice
   and is exactly what the owner's listening test has to judge.
2. **Bug found in the library use, fixed:** `flac.Encoder.Close` writes the short last block's size as
   the stream's *minimum* block size, which makes the reference decoder warn "frame number does not
   increase correctly" and treat the stream as variable-block. `encodeFLAC` patches the minimum back to
   the block size after `Close` (`TestEncodeFLACRoundTrip` checks it).
3. **Memory is dominated by holding the whole song.** The spike renders into two float32 slices (85 MB for
   4 minutes at 44.1 kHz) and converts to int16 before encoding. A production renderer should render and
   encode in blocks (the sequencer renders any block size), which brings the peak to the SoundFont plus a
   few MB. Also share one parsed SoundFont between concurrent renders if the library allows it (not
   verified).
4. **No tail:** `render` returns exactly the MIDI's length; production should append one or two seconds so
   the last notes ring out.
5. **Seeking:** the encoder writes no SEEKTABLE. Browsers can still seek a FLAC file served with Range
   (they bisect), but less precisely and with more requests. A seek table needs the byte offset of each
   frame, known only after encoding; add it in the render task if seeking feels loose on a device.
6. **Not measured (needs a person with the hardware):** speed and memory on the intended server, a
   listening comparison against the browser player of S1 (kantahe-3af.7) on 5 real songs, and whether FLAC
   plays in `<audio>` on Tizen and webOS TVs, Android TV WebView and iOS WebView (FLAC is supported by
   current Chrome, Firefox, Safari and the Android/iOS WebViews; the TV browsers are the open question).

## Owner checklist

1. On the server machine, with GeneralUser GS and 5 real songs:
   `go run ./spikes/s1b-render -sf2 GeneralUser-GS.sf2 -in song.kar -out song.flac -rate 32000` and
   write the lines it prints into the notes of kantahe-3af.9. A rule of thumb for the decision: the render
   of a 4-minute song should finish in well under the time the previous song is sung (say 30 s), i.e.
   more than about 10x real time.
2. Play `song.flac` next to the same song in the web player of S1 and note differences (brightness,
   dynamics, reverb).
3. Play a FLAC file in the TV and box browsers of S1.

## Implemented

The decision is built in [server/internal/render](../../server/internal/render): `Render` streams FLAC
block by block (no whole-song buffers; findings 3 and 4 above are done: the real renderer appends a
1.5 s tail and refuses songs longer than 20 minutes), a worker renders one song at a time into an LRU
cache (`<data>/cache/render`, limit `--render-cache-gb`), `/media/rendered/{number}` serves it with Range,
and `GetPlayback` answers `PLAYBACK_KIND_AUDIO` with that URL for devices in server mode. Differences from
the spike: the stream info carries the true sample count and equal block limits but no MD5 (it is unknown
while streaming; decoders only warn), and a damaged song is a failed render (remembered for ten minutes),
after which the device plays the MIDI itself.
