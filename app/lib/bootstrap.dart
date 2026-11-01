import 'package:flutter/material.dart';
import 'package:kantahe/core/app_scope.dart';
import 'package:kantahe/core/brand.dart';

/// Makes the services the app needs (the keystore, the stored server address, the theme, TV detection).
typedef ServicesFactory = Future<AppServices> Function();

/// Builds the app once the services are there.
typedef AppBuilder = Widget Function(AppServices services);

/// What runs first: it draws the official splash at once, while the services are made, then swaps to the app. Without it the app drew
/// nothing until [AppServices.create] had finished, and the window showed black (or white) between the native splash and the first
/// screen. If the services cannot be made, it says so and offers Retry. [create] is called once, and again only by Retry.
class Bootstrap extends StatefulWidget {
  const Bootstrap({super.key, required this.create, required this.app});

  final ServicesFactory create;

  /// The app to show when the services are ready (main.dart: an [AppRoot] around the KantaheApp); tests give a stand-in.
  final AppBuilder app;

  @override
  State<Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends State<Bootstrap> {
  late Future<AppServices> _services;

  @override
  void initState() {
    super.initState();
    _services = _start();
  }

  // Future.sync: a factory that throws at once is a failed start, not a crash. ignore(): the FutureBuilder listens only when the next frame
  // is built, and a Future that fails before that would be reported as an unhandled error (the builder still gets the error and shows it).
  Future<AppServices> _start() => Future<AppServices>.sync(widget.create)..ignore();

  void _retry() {
    setState(() {
      _services = _start(); // a block: a setState callback must not return the Future
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<AppServices>(
      future: _services,
      builder: (context, snapshot) {
        if (snapshot.hasError) return _Failed(onRetry: _retry);
        final services = snapshot.data;
        if (services == null) return const _Splash();
        return widget.app(services);
      },
    );
  }
}

/// The logo for the splash and for the failure screen. [Semantics] names it for a screen reader.
class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Kantahe',
      // outside a MaterialApp there is no Directionality, and a label without a direction is an error as soon as a screen reader is on
      textDirection: TextDirection.ltr,
      image: true,
      child: Image.asset(kSplashLogoAsset, width: kSplashLogoWidth, excludeFromSemantics: true, filterQuality: FilterQuality.medium),
    );
  }
}

/// No material, no navigator and nothing to focus: just the colour and the logo, as the native splash draws them.
class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: kSplashBackground,
    child: Center(child: _Logo()),
  );
}

/// The services could not be made. The one thing to do is Retry, and it has the focus, so the D-pad's Select presses it.
class _Failed extends StatelessWidget {
  const _Failed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kantahe',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(brightness: Brightness.dark, scaffoldBackgroundColor: kSplashBackground),
      home: Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _Logo(),
              const SizedBox(height: 32),
              const Text('Kantahe could not start.', style: TextStyle(fontSize: 18)),
              const SizedBox(height: 16),
              FilledButton(autofocus: true, onPressed: onRetry, child: const Text('Retry')),
            ],
          ),
        ),
      ),
    );
  }
}
