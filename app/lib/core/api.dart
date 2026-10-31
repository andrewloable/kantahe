import 'dart:async';
import 'dart:io' as io;

import 'package:connectrpc/connect.dart';
import 'package:connectrpc/io.dart';
import 'package:connectrpc/protobuf.dart';
import 'package:connectrpc/protocol/connect.dart' as protocol;
import 'package:kantahe/gen/kantahe/v1/admin.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/catalog.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/session.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/upload.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/user_library.connect.client.dart';

const _mustChange = 'password change required';

/// What the app does when the server's answer ends the session or asks for a new password.
class ApiHandlers {
  const ApiHandlers({required this.token, required this.onUnauthenticated, required this.onPasswordChange});

  final String? Function() token;

  /// A call that carried a token was refused: the session is over.
  final void Function() onUnauthenticated;

  /// The server wants the password changed before anything else.
  final void Function() onPasswordChange;
}

/// Adds the bearer token and reports the two errors every screen reacts to the same way.
/// The first interceptor of the list is the outermost one (the package's doc comment says the opposite, its
/// code does not), so the bearer one comes first and the error one, further in, sees the header it set.
List<Interceptor> apiInterceptors(ApiHandlers h) {
  AnyFn<I, O> bearer<I extends Object, O extends Object>(AnyFn<I, O> next) => (req) {
    final token = h.token();
    if (token != null && token.isNotEmpty) req.headers['authorization'] = 'Bearer $token';
    return next(req);
  };

  AnyFn<I, O> errors<I extends Object, O extends Object>(AnyFn<I, O> next) => (req) async {
    final hadToken = req.headers.get('authorization') != null;
    void onError(Object e) {
      final err = ConnectException.from(e);
      if (hadToken && err.code == Code.unauthenticated) {
        h.onUnauthenticated();
      } else if (err.code == Code.failedPrecondition && err.message == _mustChange) {
        h.onPasswordChange();
      }
    }

    try {
      final res = await next(req);
      if (res is StreamResponse<I, O>) {
        final watched = res.message.transform(
          StreamTransformer<O, O>.fromHandlers(
            handleError: (e, st, sink) {
              onError(e);
              sink.addError(e, st);
            },
          ),
        );
        return StreamResponse<I, O>(res.spec, res.headers, watched, res.trailers);
      }
      return res;
    } catch (e) {
      onError(e);
      rethrow;
    }
  };

  return [bearer, errors];
}

/// A transport that is rebuilt when the stored server address changes.
class FollowingTransport implements Transport {
  FollowingTransport(this._base, this._make);

  final String? Function() _base;
  final Transport Function(String baseUrl) _make;
  String? _builtFor;
  Transport? _inner;

  Transport _current() {
    final now = _base();
    if (now == null) throw ConnectException(Code.unavailable, 'No server address is set');
    if (_inner == null || now != _builtFor) {
      _inner = _make(now);
      _builtFor = now;
    }
    return _inner!;
  }

  @override
  Future<UnaryResponse<I, O>> unary<I extends Object, O extends Object>(Spec<I, O> spec, I input, [CallOptions? options]) =>
      _current().unary(spec, input, options);

  @override
  Future<StreamResponse<I, O>> stream<I extends Object, O extends Object>(Spec<I, O> spec, Stream<I> input, [CallOptions? options]) =>
      _current().stream(spec, input, options);
}

/// The transport S2 proved: the Connect protocol, binary protobuf, dart:io's HTTP/1.1 client, plain http allowed.
/// A new address closes the previous client, which ends its open streams; the state store then reconnects.
Transport Function(String baseUrl) httpTransportFactory(List<Interceptor> interceptors) {
  io.HttpClient? last;
  return (baseUrl) {
    last?.close(force: true);
    final http = last = io.HttpClient()..connectionTimeout = const Duration(seconds: 10);
    return protocol.Transport(baseUrl: baseUrl, codec: const ProtoCodec(), httpClient: createHttpClient(http), interceptors: interceptors);
  };
}

/// The generated clients, all on one transport.
class Api {
  Api(this.transport);

  final Transport transport;
  late final AuthServiceClient auth = AuthServiceClient(transport);
  late final SessionServiceClient session = SessionServiceClient(transport);
  late final CatalogServiceClient catalog = CatalogServiceClient(transport);
  late final AdminServiceClient admin = AdminServiceClient(transport);
  late final UploadServiceClient upload = UploadServiceClient(transport);
  late final UserLibraryServiceClient userLibrary = UserLibraryServiceClient(transport);
}
