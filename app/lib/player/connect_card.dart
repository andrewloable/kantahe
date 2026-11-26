import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// A QR code of the server's address and the address itself, for people in the room who want to queue songs from a phone or tablet:
/// they scan it, open the web app and sign in. Only the address is in the QR, never a token.
class ConnectCard extends StatelessWidget {
  const ConnectCard({super.key, required this.address});

  final String address;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final qrData = address; // the key below names exactly what the QR encodes
    // The QR is 200 at most and smaller on a small screen, so that the whole card fits (a phone on its side is 360 high); about 200 of
    // height go to the padding and the text.
    final screen = MediaQuery.sizeOf(context);
    final qrSize = math.min(200.0, math.max(96.0, math.min(screen.width - 96, screen.height - 200)));
    return Card(
      key: const Key('connect-card'),
      color: theme.colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(8),
              child: QrImageView(key: ValueKey('qr:$qrData'), data: qrData, size: qrSize, backgroundColor: Colors.white),
            ),
            const SizedBox(height: 16),
            Text(address, style: theme.textTheme.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text('Scan with a phone or tablet, then sign in to queue songs.', style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
