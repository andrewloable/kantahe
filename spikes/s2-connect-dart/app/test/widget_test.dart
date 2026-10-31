import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe_s2/api.dart';
import 'package:kantahe_s2/main.dart';

class FakeApi implements SpikeApi {
  FakeApi({this.info = 'spike', this.fail = false});
  final String info;
  final bool fail;
  final controller = StreamController<int>();

  @override
  Future<String> serverInfo() async {
    if (fail) throw Exception('no route to host');
    return 'version=$info setup_required=true';
  }

  @override
  Stream<int> watch() => controller.stream;

  @override
  void close() {}
}

void main() {
  testWidgets('shows unary response', (tester) async {
    await tester.pumpWidget(SpikeApp(apiFor: (_) => FakeApi(), defaultUrl: 'http://127.0.0.1:8099'));
    await tester.tap(find.byKey(const Key('unary')));
    await tester.pumpAndSettle();
    expect(find.textContaining('version=spike'), findsOneWidget);
  });

  testWidgets('shows the error of a unary call that fails', (tester) async {
    await tester.pumpWidget(SpikeApp(apiFor: (_) => FakeApi(fail: true), defaultUrl: 'http://127.0.0.1:8099'));
    await tester.tap(find.byKey(const Key('unary')));
    await tester.pumpAndSettle();
    expect(find.textContaining('no route to host'), findsOneWidget);
  });

  testWidgets('the stream switch shows the last server time and the reconnect counter', (tester) async {
    final api = FakeApi();
    await tester.pumpWidget(SpikeApp(apiFor: (_) => api, defaultUrl: 'http://127.0.0.1:8099'));
    await tester.tap(find.byKey(const Key('stream')));
    await tester.pump();
    api.controller.add(1234);
    await tester.pump();
    expect(find.textContaining('last server_time_ms: 1234'), findsOneWidget);
    expect(find.textContaining('reconnects: 0'), findsOneWidget);
    await tester.tap(find.byKey(const Key('stream'))); // switch off before the test ends
    await tester.pump();
  });
}
