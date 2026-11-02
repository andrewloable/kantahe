import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/player/embed_bridge.dart';

class FakeHost implements EmbedHost {
  final scripts = <String>[];
  int reloads = 0;
  int unloads = 0;
  int loads = 0;

  /// The address the page shows now.
  String? url = 'http://srv:1/embed/player';

  @override
  Future<String?> currentUrl() async => url;

  @override
  Future<void> runJavaScript(String script) async => scripts.add(script);

  @override
  Future<void> reload() async => reloads++;

  @override
  Future<void> unload() async {
    unloads++;
    url = 'about:blank';
  }

  @override
  Future<void> load() async {
    loads++;
    url = 'http://srv:1/embed/player';
  }
}

List<Object?> argsOf(String script) => jsonDecode('[${script.substring(script.indexOf('(') + 1, script.lastIndexOf(')'))}]') as List<Object?>;

Future<({EmbedBridge bridge, FakeHost host, AuthStore auth})> make({bool signedIn = true, String server = 'http://srv:1'}) async {
  final auth = AuthStore(MemoryStore());
  if (signedIn) {
    await auth.signIn(
      AuthToken(
        token: 'tok"en',
        deviceId: 'dev-1',
        user: User(id: 'u'),
      ),
    );
  }
  final serverUrl = ServerUrl(MemoryStore());
  await serverUrl.set(server);
  final host = FakeHost();
  return (bridge: EmbedBridge(auth: auth, serverUrl: serverUrl, host: host), host: host, auth: auth);
}

