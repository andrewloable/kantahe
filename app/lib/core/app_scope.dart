import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:kantahe/core/api.dart';
import 'package:kantahe/core/auth_store.dart';
import 'package:kantahe/core/server_url.dart';
import 'package:kantahe/core/state_store.dart';
import 'package:kantahe/core/storage.dart';
import 'package:kantahe/gen/kantahe/v1/auth.pb.dart';
import 'package:kantahe/tv/tv_detect.dart';

/// The services every screen uses, created once at start-up.
class AppServices {
  AppServices({required this.serverUrl, required this.auth, required this.api, required this.state, this.isTv = false}) {
    // A token belongs to one server: a different address ends the session.
    var address = serverUrl.value;
    serverUrl.addListener(() {
      if (serverUrl.value == address) return;
      address = serverUrl.value;
      auth.signOut();
    });
  }

  /// Asks the server who the signed-in user is. Only the token is stored, so after a restart the roles
  /// (uploader, administrator) and the "must change the password" flag are unknown until this has answered.
  Future<void> loadUser() async {
    if (!auth.signedIn || auth.user != null) return;
    try {
      final res = await api.auth.me(MeRequest());
      if (res.hasUser() && auth.signedIn) auth.setUser(res.user);
    } catch (_) {
      // the interceptors end a session the server refuses; any other failure leaves things as they are
    }
  }

  final ServerUrl serverUrl;
  final AuthStore auth;
  final Api api;
  final StateStore state;

  /// An Android TV: signs in with a code and is driven with a remote.
  final bool isTv;

  /// The real services: tokens in the keystore, the address in shared preferences, one HTTP transport that
  /// follows the stored address. Loads what was stored before returning.
  static Future<AppServices> create() async {
    final isTv = await detectTv();
    final serverUrl = ServerUrl(PrefsStore(), makeTransport: httpTransportFactory(const []));
    final auth = AuthStore(SecureStore());
    await Future.wait([serverUrl.load(), auth.load()]);
    final handlers = ApiHandlers(
      token: () => auth.token,
      // the app shows the sign-in screen whenever auth.signedIn is false, the password screen when
      // auth.passwordChangeRequired is true: no navigation call is needed here
      onUnauthenticated: auth.signOut,
      onPasswordChange: auth.markMustChangePassword,
    );
    final api = Api(FollowingTransport(() => serverUrl.value, httpTransportFactory(apiInterceptors(handlers))));
    final services = AppServices(
      serverUrl: serverUrl,
      auth: auth,
      api: api,
      state: StateStore(client: api.session, auth: auth),
      isTv: isTv,
    );
    unawaited(services.loadUser()); // the app does not wait for it
    return services;
  }
}

/// Gives the services to the widgets below it.
class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.services, required super.child});

  final AppServices services;

  static AppServices of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    if (scope == null) throw FlutterError('AppScope.of() was called with a context that has no AppScope above it.');
    return scope.services;
  }

  /// Whether this is an Android TV; false when there is no [AppScope] (a widget on its own in a test).
  static bool isTvOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()?.services.isTv ?? false;

  @override
  bool updateShouldNotify(AppScope oldWidget) => services != oldWidget.services;
}

/// The root of the app: provides the services and pauses the state stream while the app is in the background.
class AppRoot extends StatefulWidget {
  const AppRoot({super.key, required this.services, required this.child});

  final AppServices services;
  final Widget child;

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // "inactive" is a short interruption (a system sheet, the iOS app switcher peek): the stream stays open.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        widget.services.state.pause();
      case AppLifecycleState.resumed:
        widget.services.state.resume();
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  Widget build(BuildContext context) => AppScope(services: widget.services, child: widget.child);
}
