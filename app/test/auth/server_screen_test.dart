import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/auth/server_screen.dart';
import 'package:kantahe/core/server_discovery.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

import 'harness.dart';

/// Shows the screen and lets the search for servers finish (nothing is found unless the test says so).
Future<void> open(WidgetTester tester, Harness h) async {
  await h.pump(tester, const ServerScreen());
  await tester.pumpAndSettle();
}

Key rowKey(String url) => Key('found-server-$url');

void main() {
  group('no server found: the address form', () {
    testWidgets('asks for the address, with http:// already in the field', (tester) async {
      final h = Harness(server: null);
      await open(tester, h);
      expect(find.text('Connect'), findsOneWidget);
      expect(find.text('Server address'), findsOneWidget);
      expect(fieldText(tester, 'server-url'), 'http://');
      expect(shows('No Kantahe server was found on this network'), isTrue);
    });

    testWidgets('a server that answers is stored', (tester) async {
      final h = Harness(server: null);
      await open(tester, h);
      await enter(tester, 'server-url', 'http://192.168.1.20:8080/');
      await tapText(tester, 'Connect');
      expect(h.infoAsked, ['http://192.168.1.20:8080']);
      expect(h.serverUrl.value, 'http://192.168.1.20:8080');
    });

    testWidgets('setup_required: the message is shown and nothing is stored (no navigation)', (tester) async {
      final h = Harness(server: null);
      h.info = (_) => GetServerInfoResponse(version: '1.0', setupRequired: true);
      await open(tester, h);
      await enter(tester, 'server-url', 'http://192.168.1.20:8080');
      await tapText(tester, 'Connect');
      expect(shows('Server needs setup in a web browser first'), isTrue);
      expect(h.serverUrl.value, isNull);
    });

    testWidgets('an unreachable server shows why, naming the address', (tester) async {
      final h = Harness(server: null);
      h.info = (_) => throw ConnectException(Code.unavailable, 'refused');
      await open(tester, h);
      await enter(tester, 'server-url', 'http://10.0.0.9:8080');
      await tapText(tester, 'Connect');
      expect(shows('Could not reach the server at http://10.0.0.9:8080'), isTrue);
      expect(h.serverUrl.value, isNull);
    });

    testWidgets('something that is not an address says how to type one and asks nothing', (tester) async {
      final h = Harness(server: null);
      await open(tester, h);
      await enter(tester, 'server-url', 'ftp://x');
      await tapText(tester, 'Connect');
      expect(shows('Enter an address such as http://192.168.1.20:8080'), isTrue);
      expect(h.infoAsked, isEmpty);
    });

    testWidgets('a new attempt clears the old message', (tester) async {
      final h = Harness(server: null);
      h.info = (_) => throw ConnectException(Code.unavailable, 'refused');
      await open(tester, h);
      await enter(tester, 'server-url', 'http://10.0.0.9:8080');
      await tapText(tester, 'Connect');
      expect(shows('Could not reach'), isTrue);
      h.info = (_) => GetServerInfoResponse(version: '1', setupRequired: false);
      await tapText(tester, 'Connect');
      expect(shows('Could not reach'), isFalse);
    });

    testWidgets('while it checks the button is off, so a double tap asks once', (tester) async {
      final h = Harness(server: null);
      await open(tester, h);
      h.infoGate = Completer<void>(); // the server is slow to answer
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

    testWidgets('Search again runs the search again', (tester) async {
      final h = Harness(server: null);
      await open(tester, h);
      expect(h.searches, 1);
      await tester.tap(find.byKey(const Key('search-again')));
      await tester.pumpAndSettle();
      expect(h.searches, 2);
    });
  });

  group('searching', () {
    testWidgets('shows that it is looking, and no address field', (tester) async {
      final h = Harness(server: null);
      final gate = Completer<List<ServerCandidate>>();
      h.find = (_) => gate.future;
      await h.pump(tester, const ServerScreen());
      await tester.pump();
      expect(shows('Looking for Kantahe servers'), isTrue);
      expect(find.byKey(const Key('server-url')), findsNothing);
      gate.complete(const []);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('server-url')), findsOneWidget);
    });

    testWidgets('REGRESSION: the title is centred over the centred status, not left of it', (tester) async {
      final h = Harness(server: null);
      final gate = Completer<List<ServerCandidate>>();
      h.find = (_) => gate.future;
      await h.pump(tester, const ServerScreen());
      await tester.pump();
      expect(tester.widget<Text>(find.text('Connect to your server')).textAlign, TextAlign.center);
      gate.complete(const []);
      await tester.pumpAndSettle();
      // the form that follows keeps its left-aligned title over the left-aligned field
      expect(tester.widget<Text>(find.text('Connect to your server')).textAlign, isNot(TextAlign.center));
    });

    testWidgets('REGRESSION: while it connects the title is centred over the centred "Connecting to" line', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [
        ServerCandidate('Den', ['http://a:8080']),
      ];
      await open(tester, h);
      expect(shows('Connecting to'), isTrue);
      expect(tester.widget<Text>(find.text('Connect to your server')).textAlign, TextAlign.center);
    });

    testWidgets('asks for the search window the plan says: three seconds', (tester) async {
      final h = Harness(server: null);
      Duration? asked;
      h.find = (w) async {
        asked = w;
        return const [];
      };
      await open(tester, h);
      expect(asked, const Duration(seconds: 3));
    });

    testWidgets('a second Search again while it is searching does nothing', (tester) async {
      final h = Harness(server: null);
      await open(tester, h);
      final gate = Completer<List<ServerCandidate>>();
      h.find = (_) => gate.future;
      await tester.tap(find.byKey(const Key('search-again')));
      await tester.pump();
      expect(find.byKey(const Key('search-again')), findsNothing); // the button is gone while it searches
      expect(h.searches, 2);
      gate.complete(const []);
      await tester.pumpAndSettle();
    });
  });

  group('servers found', () {
    ServerCandidate server(String name, String url) => ServerCandidate(name, [url]);

    testWidgets('REGRESSION: exactly one server is stored without a tap', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [server('Den', 'http://a:8080')];
      await open(tester, h);
      expect(h.serverUrl.value, 'http://a:8080');
    });

    testWidgets('exactly one server, after Use another server, is listed and not stored; tapping it stores it', (tester) async {
      final h = Harness(server: null);
      h.serverUrl.clear(); // what the button does: auto-connect is off for the rest of the run
      h.find = (_) async => [server('Den', 'http://a:8080')];
      await open(tester, h);
      expect(h.serverUrl.value, isNull);
      expect(find.byKey(rowKey('http://a:8080')), findsOneWidget);
      expect(find.byKey(const Key('server-url')), findsNothing);
      await tester.tap(find.byKey(rowKey('http://a:8080')));
      await tester.pumpAndSettle();
      expect(h.serverUrl.value, 'http://a:8080');
    });

    testWidgets('two servers are listed by their names; the chosen one is stored; the address form is not shown', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [server('x', 'http://a:8080'), server('y', 'http://b:9000')];
      h.info = (url) => GetServerInfoResponse(version: '2.1', name: url.contains('b:') ? 'Office' : 'Living room');
      await open(tester, h);
      expect(h.serverUrl.value, isNull);
      expect(find.text('Living room'), findsOneWidget);
      expect(find.text('Office'), findsOneWidget);
      expect(shows('http://b:9000'), isTrue);
      expect(shows('version 2.1'), isTrue);
      expect(find.byKey(const Key('server-url')), findsNothing);
      await tester.tap(find.text('Office'));
      await tester.pumpAndSettle();
      expect(h.serverUrl.value, 'http://b:9000');
    });

    testWidgets('an address that does not answer is not listed, so one answering server is stored at once', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [server('a', 'http://a:8080'), server('b', 'http://b:9000')];
      h.info = (url) => url.contains('b:') ? throw ConnectException(Code.unavailable, 'refused') : GetServerInfoResponse(version: '1');
      await open(tester, h);
      expect(h.serverUrl.value, 'http://a:8080');
    });

    testWidgets('one server that is found on several addresses counts once, on the first that answers', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [
        const ServerCandidate('Den', ['http://172.17.0.1:8080', 'http://192.168.1.5:8080', 'http://[2001:db8::5]:8080']),
      ];
      h.info = (url) => url.contains('172.17') ? throw ConnectException(Code.unavailable, 'no route') : GetServerInfoResponse(version: '1');
      await open(tester, h);
      expect(h.serverUrl.value, 'http://192.168.1.5:8080');
    });

    testWidgets('two entries that end at the same address count once', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [server('a', 'http://a:8080'), server('a again', 'http://a:8080/')];
      await open(tester, h);
      expect(h.serverUrl.value, 'http://a:8080');
    });

    testWidgets('a lone server that needs setup is listed with the setup message, and nothing is stored', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [server('Den', 'http://a:8080')];
      h.info = (_) => GetServerInfoResponse(version: '1', setupRequired: true, name: 'Den');
      await open(tester, h);
      expect(h.serverUrl.value, isNull);
      expect(find.byKey(rowKey('http://a:8080')), findsOneWidget);
      await tester.tap(find.byKey(rowKey('http://a:8080')));
      await tester.pumpAndSettle();
      expect(shows('Server needs setup in a web browser first'), isTrue);
      expect(h.serverUrl.value, isNull);
    });

    testWidgets('a server with no name is shown by its address', (tester) async {
      final h = Harness(server: null);
      h.serverUrl.clear();
      h.find = (_) async => [server('whatever the network said', 'http://a:8080')];
      await open(tester, h);
      expect(find.descendant(of: find.byKey(rowKey('http://a:8080')), matching: find.text('http://a:8080')), findsOneWidget);
    });

    testWidgets('Search again on the list runs the search again', (tester) async {
      final h = Harness(server: null);
      h.serverUrl.clear();
      h.find = (_) async => [server('Den', 'http://a:8080')];
      await open(tester, h);
      await tester.tap(find.byKey(const Key('search-again')));
      await tester.pumpAndSettle();
      expect(h.searches, 2);
    });

    testWidgets('the search finding nothing after servers were found shows the address form', (tester) async {
      final h = Harness(server: null);
      h.serverUrl.clear();
      h.find = (_) async => [server('Den', 'http://a:8080')];
      await open(tester, h);
      h.find = noServers;
      await tester.tap(find.byKey(const Key('search-again')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('server-url')), findsOneWidget);
    });
  });
  group('with a remote control', () {
    ServerCandidate server(String name, String url) => ServerCandidate(name, [url]);
    // the row's own focus node is the one around its contents (the ring outside it only draws)
    bool focused(WidgetTester tester, String url) =>
        Focus.of(tester.element(find.descendant(of: find.byKey(rowKey(url)), matching: find.byType(Column)))).hasPrimaryFocus;

    testWidgets('on a TV the first server has the focus, arrow down reaches the next, OK chooses it', (tester) async {
      final h = Harness(server: null, tv: true);
      h.find = (_) async => [server('a', 'http://a:8080'), server('b', 'http://b:9000')];
      await open(tester, h);
      expect(focused(tester, 'http://a:8080'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      expect(focused(tester, 'http://b:9000'), isTrue);
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pumpAndSettle();
      expect(h.serverUrl.value, 'http://b:9000');
    });

    testWidgets('on a TV the remote can reach Search again below the servers', (tester) async {
      final h = Harness(server: null, tv: true);
      h.find = (_) async => [server('a', 'http://a:8080'), server('b', 'http://b:9000')];
      await open(tester, h);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.select);
      await tester.pumpAndSettle();
      expect(h.searches, 2);
    });

    testWidgets('on a phone nothing takes the focus by itself', (tester) async {
      final h = Harness(server: null);
      h.find = (_) async => [server('a', 'http://a:8080'), server('b', 'http://b:9000')];
      await open(tester, h);
      expect(focused(tester, 'http://a:8080'), isFalse);
    });
  });
}
