// Runs the player screen, with the real web player page in a real WebView, against a real Kantahe server that serves the web app, and looks
// at the song cache from inside the page (docs/PLAN.md section 4.3):
//
//   flutter test integration_test/song_cache_flow_test.dart -d <device> \
//     --dart-define=SERVER_URL=http://localhost:8080 \
//     --dart-define=USER_EMAIL=... --dart-define=USER_PASSWORD=...
//
// The page is a secure context only on https:// and on localhost (on an emulator or a TV reached with `adb reverse`), which is what the cache needs.
// The test queues the longest MP3 song of the library, another MP3 song, and the first one again (the player does not reload a skip to the same
// song number), and makes this device the player. It asks the page, through the JavaScript channel the app has, for: the free
// space the app told it (window.kantahe.setFreeDisk), whether it can keep files, what the song cache holds, and what every audio element
// was given as its source: the first play must come from the server (http), the second from the device (blob:). Without SERVER_URL the
// test is skipped. It signs in through the API first.
import 'package:flutter/material.dart' hide State;
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.pb.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart' hide State;
import 'package:kantahe/player/embed_bridge.dart';
import 'package:kantahe/player/player_screen.dart';
import 'package:kantahe/player/web_embed.dart';

const serverUrl = String.fromEnvironment('SERVER_URL');
const userEmail = String.fromEnvironment('USER_EMAIL');
const userPassword = String.fromEnvironment('USER_PASSWORD');

/// false when SERVER_URL is a plain http:// address that is not localhost: the page is then no secure context, has no Cache Storage, and keeps its
/// files in IndexedDB, with the free space from the app as its only way to tell the room.
const secure = bool.fromEnvironment('SECURE', defaultValue: true);

/// Put in the page when it says it is ready, before the app hands it anything: reports what the page is given as the source of an audio
/// element and the free space the app tells it, through the channel named Kantahe.
const probe = '''
(function () {
  if (window.__kdbg) return;
  window.__kdbg = true;
  var post = function (m) { Kantahe.postMessage('KDBG:' + m); };
  var d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get: d.get,
    set: function (v) { v = String(v); post('src ' + (v.indexOf('blob:') === 0 ? 'blob' : v.indexOf('/media/song/') >= 0 ? 'song-http' : 'other ' + v.slice(0, 40))); d.set.call(this, v); }
  });
  var f = window.kantahe.setFreeDisk;
  window.kantahe.setFreeDisk = function (b) { post('freeDisk ' + b); return f.apply(this, arguments); };
  post('env secure=' + window.isSecureContext + ' caches=' + (typeof caches) + ' estimate=' + (navigator.storage && navigator.storage.estimate ? 'yes' : 'no'));
  // the files the cache keeps: Cache Storage in a secure context, IndexedDB in one that is not
  var keptKeys = function () {
    if (typeof caches !== 'undefined') return caches.open('kantahe-songs-v1').then(function (c) { return c.keys(); }).then(function (k) { return k.map(function (r) { return r.url.split('/').slice(-2).join('/'); }); });
    return new Promise(function (res, rej) {
      var o = indexedDB.open('kantahe-songs', 1);
      o.onupgradeneeded = function () { o.result.createObjectStore('files'); };
      o.onerror = function () { rej(o.error); };
      o.onsuccess = function () { var r = o.result.transaction('files', 'readonly').objectStore('files').getAllKeys(); r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; };
    });
  };
  var dropAll = function () {
    if (typeof caches !== 'undefined') return caches.delete('kantahe-songs-v1');
    return new Promise(function (res, rej) {
      var o = indexedDB.open('kantahe-songs', 1);
      o.onupgradeneeded = function () { o.result.createObjectStore('files'); };
      o.onerror = function () { rej(o.error); };
      o.onsuccess = function () { var t = o.result.transaction('files', 'readwrite'); t.objectStore('files').clear(); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; };
    });
  };
  // a clean start: what an earlier run kept is not this test's business
  localStorage.removeItem('kantahe.songcache.index');
  dropAll();
  window.__audios = [];
  var play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { if (window.__audios.indexOf(this) < 0) window.__audios.push(this); return play.apply(this, arguments); };
  // a song that plays from a kept file goes on playing, and can be sought, when its entry is deleted from the cache (as an eviction would)
  window.__blobcheck = async function () {
    var a = window.__audios[window.__audios.length - 1];
    await dropAll();
    var t0 = a.currentTime;
    a.currentTime = t0 + 20;
    await new Promise(function (r) { setTimeout(r, 3000); });
    post('blob src=' + (a.src.indexOf('blob:') === 0) + ' error=' + (a.error ? a.error.code : 'none') + ' paused=' + a.paused + ' moved=' + (a.currentTime - t0).toFixed(1));
  };
  window.__kcache = function () {
    keptKeys().then(function (k) { post('cache ' + k.length + ' ' + k.join(',')); });
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { post('estimate quota=' + e.quota + ' usage=' + e.usage); });
    else post('estimate none');
  };
})();
''';

