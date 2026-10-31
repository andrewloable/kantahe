import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/core/clock.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

import 'fakes.dart';

void main() {
  test('serverOffset is server time minus the local clock at receipt', () {
    expect(serverOffset(stateAt(1000), 250), 750);
  });

  test('a playing song advances with the server clock', () {
    final s = stateAt(1000, positionMs: 41200, positionAtMs: 1000);
    final offset = serverOffset(s, 0); // received at local 0 => offset 1000
    expect(positionNow(s, offset, 2000), 43200); // local 2000 = server 3000
  });

  test('a paused song stays where it is', () {
    final s = stateAt(1000, status: PlayStatus.PLAY_STATUS_PAUSED, positionMs: 41200, positionAtMs: 1000);
    expect(positionNow(s, serverOffset(s, 0), 2000), 41200);
  });

  test('counts from position_at_ms, not from the time the state arrived', () {
    final s = stateAt(5000, positionMs: 10000, positionAtMs: 4000); // position was 10000 at server 4000
    expect(positionNow(s, serverOffset(s, 0), 0), 11000); // local 0 = server 5000
  });

  test('never goes backwards when the clocks disagree slightly', () {
    final s = stateAt(1000, positionMs: 500, positionAtMs: 1200); // position_at is ahead of the server time
    expect(positionNow(s, serverOffset(s, 0), 0), 500);
  });

  test('is 0 with nothing playing', () {
    final s = stateAt(1, status: PlayStatus.PLAY_STATUS_PAUSED, withNow: false);
    expect(positionNow(s, 0, 100), 0);
  });
}
