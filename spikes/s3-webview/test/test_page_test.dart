import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  // The page prints what it received and reports it to the app's log; a real token must never appear there,
  // not even its first characters.
  test('regression: the test page never echoes token characters', () {
    final html = File('assets/test.html').readAsStringSync();
    expect(html.contains('token.slice'), isFalse);
    expect(html.contains('first='), isFalse);
  });

  test('the test page follows the contract of /embed/player: channel Kantahe, text KantaheReady', () {
    final html = File('assets/test.html').readAsStringSync();
    expect(html.contains("window.Kantahe.postMessage('KantaheReady')"), isTrue);
    expect(html.contains('window.kantahe = {'), isTrue);
  });
}