Future<void> until(WidgetTester tester, bool Function() done, String what, {int seconds = 60}) async {
  for (var i = 0; i < seconds * 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
    if (done()) return;
  }
  fail('Timed out waiting for: $what');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the page keeps a played song on the device, plays it from there the next time, and is told the free space', (tester) async {
    final services = await AppServices.create();
    await services.auth.signOut();
    await services.serverUrl.set(serverUrl);
    final login = await services.api.auth.login(
      LoginRequest(email: userEmail, password: userPassword, deviceName: 'integration test', deviceType: DeviceType.DEVICE_TYPE_ANDROID),
    );
    await services.auth.signIn(login.auth);
    final songs = (await services.api.catalog.searchSongs(SearchSongsRequest(format: Format.FORMAT_MP3))).songs;
    final song = songs.reduce((a, b) => b.durationMs > a.durationMs ? b : a);
    final other = songs.firstWhere((s) => s.number != song.number);
    debugPrint('S5I song: ${song.number} "${song.title}" ${song.durationMs} ms');
    await until(tester, () => services.state.connected, 'the state stream');

    // A clean start whatever an earlier run left: the first song is current, the other song and the first again are queued. (A skip from a song to
    // another copy of itself is not a change of song for the player, so the queue must not hold the first song at its head.)
    current() async => (await services.api.session.getState(GetStateRequest())).state;
    Future<void> emptyQueue() async {
      for (final item in (await current()).queue) {
        await services.api.session.removeFromQueue(RemoveFromQueueRequest(itemId: item.id));
      }
    }

    Future<void> skip() => services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_SKIP));
    await emptyQueue();
    if ((await current()).now.song.number == song.number) {
      await services.api.session.addToQueue(AddToQueueRequest(number: other.number));
      await skip();
      await emptyQueue();
    }
    for (final n in [song.number, other.number, song.number]) {
      await services.api.session.addToQueue(AddToQueueRequest(number: n));
    }
    await skip();
    final start = await current();
    expect(start.now.song.number, song.number, reason: 'the first song is current');
    expect(start.queue.map((q) => q.song.number).toList(), [other.number, song.number]);

    final seen = <String>[];
    EmbedHost? host;
    Widget embed(BuildContext context, EmbedConfig c) => webEmbedBuilder(
      context,
      EmbedConfig(
        url: c.url,
        onMessage: (m) {
          if (m.startsWith('KDBG:')) {
            debugPrint('S5I page: ${m.substring(5)}');
            seen.add(m.substring(5));
            return;
          }
          if (m == 'KantaheReady') host?.runJavaScript(probe); // before the app hands over the token and the free space
          c.onMessage(m);
        },
        onPermission: c.onPermission,
        onHost: (h) {
          host = h;
          c.onHost(h);
        },
        onError: c.onError,
        allowNavigation: c.allowNavigation,
      ),
    );

    await tester.pumpWidget(
      AppRoot(
        services: services,
        child: MaterialApp(home: PlayerScreen(embedBuilder: embed)),
      ),
    );
    await tester.pump(const Duration(seconds: 3));
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY_HERE));
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_PLAY));

    List<String> sources() => seen.where((m) => m == 'src song-http' || m == 'src blob').toList();
    await until(tester, () => sources().isNotEmpty, 'the first play', seconds: 60);
    // the file is kept a moment after the song has loaded: ask the page until the cache holds it, then go on to the second copy in the queue
    await until(
      tester,
      () {
        if (seen.any((m) => m.startsWith('cache ') && m.contains('audio/${song.number}'))) return true;
        host!.runJavaScript('window.__kcache && window.__kcache();');
        return false;
      },
      'the song to be kept',
      seconds: 60,
    );
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_SKIP)); // to the other song
    await until(tester, () => sources().length >= 2, 'the other song', seconds: 60);
    await tester.pump(const Duration(seconds: 3));
    await services.api.session.control(ControlRequest(action: ControlAction.CONTROL_ACTION_SKIP)); // and back to the first
    await until(tester, () => sources().length >= 3, 'the first song again', seconds: 60);
    await tester.pump(const Duration(seconds: 4));
    if (song.durationMs.toInt() >= 60000) {
      host!.runJavaScript('window.__blobcheck && window.__blobcheck();');
      await until(tester, () => seen.any((m) => m.startsWith('blob ')), 'the check of a song playing from a kept file', seconds: 30);
    }
    host!.runJavaScript('window.__kcache && window.__kcache();');
    await until(tester, () => seen.any((m) => m.startsWith('estimate ')), 'the cache report', seconds: 20);
    for (final m in seen) {
      debugPrint('S5I seen: $m');
    }

    final env = seen.firstWhere((m) => m.startsWith('env '));
    expect(env, contains('secure=$secure'), reason: 'the address of the server decides: $env');
    expect(env, contains(secure ? 'caches=object' : 'caches=undefined'));
    final free = seen.firstWhere((m) => m.startsWith('freeDisk '), orElse: () => '');
    expect(free, isNotEmpty, reason: 'the page was told the free space of the device');
    expect(int.parse(free.substring('freeDisk '.length)), greaterThan(0));
    final src = sources();
    expect(src.first, 'src song-http', reason: 'the first play comes from the server');
    expect(src.last, 'src blob', reason: 'the second play of the first song comes from the device');
    expect(seen.where((m) => m.startsWith('cache ')), anyElement(contains('audio/${song.number}')));
    if (song.durationMs.toInt() >= 60000) {
      final blob = seen.firstWhere((m) => m.startsWith('blob '));
      expect(blob, contains('src=true'));
      expect(blob, contains('error=none'));
      expect(blob, contains('paused=false'), reason: 'the song goes on playing after its entry was deleted from the cache');
      final moved = double.parse(RegExp(r'moved=([\d.]+)').firstMatch(blob)!.group(1)!);
      expect(moved, greaterThanOrEqualTo(20), reason: 'seeking worked, and the clock went on: $blob');
    }

    await services.auth.signOut();
    await services.serverUrl.clear();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));
  }, skip: serverUrl.isEmpty);
}
