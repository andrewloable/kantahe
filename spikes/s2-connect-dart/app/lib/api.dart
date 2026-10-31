import 'dart:io';

import 'package:connectrpc/io.dart';
import 'package:connectrpc/protobuf.dart';
import 'package:connectrpc/protocol/connect.dart' as protocol;
import 'package:kantahe/gen/kantahe/v1/auth.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/session.pb.dart';

/// What the spike screen needs from the server.
abstract class SpikeApi {
  /// AuthService.GetServerInfo, as text.
  Future<String> serverInfo();

  /// SessionService.WatchState: the server_time_ms of every message.
  Stream<int> watch();

  void close();
}

/// The Connect protocol with binary protobuf over dart:io's HTTP/1.1 client, on a plain http:// address.
class ConnectApi implements SpikeApi {
  ConnectApi(String baseUrl)
      : _http = HttpClient(),
        _transport = null {
    _transport = protocol.Transport(baseUrl: baseUrl, codec: const ProtoCodec(), httpClient: createHttpClient(_http));
  }

  final HttpClient _http;
  protocol.Transport? _transport;

  @override
  Future<String> serverInfo() async {
    final r = await AuthServiceClient(_transport!).getServerInfo(GetServerInfoRequest());
    return 'version=${r.version} setup_required=${r.setupRequired}';
  }

  @override
  Stream<int> watch() => SessionServiceClient(_transport!).watchState(WatchStateRequest()).map((r) => r.state.serverTimeMs.toInt());

  @override
  void close() => _http.close(force: true);
}
