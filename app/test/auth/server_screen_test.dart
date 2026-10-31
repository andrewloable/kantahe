import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/server_screen.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

import 'harness.dart';

void main() {
  testWidgets('asks for the address, with http:// already in the field', (tester) async {
    final h = Harness(server: null);
    await h.pump(tester, const ServerScreen());
    expect(find.text('Connect'), findsOneWidget);
    expect(find.text('Server address'), findsOneWidget);
    expect(fieldText(tester, 'server-url'), 'http://');
  });

  testWidgets('a server that answers is stored', (tester) async {
    final h = Harness(server: null);
    await h.pump(tester, const ServerScreen());
    await enter(tester, 'server-url', 'http://192.168.1.20:8080/');
    await tapText(tester, 'Connect');
    expect(h.infoAsked, ['http://192.168.1.20:8080']);
    expect(h.serverUrl.value, 'http://192.168.1.20:8080');
  });

  testWidgets('setup_required: the message is shown and nothing is stored (no navigation)', (tester) async {
    final h = Harness(server: null);
    h.info = (_) => GetServerInfoResponse(version: '1.0', setupRequired: true);
    await h.pump(tester, const ServerScreen());
    await enter(tester, 'server-url', 'http://192.168.1.20:8080');
    await tapText(tester, 'Connect');
    expect(shows('Server needs setup in a web browser first'), isTrue);
    expect(h.serverUrl.value, isNull);
  });

  testWidgets('an unreachable server shows why, naming the address', (tester) async {
    final h = Harness(server: null);
    h.info = (_) => throw ConnectException(Code.unavailable, 'refused');
    await h.pump(tester, const ServerScreen());
    await enter(tester, 'server-url', 'http://10.0.0.9:8080');
    await tapText(tester, 'Connect');
    expect(shows('Could not reach the server at http://10.0.0.9:8080'), isTrue);
    expect(h.serverUrl.value, isNull);
  });

  testWidgets('something that is not an address says how to type one and asks nothing', (tester) async {
    final h = Harness(server: null);
    await h.pump(tester, const ServerScreen());
    await enter(tester, 'server-url', 'ftp://x');
    await tapText(tester, 'Connect');
    expect(shows('Enter an address such as http://192.168.1.20:8080'), isTrue);
    expect(h.infoAsked, isEmpty);
  });

  testWidgets('a new attempt clears the old message', (tester) async {
    final h = Harness(server: null);
    h.info = (_) => throw ConnectException(Code.unavailable, 'refused');
    await h.pump(tester, const ServerScreen());
    await enter(tester, 'server-url', 'http://10.0.0.9:8080');
    await tapText(tester, 'Connect');
    expect(shows('Could not reach'), isTrue);
    h.info = (_) => GetServerInfoResponse(version: '1', setupRequired: false);
    await tapText(tester, 'Connect');
    expect(shows('Could not reach'), isFalse);
  });

  testWidgets('while it checks the button is off, so a double tap asks once', (tester) async {
    final h = Harness(server: null);
    h.infoGate = Completer<void>(); // the server is slow to answer
    await h.pump(tester, const ServerScreen());
    await enter(tester, 'server-url', 'http://10.0.0.9:8080');
    await tester.tap(find.text('Connect'));
    await tester.pump();
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
    await tester.tap(find.text('Connect'), warnIfMissed: false);
    await tester.pump();
    expect(h.infoAsked.length, 1);
    h.infoGate!.complete();
    await tester.pumpAndSettle();
    expect(h.infoAsked.length, 1);
  });
}
