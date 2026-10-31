import 'package:flutter/foundation.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/common.pb.dart';

const _tokenKey = 'kantahe.token';
const _deviceKey = 'kantahe.deviceId';

/// The signed-in device: its bearer token and id live in the platform keystore (never in preferences or
/// logs); the user is loaded on demand and is not stored.
class AuthStore extends ChangeNotifier {
  AuthStore(this._store);

  final KeyValueStore _store;
  String? _token;
  String? _deviceId;
  User? _user;
  bool _passwordChangeRequired = false;

  String? get token => _token;
  String? get deviceId => _deviceId;
  User? get user => _user;

  /// The server refuses everything but a password change; true even while the user is not loaded.
  bool get passwordChangeRequired => _passwordChangeRequired;
  bool get signedIn => _token != null;

  /// Reads the stored session. A token without a device id is not a session.
  Future<void> load() async {
    String? token;
    String? device;
    try {
      token = await _store.read(_tokenKey);
      device = await _store.read(_deviceKey);
    } catch (_) {
      return; // a broken keystore means signed out, not a crash
    }
    if (token == null || device == null) return;
    _token = token;
    _deviceId = device;
    notifyListeners();
  }

  Future<void> signIn(AuthToken auth) async {
    _token = auth.token;
    _deviceId = auth.deviceId;
    _user = auth.hasUser() ? auth.user : null;
    _passwordChangeRequired = auth.hasUser() && auth.user.mustChangePassword;
    notifyListeners();
    await _persist(() async {
      await _store.write(_tokenKey, auth.token);
      await _store.write(_deviceKey, auth.deviceId);
    });
  }

  Future<void> signOut() async {
    _token = null;
    _deviceId = null;
    _user = null;
    _passwordChangeRequired = false;
    notifyListeners();
    await _persist(() async {
      await _store.delete(_tokenKey);
      await _store.delete(_deviceKey);
    });
  }

  void setUser(User? user) {
    _user = user;
    if (user != null) _passwordChangeRequired = user.mustChangePassword;
    notifyListeners();
  }

  /// The password was changed: the server accepts everything again.
  void passwordChanged() {
    _passwordChangeRequired = false;
    final u = _user;
    if (u != null && u.mustChangePassword) _user = u.deepCopy()..mustChangePassword = false;
    notifyListeners();
  }

  /// The server refused a call until the password is changed.
  void markMustChangePassword() {
    _passwordChangeRequired = true;
    final u = _user;
    if (u != null) _user = u.deepCopy()..mustChangePassword = true;
    notifyListeners();
  }

  // The session also lives in memory for this run when the keystore fails.
  Future<void> _persist(Future<void> Function() write) async {
    try {
      await write();
    } catch (_) {}
  }
}
