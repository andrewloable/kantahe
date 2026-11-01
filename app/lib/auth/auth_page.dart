import 'package:flutter/material.dart';

/// The frame of the sign-in screens: a centred column that scrolls when the keyboard is up.
class AuthPage extends StatelessWidget {
  const AuthPage({super.key, required this.title, required this.children, this.centered = false});

  final String title;
  final List<Widget> children;

  /// For a status screen whose lines are centred: the title is centred over them (a form keeps its left-aligned title over its fields).
  final bool centered;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(title, textAlign: centered ? TextAlign.center : null, style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 16),
                  ...children,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A failure or status line under the form; screen readers announce it when it appears.
class MessageLine extends StatelessWidget {
  const MessageLine(this.text, {super.key, this.error = true});

  final String text;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Semantics(
        liveRegion: true,
        child: Text(text, style: TextStyle(color: error ? scheme.error : null)),
      ),
    );
  }
}
