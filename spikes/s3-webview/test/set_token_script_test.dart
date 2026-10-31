import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe_s3/player_bridge.dart';

void main() {
  group('buildSetTokenScript', () {
    test('escapes quotes', () {
      final script = buildSetTokenScript('a"b', 'd1', 'http://x');
      expect(script, 'window.kantahe.setToken("a\\"b", "d1", "http://x");');
      // The arguments, taken back out of the call, are the original values.
      final args = jsonDecode('[${script.substring(script.indexOf('(') + 1, script.lastIndexOf(')'))}]');
      expect(args, ['a"b', 'd1', 'http://x']);
    });

    test('a token that tries to end the call stays inside its string', () {
      const evil = '");alert(1);("';
      final script = buildSetTokenScript(evil, 'd', 'http://x');
      final args = jsonDecode('[${script.substring(script.indexOf('(') + 1, script.lastIndexOf(')'))}]');
      expect(args, [evil, 'd', 'http://x']);
    });

    test('line breaks and unicode line separators cannot split the script', () {
      final script = buildSetTokenScript('a\nb${String.fromCharCode(0x2028)}c${String.fromCharCode(0x2029)}', 'd', 'http://x');
      expect(script.contains('\n'), isFalse);
      expect(script.contains(String.fromCharCode(0x2028)), isFalse);
      expect(script.contains(String.fromCharCode(0x2029)), isFalse);
      final args = jsonDecode('[${script.substring(script.indexOf('(') + 1, script.lastIndexOf(')'))}]');
      expect(args[0], 'a\nb${String.fromCharCode(0x2028)}c${String.fromCharCode(0x2029)}');
    });
  });

  group('playerUrl', () {
    test('no token in URL', () {
      final url = playerUrl('http://10.0.2.2:8080');
      expect(url.toString(), 'http://10.0.2.2:8080/embed/player');
      expect(url.hasQuery, isFalse);
      expect(url.hasFragment, isFalse);
    });

    test('a trailing slash on the server address does not double up', () {
      expect(playerUrl('http://karaoke.lan:8080/').toString(), 'http://karaoke.lan:8080/embed/player');
    });
  });
}
