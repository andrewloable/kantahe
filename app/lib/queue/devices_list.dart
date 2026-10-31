import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

const _types = <DeviceType, (IconData, String)>{
  DeviceType.DEVICE_TYPE_WEB: (Icons.language, 'Web'),
  DeviceType.DEVICE_TYPE_ANDROID: (Icons.smartphone, 'Android'),
  DeviceType.DEVICE_TYPE_IOS: (Icons.smartphone, 'iOS'),
  DeviceType.DEVICE_TYPE_ANDROID_TV: (Icons.tv, 'Android TV'),
  DeviceType.DEVICE_TYPE_TIZEN: (Icons.tv, 'Tizen TV'),
  DeviceType.DEVICE_TYPE_WEBOS: (Icons.tv, 'webOS TV'),
};

/// The user's devices: name, type, which one is this device, which one plays, who is online.
class DevicesList extends StatelessWidget {
  const DevicesList({super.key});

  @override
  Widget build(BuildContext context) {
    final store = AppScope.of(context).state;
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final state = store.state;
        final devices = state?.devices ?? const <Device>[];
        final playerId = state?.playerDeviceId ?? '';
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Devices', style: Theme.of(context).textTheme.titleMedium),
            if (devices.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('No devices yet.')),
            for (final d in devices)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    ExcludeSemantics(child: Icon(_types[d.type]?.$1 ?? Icons.devices_other, size: 20)),
                    Text(d.name),
                    if (d.isCaller) const Text('(this device)'),
                    Text(_types[d.type]?.$2 ?? '', style: TextStyle(color: muted)),
                    if (d.id == playerId) const Text('playing', style: TextStyle(fontWeight: FontWeight.w700)),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ExcludeSemantics(child: Icon(Icons.circle, size: 10, color: d.online ? Colors.green.shade700 : muted)),
                        const SizedBox(width: 4),
                        Text(d.online ? 'online' : 'offline', style: TextStyle(color: muted)),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}