void main() {
  group('guide vocals', () {
    test('buildSetVocalsScript_is_plain: a guarded call with a boolean and a whole number, rounded down to a step of 10 between 0 and 100', () {
      expect(buildSetVocalsScript(true, 60), 'window.kantahe && window.kantahe.setVocals && window.kantahe.setVocals(true, 60);');
      expect(argsOf(buildSetVocalsScript(false, 85)), [false, 80]);
      expect(argsOf(buildSetVocalsScript(true, -5)), [true, 0]);
      expect(argsOf(buildSetVocalsScript(true, 500)), [true, 100]);
    });

    test('parseVocalsMessage reads KantaheVocals:state:pct and nothing else', () {
      final on = parseVocalsMessage('KantaheVocals:on:60');
      expect([on?.state, on?.pct], ['on', 60]);
      expect(parseVocalsMessage('KantaheVocals:failed:60')?.state, 'failed');
      expect(parseVocalsMessage('KantaheVocals:off:0')?.pct, 0);
      expect(parseVocalsMessage('KantaheVocals:loading:100')?.pct, 100);
      for (final bad in [
        'KantaheVocals:maybe:60',
        'KantaheVocals:on:abc',
        'KantaheVocals:on:101',
        'KantaheVocals:on:-1',
        'KantaheVocals:on',
        'KantaheVocals:on:60:1',
        'hello',
        '',
        'KantaheReady',
      ]) {
        expect(parseVocalsMessage(bad), isNull, reason: bad);
      }
    });

    test('vocals_messages_reach_onVocals_only_from_the_server_page, and run no script', () async {
      final m = await make();
      final seen = <VocalsReport>[];
      m.bridge.onVocals = seen.add;
      await m.bridge.onMessage('KantaheVocals:on:60');
      expect(seen.map((r) => r.state), ['on']);
      m.host.url = 'about:blank';
      await m.bridge.onMessage('KantaheVocals:on:60');
      m.host.url = 'https://evil.example/';
      await m.bridge.onMessage('KantaheVocals:on:60');
      expect(seen, hasLength(1));
      expect(m.host.scripts, isEmpty);
    });

    test('ready_hands_over_the_remembered_vocals_choice: setToken first, then setVocals', () async {
      final m = await make();
      await m.bridge.setVocals(true, 70);
      expect(m.host.scripts, hasLength(1)); // set at once
      m.host.scripts.clear();
      await m.bridge.onMessage('KantaheReady');
      expect(m.host.scripts, hasLength(2));
      expect(m.host.scripts[0], contains('setToken'));
      expect(argsOf(m.host.scripts[1]), [true, 70]);
    });

    test('without a remembered choice KantaheReady still hands over the token and nothing else', () async {
      final m = await make();
      await m.bridge.onMessage('KantaheReady');
      expect(m.host.scripts, hasLength(1));
      expect(m.host.scripts.single, contains('setToken'));
    });

    test('setVocals_without_a_host_only_remembers', () async {
      final m = await make();
      m.bridge.host = null;
      await m.bridge.setVocals(false, 30);
      expect(m.bridge.vocalsChoice, (on: false, pct: 30));
      expect(m.host.scripts, isEmpty);
    });
  });

  group('playerUrl', () {
    test('no token in URL: the address of the player page, with no query or fragment', () {
      final url = playerUrl('http://10.0.2.2:8080');
      expect(url.toString(), 'http://10.0.2.2:8080/embed/player');
      expect(url.hasQuery, isFalse);
      expect(url.hasFragment, isFalse);
    });

    test('a trailing slash on the server address does not double up', () {
      expect(playerUrl('http://karaoke.lan:8080/').toString(), 'http://karaoke.lan:8080/embed/player');
    });

    test('a server under a path keeps its path', () {
      expect(playerUrl('https://example.org/kantahe').toString(), 'https://example.org/kantahe/embed/player');
    });
  });

  group('sameOrigin', () {
    test('scheme, host and port must all match; the host is case-insensitive; default ports count', () {
      expect(sameOrigin('http://srv:1/a/b?c', 'http://srv:1'), isTrue);
      expect(sameOrigin('http://SRV:1/', 'http://srv:1'), isTrue);
      expect(sameOrigin('https://srv/x', 'https://srv:443'), isTrue);
      expect(sameOrigin('http://srv/x', 'http://srv:80'), isTrue);
      expect(sameOrigin('https://srv:1/', 'http://srv:1'), isFalse);
      expect(sameOrigin('http://srv:2/', 'http://srv:1'), isFalse);
      expect(sameOrigin('http://srv.evil.example:1/', 'http://srv:1'), isFalse);
      expect(sameOrigin('http://srv:1@evil.example/', 'http://srv:1'), isFalse);
      expect(sameOrigin('about:blank', 'http://srv:1'), isFalse);
      expect(sameOrigin('not a url', 'http://srv:1'), isFalse);
      expect(sameOrigin(null, 'http://srv:1'), isFalse);
    });
  });

  group('buildSetTokenScript', () {
    test('escapes quotes and backslashes: the arguments come back as they went in', () {
      const token = r'a"b\c';
      final script = buildSetTokenScript(token, 'd1', 'http://x');
      expect(script, startsWith('window.kantahe.setToken('));
      expect(argsOf(script), [token, 'd1', 'http://x']);
    });

    test('a token that tries to end the call stays inside its string', () {
      const evil = '");alert(1);("';
      expect(argsOf(buildSetTokenScript(evil, 'd', 'http://x')), [evil, 'd', 'http://x']);
    });

    test('line breaks and unicode line separators cannot split the script', () {
      final value = 'a\nb${String.fromCharCode(0x2028)}c${String.fromCharCode(0x2029)}';
      final script = buildSetTokenScript(value, 'd', 'http://x');
      expect(script.contains('\n'), isFalse);
      expect(script.contains(String.fromCharCode(0x2028)), isFalse);
      expect(script.contains(String.fromCharCode(0x2029)), isFalse);
      expect(argsOf(script)[0], value);
    });
  });

  group('EmbedBridge', () {
    test('nothing is injected before the page says it is ready', () async {
      final m = await make();
      expect(m.host.scripts, isEmpty);
    });

    test('the ready message injects the token, the device id and the server address, once', () async {
      final m = await make();
      m.bridge.onMessage('KantaheReady');
      await Future<void>.delayed(Duration.zero);
      expect(m.host.scripts.length, 1);
      expect(argsOf(m.host.scripts.single), ['tok"en', 'dev-1', 'http://srv:1']);
    });

    test('a page that starts again (a reload) asks again and is given the token again', () async {
      final m = await make();
      m.bridge.onMessage('KantaheReady');
      m.bridge.onMessage('KantaheReady');
      await Future<void>.delayed(Duration.zero);
      expect(m.host.scripts.length, 2);
    });

    test('other messages from the page are ignored', () async {
      final m = await make();
      m.bridge.onMessage('hello');
      m.bridge.onMessage('{"key":"x"}');
      m.bridge.onMessage('kantaheready');
      await Future<void>.delayed(Duration.zero);
      expect(m.host.scripts, isEmpty);
    });

    test('regression: a page that is not on the server (a redirect, a link) is never given the token', () async {
      final m = await make();
      for (final elsewhere in ['https://evil.example/embed/player', 'http://srv:2/embed/player', 'http://other:1/', 'about:blank', null]) {
        m.host.url = elsewhere;
        m.bridge.onMessage('KantaheReady');
        await Future<void>.delayed(Duration.zero);
      }
      expect(m.host.scripts, isEmpty);
    });

    test('a page on the server is given it whatever its path or query', () async {
      final m = await make();
      m.host.url = 'http://SRV:1/embed/player?x=1#y';
      m.bridge.onMessage('KantaheReady');
      await Future<void>.delayed(Duration.zero);
      expect(m.host.scripts.length, 1);
    });

    test('without a session nothing is injected', () async {
      final m = await make(signedIn: false);
      m.bridge.onMessage('KantaheReady');
      await Future<void>.delayed(Duration.zero);
      expect(m.host.scripts, isEmpty);
    });

    test('the token of the moment is used: after a sign-out nothing is injected', () async {
      final m = await make();
      await m.auth.signOut();
      m.bridge.onMessage('KantaheReady');
      await Future<void>.delayed(Duration.zero);
      expect(m.host.scripts, isEmpty);
    });

    test('without a server address nothing is injected', () async {
      final auth = AuthStore(MemoryStore());
      await auth.signIn(
        AuthToken(
          token: 't',
          deviceId: 'd',
          user: User(id: 'u'),
        ),
      );
      final host = FakeHost();
      EmbedBridge(auth: auth, serverUrl: ServerUrl(MemoryStore()), host: host).onMessage('KantaheReady');
      await Future<void>.delayed(Duration.zero);
      expect(host.scripts, isEmpty);
    });
  });
}
