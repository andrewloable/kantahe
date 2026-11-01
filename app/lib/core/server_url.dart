import 'dart:async';

import 'package:connectrpc/connect.dart';
import 'package:flutter/foundation.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.connect.client.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';

const _key = 'kantahe.server';
const _checkTimeout = Duration(seconds: 5);

/// The answer of [ServerUrl.validate].
class ServerCheck {
  const ServerCheck.ok({required String this.url, required String this.version, required this.setupRequired, this.name = ''}) : error = null;
  const ServerCheck.failed(String this.error) : url = null, version = null, name = null, setupRequired = false;

  /// The normalised address that answered.
  final String? url;
  final String? version;

  /// The name the server gives itself (--name); empty when it gives none, null when the check failed.
  final String? name;

  /// No user exists yet: the first person to sign in creates the admin.
  final bool setupRequired;

  /// What to show the user when the check failed.
  final String? error;

  bool get ok => error == null;
}

/// The address of the server, typed in by the user and kept in shared preferences.
class ServerUrl extends ChangeNotifier {
  ServerUrl(this._store, {this._makeTransport});

  final KeyValueStore _store;
  final Transport Function(String baseUrl)? _makeTransport;
  String? _value;
  bool _autoConnect = true;

  /// Whether a single server found on the network may be connected to without asking. Off after [clear] for the rest
  /// of the run (a person who chose "Use another server" would otherwise be sent straight back); never stored, so a
  /// new start has it on again.
  bool get autoConnect => _autoConnect;

  /// The stored address, without a trailing slash; null until one is set.
  String? get value => _value;

  /// An absolute http(s) address without credentials, query or fragment, no trailing slash. A missing scheme
  /// means http (a typed "192.168.1.20:8080"). Returns null for anything else.
  static String? normalize(String input) {
    var s = input.trim();
    if (s.isEmpty) return null;
    if (!s.contains('://')) s = 'http://$s';
    while (s.endsWith('/')) {
      s = s.substring(0, s.length - 1);
    }
    final Uri u;
    try {
      u = Uri.parse(s);
    } on FormatException {
      return null;
    }
    final ok = (u.scheme == 'http' || u.scheme == 'https') && u.host.isNotEmpty && u.userInfo.isEmpty && !u.hasQuery && !u.hasFragment && !s.contains(' ');
    return ok ? s : null;
  }

  Future<void> load() async {
    String? stored;
    try {
      stored = await _store.read(_key);
    } catch (_) {
      return; // unreadable storage: no address yet
    }
    final n = stored == null ? null : normalize(stored);
    if (n != _value) {
      _value = n;
      notifyListeners();
    }
  }

  /// Stores the address; throws [ArgumentError] for one that is not valid, keeping the old one.
  Future<void> set(String url) async {
    final n = normalize(url);
    if (n == null) throw ArgumentError.value(url, 'url', 'The server address must be an http(s) address');
    _value = n;
    notifyListeners();
    try {
      await _store.write(_key, n);
    } catch (_) {
      // kept in memory for this run
    }
  }

  Future<void> clear() async {
    _autoConnect = false;
    _value = null;
    notifyListeners();
    try {
      await _store.delete(_key);
    } catch (_) {
      // nothing to clean up
    }
  }

  /// Asks the server at [input] for its info (5 s limit) without storing anything.
  Future<ServerCheck> validate(String input) async {
    final url = normalize(input);
    if (url == null) return const ServerCheck.failed('Enter an address such as http://192.168.1.20:8080');
    final make = _makeTransport;
    if (make == null) throw StateError('ServerUrl has no transport factory');
    // a CancelableSignal, not a TimeoutSignal: that one leaves a timer running for its whole length
    final signal = CancelableSignal();
    try {
      final r = await AuthServiceClient(make(url))
          .getServerInfo(GetServerInfoRequest(), signal: signal)
          .timeout(
            _checkTimeout,
            onTimeout: () {
              signal.cancel(); // aborts the request itself
              throw TimeoutException('no answer in 5 seconds');
            },
          );
      return ServerCheck.ok(url: url, version: r.version, setupRequired: r.setupRequired, name: r.name);
    } on Object catch (e) {
      final timedOut = e is TimeoutException || (e is ConnectException && e.code == Code.deadlineExceeded);
      if (timedOut) return ServerCheck.failed('The server at $url did not answer within 5 seconds. Check the address and the network.');
      return ServerCheck.failed('Could not reach the server at $url. Check the address and that this device is on the same network.');
    }
  }
}
