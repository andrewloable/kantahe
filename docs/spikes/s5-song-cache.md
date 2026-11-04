# S5: the song cache on real devices

**Status: measured on the Android TV emulator by the agent; not yet on the real TV box, on Samsung Tizen or on LG webOS.** Nothing in a
device row is estimated. Design and rules: [PLAN.md](../PLAN.md) section 4.3 (epic `kantahe-1im`).

## Question

The song cache (section 4.3) relies on browser features that differ per platform: Cache Storage, `navigator.storage.estimate()`, an object
URL of a stored file as the source of an `<audio>` element with seeking, and the storage quota. Do they work in the Android WebView that the
Flutter apps embed (Android TV in particular), and does the quota say anything about the real free space?

## Measured: Android TV emulator (agent)

Android TV image API 36 (arm64, 1.5 GB RAM, `HoleBridge_TV_API36`), the debug build of the Flutter app, the real web player page in the
app's WebView, served by a local server through `adb reverse` so that the page address is `http://localhost:<port>`, which Chromium treats
as a secure context (like `https://`). Run: `app/integration_test/song_cache_flow_test.dart` (one test; it queues the library's longest MP3
song twice, makes the device the player, and asks the page what it sees through the app's JavaScript channel).

| Check | Result |
|---|---|
| `isSecureContext`, `typeof caches`, `navigator.storage.estimate` | `true`, `object`, present |
| Free space the app told the page (`window.kantahe.setFreeDisk`, `device_info_plus` / `StatFs` of the data partition) | 3.98 GB at the start; the value is read again every minute (3,979,603,968 then 3,971,067,904 bytes in one run) |
| The browser's own estimate | quota 6.44 GB, usage 50 KB (a quota of about 60 % of the partition, more than the 3.98 GB that were free: the estimate does overstate the real free space) |
| First play of a 2.2-minute MP3 | `audio.src` is the server's `/media/song/...` address; the file is kept (`audio/<number>` in `kantahe-songs-v1`) a moment after the song has loaded |
| Second play | `audio.src` is a `blob:` address: nothing is downloaded |
| Entry deleted from the cache while the song plays from the `blob:` address (what an eviction does) | no `error`, `paused` false, the clock goes on |
| Seek 20 s ahead while playing from the `blob:` address | works (`currentTime` moved 22.6 s in 3 s: the seek and the playing) |
| The song that is up next | kept ahead of time (`audio/<number>` of a second song appeared without being played) |

What this shows for the rule "always check the available size and leave a margin": the page needs the app's number (task `kantahe-1im.13`):
the quota (6.44 GB) was larger than the free space (3.98 GB), so the browser's estimate alone would have allowed more than the device had.
The cache takes the smaller of the two.

## Measured: the same app over plain HTTP (agent)

The same device test with the server reached as `http://10.0.2.2:<port>` (a non-loopback address: not a secure context). The page reports
`isSecureContext` false, `typeof caches` undefined and no `navigator.storage`; the app's free-disk value arrives; the first play is from the
server, the file is kept in **IndexedDB** (`audio/<number>` in `kantahe-songs`, plus the up-next song), the second play is a `blob:` address, deleting
the stored files while it plays does not interrupt it and a seek works (3 of 3 runs). A plain browser without the app has no free-space number and
keeps nothing (unit tests).

## Not measured (open)

* **The real Android TV box** (a Sony Android TV with 3 GB, the one used for the other spikes): it was in use by another app when this was run,
  and the agent does not take over a TV that someone is watching; its pairing with the production server is also not changed to run a test
  server. Still to do: with the new web page deployed to the production server, play three songs twice each on the box, record
  `navigator.storage.estimate()` and `adb shell df /data` (both numbers, to compare), and the start time of a first play.
* **Samsung Tizen and LG webOS** (owner): open the packaged app, play a song twice, and report in these two lines what the page says in its
  console or in the app's logs: `typeof caches` and whether the second play makes a request to `/media/song/...` (the server's log shows it).
  A platform without Cache Storage needs no change: the player falls back to the network. Samsung: ______  LG: ______
* **iOS**: `device_info_plus` reads `freeDiskSize` there; not run (no iOS device).
* **First-play start time** with the low-priority cache download running in parallel with the stream: not measured on a slow link.

## Procedure

```sh
# a server with the web app embedded, on a loopback port, and a library with one long MP3 song
adb -s <device> reverse tcp:<port> tcp:<port>
cd app && flutter test integration_test/song_cache_flow_test.dart -d <device> \
  --dart-define=SERVER_URL=http://localhost:<port> --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=...
```
