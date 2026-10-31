import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

/// Server time minus the local monotonic clock at the moment the state arrived.
/// Adding it to the local clock gives the server's clock, whatever the device clock says.
int serverOffset(State state, int receivedAtMs) => state.serverTimeMs.toInt() - receivedAtMs;

/// Where the current song is now, in ms: a playing song moves on with the server clock, a paused one stays.
int positionNow(State state, int offsetMs, int nowMs) {
  if (!state.hasNow()) return 0;
  final now = state.now;
  final position = now.positionMs.toInt();
  if (state.status != PlayStatus.PLAY_STATUS_PLAYING) return position;
  final moved = nowMs + offsetMs - now.positionAtMs.toInt();
  return position + (moved > 0 ? moved : 0);
}
