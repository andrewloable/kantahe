import 'package:flutter/material.dart';
import 'package:kantahe/auth/auth_gate.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/shell/app_shell.dart';
import 'package:kantahe/tv/focus.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final services = await AppServices.create();
  runApp(AppRoot(services: services, child: const KantaheApp()));
}

/// The app below an [AppRoot]: the sign-in flow first, then the shell with Library, Queue and Me.
class KantaheApp extends StatelessWidget {
  const KantaheApp({super.key});

  @override
  Widget build(BuildContext context) {
    final tv = AppScope.isTvOf(context);
    return MaterialApp(
      title: 'Kantahe',
      theme: tv ? tvTheme(ThemeData()) : null,
      builder: tv
          ? (context, child) {
              final media = MediaQuery.of(context);
              return MediaQuery(
                data: media.copyWith(textScaler: TextScaler.linear(media.textScaler.scale(1) * tvTextScale)),
                child: child!,
              );
            }
          : null,
      home: AuthGate(signedIn: (_) => const AppShell()),
    );
  }
}
