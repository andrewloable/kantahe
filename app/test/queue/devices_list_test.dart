import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';
import 'package:kantahe/queue/devices_list.dart';

import 'fakes.dart';

Future<QueueRig> open(WidgetTester tester, {List<Device> devices = const [], String player = ''}) async {
  final rig = QueueRig();
  rig.setState(stateOf(devices: devices, player: player));
  await rig.pump(tester, const Scaffold(body: DevicesList()));
  return rig;
}

void main() {
  testWidgets('lists every device with its name and type', (tester) async {
    await open(
      tester,
      devices: [
        device('a', 'Kitchen phone', type: DeviceType.DEVICE_TYPE_ANDROID),
        device('b', 'Living room TV', type: DeviceType.DEVICE_TYPE_ANDROID_TV),
        device('c', 'Browser', type: DeviceType.DEVICE_TYPE_WEB),
        device('d', 'iPhone', type: DeviceType.DEVICE_TYPE_IOS),
        device('e', 'Samsung', type: DeviceType.DEVICE_TYPE_TIZEN),
        device('f', 'LG', type: DeviceType.DEVICE_TYPE_WEBOS),
      ],
    );
    for (final n in ['Kitchen phone', 'Living room TV', 'Browser', 'iPhone', 'Samsung', 'LG']) {
      expect(find.text(n), findsOneWidget, reason: n);
    }
    for (final t in ['Android', 'Android TV', 'Web', 'iOS', 'Tizen TV', 'webOS TV']) {
      expect(find.text(t), findsOneWidget, reason: t);
    }
  });

  testWidgets('marks this device, the player, and who is online, in words as well as dots', (tester) async {
    await open(tester, player: 'b', devices: [device('a', 'Phone', isCaller: true), device('b', 'TV', online: false)]);
    expect(find.text('(this device)'), findsOneWidget);
    expect(find.text('playing'), findsOneWidget);
    expect(find.text('online'), findsOneWidget);
    expect(find.text('offline'), findsOneWidget);
  });

  testWidgets('says so when there are no devices yet', (tester) async {
    await open(tester);
    expect(shows('No devices yet.'), isTrue);
  });

  testWidgets('follows the state', (tester) async {
    final rig = await open(tester);
    rig.setState(stateOf(devices: [device('a', 'New phone')]));
    await tester.pump();
    expect(find.text('New phone'), findsOneWidget);
    expect(shows('No devices yet.'), isFalse);
  });
}
