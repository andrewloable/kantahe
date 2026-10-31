import 'package:connectrpc/connect.dart';

/// In a code map: show the text the server sent.
class ServerText {
  const ServerText();
}

const fromServer = ServerText();

/// The sentence to show for a failed call: what the screen says for that code (a String, or [fromServer]),
/// else a general one.
String problem(Object err, Map<Code, Object> byCode) {
  if (err is! ConnectException) {
    // a socket or timeout error that never became a Connect error: the server could not be reached
    return err is Exception ? _unreachable : _general;
  }
  final mapped = byCode[err.code];
  if (mapped is ServerText) return err.message;
  if (mapped is String) return mapped;
  if (err.code == Code.invalidArgument) return err.message;
  if (err.code == Code.unavailable || err.code == Code.unknown || err.code == Code.deadlineExceeded) return _unreachable;
  return _general;
}

const _unreachable = 'Could not reach the server. Check the connection and try again.';
const _general = 'Something went wrong. Try again.';
