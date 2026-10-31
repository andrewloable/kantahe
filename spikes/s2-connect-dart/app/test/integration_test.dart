// Runs against the Go test server of spikes/s2-connect-dart/server:
//   (cd ../server && go run . -addr 127.0.0.1:18099 -tick 200ms) &
//   S2_URL=http://127.0.0.1:18099 flutter test test/integration_test.dart
@TestOn('vm')
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe_s2/api.dart';

void main() {
  final url = Platform.environment['S2_URL'];
  final skip = url == null ? 'set S2_URL to the address of the Go test server' : null;

  test('unary call over plain HTTP', skip: skip, () async {
    final api = ConnectApi(url!);
    expect(await api.serverInfo(), 'version=spike setup_required=true');
    api.close();
  });

  test('server stream over plain HTTP: increasing times', skip: skip, () async {
    final api = ConnectApi(url!);
    final times = await api.watch().take(5).toList().timeout(const Duration(seconds: 20));
    api.close();
    expect(times, hasLength(5));
    for (var i = 1; i < times.length; i++) {
      expect(times[i], greaterThan(times[i - 1]));
    }
  });
}
