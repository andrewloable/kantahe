import 'dart:async';

import 'package:flutter/material.dart';
import 'package:kantahe/auth/change_password_screen.dart';
import 'package:kantahe/auth/server_screen.dart';
import 'package:kantahe/auth/sign_in_screen.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/tv/code_sign_in_screen.dart';

/// Decides what the app shows from the state alone: no server address, no session, a password the server
/// wants changed, or the app itself. A session the server refuses and a new server address both land here.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key, required this.signedIn, this.deviceName});

  /// The app, shown once the device is signed in and the password is fine.
  final WidgetBuilder signedIn;

  /// Passed to the sign-in screen (tests give a fixed name).
  final Future<String> Function()? deviceName;

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    return ListenableBuilder(
      listenable: Listenable.merge([services.serverUrl, services.auth]),
      builder: (context, _) {
        if (services.serverUrl.value == null) {
          // Reached with "Use another server": Back returns to the server that was set, instead of leaving the app. First run: Back leaves as before.
          final previous = services.serverUrl.previous;
          return PopScope(
            canPop: previous == null,
            onPopInvokedWithResult: (didPop, _) {
              if (!didPop) unawaited(services.serverUrl.restorePrevious());
            },
            child: const ServerScreen(),
          );
        }
        if (!services.auth.signedIn) return services.isTv ? CodeSignInScreen(deviceName: deviceName) : SignInScreen(deviceName: deviceName);
        if (services.auth.passwordChangeRequired) return const ChangePasswordScreen();
        return signedIn(context);
      },
    );
  }
}
