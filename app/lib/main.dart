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
  const KantaheApp({super.key, this.playerBuilder});

  /// The player screen (tests give a stand-in: the real one needs a WebView); null is the real one.
  final WidgetBuilder? playerBuilder;

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    final tv = services.isTv;
    ThemeData themed(Brightness brightness) {
      final base = ThemeData(brightness: brightness);
      return tv ? tvTheme(base) : base;
    }

    // light, dark or Auto (the system's choice): applies at once, on a phone and on a TV
    return ListenableBuilder(
      listenable: services.theme,
      builder: (context, _) => MaterialApp(
        title: 'Kantahe',
        theme: themed(Brightness.light),
        darkTheme: themed(Brightness.dark),
        themeMode: services.theme.mode,
        builder: tv
            ? (context, child) {
                final media = MediaQuery.of(context);
                return MediaQuery(
                  data: media.copyWith(textScaler: TextScaler.linear(media.textScaler.scale(1) * tvTextScale)),
                  child: child!,
                );
              }
            : null,
        home: AuthGate(signedIn: (_) => playerBuilder == null ? const AppShell() : AppShell(playerBuilder: playerBuilder!)),
      ),
    );
  }
}
